import os
import time
import threading
import traceback
import json
import re
import hashlib
import urllib.request
import urllib.error
import sqlite3
from collections import Counter
from threading import Thread
from pathlib import Path

try:
    import cv2
except ImportError:
    cv2 = None

# State Management
import backend.app.state as app_state
from backend.app.state import STATE

# Database & Config
from backend.app.database import SessionLocal, FileIndex
from backend.app.config import load_config
from sqlalchemy import func, text

try:
    from PIL import Image, ExifTags
except ImportError:
    Image = None
    ExifTags = None

try:
    import fitz
except ImportError:
    fitz = None

try:
    import mutagen
except ImportError:
    mutagen = None

try:
    import pefile
except ImportError:
    pefile = None

try:
    import filetype
except ImportError:
    filetype = None

try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    import docx
except ImportError:
    docx = None

try:
    import pptx
except ImportError:
    pptx = None

STOP_WORDS = frozenset({
    "the", "and", "to", "of", "a", "in", "is", "that", "for", "it", "with", "as", "was", "on", 
    "at", "by", "an", "be", "this", "which", "or", "from", "but", "not", "are", "have", "we", 
    "all", "they", "one", "has", "were", "will", "would", "can", "if", "their", "your", "what", 
    "about", "who", "so", "when", "there", "out", "more", "do", "up", "any", "some", "into", 
    "only", "than", "them", "its", "also", "then", "been", "these", "how", "other", "could", 
    "our", "such", "may", "no", "over", "like", "most", "even", "because", "well", "where", 
    "through", "back", "much", "down", "should", "those", "under", "while", "very", "just", 
    "before", "each", "does", "why", "same", "both", "many", "after", "between", "too", "now", 
    "my", "me", "am", "i", "he", "she", "his", "hers", "him", "her", "us", "you", "yours"
})

def extract_top_keywords(text_data: str, max_words: int = None) -> str:
    if max_words is None:
        max_words = int(load_config().get("text_extraction_limit", 300))

    words = re.findall(r'\b[a-z0-9]{3,}\b', text_data.lower())
    word_counts = Counter(words)

    meaningful_words = {}
    codes_and_numbers = []

    for w, count in word_counts.items():
        if not w.isalpha():
            codes_and_numbers.append(w)
        elif w not in STOP_WORDS:
            meaningful_words[w] = count

    top_words = [word for word, _ in Counter(meaningful_words).most_common(max_words)]
    return " ".join(top_words + codes_and_numbers)

worker = None

