from fastapi import APIRouter, Body, Request, HTTPException
from pathlib import Path
import json
import sqlite3
import shutil
import sys
import threading
import time
import re
import os
import platform
from sqlalchemy import func, text, Integer

from backend.app.database import SessionLocal, FileIndex
from backend.app.config import load_config, save_config
from backend.app.utils.paths import get_ai_db_path
from backend.app.utils.cache import EXEMPLAR_CACHE
from backend.app.utils.utils import _resolve_path
import backend.app.shared_state as shared_state

router = APIRouter()

@router.get("/stats")
def stats():
    cfg = load_config()
    with SessionLocal() as s:
        results = s.query(FileIndex.category, func.count(FileIndex.id)).group_by(FileIndex.category).all()
        stats_dict = {"total": 0, "duplicates": 0, "photos": 0, "videos": 0, "audio": 0, "documents": 0, "ebooks": 0, "code": 0, "fonts": 0, "databases": 0, "compressed": 0, "installers": 0, "binaries": 0, "others": 0}
        for cat, count in results:
            stats_dict["total"] += count
            if cat == "photo": stats_dict["photos"] += count
            elif cat == "video": stats_dict["videos"] += count
            elif cat == "audio": stats_dict["audio"] += count
            elif cat == "document": stats_dict["documents"] += count
            elif cat == "ebook": stats_dict["ebooks"] += count
            elif cat == "code": stats_dict["code"] += count
            elif cat == "font": stats_dict["fonts"] += count
            elif cat == "database": stats_dict["databases"] += count
            elif cat == "compressed": stats_dict["compressed"] += count
            elif cat == "installer": stats_dict["installers"] += count
            elif cat == "binary": stats_dict["binaries"] += count
            else: stats_dict["others"] += count
            
        dup_subq = s.query(func.count(FileIndex.id).label('c')).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1).subquery()
        dup_count = s.query(func.sum(dup_subq.c.c)).scalar() or 0
        stats_dict["duplicates"] = int(dup_count)
        
        try:
            doc_count = s.execute(text("SELECT COUNT(file_id) FROM processed_text")).scalar()
            stats_dict["searchable_documents"] = int(doc_count) if doc_count else 0
        except Exception:
            stats_dict["searchable_documents"] = 0

        stats_dict["known_faces"] = 0
        stats_dict["unknown_faces"] = 0
        stats_dict["tagged_objects"] = 0
        stats_dict["untagged_media"] = 0

        try:
            untagged_count = s.query(func.count(FileIndex.id)).filter(
                FileIndex.category == 'photo',
                (FileIndex.tags.is_(None) | (FileIndex.tags == ''))
            ).scalar() or 0
            stats_dict["untagged_media"] = int(untagged_count)
        except Exception:
            pass

        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            try:
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='faces'")
                    if cursor.fetchone():
                        hidden_people = cfg.get("hidden_people")
                        if hidden_people is None:
                            hidden_people = cfg.get("ui_preferences", {}).get("hidden_people", [])
                        if not isinstance(hidden_people, list):
                            hidden_people = []
                        hidden_ids = [str(pid) for pid in hidden_people if str(pid).isdigit()]
                        hidden_clause = f" AND people.id NOT IN ({','.join(hidden_ids)})" if hidden_ids else ""
                        
                        cursor.execute(f"SELECT COUNT(DISTINCT people.id) FROM faces JOIN people ON faces.person_id = people.id WHERE people.name NOT LIKE 'Unknown Person%' {hidden_clause}")
                        stats_dict["known_faces"] = cursor.fetchone()[0] or 0
                        
                        cursor.execute(f"SELECT COUNT(DISTINCT people.id) FROM faces JOIN people ON faces.person_id = people.id WHERE people.name LIKE 'Unknown Person%' {hidden_clause}")
                        stats_dict["unknown_faces"] = cursor.fetchone()[0] or 0
                        
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='processed_objects'")
                    if cursor.fetchone():
                        cursor.execute("SELECT COUNT(DISTINCT file_id) FROM processed_objects")
                        stats_dict["tagged_objects"] = cursor.fetchone()[0] or 0
            except Exception as e:
                print(f"Error fetching AI stats: {e}")
                
        return stats_dict

