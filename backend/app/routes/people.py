import sqlite3
import json
from pathlib import Path
import concurrent.futures

from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.responses import FileResponse, StreamingResponse

def _get_cv2():
    try:
        import cv2
        return cv2
    except ImportError:
        return None

from backend.app.routes.files import preview, _build_item
from backend.app.config import load_config
from backend.app.database import SessionLocal, FileIndex
from backend.app.utils.utils import _resolve_path, parse_tags
from backend.app.utils.log_utils import log_operation
from backend.app.utils.media import _evaluate_image_faces, get_cv2_dnn_backends
import backend.app.state as app_state
from backend.app.state import STATE
from backend.app.utils.indexer import _process_unified_scanners, get_or_create_exemplars
from backend.app.utils.cache import EXEMPLAR_CACHE
from backend.app.utils.paths import get_bundled_model_path, get_ai_db_path
import backend.app.shared_state as shared_state
from backend.app.utils.validators import check_no_scanners_running, lock_data_operation, wait_for_stopping_scanners

router = APIRouter()

face_scanner_thread = None

def _cosine_similarity(vec1, vec2):
    import numpy as np
    v1, v2 = np.array(vec1), np.array(vec2)
    norm_1, norm_2 = np.linalg.norm(v1), np.linalg.norm(v2)
    if norm_1 == 0 or norm_2 == 0:
        return 0.0
    return float(np.dot(v1, v2) / (norm_1 * norm_2))