def _process_unified_scanners(run_index: bool = False, run_face: bool = False, run_object: bool = False, run_document: bool = False):
    
    if run_face:
        app_state.face_scanner_running = True
        STATE["face_scanner_stopped"] = False
    if run_object:
        app_state.object_scanner_running = True
        STATE["object_scanner_stopped"] = False
    if run_document:
        app_state.document_scanner_running = True
        STATE["document_scanner_stopped"] = False

    try:
        import numpy as np
        from backend.app.utils.paths import get_bundled_model_path, get_ai_db_path
        from backend.app.utils.media import get_cv2_dnn_backends
            
        cfg = load_config()
        ai_db_path = get_ai_db_path()

        # --- Object Setup ---
        net, classes, object_threshold = None, None, 0.15
        if run_object:
            model_path = get_bundled_model_path("mobilenetv2-small.onnx")
            classes_path = get_bundled_model_path("imagenet_classes.txt")
            if Path(model_path).exists() and Path(classes_path).exists():
                net = cv2.dnn.readNetFromONNX(model_path)
                backend_id, target_id = get_cv2_dnn_backends()
                try:
                    net.setPreferableBackend(backend_id)
                    net.setPreferableTarget(target_id)
                except Exception:
                    pass
            with open(classes_path, 'rt') as f:
                classes = [line.strip() for line in f.readlines()]
            object_sensitivity = cfg.get("object_sensitivity", "medium")
            object_threshold = 0.10 if object_sensitivity == "high" else 0.30 if object_sensitivity == "low" else 0.15

        # --- Face Setup ---
        detector, recognizer, clusters, p_count = None, None, {}, 0
        cluster_matrix_norm = None
        cluster_ids_list = []
        face_threshold, cluster_threshold = 0.70, 0.55
        if run_face:
            yunet_path = get_bundled_model_path("face_detection_yunet_2023mar.onnx")
            sface_path = get_bundled_model_path("face_recognition_sface_2021dec.onnx")
            
            backend_id, target_id = get_cv2_dnn_backends()

            if Path(yunet_path).exists() and Path(sface_path).exists():
                try:
                    detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320), 0.9, 0.3, 5000, backend_id, target_id)
                except Exception:
                    detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320))
                face_sensitivity = cfg.get("face_sensitivity", "medium")
                face_threshold = 0.55 if face_sensitivity == "high" else 0.85 if face_sensitivity == "low" else 0.70
                detector.setScoreThreshold(face_threshold)
                try:
                    recognizer = cv2.FaceRecognizerSF.create(sface_path, "", backend_id, target_id)
                except Exception:
                    recognizer = cv2.FaceRecognizerSF.create(sface_path, "")
            else:
                print("Face recognition models not found. Ensure .onnx files are in the backend folder.")
                return

            cluster_sensitivity = cfg.get("face_clustering_sensitivity", "medium")
            cluster_threshold = 0.65 if cluster_sensitivity == "high" else 0.45 if cluster_sensitivity == "low" else 0.55

        # --- DB Initialization ---
        face_processed_ids = set()
        object_processed_ids = set()
        text_processed_ids = set()

        if run_document:
            with SessionLocal() as s:
                text_processed_ids = set(r[0] for r in s.execute(text("SELECT file_id FROM processed_text")).fetchall())

        ai_db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(str(ai_db_path), timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            if run_face:
                cursor.execute('''CREATE TABLE IF NOT EXISTS people (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT DEFAULT 'Unknown Person',
                                thumbnail_file_id INTEGER
                              )''')
                cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_people_name ON people(name)")
                cursor.execute('''CREATE TABLE IF NOT EXISTS faces (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    person_id INTEGER,
                                    file_id INTEGER,
                                    embedding_json TEXT,
                                    FOREIGN KEY(person_id) REFERENCES people(id)
                                )''')
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_faces_person_file ON faces(person_id, file_id)")
                cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_faces_unique ON faces(person_id, file_id, embedding_json)")
                cursor.execute('''CREATE TABLE IF NOT EXISTS processed_files (
                                    file_id INTEGER PRIMARY KEY
                                )''')
                cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) SELECT DISTINCT file_id FROM faces")
                cursor.execute("SELECT file_id FROM processed_files")
                face_processed_ids = set(r[0] for r in cursor.fetchall())

                cursor.execute("SELECT person_id, embedding_json FROM faces WHERE embedding_json != '[]'")
                for p_id, emb_str in cursor.fetchall():
                    if p_id not in clusters:
                        clusters[p_id] = []
                    if len(clusters[p_id]) < 15:
                        clusters[p_id].append(json.loads(emb_str))

                cursor.execute("SELECT MAX(id) FROM people")
                p_row = cursor.fetchone()
                p_count = p_row[0] if (p_row and p_row[0]) else 0

                # Build initial numpy matrix for clustering
                cluster_embs = []
                for pid, embs in clusters.items():
                    cluster_ids_list.extend([pid] * len(embs))
                    cluster_embs.extend(embs)
                if cluster_embs:
                    cm = np.array(cluster_embs)
                    cn = np.linalg.norm(cm, axis=1, keepdims=True)
                    cluster_matrix_norm = cm / np.where(cn == 0, 1, cn)

            if run_object:
                cursor.execute('''CREATE TABLE IF NOT EXISTS processed_objects (file_id INTEGER PRIMARY KEY)''')
                cursor.execute("SELECT COUNT(*) FROM processed_objects")
                if cursor.fetchone()[0] == 0:
                    with SessionLocal() as s:
                        tagged_photos = s.query(FileIndex.id).filter(FileIndex.category == 'photo', FileIndex.tags.like('%object:%')).all()
                        for (p_id,) in tagged_photos:
                            cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (p_id,))
                cursor.execute("SELECT file_id FROM processed_objects")
                object_processed_ids = set(r[0] for r in cursor.fetchall())
            conn.commit()

        # --- Build File List ---
        files_to_process = []
        if run_index:
            backup_configs = cfg.get("backup_configs", [])
            roots = [Path(c.get("backup_path", "")) for c in backup_configs if c.get("backup_path")]
            valid_roots = [r for r in roots if r.exists() and r.is_dir()]
            for root_path in valid_roots:
                if app_state.combined_scanner_stopped or STATE.get("stopped"):
                    break
                for dirpath, _, filenames in os.walk(str(root_path)):
                    if app_state.combined_scanner_stopped or STATE.get("stopped"):
                        break
                    for f in filenames:
                        files_to_process.append(os.path.join(dirpath, f))
        else:
            with SessionLocal() as s:
                q = s.query(FileIndex.path)
                categories = []
                if run_face or run_object:
                    categories.append('photo')
                if run_document:
                    categories.extend(['document', 'ebook', 'code', 'other'])
                if categories:
                    q = q.filter(FileIndex.category.in_(categories))
                for p in q.yield_per(5000):
                    if app_state.combined_scanner_stopped or STATE.get("stopped"):
                        break
                    if not run_index and run_document and STATE.get("document_scanner_stopped"):
                        break
                    if not run_index and run_face and STATE.get("face_scanner_stopped"):
                        break
                    if not run_index and run_object and STATE.get("object_scanner_stopped"):
                        break
                    files_to_process.append(p[0])

        total_files = len(files_to_process)
        if run_index:
            STATE["total"] = total_files
            STATE["current"] = 0
            STATE["indexed"] = 0
            STATE["status"] = "Indexing & Scanning..."
            STATE["running"] = True
        if run_face:
            STATE["face_scanner_total"] = total_files
            STATE["face_scanner_current"] = 0
        if run_object:
            STATE["object_scanner_total"] = total_files
            STATE["object_scanner_current"] = 0
        if run_document:
            STATE["document_scanner_total"] = total_files
            STATE["document_scanner_current"] = 0
            
        processed_count = 0
        
        with sqlite3.connect(str(ai_db_path), timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            with SessionLocal() as session:
                # Store lightweight info mapping to avoid millions of session.get() queries
                file_cache = {}
                for r in session.query(FileIndex.id, FileIndex.path, FileIndex.size, FileIndex.modified, FileIndex.category, FileIndex.filename).yield_per(5000):
                    if app_state.combined_scanner_stopped or (run_index and STATE.get("stopped")):
                        break
                    if not run_index and run_document and STATE.get("document_scanner_stopped"):
                        break
                    if not run_index and run_face and STATE.get("face_scanner_stopped"):
                        break
                    if not run_index and run_object and STATE.get("object_scanner_stopped"):
                        break
                    file_cache[r.path] = {"id": r.id, "size": r.size, "modified": r.modified, "category": r.category, "filename": r.filename}
                
                for idx, file_str in enumerate(files_to_process):
                    if run_document and STATE.get("document_scanner_stopped") and app_state.document_scanner_running:
                        app_state.document_scanner_running = False
                        STATE["document_scanner_stopped"] = False
                        STATE["document_scanner_current_file"] = ""
                        STATE["document_scanner_current"] = 0
                        STATE["document_scanner_total"] = 0
                        run_document = False

                    if run_face and STATE.get("face_scanner_stopped") and app_state.face_scanner_running:
                        app_state.face_scanner_running = False
                        STATE["face_scanner_stopped"] = False
                        STATE["face_scanner_current_file"] = ""
                        STATE["face_scanner_current"] = 0
                        STATE["face_scanner_total"] = 0
                        run_face = False

                    if run_object and STATE.get("object_scanner_stopped") and app_state.object_scanner_running:
                        app_state.object_scanner_running = False
                        STATE["object_scanner_stopped"] = False
                        STATE["object_scanner_current_file"] = ""
                        STATE["object_scanner_current"] = 0
                        STATE["object_scanner_total"] = 0
                        run_object = False

                    if not run_index and not run_document and not run_face and not run_object:
                        break

                    while STATE.get("paused"):
                        time.sleep(0.5)
                        
                        if run_document and STATE.get("document_scanner_stopped") and app_state.document_scanner_running:
                            app_state.document_scanner_running = False
                            STATE["document_scanner_stopped"] = False
                            STATE["document_scanner_current_file"] = ""
                            STATE["document_scanner_current"] = 0
                            STATE["document_scanner_total"] = 0
                            run_document = False

                        if run_face and STATE.get("face_scanner_stopped") and app_state.face_scanner_running:
                            app_state.face_scanner_running = False
                            STATE["face_scanner_stopped"] = False
                            STATE["face_scanner_current_file"] = ""
                            STATE["face_scanner_current"] = 0
                            STATE["face_scanner_total"] = 0
                            run_face = False

                        if run_object and STATE.get("object_scanner_stopped") and app_state.object_scanner_running:
                            app_state.object_scanner_running = False
                            STATE["object_scanner_stopped"] = False
                            STATE["object_scanner_current_file"] = ""
                            STATE["object_scanner_current"] = 0
                            STATE["object_scanner_total"] = 0
                            run_object = False

                        if app_state.combined_scanner_stopped or (run_index and STATE.get("stopped")):
                            break
                        if not run_index and not run_document and not run_face and not run_object:
                            break

                    if app_state.combined_scanner_stopped or (run_index and STATE.get("stopped")):
                        break
                    if not run_index and not run_document and not run_face and not run_object:
                        break
                        
                    file = Path(file_str)
                    if not file.exists():
                        continue
                        
                    if run_index:
                        STATE["current"] += 1
                        STATE["current_file"] = str(file)
                    if run_face and not STATE.get("face_scanner_stopped"):
                        STATE["face_scanner_current"] += 1
                        STATE["face_scanner_current_file"] = file.name
                    if run_object and not STATE.get("object_scanner_stopped"):
                        STATE["object_scanner_current"] += 1
                        STATE["object_scanner_current_file"] = file.name
                    if run_document and not STATE.get("document_scanner_stopped"):
                        STATE["document_scanner_current"] += 1
                        STATE["document_scanner_current_file"] = file.name

                    # --- 1. Indexing Phase ---
                    cached_info = file_cache.get(file_str)
                    db_item_id = cached_info["id"] if cached_info else None
                    db_item = None
                    
                    if run_index:
                        try:
                            f_stat = file.stat()
                            modified_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(f_stat.st_mtime))
                            file_size = str(f_stat.st_size)
                            
                            if not cached_info:
                                category = classify(file.suffix)
                                metadata, extra_tags = extract_metadata_for_file(file, category)
                                tags = build_tags(metadata, category, file.suffix, file)
                                if extra_tags: tags = ",".join(set(tags.split(",") + extra_tags))
                                
                                db_item = FileIndex(
                                    path=str(file), filename=file.name, category=category,
                                    size=file_size, modified=modified_time, extension=file.suffix,
                                    tags=tags, metadata_json=json.dumps(metadata)
                                )
                                session.add(db_item)
                                session.flush()
                                STATE["indexed"] += 1
                                if STATE["indexed"] % 500 == 0:
                                    session.commit()
                                db_item_id = db_item.id
                                file_cache[file_str] = {"id": db_item.id, "size": file_size, "modified": modified_time, "category": category, "filename": file.name}
                                cached_info = file_cache[file_str]
                            else:
                                if cached_info["size"] != file_size or cached_info["modified"] != modified_time:
                                    db_item = session.get(FileIndex, db_item_id)
                                    category = classify(file.suffix)
                                    metadata, extra_tags = extract_metadata_for_file(file, category)
                                    tags = build_tags(metadata, category, file.suffix, file)
                                    if extra_tags: tags = ",".join(set(tags.split(",") + extra_tags))
                                    db_item.size = file_size
                                    db_item.modified = modified_time
                                    db_item.metadata_json = json.dumps(metadata)
                                    db_item.tags = tags
                                    
                                    cached_info["size"] = file_size
                                    cached_info["modified"] = modified_time
                                    cached_info["category"] = category
                                    
                                    STATE["indexed"] += 1
                                    if STATE["indexed"] % 500 == 0:
                                        session.commit()
                        except Exception as e:
                            print(f"Index error on {file.name}: {e}")
                            continue

                    if not cached_info:
                        continue
                    category = cached_info["category"]

                    # --- 2. AI Phase ---
                    obj_stopped = STATE.get("object_scanner_stopped", False)
                    doc_stopped = STATE.get("document_scanner_stopped", False)
                    face_stopped = STATE.get("face_scanner_stopped", False)
                    
                    needs_text = run_document and not doc_stopped and db_item_id not in text_processed_ids and category in ['document', 'ebook', 'code', 'other']
                    needs_face = run_face and not face_stopped and db_item_id not in face_processed_ids and category == 'photo'
                    needs_object = run_object and not obj_stopped and db_item_id not in object_processed_ids and category == 'photo'
                    
                    if not needs_face and not needs_object and not needs_text:
                        continue
                        
                    # Fetch full SQLAlchemy object ONLY if we need to modify tags or it wasn't fetched yet
                    if not db_item:
                        db_item = session.get(FileIndex, db_item_id)
                        
                    filename_lower = cached_info["filename"].lower() if cached_info["filename"] else ""
                    if "screenshot" in filename_lower or "meme" in filename_lower:
                        if needs_face: cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (db_item_id,))
                        if needs_object: cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (db_item_id,))
                        processed_count += 1
                        if processed_count % 500 == 0:
                            conn.commit()
                            session.commit()
                        continue

                    # --- FTS Text Extraction (PDFs, TXT, MD, etc.) ---
                    if needs_text:
                        try:
                            extracted_text = ""
                            ext = file.suffix.lower()
                            if ext == '.pdf' and fitz is not None:
                                with fitz.open(str(file)) as doc:
                                    for page_num in range(min(15, len(doc))):
                                        extracted_text += doc[page_num].get_text() + " "
                            elif ext == '.docx' and docx is not None:
                                word_doc = docx.Document(str(file))
                                # Extract up to 500 paragraphs to keep the database size reasonable
                                for p in word_doc.paragraphs[:500]:
                                    if p.text.strip():
                                        extracted_text += p.text + " "
                            elif ext == '.pptx' and pptx is not None:
                                ppt_doc = pptx.Presentation(str(file))
                                # Extract text from up to the first 50 slides to keep database size reasonable
                                for slide in ppt_doc.slides[:50]:
                                    for shape in slide.shapes:
                                        if hasattr(shape, "text") and shape.text.strip():
                                            extracted_text += shape.text.strip() + " "
                            elif ext == '.xlsx' and openpyxl is not None:
                                wb = openpyxl.load_workbook(str(file), data_only=True, read_only=True)
                                # Extract text from up to the first 3 sheets to keep database size reasonable
                                for sheetname in wb.sheetnames[:3]:
                                    sheet = wb[sheetname]
                                    for i, row in enumerate(sheet.iter_rows(values_only=True)):
                                        if i > 200:
                                            break
                                        row_text = " ".join([str(cell).strip() for cell in row if cell is not None and str(cell).strip()])
                                        if row_text:
                                            extracted_text += row_text + " "
                                wb.close()
                            elif ext in ['.txt', '.md', '.csv', '.json', '.log', '.py', '.js', '.html']:
                                with open(str(file), 'r', encoding='utf-8', errors='ignore') as f:
                                    extracted_text = f.read(50000)
                            
                            extracted_text = extracted_text.strip()
                            if extracted_text:
                                optimized_text = extract_top_keywords(extracted_text)
                                optimized_text = optimized_text.replace('\x00', ' ')
                                session.execute(text("INSERT INTO file_text_fts (file_id, content) VALUES (:f, :c)"), {"f": db_item_id, "c": optimized_text})
                        except Exception:
                            pass 
                        finally:
                            session.execute(text("INSERT OR IGNORE INTO processed_text (file_id) VALUES (:f)"), {"f": db_item_id})
                            text_processed_ids.add(db_item_id)

                    if not needs_face and not needs_object:
                        processed_count += 1
                        if processed_count % 500 == 0: session.commit(); conn.commit()
                        continue

                    # --- OPTIMIZATION: Read file ONCE from disk for both ML models ---
                    img = None
                    try:
                        if category == 'document' and file.suffix.lower() == '.pdf' and fitz is not None:
                            doc = fitz.open(str(file))
                            page = doc.load_page(0)
                            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n) # type: ignore
                            if pix.n == 4:
                                img = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                            else:
                                img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                            doc.close()
                        else:
                            img_array = np.fromfile(str(file), np.uint8)
                            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

                            if img is None:
                                try:
                                    from PIL import Image, ImageOps
                                    with Image.open(file) as pil_img:
                                        pil_img = ImageOps.exif_transpose(pil_img)
                                        if pil_img.mode != 'RGB':
                                            pil_img = pil_img.convert('RGB')
                                        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                                except Exception:
                                    pass # Final failure will be caught by `if img is None` below
                    except Exception as e:
                        print(f"Error reading image {file.name}: {e}")
                        continue

                    if img is None:
                        if needs_face: cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (db_item_id,))
                        if needs_object: cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (db_item_id,))
                        if needs_text: session.execute(text("INSERT OR IGNORE INTO processed_text (file_id) VALUES (:f)"), {"f": db_item_id})
                        processed_count += 1
                        if processed_count % 500 == 0:
                            conn.commit()
                            session.commit()
                        continue
                        
                    # --- Run Object Classifier ---
                    if needs_object and net is not None:
                        try:
                            o_img = cv2.resize(img, (224, 224))
                            o_img = cv2.cvtColor(o_img, cv2.COLOR_BGR2RGB)
                            o_img = o_img.astype(np.float32) / 255.0
                            o_img -= np.array([0.485, 0.456, 0.406])
                            o_img /= np.array([0.229, 0.224, 0.225])
                            o_img = o_img.transpose(2, 0, 1)
                            o_img = np.expand_dims(o_img, axis=0)
                            o_img = np.ascontiguousarray(o_img)

                            net.setInput(o_img)
                            preds = net.forward().flatten()
                            exp_preds = np.exp(preds - np.max(preds))
                            probs = exp_preds / np.sum(exp_preds)
                            
                            classIds = np.argsort(probs)[-5:][::-1]
                            new_tags = []
                            for classId in classIds:
                                if probs[classId] > object_threshold:
                                    label = classes[classId].split(',')[0].strip().lower().replace(" ", "_")
                                    new_tags.append(f"object:{label}")
                                    
                            if new_tags:
                                current_tags = db_item.tags or ""
                                for tag in new_tags:
                                    if tag not in current_tags:
                                        current_tags = f"{current_tags} {tag}".strip()
                                db_item.tags = current_tags
                        except Exception as e:
                            print(f"ERROR: Failed to classify {file.name}: {e}")
                            
                        cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (db_item_id,))
                        object_processed_ids.add(db_item_id)

                    # --- Run Face Detector ---
                    if needs_face and detector is not None:
                        try:
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
                                try:
                                    success, faces = detector.detect(det_img)
                                except Exception:
                                    pass

                            if faces is not None:
                                if scale != 1.0:
                                    faces[:, :14] /= scale
                                for face in faces:
                                    face_align = recognizer.alignCrop(img, face)
                                    face_feature = recognizer.feature(face_align)
                                    embedding = face_feature[0].tolist()

                                    best_match_id = None
                                    best_sim = -1.0
                                    
                                    if cluster_matrix_norm is not None:
                                        emb_np = np.array(embedding)
                                        emb_norm = np.linalg.norm(emb_np)
                                        if emb_norm > 0:
                                            emb_np_norm = emb_np / emb_norm
                                            similarities = np.dot(cluster_matrix_norm, emb_np_norm)
                                            max_idx = np.argmax(similarities)
                                            max_sim = similarities[max_idx]
                                            
                                            if max_sim > cluster_threshold:
                                                best_sim = float(max_sim)
                                                best_match_id = cluster_ids_list[max_idx]

                                    if best_match_id is None:
                                        while True:
                                            p_count += 1
                                            cursor.execute("INSERT OR IGNORE INTO people (name) VALUES (?)", (f"Unknown Person #{p_count}",))
                                            if cursor.rowcount > 0:
                                                best_match_id = cursor.lastrowid
                                                break
                                        clusters[best_match_id] = [embedding]
                                        
                                        emb_np = np.array(embedding)
                                        emb_norm = np.linalg.norm(emb_np)
                                        emb_np_norm = emb_np / emb_norm if emb_norm > 0 else emb_np
                                        if cluster_matrix_norm is None:
                                            cluster_matrix_norm = np.array([emb_np_norm])
                                            cluster_ids_list = [best_match_id]
                                        else:
                                            cluster_matrix_norm = np.vstack([cluster_matrix_norm, emb_np_norm])
                                            cluster_ids_list.append(best_match_id)
                                    else:
                                        if len(clusters[best_match_id]) < 15:
                                            clusters[best_match_id].append(embedding)
                                            
                                            emb_np = np.array(embedding)
                                            emb_norm = np.linalg.norm(emb_np)
                                            emb_np_norm = emb_np / emb_norm if emb_norm > 0 else emb_np
                                            cluster_matrix_norm = np.vstack([cluster_matrix_norm, emb_np_norm])
                                            cluster_ids_list.append(best_match_id)
                                    cursor.execute("INSERT OR IGNORE INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)",
                                                    (best_match_id, db_item_id, json.dumps(embedding)))
                        except Exception as e:
                            print(f"Face processing error on {file.name}: {e}")
                            
                        cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (db_item_id,))
                        face_processed_ids.add(db_item_id)

                    processed_count += 1
                    if processed_count % 500 == 0:
                        session.commit()
                        conn.commit()

                session.commit()
                conn.commit()

    except Exception as e:
        print(f"CRITICAL: Unified Worker Error: {e}")
        traceback.print_exc()
    finally:
        with app_state.scanner_lock:
            if run_index:
                is_stopped = STATE.get("stopped", False) or app_state.combined_scanner_stopped
                STATE["running"] = False
                if is_stopped:
                    STATE["status"] = "Stopped"
                else:
                    STATE["status"] = "Completed"
            
            app_state.face_scanner_running = False
            app_state.object_scanner_running = False
            app_state.document_scanner_running = False
            app_state.combined_scanner_running = False
    
            STATE["face_scanner_current_file"] = ""
            STATE["object_scanner_current_file"] = ""
            STATE["document_scanner_current_file"] = ""
            STATE["face_scanner_stopped"] = False
            STATE["object_scanner_stopped"] = False
            STATE["document_scanner_stopped"] = False

            STATE["face_scanner_current"] = 0
            STATE["face_scanner_total"] = 0
            STATE["object_scanner_current"] = 0
            STATE["object_scanner_total"] = 0
            STATE["document_scanner_current"] = 0
            STATE["document_scanner_total"] = 0

            STATE["stopped"] = False
            app_state.combined_scanner_stopped = False