@router.get("/timeline")
def timeline(category: str = "all"):
    with SessionLocal() as s:
        exif_date = func.json_extract(FileIndex.metadata_json, '$.date')
        exif_date_norm = func.replace(func.substr(exif_date, 1, 10), ':', '-')
        mod_date = func.substr(FileIndex.modified, 1, 10)
        best_date_str = func.coalesce(exif_date_norm, mod_date)
        best_date = func.date(best_date_str)
        
        q = s.query(best_date.label("date"), func.count(FileIndex.id))
        if category != "all":
            if category == "other":
                standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                q = q.filter(~FileIndex.category.in_(standard))
            elif category == "duplicates":
                dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                q = q.filter(FileIndex.size.in_(dup_sizes))
            elif category == "searchable_documents":
                q = q.filter(text("files.id IN (SELECT file_id FROM processed_text)"))
            elif category == "tagged_objects":
                q = q.filter(FileIndex.tags.like('%object:%'))
            else:
                q = q.filter(FileIndex.category == category)
        
        q = q.filter(best_date.isnot(None))
        q = q.filter(func.substr(best_date, 1, 4) > '1900')
        q = q.group_by('date').order_by('date')
        rows = q.all()
        return [{"date": r[0], "count": r[1]} for r in rows if r[0]]

@router.get("/choose-path")
def choose_path_api(mode: str = "directory"):
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        if mode == "directory":
            path = filedialog.askdirectory(parent=root, title="Select Directory")
        else:
            path = filedialog.askopenfilename(parent=root, title="Select File")
        root.destroy()
        return {"path": path or ""}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dialog failed: {exc}")

@router.get("/settings")
def settings():
    cfg = load_config()
    if not isinstance(cfg, dict):
        cfg = {}
        
    defaults = {
        "database_path": "archive.db",
        "thumbnail_path": "thumbnails",
        "enable_logging": False,
        "theme": "dark",
        "enable_photo_thumbnail_cache": False,
        "photo_thumbnail_size_limit_mb": 5,
        "allow_unverified_deletion": False,
        "animations_enabled": True,
        "show_full_timeline": False,
        "read_only_mode": True,
        "ai_enabled": False,
        "ai_provider": "",
        "ai_model": "",
        "ai_api_key": "",
        "face_sensitivity": "medium",
        "face_clustering_sensitivity": "medium",
        "object_sensitivity": "medium",
        "min_unknown_photos": 1,
        "document_scan_depth": "low",
        "text_extraction_limit": 300,
        "run_face_scan": False,
        "run_object_scan": False,
        "backup_configs": [],
        "smart_searches": [],
    }

    def merge_defaults(config, defaults_dict):
        for key, default_value in defaults_dict.items():
            if key not in config:
                config[key] = default_value
            elif isinstance(default_value, dict) and isinstance(config[key], dict):
                merge_defaults(config[key], default_value)
        return config
        
    return merge_defaults(cfg, defaults)

@router.post("/settings")
def save(data:dict):
    save_config(data)
    shared_state.LOGGING_ENABLED = data.get("enable_logging", False)
    if load_config().get("enable_logging"):
        import logging
        logging.info("Configuration file updated.")
    return {"saved":True}

@router.post("/system/test-ai")
def test_ai(payload: dict = Body(...)):
    import urllib.request
    import urllib.error
    import json
    
    provider = payload.get("ai_provider") or "https://api.openai.com/v1"
    model = payload.get("ai_model") or "gpt-3.5-turbo"
    api_key = payload.get("ai_api_key") or "dummy-key"
    
    provider = provider.rstrip("/")
    if provider.endswith("/chat/completions"):
        provider = provider[:-17]
        
    endpoint = f"{provider}/chat/completions"
    
    req_data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "Say hello!"}],
        "max_tokens": 15
    }).encode("utf-8")
    
    req = urllib.request.Request(endpoint, data=req_data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            reply = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"success": True, "reply": reply}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=e.code, detail=f"HTTP {e.code}: {err_msg}")
    except Exception as e:
        err_str = str(e) or type(e).__name__
        raise HTTPException(status_code=500, detail=f"Request failed: {err_str}")