@router.get("/people")
def get_people(min_unknown_photos: int = 1):
    try:
        cfg = load_config()
        ai_db_path = get_ai_db_path()
        if not ai_db_path.exists():
            return []
        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.id, p.name, f.file_id, COUNT(f.id) as face_count, p.thumbnail_file_id
                FROM people p
                JOIN faces f ON p.id = f.person_id
                GROUP BY p.id
                HAVING p.name NOT LIKE 'Unknown Person%' OR face_count >= ?
                ORDER BY face_count DESC
            """, (min_unknown_photos,))
            
            results = []
            for row in cursor.fetchall():
                person_id, name, sample_file_id, count, thumb_file_id = row
                v_param = f"{thumb_file_id or sample_file_id}_{count}"
                results.append({
                    "id": person_id, 
                    "name": name, 
                    "face_count": count, 
                    "thumbnail": f"/people/{person_id}/thumbnail?v={v_param}"
                })
            return results
    except Exception as e:
        print(f"Error in /people API: {e}")
        return []

@router.get("/people/{person_id}/similar-unknowns", dependencies=[Depends(lock_data_operation)])
def get_similar_unknowns(person_id: int, threshold: float = 0.55):
    """
    Finds unknown profiles similar to a named person using cosine similarity of face exemplars.
    """
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        try:
            known_embeddings = get_or_create_exemplars(person_id, cursor)
        except sqlite3.OperationalError as e:
            if "no such table" not in str(e).lower():
                raise HTTPException(status_code=500, detail=f"Database locked or unavailable: {e}")
            raise HTTPException(status_code=404, detail="AI database tables not initialized.")
        if not known_embeddings:
            EXEMPLAR_CACHE.pop(person_id, None)
            raise HTTPException(status_code=404, detail="No faces found for this person. They may have been merged or deleted by an active background task, or only contain manually tagged photos.")

        # Fetch all unknown persons and their embeddings
        cursor.execute("""
            SELECT p.id, p.name, f.embedding_json, 
                   (SELECT COUNT(id) FROM faces WHERE person_id = p.id) as photo_count,
                   f.file_id, p.thumbnail_file_id
            FROM people p
            JOIN faces f ON p.id = f.person_id
            WHERE p.name LIKE 'Unknown Person%' AND f.embedding_json != '[]'
        """)
        
        try:
            import numpy as np
            has_numpy = True
            known_matrix = np.array(known_embeddings)
            known_norms = np.linalg.norm(known_matrix, axis=1, keepdims=True)
            known_matrix_norm = known_matrix / np.where(known_norms == 0, 1, known_norms)
        except ImportError:
            has_numpy = False
        
        similar_profiles = {}
        for unk_person_id, unk_name, unk_embedding_json, photo_count, file_id, thumb_file_id in cursor:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            if not unk_embedding_json:
                continue
            
            if has_numpy:
                unk_embedding = np.array(json.loads(unk_embedding_json))
                unk_norm = np.linalg.norm(unk_embedding)
                if unk_norm == 0:
                    continue
                unk_embedding_norm = unk_embedding / unk_norm
                similarities = np.dot(known_matrix_norm, unk_embedding_norm)
                max_sim = np.max(similarities)
            else:
                unk_embedding = json.loads(unk_embedding_json)
                max_sim = 0.0
                for known_emb in known_embeddings:
                    if known_emb:
                        sim = _cosine_similarity(known_emb, unk_embedding)
                        if sim > max_sim:
                            max_sim = sim
                            
            if max_sim >= threshold:
                if unk_person_id not in similar_profiles or max_sim > similar_profiles[unk_person_id]["similarity"]:
                    v_param = f"{thumb_file_id or file_id}_{photo_count}"
                    similar_profiles[unk_person_id] = {
                        "id": unk_person_id, "name": unk_name, "similarity": round(float(max_sim), 3),
                        "face_count": photo_count, "thumbnail": f"/people/{unk_person_id}/thumbnail?v={v_param}"
                    }
        results = list(similar_profiles.values())
        
        with SessionLocal() as s:
            for match in results:
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                # Get a sample of file IDs for this unknown person
                cursor.execute("SELECT file_id FROM faces WHERE person_id = ? LIMIT 10", (match["id"],))
                file_ids = [r[0] for r in cursor.fetchall()]
                
                if file_ids:
                    # Look up their paths and dates in the main database
                    files_info = s.query(FileIndex.path, FileIndex.modified).filter(FileIndex.id.in_(file_ids)).all()
                    match["sample_paths"] = "|".join([str(f.path) for f in files_info if f.path])
                    match["sample_dates"] = "|".join([str(f.modified) for f in files_info if f.modified])
                    
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

@router.get("/people/{person_id}/thumbnail")
def get_person_thumbnail(person_id: int, theme: str = "dark"):
    cv2 = _get_cv2()
    if cv2 is None:
        raise HTTPException(status_code=500, detail="OpenCV not installed")
        
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT thumbnail_file_id FROM people WHERE id = ?", (person_id,))
        thumb_row = cursor.fetchone()
        thumb_file_id = thumb_row[0] if thumb_row else None
            
        face_row = None
        if thumb_file_id:
            cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ? AND file_id = ? AND embedding_json != '[]' LIMIT 1", (person_id, thumb_file_id))
            face_row = cursor.fetchone()
            if not face_row:
                # User selected a manual tag as cover photo (no embedding). Return the full photo fallback.
                return preview(thumb_file_id)
            
        if not face_row:
            cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ? AND embedding_json != '[]' ORDER BY id DESC LIMIT 1", (person_id,))
            face_row = cursor.fetchone()
            
        if not face_row:
            # If they only have manual tags without embeddings, fallback to the full uncropped photo
            cursor.execute("SELECT file_id FROM faces WHERE person_id = ? ORDER BY id DESC LIMIT 1", (person_id,))
            fallback = cursor.fetchone()
            if fallback:
                return preview(fallback[0], theme)
            raise HTTPException(status_code=404, detail="Person not found")
        file_id, emb_json = face_row
        target_embedding = json.loads(emb_json)

    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    cached_face = thumb_dir / f"person_{person_id}.jpg"
    
    if cached_face.exists():
        return FileResponse(str(cached_face), media_type="image/jpeg")

    try:
        with SessionLocal() as s:
            file_item = s.query(FileIndex).filter(FileIndex.id == file_id).first()
            if not file_item:
                raise HTTPException(status_code=404, detail="Image not found")
        file_path = _resolve_path(Path(file_item.path))
        
        import numpy as np
        img_array = np.fromfile(str(file_path), np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if img is None:
            try:
                from PIL import Image, ImageOps
                with Image.open(file_path) as pil_img:
                    pil_img = ImageOps.exif_transpose(pil_img)
                    if pil_img.mode != 'RGB':
                        pil_img = pil_img.convert('RGB')
                    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            except Exception as e:
                print(f"Pillow face thumbnail fallback failed for {file_path.name}: {e}")
                
        if img is None:
            return preview(file_id, theme)

        yunet_path = get_bundled_model_path("face_detection_yunet_2023mar.onnx")
        sface_path = get_bundled_model_path("face_recognition_sface_2021dec.onnx")

        if not Path(yunet_path).exists() or not Path(sface_path).exists():
            print("Face recognition models not found. Ensure .onnx files are in the backend folder.")
            return

        backend_id, target_id = get_cv2_dnn_backends()

        try:
            detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320), 0.9, 0.3, 5000, backend_id, target_id)
        except Exception:
            detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320))
        detector.setScoreThreshold(0.5)
        try:
            recognizer = cv2.FaceRecognizerSF.create(sface_path, "", backend_id, target_id)
        except Exception:
            recognizer = cv2.FaceRecognizerSF.create(sface_path, "")

        height, width, _ = img.shape
        target_dim = 800
        scale = 1.0
        if max(height, width) > target_dim:
            scale = target_dim / max(height, width)
            new_w, new_h = int(width * scale), int(height * scale)
            det_img = cv2.resize(img, (new_w, new_h))
            detector.setInputSize((new_w, new_h))
        else:
            det_img = img
            detector.setInputSize((width, height))

        success, faces = detector.detect(det_img)

        if faces is None:
            target_dim = 320
            scale = 1.0
            if max(height, width) > target_dim:
                scale = target_dim / max(height, width)
                new_w, new_h = int(width * scale), int(height * scale)
                det_img = cv2.resize(img, (new_w, new_h))
                detector.setInputSize((new_w, new_h))
            else:
                det_img = img
                detector.setInputSize((width, height))
            success, faces = detector.detect(det_img)

        if faces is not None:
            if scale != 1.0:
                faces[:, :14] /= scale

            best_face_align = None
            best_sim = -1.0
            
            target_emb_np = np.array(target_embedding)
            target_norm = np.linalg.norm(target_emb_np)
            target_emb_norm = target_emb_np / target_norm if target_norm > 0 else target_emb_np
            
            for face in faces:
                face_align = recognizer.alignCrop(img, face)
                face_feature = recognizer.feature(face_align)
                
                emb_np = face_feature[0]
                emb_norm = np.linalg.norm(emb_np)
                emb_np_norm = emb_np / emb_norm if emb_norm > 0 else emb_np
                
                sim = float(np.dot(target_emb_norm, emb_np_norm))
                
                if sim > best_sim:
                    best_sim = sim
                    best_face_align = face_align
                    
                # Early Exit: Since the target embedding came from this exact image, 
                # the match will be nearly 1.0. We can safely skip the remaining faces!
                if best_sim > 0.98:
                    break

            if best_face_align is not None and best_sim >= 0.40:
                is_success, buffer = cv2.imencode(".jpg", best_face_align)
                if is_success:
                    with open(str(cached_face), "wb") as f:
                        f.write(buffer.tobytes())
                if cached_face.exists():
                    return FileResponse(str(cached_face), media_type="image/jpeg")

    except Exception as e:
        print(f"Failed to generate face thumbnail: {e}")

    # Fallback to the full image thumbnail if face crop fails
    return preview(file_id, theme)

@router.get("/people/{person_id}/photos")
def get_person_photos(person_id: int, offset: int = 0, limit: int = 50):
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        return []
        
    ui_prefs = cfg.get("ui_preferences") or {}
    cache_enabled = cfg.get("enable_photo_thumbnail_cache")
    if cache_enabled is None:
        cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
    cache_flag = "&tc=1" if str(cache_enabled).lower() in ("true", "1", "yes") else ""

    def generate():
        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "SELECT file_id FROM faces WHERE person_id = ? GROUP BY file_id ORDER BY file_id DESC LIMIT ? OFFSET ?", 
                    (person_id, limit, offset)
                )
                file_ids = [r[0] for r in cursor.fetchall()]
            except sqlite3.OperationalError as e:
                if "no such table" not in str(e).lower():
                    pass
                file_ids = []

        if not file_ids:
            yield "[]"
            return

        with SessionLocal() as s:
            yield "["
            first = True
            for i in range(0, len(file_ids), 900):
                if shared_state.APP_SHUTTING_DOWN:
                    break
                chunk = file_ids[i:i + 900]
                photos = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.category, FileIndex.size, FileIndex.modified, FileIndex.extension, FileIndex.tags, FileIndex.metadata_json).filter(FileIndex.id.in_(chunk)).all()
                photo_dict = {p.id: _build_item(p, cache_flag) for p in photos}
                for fid in chunk:
                    if fid in photo_dict:
                        if not first: yield ","
                        first = False
                        yield json.dumps(photo_dict[fid])
            yield "]"

    return StreamingResponse(generate(), media_type="application/json")

@router.post("/people/{person_id}/set-thumbnail", dependencies=[Depends(lock_data_operation)])
def set_person_thumbnail(person_id: int, payload: dict = Body(...)):

    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    # Invalidate cache for this person
    EXEMPLAR_CACHE.pop(person_id, None)

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("UPDATE people SET thumbnail_file_id = ? WHERE id = ?", (file_id, person_id))
        conn.commit()
        
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
    cached_face = thumb_dir / f"person_{person_id}.jpg"
    if cached_face.exists():
        try:
            cached_face.unlink()
        except Exception:
            pass
            
    return {"success": True}

@router.post("/people/{person_id}/suggest-thumbnail", dependencies=[Depends(lock_data_operation)])
def auto_suggest_thumbnail(person_id: int):
    """
    Auto-picks the best cover photo using face sizes and Laplacian sharpness metrics.
    Special code: Uses a randomized selection from top 5 covers (>=50% of max score) to prevent sticky coverage locks.
    """
    cv2 = _get_cv2()
    if cv2 is None:
        raise HTTPException(status_code=500, detail="OpenCV not installed")
        
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        # Retrieve current thumbnail file ID
        cursor.execute("SELECT thumbnail_file_id FROM people WHERE id = ?", (person_id,))
        thumb_row = cursor.fetchone()
        current_thumb_id = thumb_row[0] if thumb_row else None
        
        # Fetch up to 30 recent faces to evaluate (to avoid locking the CPU for too long)
        cursor.execute("""
            SELECT file_id 
            FROM faces 
            WHERE person_id = ? AND embedding_json != '[]' 
            ORDER BY id DESC LIMIT 30
        """, (person_id,))
        face_rows = cursor.fetchall()

    if not face_rows:
        raise HTTPException(status_code=404, detail="No valid faces found for this person.")

    yunet_path = get_bundled_model_path("face_detection_yunet_2023mar.onnx")

    import concurrent.futures
    import random
    
    file_ids = [r[0] for r in face_rows]
    file_items = []
    with SessionLocal() as s:
        # Batch-query all file records for efficiency
        db_files = s.query(FileIndex).filter(FileIndex.id.in_(file_ids)).all()
        for f in db_files:
            file_items.append((f.id, _resolve_path(Path(f.path))))
                
    file_scores = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_evaluate_image_faces, fp, yunet_path): fid for fid, fp in file_items if fp.exists()}
        for future in concurrent.futures.as_completed(futures):
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                for f in futures: f.cancel()
                raise HTTPException(status_code=400, detail="Operation cancelled")
            fid = futures[future]
            try:
                metrics = future.result()
                if metrics:
                    max_score = max(fm["score"] for fm in metrics)
                    file_scores[fid] = max_score
            except Exception:
                pass

    if not file_scores:
        raise HTTPException(status_code=400, detail="Could not determine a suitable thumbnail.")

    # Sort files by best face score descending
    sorted_files = sorted(file_scores.items(), key=lambda x: x[1], reverse=True)
    best_score = sorted_files[0][1]

    # Select candidates with score >= 50% of the best score, limit to top 5
    candidates = [fid for fid, score in sorted_files if score >= 0.5 * best_score][:5]

    # Try to pick a candidate different from the current thumbnail
    filtered_candidates = [fid for fid in candidates if fid != current_thumb_id]
    if filtered_candidates:
        selected_file_id = random.choice(filtered_candidates)
    else:
        selected_file_id = random.choice(candidates)

    selected_score = file_scores[selected_file_id]

    # Save the selected thumbnail back to the database
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE people SET thumbnail_file_id = ? WHERE id = ?", (selected_file_id, person_id))
        conn.commit()
        
    # Clear the old cached thumbnail so it regenerates on next load
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
    cached_face = thumb_dir / f"person_{person_id}.jpg"
    if cached_face.exists():
        try:
            cached_face.unlink()
        except Exception:
            pass
            
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Auto-suggested cover photo {selected_file_id} for person {person_id} with score {round(selected_score, 2)}")
        
    return {"success": True, "new_thumbnail_id": selected_file_id, "score": selected_score}

@router.post("/people/{person_id}/remove-photo", dependencies=[Depends(lock_data_operation)])
def remove_person_photo(person_id: int, payload: dict = Body(...)):

    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    # Invalidate cache for this person
    EXEMPLAR_CACHE.pop(person_id, None)

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        person_row = cursor.fetchone()
        person_name = person_row[0] if person_row else None
        
        cursor.execute("DELETE FROM faces WHERE person_id = ? AND file_id = ?", (person_id, file_id))
        deleted_count = cursor.rowcount
        
        cursor.execute("SELECT thumbnail_file_id FROM people WHERE id = ?", (person_id,))
        thumb_row = cursor.fetchone()
        if thumb_row and thumb_row[0] == file_id:
            cursor.execute("UPDATE people SET thumbnail_file_id = NULL WHERE id = ?", (person_id,))
            
        conn.commit()
        
    # Always ensure the tag is removed from the main index if it's a known person
    if person_name and not person_name.startswith("Unknown Person"):
        with SessionLocal() as s:
            f = s.query(FileIndex).filter(FileIndex.id == file_id).first()
            if f and f.tags:
                current_tags = parse_tags(f.tags)
                tag_to_remove = f"person:{person_name}"
                if tag_to_remove in current_tags:
                    current_tags.remove(tag_to_remove)
                    f.tags = ",".join(sorted(current_tags))
                    s.commit()

        thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
        cached_face = thumb_dir / f"person_{person_id}.jpg"
        if cached_face.exists():
            try:
                cached_face.unlink()
            except Exception:
                pass

    log_operation(f"Manually untagged person '{person_name}' (ID {person_id}) from file ID {file_id}", user_logs_enabled=cfg.get("enable_logging"))
    return {"success": True, "removed": deleted_count}

@router.post("/people/{person_id}/add-photo", dependencies=[Depends(lock_data_operation)])
def add_person_photo(person_id: int, payload: dict = Body(...)):

    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        person_row = cursor.fetchone()
        if not person_row:
            raise HTTPException(status_code=404, detail="Person not found")
        person_name = person_row[0]
        
        cursor.execute("SELECT id FROM faces WHERE person_id = ? AND file_id = ?", (person_id, file_id))
        already_in_faces = cursor.fetchone() is not None
        if not already_in_faces:
            # Insert empty array since it's a manual tag (bypasses similarity checks)
            cursor.execute("INSERT OR IGNORE INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)", (person_id, file_id, "[]"))
            conn.commit()
        
    if person_name and not person_name.startswith("Unknown Person"):
        with SessionLocal() as s:
            f = s.query(FileIndex).filter(FileIndex.id == file_id).first()
            if f:
                current_tags = parse_tags(f.tags)
                new_tag = f"person:{person_name}"
                if new_tag not in current_tags:
                    current_tags.add(new_tag)
                    f.tags = ",".join(sorted(current_tags))
                    s.commit()

    log_operation(f"Manually tagged person '{person_name}' (ID {person_id}) on file ID {file_id}", user_logs_enabled=cfg.get("enable_logging"))
    return {"success": True}

@router.post("/people/{person_id}/rename", dependencies=[Depends(lock_data_operation)])
def rename_person(person_id: int, payload: dict = Body(...)):
    """
    Renames a profile in the AI DB and dynamically updates associated tags in the file index.
    """
    new_name = payload.get("name", "Unknown Person").strip()
    if not new_name:
        new_name = "Unknown Person"

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        old_name_row = cursor.fetchone()
        if not old_name_row:
            raise HTTPException(status_code=404, detail="Person not found (may have been merged or deleted by a background task).")
        old_name = old_name_row[0]
        
        cursor.execute("SELECT DISTINCT file_id FROM faces WHERE person_id = ?", (person_id,))
        file_ids = [r[0] for r in cursor.fetchall()]
        
        # Case-insensitive check to see if the target name already exists
        cursor.execute("SELECT id FROM people WHERE name COLLATE NOCASE = ? AND id != ?", (new_name, person_id))
        existing_person = cursor.fetchone()
        
        if existing_person:
            target_id = existing_person[0]
            # Invalidate both caches if a merge happens
            EXEMPLAR_CACHE.pop(target_id, None)
            # Auto-Merge: Reassign all faces to the existing person, then delete the duplicate
            cursor.execute("UPDATE OR IGNORE faces SET person_id = ? WHERE person_id = ?", (target_id, person_id))
            cursor.execute("DELETE FROM faces WHERE person_id = ?", (person_id,))
            cursor.execute("DELETE FROM people WHERE id = ?", (person_id,))
        else:
            # Standard Rename
            cursor.execute("UPDATE people SET name = ? WHERE id = ?", (new_name, person_id))
            
        EXEMPLAR_CACHE.pop(person_id, None)
        conn.commit()
        
    if file_ids:
        with SessionLocal() as s:
            for i in range(0, len(file_ids), 900):
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                chunk = file_ids[i:i + 900]
                files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
                mappings = []
                for f_id, tags in files_to_update:
                    current_tags_set = parse_tags(tags)
                    if old_name and not old_name.startswith("Unknown Person"):
                        current_tags_set.discard(f"person:{old_name}")
                    if new_name and not new_name.startswith("Unknown Person"):
                        current_tags_set.add(f"person:{new_name}")
                        
                    new_tags_str = ",".join(sorted(current_tags_set))
                    if new_tags_str != tags:
                        mappings.append({"id": f_id, "tags": new_tags_str})
                if mappings:
                    s.bulk_update_mappings(FileIndex, mappings)
                    s.commit()
            
    return {"success": True, "name": new_name}

@router.delete("/people/{person_id}", dependencies=[Depends(lock_data_operation)])
def delete_person(person_id: int):
    """
    Deletes a person profile, clears their face embeddings, and purges their tags from all files.
    """
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    EXEMPLAR_CACHE.pop(person_id, None)

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        old_name_row = cursor.fetchone()
        old_name = old_name_row[0] if old_name_row else "Unknown Person"
        
        cursor.execute("SELECT DISTINCT file_id FROM faces WHERE person_id = ?", (person_id,))
        file_ids = [r[0] for r in cursor.fetchall()]
        
        # Wipe the face embeddings and the person
        cursor.execute("DELETE FROM faces WHERE person_id = ?", (person_id,))
        cursor.execute("DELETE FROM people WHERE id = ?", (person_id,))
        conn.commit()
        
    # Clean up any tags from the main index
    if file_ids and old_name and not old_name.startswith("Unknown Person"):
        with SessionLocal() as s:
            for i in range(0, len(file_ids), 900):
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                chunk = file_ids[i:i + 900]
                files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
                mappings = []
                for f_id, tags in files_to_update:
                    if tags:
                        current_tags_set = parse_tags(tags)
                        current_tags_set.discard(f"person:{old_name}")
                        new_tags_str = ",".join(sorted(current_tags_set))
                        if new_tags_str != tags:
                            mappings.append({"id": f_id, "tags": new_tags_str})
                if mappings:
                    s.bulk_update_mappings(FileIndex, mappings)
                    s.commit()
            
    return {"success": True, "deleted_id": person_id}

@router.post("/people/merge", dependencies=[Depends(lock_data_operation)])
def merge_people(payload: dict = Body(...)):
    """
    Merges multiple profiles into a single primary profile, updating all corresponding face IDs.
    """
    person_ids = payload.get("person_ids", [])
    if not person_ids or len(person_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two person IDs are required for merging.")
    
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Started merging {len(person_ids)} profiles.")
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        placeholders = ",".join("?" * len(person_ids))
        cursor.execute(f"SELECT id, name FROM people WHERE id IN ({placeholders})", person_ids)
        people_rows = cursor.fetchall()
        
        if not people_rows:
             raise HTTPException(status_code=404, detail="People not found.")
             
        people_rows.sort(key=lambda p: (0 if p[1] and not p[1].startswith("Unknown Person") else 1, p[0]))
        primary_id = people_rows[0][0]
        ids_to_merge = [p[0] for p in people_rows if p[0] != primary_id]
        
        for old_id in ids_to_merge:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            cursor.execute("UPDATE OR IGNORE faces SET person_id = ? WHERE person_id = ?", (primary_id, old_id))
            cursor.execute("DELETE FROM faces WHERE person_id = ?", (old_id,))
            cursor.execute("DELETE FROM people WHERE id = ?", (old_id,))
            EXEMPLAR_CACHE.pop(old_id, None)
            
        EXEMPLAR_CACHE.pop(primary_id, None)
        conn.commit()
        
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Merged {len(ids_to_merge)} unknown profiles into person {primary_id}.")
        
    return {"success": True, "merged_into": primary_id}

@router.post("/people/cluster-unknowns", dependencies=[Depends(lock_data_operation)])
def cluster_unknowns(payload: dict = Body(...)):
    """
    Automatically groups and merges similar unknown profiles.
    Special code: Uses a MAX_EMBS_PER_PERSON=15 cap to prevent massive OOM memory spikes during matrix multiplication.
    """
    person_ids = payload.get("person_ids", [])
    threshold = payload.get("threshold", 0.55)
    if not person_ids:
        return {"merged_count": 0, "results": []}
        
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info("Started clustering unknown profiles.")
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=60) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        # Fetch ONLY Unknown People embeddings to cluster them together
        cursor.execute("""
            SELECT p.id, p.name, f.embedding_json
            FROM people p
            JOIN faces f ON p.id = f.person_id
            WHERE p.name LIKE 'Unknown Person%' AND f.embedding_json != '[]'
        """)
        
        all_rows = cursor.fetchall()
        if not all_rows:
            return {"merged_count": 0, "message": "No unknown persons to compare against.", "results": []}
            
        import numpy as np
        
        person_embs = {}
        person_names = {}
        
        # OOM PREVENTION: Cap the maximum number of embeddings per cluster.
        # Unknown profiles are highly cohesive. 15 faces perfectly represent the cluster's variations
        # and completely prevent massive O(N^2) memory spikes during the matrix dot product.
        MAX_EMBS_PER_PERSON = 15
        
        for pid, pname, emb_json in all_rows:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            if pid not in person_embs:
                person_embs[pid] = []
            if len(person_embs[pid]) < MAX_EMBS_PER_PERSON:
                try:
                    emb = json.loads(emb_json)
                    if emb and len(emb) == 128:
                        person_embs[pid].append(emb)
                except Exception:
                    continue
            person_names[pid] = pname
            
        # Sort all PIDs by number of faces DESC so smaller clusters merge into larger ones
        sorted_pids = sorted(person_embs.keys(), key=lambda k: len(person_embs[k]), reverse=True)
        
        canonical_embs = []
        canonical_pids = []
        for pid in sorted_pids:
            canonical_embs.extend(person_embs[pid])
            canonical_pids.extend([pid] * len(person_embs[pid]))
            
        # Sanity check to prevent Numpy AxisError if the operation is cancelled instantly and no embeddings are gathered
        if not canonical_embs:
            return {"merged_count": 0, "results": []}
            
        # Cast to float32 to instantly halve the memory requirements of the matrix
        k_matrix = np.array(canonical_embs, dtype=np.float32)
        k_norms = np.linalg.norm(k_matrix, axis=1, keepdims=True)
        k_matrix_norm = k_matrix / np.where(k_norms == 0, 1, k_norms)
        
        merged_count = 0
        results = []
        merged_away = set() # Track already-merged IDs so they aren't processed twice
        
        # Order target IDs ascending by size so small cards fold into large ones
        target_ids = sorted([pid for pid in person_ids if pid in person_embs], key=lambda k: len(person_embs[k]))
        
        # Batch targets to prevent out-of-memory errors on massive 30,000x30,000 matrix operations
        batch_size_embs = 250
        batches, current_batch_pids = [], []
        current_batch_embs_count = 0
        
        for pid in target_ids:
            num_embs = len(person_embs[pid])
            if current_batch_embs_count + num_embs > batch_size_embs and current_batch_pids:
                batches.append(current_batch_pids)
                current_batch_pids = []
                current_batch_embs_count = 0
            current_batch_pids.append(pid)
            current_batch_embs_count += num_embs
        if current_batch_pids:
            batches.append(current_batch_pids)
            
        for batch_pids in batches:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            valid_batch_pids = [pid for pid in batch_pids if pid not in merged_away]
            if not valid_batch_pids:
                continue
                
            batch_embs = []
            for pid in valid_batch_pids:
                batch_embs.extend(person_embs[pid])
                
            # Skip empty batches to prevent numpy matrix dimension errors on instant cancellation
            if not batch_embs:
                continue

            unk_matrix = np.array(batch_embs, dtype=np.float32)
            unk_norms = np.linalg.norm(unk_matrix, axis=1, keepdims=True)
            unk_matrix_norm = unk_matrix / np.where(unk_norms == 0, 1, unk_norms)
 
            similarities = np.dot(k_matrix_norm, unk_matrix_norm.T)
            
            col_offset = 0
            for pid in valid_batch_pids:
                if pid in merged_away:
                    col_offset += len(person_embs[pid])
                    continue
                    
                num_embs = len(person_embs[pid])
                if num_embs == 0:
                    continue
                    
                pid_similarities = similarities[:, col_offset:col_offset+num_embs]
                col_offset += num_embs
                
                max_sims_per_canonical = np.max(pid_similarities, axis=1)
                sorted_indices = np.argsort(max_sims_per_canonical)[::-1]
                
                best_match_id = None
                max_sim = 0.0
                
                for idx in sorted_indices:
                    match_pid = canonical_pids[idx]
                    sim = float(max_sims_per_canonical[idx])
                    if sim < threshold:
                        break # Sorted DESC, so anything below is a guaranteed fail
                        
                    if match_pid != pid and match_pid not in merged_away:
                        best_match_id = match_pid
                        max_sim = sim
                        break
                        
                if best_match_id is not None:
                    cursor.execute("UPDATE OR IGNORE faces SET person_id = ? WHERE person_id = ?", (best_match_id, pid))
                    cursor.execute("DELETE FROM faces WHERE person_id = ?", (pid,))
                    cursor.execute("DELETE FROM people WHERE id = ?", (pid,))
                    EXEMPLAR_CACHE.pop(pid, None)
                    EXEMPLAR_CACHE.pop(best_match_id, None)
                    merged_away.add(pid)
                    merged_count += 1
                    results.append({
                        "id": pid, "merged_into": best_match_id, 
                        "name": person_names[best_match_id], "similarity": round(max_sim, 3)
                    })
                    
        conn.commit()
        
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Clustered {merged_count} unknown profiles together.")
        
    return {"merged_count": merged_count, "results": results}

@router.post("/people/reclassify", dependencies=[Depends(lock_data_operation)])
def reclassify_people(payload: dict = Body(...)):
    """
    Re-evaluates every single face from the target unknown profiles against all named profiles and other unknowns.
    Useful for breaking apart incorrectly merged profiles or adjusting to a new similarity threshold.
    """
    person_ids = payload.get("person_ids", [])
    threshold = payload.get("threshold", 0.55)
    
    if not person_ids:
        return {"reclassified_count": 0}
        
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Started reclassifying {len(person_ids)} unknown profiles.")
    ai_db_path = get_ai_db_path()
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=60) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        # 1. Fetch all embeddings for the target unknown profiles in safe chunks
        faces_to_reclassify = []
        for i in range(0, len(person_ids), 900):
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            chunk = person_ids[i:i+900]
            placeholders = ",".join("?" * len(chunk))
            cursor.execute(f"""
                SELECT f.id, f.file_id, f.embedding_json, p.id
                FROM faces f
                JOIN people p ON p.id = f.person_id
                WHERE p.id IN ({placeholders}) AND p.name LIKE 'Unknown Person%' AND f.embedding_json != '[]'
            """, chunk)
            faces_to_reclassify.extend(cursor.fetchall())
            
        if not faces_to_reclassify:
            return {"reclassified_count": 0, "message": "No valid faces to reclassify."}
            
        target_person_ids = list(set([r[3] for r in faces_to_reclassify]))
        
        # 2. Fetch the exemplar embeddings for all OTHER profiles (Named and Unselected Unknowns)
        cursor.execute("SELECT DISTINCT person_id FROM faces WHERE embedding_json != '[]'")
        all_pids = [r[0] for r in cursor.fetchall()]
        
        target_ids_set = set(person_ids)
        clusters = {}
        for pid in all_pids:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            if pid in target_ids_set:
                continue
            curated_embs = get_or_create_exemplars(pid, cursor)
            if curated_embs:
                clusters[pid] = curated_embs
            else:
                EXEMPLAR_CACHE.pop(pid, None)
            
        # 3. Delete the old targeted profiles and their faces
        for pid in target_person_ids:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            cursor.execute("DELETE FROM faces WHERE person_id = ?", (pid,))
            cursor.execute("DELETE FROM people WHERE id = ?", (pid,))
            EXEMPLAR_CACHE.pop(pid, None)
            old_thumb = thumb_dir / f"person_{pid}.jpg"
            if old_thumb.exists():
                try: old_thumb.unlink()
                except Exception: pass
            
        # Determine the current max person ID for generating new Unknowns
        cursor.execute("SELECT MAX(id) FROM people")
        p_row = cursor.fetchone()
        p_count = p_row[0] if (p_row and p_row[0]) else 0
        
        import numpy as np
        
        cluster_embs = []
        cluster_ids_list = []
        for pid, embs in clusters.items():
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            cluster_ids_list.extend([pid] * len(embs))
            cluster_embs.extend(embs)
            
        if cluster_embs:
            cm = np.array(cluster_embs, dtype=np.float32)
            cn = np.linalg.norm(cm, axis=1, keepdims=True)
            cluster_matrix_norm = cm / np.where(cn == 0, 1, cn)
        else:
            cluster_matrix_norm = None
            
        # 4. Re-cluster the faces
        reclassified_count = 0
        files_to_tag = {}
        affected_person_ids = set()
        
        cursor.execute("SELECT id, name FROM people WHERE name NOT LIKE 'Unknown Person%'")
        named_people_map = {r[0]: r[1] for r in cursor.fetchall()}
        
        for face_id, file_id, emb_json, old_pid in faces_to_reclassify:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            embedding = json.loads(emb_json)
            # Sanity check against corrupted or empty JSON embeddings to prevent matrix math crashes
            if not embedding:
                continue
            emb_np = np.array(embedding, dtype=np.float32)
            emb_norm = np.linalg.norm(emb_np)
            emb_np_norm = emb_np / emb_norm if emb_norm > 0 else emb_np
            
            best_match_id = None
            
            if cluster_matrix_norm is not None:
                similarities = np.dot(cluster_matrix_norm, emb_np_norm)
                max_idx = np.argmax(similarities)
                max_sim = similarities[max_idx]
                
                if max_sim >= threshold:
                    best_match_id = cluster_ids_list[max_idx]
                    
            if best_match_id is None:
                while True:
                    p_count += 1
                    cursor.execute("INSERT OR IGNORE INTO people (name) VALUES (?)", (f"Unknown Person #{p_count}",))
                    if cursor.rowcount > 0:
                        best_match_id = cursor.lastrowid
                        break
                clusters[best_match_id] = [embedding]
                if cluster_matrix_norm is None:
                    cluster_matrix_norm = np.array([emb_np_norm])
                    cluster_ids_list = [best_match_id]
                else:
                    cluster_matrix_norm = np.vstack([cluster_matrix_norm, emb_np_norm])
                    cluster_ids_list.append(best_match_id)
            else:
                if len(clusters[best_match_id]) < 15:
                    clusters[best_match_id].append(embedding)
                    cluster_matrix_norm = np.vstack([cluster_matrix_norm, emb_np_norm])
                    cluster_ids_list.append(best_match_id)
                    
            cursor.execute("INSERT OR IGNORE INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)",
                            (best_match_id, file_id, emb_json))
            reclassified_count += 1
            affected_person_ids.add(best_match_id)
            
            if best_match_id in named_people_map:
                name = named_people_map[best_match_id]
                if name not in files_to_tag:
                    files_to_tag[name] = set()
                files_to_tag[name].add(file_id)
                
        conn.commit()
        
        # Pop affected person IDs' cached exemplars
        for pid in affected_person_ids:
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            EXEMPLAR_CACHE.pop(pid, None)
        
    if files_to_tag:
        with SessionLocal() as s:
            for name, f_ids in files_to_tag.items():
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                f_ids_list = list(f_ids)
                for i in range(0, len(f_ids_list), 900):
                    chunk = f_ids_list[i:i + 900]
                    files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
                    mappings = []
                    for f_id, tags in files_to_update:
                        current_tags_set = parse_tags(tags)
                        new_tag = f"person:{name}"
                        if new_tag not in current_tags_set:
                            current_tags_set.add(new_tag)
                            mappings.append({"id": f_id, "tags": ",".join(sorted(current_tags_set))})
                    if mappings:
                        s.bulk_update_mappings(FileIndex, mappings)
                        s.commit()
                        
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Reclassified {reclassified_count} faces from unknown profiles.")
                        
    return {"reclassified_count": reclassified_count}

@router.post("/scan-faces")
def scan_faces():
    import threading
    cv2 = _get_cv2()
    if cv2 is None:
        raise HTTPException(status_code=500, detail="OpenCV is required for face recognition.")
    global face_scanner_thread
    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or app_state.combined_scanner_running or STATE.get("running") or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            raise HTTPException(status_code=400, detail="Another scanning process is already running. Please stop it before starting a new one.")
        app_state.face_scanner_running = True
        app_state.combined_scanner_stopped = False
        STATE["stopped"] = False
        STATE["face_scanner_stopped"] = False
        STATE["paused"] = False
        face_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": False, "run_face": True, "run_object": False, "run_document": False}, daemon=True)
        face_scanner_thread.start()
        
    if load_config().get("enable_logging"):
        import logging
        logging.info("Face scanning and clustering started in the background.")
        
    return {"message": "Face scanning and clustering started in the background."}

@router.post("/stop-scan-faces")
def stop_scan_faces():
    with app_state.scanner_lock:
        if not app_state.face_scanner_running:
            return {"message": "Face scanner is not running or already stopped."}
        STATE["face_scanner_stopped"] = True
        if not app_state.combined_scanner_running:
            STATE["stopped"] = True
            app_state.combined_scanner_stopped = True
            
    if load_config().get("enable_logging"):
        import logging
        logging.info("Stopping face scanner.")
        
    return {"message": "Stopping face scanner."}

@router.post("/reset-face-scanner-progress", dependencies=[Depends(lock_data_operation)])
def reset_face_scanner_progress():

    try:
        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path, timeout=15) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("CREATE TABLE IF NOT EXISTS processed_files (file_id INTEGER PRIMARY KEY)")
                conn.execute("DELETE FROM processed_files")
                conn.commit()
                
        if load_config().get("enable_logging"):
            import logging
            logging.info("Face scanner progress has been reset.")
            
        return {"message": "Face scanner progress has been reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reset face scanner progress: {e}")