def classify(ext):
    ext = ext.lower()
    if ext in [".jpg",".jpeg",".png",".webp",".gif",".bmp",".tiff",".raw",".svg",".ico",".xcf"]:
        return "photo"
    if ext in [".mp4",".mkv",".avi",".mov",".wmv",".flv",".webm",".m4v",".mpg",".mpeg"]:
        return "video"
    if ext in [".mp3",".wav",".flac",".aac",".ogg",".m4a",".wma",".alac"]:
        return "audio"
    if ext in [".pdf",".doc",".docx",".txt",".rtf",".odt",".xls",".xlsx",".ppt",".pptx",".csv",".md",".log"]:
        return "document"
    if ext in [".epub",".mobi",".azw3",".cbz",".cbr",".chm"]:
        return "ebook"
    if ext in [".py",".js",".jsx",".ts",".tsx",".html",".css",".json",".xml",".yaml",".yml",".c",".cpp",".h",".java",".cs",".go",".rs",".rb",".php",".sh",".bat",".ps1",".sql",".ini"]:
        return "code"
    if ext in [".ttf",".otf",".woff",".woff2",".eot"]:
        return "font"
    if ext in [".db",".sqlite",".sqlite3",".mdb",".accdb"] or re.match(r"^\.crypt\d{2,}$", ext):
        return "database"
    if ext in [".zip",".rar",".7z",".tar",".gz",".bz2",".xz"]:
        return "compressed"
    if ext in [".exe",".msi",".apk",".dmg",".deb",".rpm",".appimage"]:
        return "installer"
    if ext in [".bin",".dat",".iso",".img",".vmdk",".vdi",".qcow2",".mpb"]:
        return "binary"
    return "other"