@router.post("/system/generate-search")
def generate_search(payload: dict = Body(...)):
    import urllib.request
    import urllib.error
    import json
    
    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    cfg = load_config()
    provider = payload.get("ai_provider") or cfg.get("ai_provider") or "https://api.openai.com/v1"
    model = payload.get("ai_model") or cfg.get("ai_model") or "gpt-3.5-turbo"
    api_key = payload.get("ai_api_key") or cfg.get("ai_api_key") or "dummy-key"
    
    provider = provider.rstrip("/")
    if provider.endswith("/chat/completions"):
        provider = provider[:-17]
        
    endpoint = f"{provider}/chat/completions"
    
    system_prompt = """Translate natural language to WABS search syntax. Output ONLY the query string."""

    req_data = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Request: {prompt}"}
        ],
        "temperature": 0.0,
        "max_tokens": 50
    }).encode("utf-8")
    
    req = urllib.request.Request(endpoint, data=req_data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    })
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            reply = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"success": True, "query": reply.strip()}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=e.code, detail=f"HTTP {e.code}: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {e}")

@router.post("/clear-cache")
def clear_cache():
    import logging
    cfg = load_config()
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
    if thumb_dir.exists() and thumb_dir.is_dir():
        try:
            shutil.rmtree(thumb_dir)
            if cfg.get("enable_logging"):
                logging.info("Cleared thumbnail cache.")
            return {"cleared": True}
        except Exception as e:
            if cfg.get("enable_logging"):
                logging.error(f"Critical error: Failed to clear cache: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")
    return {"cleared": True, "message": "Cache was already empty"}

@router.post("/shutdown")
def shutdown(request: Request):
    shared_state.APP_SHUTTING_DOWN = True
    import logging
    logging_enabled = load_config().get("enable_logging")
    if hasattr(request.app.state, 'server'):
        server = request.app.state.server
        def graceful_shutdown():
            time.sleep(2.0)
            if logging_enabled:
                logging.info("Server is shutting down (Production method).")
            server.should_exit = True
        threading.Thread(target=graceful_shutdown).start()
        return {"shutdown": True, "message": "Server is shutting down..."}
    else:
        import os
        import signal
        def dev_shutdown():
            time.sleep(2.0)
            if logging_enabled:
                logging.info("Server shutdown signal sent (Development method).")
            os.kill(os.getpid(), signal.SIGTERM)
        threading.Thread(target=dev_shutdown).start()
        return {"shutdown": True, "message": "Server shutdown signal sent..."}

@router.post("/system/free-memory")
def free_memory():
    import gc
    import sqlite3
    
    gc.collect()
    
    cfg = load_config()
    db_path_str = cfg.get("database_path") or "archive.db"
    main_db_path = Path(db_path_str)
    if not main_db_path.is_absolute():
        if getattr(sys, 'frozen', False):
            main_db_path = Path(sys.executable).parent / main_db_path
        else:
            main_db_path = Path(__file__).resolve().parent.parent.parent.parent / main_db_path

    try:
        if main_db_path.exists():
            with sqlite3.connect(main_db_path) as db:
                db.execute("PRAGMA shrink_memory")
    except Exception:
        pass
        
    ai_db_path = get_ai_db_path()
    try:
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path) as db:
                db.execute("PRAGMA shrink_memory")
    except Exception:
        pass

    if cfg.get("enable_logging"):
        import logging
        logging.info("System memory released via garbage collection and SQLite cache flush.")

    return {"status": "Memory released"}