def build_tags(metadata, category, ext, path_obj=None):
    tags = [category or "other", ext.lower().lstrip('.')]
    if isinstance(metadata, dict):
        if "date" in metadata:
            tags.extend(metadata["date"] if isinstance(metadata["date"], list) else [metadata["date"]])
        if "camera" in metadata:
            tags.append(metadata["camera"].lower())
            
    if path_obj:
        for part in path_obj.parts[:-1]:
            words = re.findall(r'[a-zA-Z0-9]+', part)
            tags.extend([w.lower() for w in words if len(w) > 2])
            
        words = re.findall(r'[a-zA-Z0-9]+', path_obj.stem)
        tags.extend([w.lower() for w in words if len(w) > 2])
        
    return ",".join(set(tags))

def _normalize_metadata_value(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode('utf-8', errors='ignore')
        except Exception:
            return str(value)
    if isinstance(value, (list, tuple, set)):
        return [_normalize_metadata_value(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _normalize_metadata_value(v) for k, v in value.items()}
    return str(value)

def extract_metadata_for_file(path, category):
    metadata = {"file_type": category}
    tags = []

    if category == "photo" and Image is not None:
        try:
            with Image.open(path) as img:
                metadata["format"] = img.format
                metadata["mode"] = img.mode
                metadata["size"] = img.size
                if hasattr(img, "getexif"):
                    exif = img.getexif()
                    if exif:
                        if hasattr(exif, 'get_ifd'):
                            try:
                                gps_ifd = exif.get_ifd(0x8825)
                                if gps_ifd and 1 in gps_ifd and 2 in gps_ifd and 3 in gps_ifd and 4 in gps_ifd:
                                    def _dms_to_dec(dms, ref):
                                        try:
                                            d = float(dms[0])
                                            m = float(dms[1])
                                            s = float(dms[2])
                                            dec = d + (m / 60.0) + (s / 3600.0)
                                            return -dec if ref in ['S', 'W'] else dec
                                        except Exception:
                                            return None
                                    lat = _dms_to_dec(gps_ifd[2], gps_ifd[1])
                                    lon = _dms_to_dec(gps_ifd[4], gps_ifd[3])
                                    if lat is not None and lon is not None:
                                        metadata["gps"] = {"latitude": round(lat, 6), "longitude": round(lon, 6)}
                                        tags.append("location")
                            except Exception:
                                pass
                        mapped = {}
                        for tag_id, value in exif.items():
                            tag = ExifTags.TAGS.get(tag_id, tag_id)
                            if tag in ('MakerNote', 'UserComment', 'PrintImageMatching') or (isinstance(value, bytes) and len(value) > 1000):
                                continue
                            mapped[tag] = _normalize_metadata_value(value)
                        metadata["exif"] = mapped
                        date = mapped.get("DateTimeOriginal") or mapped.get("DateTime")
                        if date:
                            date_text = str(date)
                            metadata["date"] = date_text
                            if m := re.match(r"(\d{4}):(\d{2}):(\d{2})", date_text):
                                year, month, day = m.groups()
                                tags.append(f"date:{year}")
                                tags.append(f"date:{year}-{month}")
                                tags.append(f"date:{year}-{month}-{day}")
                                tags.append(f"date:{month}/{day}/{year}")
                        if "Model" in mapped:
                            metadata["camera"] = mapped["Model"]
        except Exception:
            metadata["error"] = "Failed to extract image metadata"
    else:
        metadata["file_name"] = path.name
        metadata["file_extension"] = path.suffix.lower()
        
        if category == "document":
            if path.suffix.lower() == ".pdf":
                if fitz is not None:
                    try:
                        doc = fitz.open(str(path))
                        metadata["pages"] = doc.page_count
                        doc.close()
                    except Exception:
                        pass
            elif path.suffix.lower() in [".txt", ".md", ".csv", ".log"]:
                try:
                    if path.stat().st_size < 10 * 1024 * 1024:
                        with open(path, 'rb') as f:
                            lines = f.read().count(b'\n')
                        metadata["lines"] = lines
                        metadata["pages"] = max(1, (lines + 49) // 50)
                except Exception:
                    pass
        elif category == "code":
            try:
                if path.stat().st_size < 10 * 1024 * 1024:
                    with open(path, 'rb') as f:
                        metadata["loc"] = f.read().count(b'\n')
            except Exception:
                pass
        elif category == "video":
            if cv2 is not None:
                try:
                    hw_params = []
                    if hasattr(cv2, 'CAP_PROP_HW_ACCELERATION') and hasattr(cv2, 'VIDEO_ACCELERATION_ANY'):
                        hw_params = [cv2.CAP_PROP_HW_ACCELERATION, cv2.VIDEO_ACCELERATION_ANY]

                    if hw_params:
                        cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG, hw_params)
                        if not cap.isOpened():
                            cap = cv2.VideoCapture(str(path), cv2.CAP_ANY, hw_params)
                    else:
                        cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG)

                    if not cap.isOpened():
                        cap = cv2.VideoCapture(str(path))
                    if cap.isOpened():
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        fps = cap.get(cv2.CAP_PROP_FPS)
                        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        
                        if width > 0 and height > 0:
                            metadata["resolution"] = f"{width}x{height}"
                        if fps > 0:
                            metadata["fps"] = round(fps, 2)
                            if frame_count > 0:
                                metadata["duration_seconds"] = round(frame_count / fps, 2)
                        cap.release()
                except Exception:
                    pass
                    
            if mutagen is not None:
                try:
                    vid = mutagen.File(str(path))
                    if vid is not None and hasattr(vid, 'tags') and vid.tags:
                        for key, value in vid.tags.items():
                            if not value:
                                continue
                            val_str = str(value[0]) if isinstance(value, list) else str(value)
                            if len(val_str) > 1000:
                                continue
                            if key.lower() in ['date', 'creation_time', '\xa9day', 'year']:
                                metadata['date'] = val_str
                                if len(val_str) >= 4 and val_str[:4].isdigit():
                                    tags.append(f"date:{val_str[:4]}")
                                break
                except Exception:
                    pass
        elif category == "audio" and mutagen is not None:
            try:
                audio = mutagen.File(str(path))
                if audio is not None:
                    if hasattr(audio, 'info') and audio.info is not None:
                        if hasattr(audio.info, 'length') and audio.info.length:
                            metadata['duration_seconds'] = round(audio.info.length, 2)
                        if hasattr(audio.info, 'bitrate') and audio.info.bitrate:
                            metadata['bitrate'] = audio.info.bitrate
                        if hasattr(audio.info, 'sample_rate') and audio.info.sample_rate:
                            metadata['sample_rate'] = audio.info.sample_rate
                    
                    if hasattr(audio, 'tags') and audio.tags:
                        for key, value in audio.tags.items():
                            if not value:
                                continue
                            val_str = str(value[0]) if isinstance(value, list) else str(value)
                            if len(val_str) > 1000:
                                continue
                            key_lower = key.lower()
                            
                            if key_lower in ['title', 'tit2', '\xa9nam']:
                                metadata['title'] = val_str
                            elif key_lower in ['artist', 'tpe1', '\xa9art']:
                                metadata['artist'] = val_str
                                tags.append(f"artist:{val_str.lower()}")
                            elif key_lower in ['album', 'talb', '\xa9alb']:
                                metadata['album'] = val_str
                            elif key_lower in ['genre', 'tcon', '\xa9gen']:
                                metadata['genre'] = val_str
                                tags.append(f"genre:{val_str.lower()}")
                            elif key_lower in ['date', 'tyer', 'tdrc', '\xa9day']:
                                metadata['date'] = val_str
                                tags.append(f"date:{val_str}")
            except Exception:
                pass
        elif category in ["installer", "binary"] and path.suffix.lower() in [".exe", ".dll", ".sys"] and pefile is not None:
            try:
                pe = pefile.PE(str(path), fast_load=True)
                pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_RESOURCE']])
                
                metadata["machine"] = "x64" if pe.FILE_HEADER.Machine == 0x8664 else "x86" if pe.FILE_HEADER.Machine == 0x014c else hex(pe.FILE_HEADER.Machine)
                
                if hasattr(pe, 'FileInfo'):
                    for entry in pe.FileInfo:
                        for structure in entry:
                            if hasattr(structure, 'StringTable'):
                                for st_entry in structure.StringTable:
                                    for key, val in st_entry.entries.items():
                                        try:
                                            k = key.decode('utf-8', 'ignore')
                                            v = val.decode('utf-8', 'ignore').strip()
                                            if v and k in ['FileDescription', 'CompanyName', 'FileVersion', 'ProductName']:
                                                metadata[k] = v
                                                if k == 'CompanyName':
                                                    tags.append(f"company:{v.lower().replace(' ', '')}")
                                        except Exception:
                                            pass
            except Exception:
                pass
                
    return metadata, tags

def llm_classify(metadata, ext, cfg):
    if not ext and not metadata:
        return None
        
    provider_url = cfg.get("ai_provider", "").strip()
    api_key = cfg.get("openai_api_key", "").strip()
    
    if not provider_url or provider_url.lower() == "openai":
        api_url = "https://api.openai.com/v1/chat/completions"
        if not api_key:
            return None
    else:
        api_url = provider_url.rstrip("/")
        if not api_url.endswith("/chat/completions"):
            api_url += "/chat/completions"
        if not api_key:
            api_key = "local-dummy-key"
            
    model = cfg.get("ai_model") or "gpt-4o-mini"
    
    prompt = f"Identify the specific file type or category for a file with the extension '{ext}' and the following metadata: {json.dumps(metadata) if metadata else 'None'}. Reply with a short, highly descriptive category (e.g., 'Source Code', '3D Model', 'Audio', 'Configuration', 'Disk Image'). Maximum 2 words. Only reply with the category name, no punctuation."
    
    data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 10
    }).encode("utf-8")
    
    req = urllib.request.Request(api_url, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    })
    
    if cfg.get("enable_logging"):
        import logging
        logging.info("Requesting classification data from LLM...")
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            res = json.loads(response.read().decode())
            category = res.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not category:
                category = ""
            category = category.strip()
            category = re.sub(r'[\'"\.]', '', category).title()
            if category and len(category) <= 25:
                return category
    except Exception as e:
        print(f"LLM Classification error for extension {ext}: {e}")
    return None

def background_ai_categorize(cfg):
    if not cfg.get("ai_enabled"):
        return
    session = SessionLocal()
    try:
        items = session.query(FileIndex).filter(FileIndex.category == "other").limit(500).all()
        if not items:
            return
            
        for item in items:
            if STATE.get("stopped"):
                break
            suggested = llm_classify(json.loads(item.metadata_json or "{}"), item.extension or "", cfg)
            if suggested and suggested.lower() != "other":
                item.category = suggested
                tags = set(item.tags.split(",")) if item.tags else set()
                tags.add(suggested.lower())
                item.tags = ",".join(filter(bool, tags))
                session.add(item)
        session.commit()
    finally:
        session.close()

def background_lazy_hasher():
    if STATE.get("hasher_running"):
        return
    STATE["hasher_running"] = True
    STATE["hasher_stopped"] = False
    session = SessionLocal()
    try:
        dup_sizes_query = session.query(FileIndex.size).filter(
            FileIndex.size != '0', 
            FileIndex.size.isnot(None)
        ).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1).all()
        
        dup_sizes = [row[0] for row in dup_sizes_query]
        if not dup_sizes:
            return
            
        files = []
        for i in range(0, len(dup_sizes), 900):
            chunk = dup_sizes[i:i + 900]
            chunk_files = session.query(FileIndex.id, FileIndex.path, FileIndex.metadata_json).filter(
                FileIndex.size.in_(chunk),
                func.json_extract(FileIndex.metadata_json, '$.sha256').is_(None)
            ).all()
            files.extend(chunk_files)
        
        STATE["hasher_total"] = len(files)
        STATE["hasher_current"] = 0
        STATE["hasher_current_file"] = ""

        updates = 0
        mappings = []
        for item_id, path, metadata_json in files:
            while STATE.get("paused"):
                time.sleep(0.5)
                if STATE.get("hasher_stopped") or STATE.get("stopped"):
                    break
            
            if STATE.get("hasher_stopped") or STATE.get("stopped"):
                break
            STATE["hasher_current"] += 1
            STATE["hasher_current_file"] = Path(path).name
            try:
                meta = json.loads(metadata_json or "{}")
                file_path = Path(path)
                if file_path.exists() and file_path.is_file():
                    hasher = hashlib.sha256()
                    with open(file_path, 'rb') as f:
                        for chunk in iter(lambda: f.read(4096 * 1024), b""):
                            hasher.update(chunk)
                    meta["sha256"] = hasher.hexdigest()
                    mappings.append({"id": item_id, "metadata_json": json.dumps(meta)})
                    updates += 1
                    
                    if updates >= 500:
                        session.bulk_update_mappings(FileIndex, mappings)
                        session.commit()
                        mappings = []
                        updates = 0
            except Exception as e:
                pass
        if mappings:
            session.bulk_update_mappings(FileIndex, mappings)
            session.commit()
    except Exception as e:
        print(f"Lazy hasher error: {e}")
    finally:
        STATE["hasher_running"] = False
        STATE["hasher_current_file"] = ""
        session.close()