@router.post("/system/backup")
def backup_databases(payload: dict = Body(...)):
    dest_dir = payload.get("destination")
    if not dest_dir:
        raise HTTPException(status_code=400, detail="Destination directory is required.")
        
    dest_path = Path(dest_dir)
    if not dest_path.exists() or not dest_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid destination directory.")
        
    ai_db_path = get_ai_db_path()
    cfg = load_config()
    db_path_str = cfg.get("database_path") or "archive.db"
    main_db_path = Path(db_path_str)
    if not main_db_path.is_absolute():
        if getattr(sys, 'frozen', False):
            main_db_path = Path(sys.executable).parent / main_db_path
        else:
            main_db_path = Path(__file__).resolve().parent.parent.parent.parent / main_db_path

    if getattr(sys, 'frozen', False):
        config_path = Path(sys.executable).parent / "config.yaml"
    else:
        config_path = Path(__file__).resolve().parent.parent.parent.parent / "config.yaml"

    try:
        if main_db_path.exists():
            with sqlite3.connect(main_db_path) as src, sqlite3.connect(dest_path / main_db_path.name) as dst:
                src.backup(dst)
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path) as src, sqlite3.connect(dest_path / ai_db_path.name) as dst:
                src.backup(dst)
        if config_path.exists():
            shutil.copy2(config_path, dest_path / config_path.name)
            
        if load_config().get("enable_logging"):
            import logging
            logging.info("Successfully backed up databases and config.")
        return {"success": True, "message": "Databases and config successfully backed up."}
    except Exception as e:
        if load_config().get("enable_logging"):
            import logging
            logging.error(f"Critical error: Backup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")

@router.post("/system/cleanup")
def system_cleanup():
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    db_path_str = cfg.get("database_path") or "archive.db"
    main_db_path = Path(db_path_str)
    if not main_db_path.is_absolute():
        if getattr(sys, 'frozen', False):
            main_db_path = Path(sys.executable).parent / main_db_path
        else:
            main_db_path = Path(__file__).resolve().parent.parent.parent.parent / main_db_path

    missing_ids = []
    deleted_thumbnails_count = 0
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
    
    with SessionLocal() as s:
        for r in s.query(FileIndex.id, FileIndex.path).yield_per(1000):
            fid, path_str = r[0], r[1]
            file_path = _resolve_path(Path(path_str))
            if not file_path.exists():
                missing_ids.append(fid)
                
        if missing_ids:
            for i in range(0, len(missing_ids), 900):
                chunk = missing_ids[i:i + 900]
                s.query(FileIndex).filter(FileIndex.id.in_(chunk)).delete(synchronize_session=False)
                s.execute(text(f"DELETE FROM processed_text WHERE file_id IN ({','.join(map(str, chunk))})"))
                s.execute(text(f"DELETE FROM file_text_fts WHERE file_id IN ({','.join(map(str, chunk))})"))
            s.commit()

        valid_file_ids = {str(r[0]) for r in s.query(FileIndex.id).all()}

        if thumb_dir.exists():
            for f in thumb_dir.rglob('*.jpg'):
                if f.is_file() and not f.name.startswith("person_") and f.stem not in valid_file_ids:
                    try:
                        f.unlink()
                        deleted_thumbnails_count += 1
                    except Exception:
                        pass

    return {"status": "success", "removed_files": len(missing_ids), "removed_thumbnails": deleted_thumbnails_count, "message": "Cleanup and optimization complete."}