def run():
    cfg = load_config()
    backup_configs = cfg.get("backup_configs", [])
    if not backup_configs:
        backup_configs = [{"backup_path": cfg.get("backup_path", "")}]

    roots = [Path(c.get("backup_path", "")) for c in backup_configs if c.get("backup_path")]
    valid_roots = [r for r in roots if r.exists() and r.is_dir()]

    try:
        with SessionLocal() as session:
            others = session.query(FileIndex).filter(FileIndex.category == 'other').all()
            updated_count = 0
            for item in others:
                new_cat = classify(item.extension or "")
                if new_cat != "other":
                    item.category = new_cat
                    tags = set(item.tags.split(",")) if item.tags else set()
                    tags.add(new_cat)
                    if "other" in tags:
                        tags.remove("other")
                    item.tags = ",".join(filter(bool, tags))
                    updated_count += 1
            if updated_count > 0:
                session.commit()
                print(f"Self-healed {updated_count} files from 'other' to their new categories.")
    except Exception as e:
        print(f"Pre-scan reclassification error: {e}")

    BATCH_SIZE = 500

    last_root_id = ",".join(str(r) for r in valid_roots)

    resume_index = 0
    if STATE.get("last_root") == last_root_id and STATE.get("indexed", 0) > 0:
        resume_index = STATE["indexed"]
    else:
        STATE["current"] = 0
        STATE["indexed"] = 0

    STATE["running"] = True
    STATE["paused"] = False
    STATE["stopped"] = False
    STATE["status"] = "Scanning"
    STATE["last_root"] = last_root_id
    if resume_index == 0:
        STATE["current"] = 0
        STATE["total"] = 0
    STATE["current_file"] = ""

    if not valid_roots:
        STATE["running"] = False
        STATE["status"] = "No valid backup paths configured or found."
        return

    try:
        with SessionLocal() as session:
            STATE["status"] = "Discovering files..."
            
            path_mappings = cfg.get("path_mappings")
            if path_mappings and isinstance(path_mappings, dict):
                mapped_count = 0
                for old_prefix, new_prefix in path_mappings.items():
                    items = session.query(FileIndex).filter(FileIndex.path.startswith(old_prefix)).all()
                    for item in items:
                        mapped_path = item.path.replace(old_prefix, new_prefix, 1)
                        mapped_path = mapped_path.replace('\\', os.sep).replace('/', os.sep)
                        item.path = os.path.normpath(mapped_path)
                        mapped_count += 1
                if mapped_count > 0:
                    session.commit()

            global_excluded_str = cfg.get("global_excluded_paths", "")
            global_excluded_list = [p.strip() for p in global_excluded_str.split(",") if p.strip()]
            
            raw_files = []
            for root_path in valid_roots:
                matching_config = next((c for c in backup_configs if c.get("backup_path") and Path(c["backup_path"]) == root_path), {})
                excluded_str = matching_config.get("excluded_paths", "")
                backup_excluded_list = [p.strip() for p in excluded_str.split(",") if p.strip()]
                combined_excluded_list = list(set(global_excluded_list + backup_excluded_list))

                for dirpath, dirnames, filenames in os.walk(str(root_path)):
                    if combined_excluded_list:
                        dirnames[:] = [d for d in dirnames if d not in combined_excluded_list]
                    for f in filenames:
                        raw_files.append(os.path.join(dirpath, f))
            
            raw_files.sort()

            old_total = STATE.get("total", 0)
            STATE["total"] = len(raw_files)
            STATE["status"] = "Indexing"

            start_offset = 0
            is_update_only = STATE.get("update_only")
            
            existing_paths_set = {r[0] for r in session.query(FileIndex.path).all()}
            
            if is_update_only:
                valid_roots_prefixes = [str(r) + os.sep if not str(r).endswith(os.sep) else str(r) for r in valid_roots]
                raw_files_set = set(raw_files)
                paths_to_delete = []
                unmapped_paths = []
                
                for ep in existing_paths_set:
                    if any(ep.startswith(prefix) for prefix in valid_roots_prefixes):
                        if ep not in raw_files_set:
                            paths_to_delete.append(ep)
                    else:
                        unmapped_paths.append(ep)
                                
                if unmapped_paths and not STATE.get("force_reindex"):
                    STATE["status"] = "Unmapped paths detected! Setup Path Mapping or force re-index."
                    STATE["running"] = False
                    return
                            
                if paths_to_delete:
                    if not STATE.get("force_reindex") and not cfg.get("allow_delete_missing"):
                        STATE["status"] = f"{len(paths_to_delete)} missing files. Enable mapping or force re-index to remove."
                        STATE["running"] = False
                        return

                    STATE["status"] = f"Removing {len(paths_to_delete)} missing/excluded files..."
                    for i in range(0, len(paths_to_delete), 500):
                        chunk = paths_to_delete[i:i+500]
                        session.query(FileIndex).filter(FileIndex.path.in_(chunk)).delete(synchronize_session=False)
                    session.commit()

                files_to_process = [f for f in raw_files if f not in existing_paths_set]
                
                processed_count = len(raw_files) - len(files_to_process)
                STATE["indexed"] = processed_count
                STATE["total"] = len(raw_files)
                STATE["current"] = processed_count
                start_offset = processed_count
            elif resume_index > 0 and resume_index < len(raw_files) and old_total == len(raw_files):
                start_offset = resume_index
                files_to_process = raw_files[start_offset:]
                STATE["total"] = len(raw_files)
                STATE["current"] = start_offset
            elif resume_index >= len(raw_files):
                start_offset = len(raw_files)
                files_to_process = []
                STATE["total"] = len(raw_files)
                STATE["current"] = start_offset
            else:
                files_to_process = raw_files

            for idx, file_str in enumerate(files_to_process):

                file = Path(file_str)

                if STATE["stopped"]:
                    STATE["status"] = "Stopped"
                    break

                while STATE["paused"]:
                    STATE["status"] = "Paused"
                    time.sleep(0.3)
                    if STATE["stopped"]:
                        break

                if STATE["stopped"]:
                    STATE["status"] = "Stopped"
                    break

                real_idx = start_offset + idx
                STATE["current"] = real_idx + 1
                STATE["current_file"] = str(file)
                STATE["status"] = "Indexing"

                try:
                    modified_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(file.stat().st_mtime))
                    file_size = str(file.stat().st_size)
                    category = classify(file.suffix)
                    
                    if category == "other" and filetype is not None:
                        try:
                            kind = filetype.guess(str(file))
                            if kind:
                                mime = kind.mime
                                if mime.startswith('image/'): category = "photo"
                                elif mime.startswith('video/'): category = "video"
                                elif mime.startswith('audio/'): category = "audio"
                                elif mime.startswith('font/'): category = "font"
                                elif 'pdf' in mime: category = "document"
                                elif 'zip' in mime or 'compressed' in mime or 'tar' in mime: category = "compressed"
                                elif 'executable' in mime or 'msdownload' in mime: category = "installer"
                        except Exception:
                            pass

                    metadata, extra_tags = extract_metadata_for_file(file, category)
                    tags = build_tags(metadata, category, file.suffix, file)
                    if extra_tags:
                        tags = ",".join(set(tags.split(",") + extra_tags))

                    exists = None
                    if not is_update_only and str(file) in existing_paths_set:
                        exists = session.query(FileIndex).filter_by(
                            path=str(file)
                        ).first()

                    if exists:
                        if exists.size != file_size or exists.modified != modified_time or exists.metadata_json != json.dumps(metadata) or exists.tags != tags:
                            exists.size = file_size
                            exists.modified = modified_time
                            exists.metadata_json = json.dumps(metadata)
                            exists.tags = tags
                            session.add(exists)
                    else:
                        session.add(
                            FileIndex(
                                path=str(file),
                                filename=file.name,
                                category=category,
                                size=file_size,
                                modified=modified_time,
                                extension=file.suffix,
                                tags=tags,
                                metadata_json=json.dumps(metadata)
                            )
                        )

                    if idx > 0 and idx % BATCH_SIZE == 0:
                        session.commit()
                except Exception as exc:
                    print(f"Indexer error processing {file}: {exc}")
                    traceback.print_exc()
                    session.rollback()
                    continue

            try:
                session.commit()
            except Exception as exc:
                print(f"Indexer final commit failed: {exc}")
                traceback.print_exc()
                session.rollback()

        if cfg.get("ai_enabled") and not STATE.get("stopped"):
            categorization_thread = Thread(target=background_ai_categorize, args=(cfg,), daemon=True)
            categorization_thread.start()
    except Exception as exc:
        print(f"Indexer exception: {exc}")
        traceback.print_exc()
        STATE["status"] = f"Error: {exc}"
    finally:
        STATE["running"] = False
        if STATE["stopped"]:
            STATE["status"] = "Stopped"
        elif not STATE["status"].startswith("Invalid backup path") and not STATE["status"].startswith("Error"):
            STATE["status"] = "Completed"
        STATE["indexed"] = STATE.get("current", 0)

def start_indexing():
    global worker

    if STATE["running"]:
        return

    STATE["running"] = True
    STATE["status"] = "Starting..."
    STATE["stopped"] = False
    worker = Thread(target=run, daemon=True)
    worker.start()