@router.post("/system/purge-unknowns")
def purge_unknowns(payload: dict = Body(...)):
    threshold = int(payload.get("threshold", 3))
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    
    if not ai_db_path.exists():
        raise HTTPException(status_code=404, detail="AI Database not found")
        
    purged_count = 0
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id 
            FROM people p 
            LEFT JOIN faces f ON p.id = f.person_id 
            WHERE p.name LIKE 'Unknown Person%' 
            GROUP BY p.id 
            HAVING COUNT(f.id) < ?
        """, (threshold,))
        
        ids_to_delete = [r[0] for r in cursor.fetchall()]
        
        if ids_to_delete:
            for i in range(0, len(ids_to_delete), 900):
                chunk = ids_to_delete[i:i+900]
                placeholders = ",".join("?" * len(chunk))
                cursor.execute(f"DELETE FROM faces WHERE person_id IN ({placeholders})", chunk)
                cursor.execute(f"DELETE FROM people WHERE id IN ({placeholders})", chunk)
                for pid in chunk:
                    EXEMPLAR_CACHE.pop(pid)
            purged_count = len(ids_to_delete)
            conn.commit()
            
    system_cleanup()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Purged {purged_count} small unknown profiles to reclaim space.")
        
    return {"status": "success", "purged_profiles": purged_count}

@router.get("/system/export-people")
def export_people():
    if load_config().get("enable_logging"):
        import logging
        logging.info("Exporting people data.")
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        return []
         
    import struct
    import base64

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id, name, thumbnail_file_id FROM people WHERE name NOT LIKE 'Unknown Person%'")
            people_rows = cursor.fetchall()
        except sqlite3.OperationalError:
            people_rows = []
        
        export_data = []
        with SessionLocal() as s:
            for pid, name, thumb_id in people_rows:
                thumb_path = None
                if thumb_id:
                    thumb_file = s.get(FileIndex, thumb_id)
                    if thumb_file:
                        thumb_path = thumb_file.path
                cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ?", (pid,))
                faces = []
                for fid, emb_json in cursor.fetchall():
                    f_item = s.get(FileIndex, fid)
                    if f_item:
                        emb_b64 = ""
                        if emb_json:
                            try:
                                floats = json.loads(emb_json)
                                if floats:
                                    packed = struct.pack(f"{len(floats)}f", *floats)
                                    emb_b64 = base64.b64encode(packed).decode("ascii")
                            except Exception:
                                pass
                        faces.append({"path": f_item.path, "embedding": emb_b64})
                if faces:
                    export_data.append({"name": name, "thumbnail_path": thumb_path, "faces": faces})
    return export_data

@router.post("/system/import-people")
def import_people(payload: list = Body(...)):
    if load_config().get("enable_logging"):
        import logging
        logging.info(f"Importing {len(payload)} people profiles.")
    
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        raise HTTPException(status_code=500, detail="AI Database not initialized.")
        
    import struct
    import base64

    imported_people_count = 0
    imported_faces_count = 0
    path_cache = {}

    try:
        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            
            with SessionLocal() as session:
                for person_data in payload:
                    name = person_data.get("name")
                    if not name:
                        continue
                    
                    cursor.execute("INSERT OR IGNORE INTO people (name) VALUES (?)", (name,))
                    cursor.execute("SELECT id FROM people WHERE name = ?", (name,))
                    row = cursor.fetchone()
                    if not row:
                        continue
                    person_id = row[0]
                    
                    EXEMPLAR_CACHE.pop(person_id)
                    
                    faces = person_data.get("faces", [])
                    for face in faces:
                        path = face.get("path")
                        embedding_data = face.get("embedding")
                        if not path:
                            continue
                            
                        if path not in path_cache:
                            file_item = session.query(FileIndex).filter(FileIndex.path == path).first()
                            path_cache[path] = file_item
                        
                        file_item = path_cache[path]
                        if not file_item:
                            continue
                        file_id = file_item.id
                            
                        if isinstance(embedding_data, str) and embedding_data:
                            try:
                                decoded = base64.b64decode(embedding_data)
                                num_floats = len(decoded) // 4
                                unpacked = struct.unpack(f"{num_floats}f", decoded)
                                embedding_json = json.dumps(list(unpacked))
                            except Exception:
                                embedding_json = "[]"
                        else:
                            embedding_json = "[]"
                            
                        cursor.execute(
                            "INSERT OR IGNORE INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)",
                            (person_id, file_id, embedding_json)
                        )
                        if cursor.rowcount > 0:
                            imported_faces_count += 1
                            
                        if name and not name.startswith("Unknown Person"):
                            current_tags = set((file_item.tags or "").split())
                            new_tag = f"person:{name}"
                            if new_tag not in current_tags:
                                current_tags.add(new_tag)
                                file_item.tags = " ".join(sorted(current_tags))
                    
                    thumb_path = person_data.get("thumbnail_path")
                    if thumb_path:
                        if thumb_path not in path_cache:
                            thumb_file = session.query(FileIndex).filter(FileIndex.path == thumb_path).first()
                            path_cache[thumb_path] = thumb_file
                        
                        thumb_item = path_cache[thumb_path]
                        if thumb_item:
                            cursor.execute("UPDATE people SET thumbnail_file_id = ? WHERE id = ?", (thumb_item.id, person_id))
                            
                    imported_people_count += 1
                
                session.commit()
            conn.commit()
    except Exception as e:
        if load_config().get("enable_logging"):
            import logging
            logging.error(f"Error importing people profiles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
        
    return {
        "success": True,
        "imported_people": imported_people_count,
        "imported_faces": imported_faces_count
    }