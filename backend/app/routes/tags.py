from fastapi import APIRouter, Body, HTTPException, Depends
from sqlalchemy import text
import re
import sqlite3
import threading

from backend.app.database import SessionLocal, FileIndex
from pydantic import BaseModel
import backend.app.state as app_state
from backend.app.state import STATE
from backend.app.utils.indexer import _process_unified_scanners
from backend.app.utils.paths import get_ai_db_path
from backend.app.config import load_config
from backend.app.utils.utils import parse_tags, find_file_by_path_smart
from backend.app.utils.log_utils import log_operation
from backend.app.utils.validators import check_no_scanners_running, lock_data_operation, wait_for_stopping_scanners
import backend.app.shared_state as shared_state

router = APIRouter()

class TagUpdateRequest(BaseModel):
    file_ids: list[int]
    tags: list[str]

@router.post("/tags/add", dependencies=[Depends(lock_data_operation)])
def add_tags(req: TagUpdateRequest):
    """
    Manually appends tags to a batch of files.
    """
    with SessionLocal() as s:
        for i in range(0, len(req.file_ids), 900):
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            chunk = req.file_ids[i:i + 900]
            files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files_to_update:
                current_tags = parse_tags(tags)
                for tag in req.tags:
                    formatted_tag = f"object:{tag}" if ":" not in tag else tag
                    current_tags.add(formatted_tag)
                new_tags_str = ",".join(sorted(current_tags))
                if new_tags_str != tags:
                    mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    
    log_operation(f"Manually added tags {req.tags} to {len(req.file_ids)} file(s)", user_logs_enabled=load_config().get("enable_logging"))
    return {"status": "success"}

@router.post("/tags/remove", dependencies=[Depends(lock_data_operation)])
def remove_tags(req: TagUpdateRequest):
    """
    Manually removes tags from a batch of files.
    """
    with SessionLocal() as s:
        for i in range(0, len(req.file_ids), 900):
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            chunk = req.file_ids[i:i + 900]
            files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files_to_update:
                if not tags:
                    continue
                current_tags = parse_tags(tags)
                for tag in req.tags:
                    formatted_tag = f"object:{tag}" if ":" not in tag else tag
                    current_tags.discard(formatted_tag)
                new_tags_str = ",".join(sorted(current_tags))
                if new_tags_str != tags:
                    mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    
    log_operation(f"Manually removed tags {req.tags} from {len(req.file_ids)} file(s)", user_logs_enabled=load_config().get("enable_logging"))
    return {"status": "success"}

@router.delete("/tags/objects/all", dependencies=[Depends(lock_data_operation)])
def clear_all_object_tags():
    """
    Purges all AI-generated object: tags across the entire file index.
    """
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info("User started purging all AI object tags.")

    with SessionLocal() as s:
        file_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.tags.like('%object:%')).all()]
        chunk_size = 1000
        for i in range(0, len(file_ids), chunk_size):
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            chunk = file_ids[i:i + chunk_size]
            files = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files:
                if tags:
                    current_tags = parse_tags(tags)
                    tags_list = [t for t in current_tags if not t.startswith('object:')]
                    new_tags_str = ",".join(sorted(tags_list))
                    if new_tags_str != tags:
                        mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Successfully cleared all object tags from {len(file_ids)} files.")
    return {"status": "success", "message": "All object tags have been cleared."}

@router.delete("/tags/objects/{tag_name}", dependencies=[Depends(lock_data_operation)])
def delete_object_tag_globally(tag_name: str):
    """
    Deletes a specific tag globally from all files in the archive.
    """
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"User started deleting object tag '{tag_name}' globally.")

    tag_to_delete = tag_name
    if not tag_to_delete.startswith("object:"):
        tag_to_delete = f"object:{tag_to_delete}"

    with SessionLocal() as s:
        file_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.tags.like(f'%{tag_to_delete}%')).all()]
        chunk_size = 1000
        for i in range(0, len(file_ids), chunk_size):
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            chunk = file_ids[i:i + chunk_size]
            files = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files:
                if tags:
                    current_tags = parse_tags(tags)
                    tags_list = [t for t in current_tags if t != tag_to_delete]
                    new_tags_str = ",".join(sorted(tags_list))
                    if new_tags_str != tags:
                        mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Successfully deleted object tag '{tag_to_delete}' globally from {len(file_ids)} files.")
    return {"status": "success", "deleted_tag": tag_to_delete}

@router.get("/tags/objects")
def get_object_tags():
    with SessionLocal() as s:
        try:
            # Query the indexed FTS vocabulary for instantaneous lookup without scanning the files table
            vocab_rows = s.execute(text("SELECT term FROM files_fts_vocab WHERE term LIKE 'object:%'")).fetchall()
            if vocab_rows:
                return sorted(list({r[0] for r in vocab_rows if r[0]}))
        except Exception:
            pass

        unique_tags = set()
        for r in s.query(FileIndex.tags).filter(FileIndex.tags.like('%object:%')).yield_per(1000):
            if shared_state.APP_SHUTTING_DOWN:
                break
            if r[0]:
                for tag in parse_tags(r[0]):
                    if tag.startswith('object:'):
                        unique_tags.add(tag)
        return sorted(list(unique_tags))

def export_tags_internal(s):
    files = s.query(FileIndex.path, FileIndex.tags).filter(FileIndex.tags != None, FileIndex.tags != '').yield_per(1000)
    export_data = []
    for path, tags in files:
        if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
            raise HTTPException(status_code=400, detail="Operation cancelled")
        tag_list = parse_tags(tags)
        if tag_list:
            export_data.append({"path": path, "tags": sorted(list(tag_list))})
    return export_data

def import_tags_internal(s, tags_data):
    imported_count = 0
    for item in tags_data:
        if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
            raise HTTPException(status_code=400, detail="Operation cancelled")
        path = item.get("path")
        tags_list = item.get("tags")
        if not path or not tags_list:
            continue
        
        # Handle cases where tags might still be a string (robustness)
        if isinstance(tags_list, str):
            imported_tags = parse_tags(tags_list)
        else:
            imported_tags = {t.strip() for t in tags_list if t.strip()}
            
        if not imported_tags:
            continue
            
        file_record = find_file_by_path_smart(s, path)
        if file_record:
            current_tags = parse_tags(file_record.tags)
            combined = current_tags.union(imported_tags)
            new_tags_str = ",".join(sorted(combined))
            if new_tags_str != file_record.tags:
                file_record.tags = new_tags_str
                imported_count += 1
    s.commit()
    return imported_count

@router.get("/system/export-tags", dependencies=[Depends(lock_data_operation)])
def export_tags():
    """
    Exports all manual and object tags and their file paths to JSON.
    """
    if load_config().get("enable_logging"):
        import logging
        logging.info("Exporting tags data.")
    with SessionLocal() as s:
        return export_tags_internal(s)

@router.post("/system/import-tags", dependencies=[Depends(lock_data_operation)])
def import_tags(payload: list = Body(...)):
    """
    Imports tags from JSON backup.
    Special code: Uses a Smart Path Fallback Matcher so tags survive root folder/drive letter changes.
    """
    with SessionLocal() as s:
        imported_count = import_tags_internal(s, payload)
    return {"success": True, "imported_files": imported_count}

object_scanner_thread = None

@router.post("/scan-objects")
def scan_objects():
    global object_scanner_thread
    from backend.app.utils.paths import check_models_exist
    check_models_exist("object")
    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if app_state.object_scanner_running or app_state.face_scanner_running or app_state.document_scanner_running or app_state.combined_scanner_running or STATE.get("running") or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            raise HTTPException(status_code=400, detail="Another scanning process is already running. Please stop it before starting a new one.")
        app_state.object_scanner_running = True
        app_state.combined_scanner_stopped = False
        STATE["stopped"] = False
        STATE["object_scanner_stopped"] = False
        STATE["paused"] = False
        object_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": False, "run_face": False, "run_object": True, "run_document": False}, daemon=True)
        object_scanner_thread.start()
        
    if load_config().get("enable_logging"):
        import logging
        logging.info("Object scanning started in the background.")
        
    return {"message": "Object scanning started in the background."}

@router.post("/stop-scan-objects")
def stop_scan_objects():
    with app_state.scanner_lock:
        if not app_state.object_scanner_running:
            return {"message": "Object scanner is not running or already stopped."}
        STATE["object_scanner_stopped"] = True
        if not app_state.combined_scanner_running:
            STATE["stopped"] = True
            app_state.combined_scanner_stopped = True
            
    if load_config().get("enable_logging"):
        import logging
        logging.info("Stopping object scanner.")
        
    return {"message": "Stopping object scanner."}

@router.post("/reset-object-scanner-progress", dependencies=[Depends(lock_data_operation)])
def reset_object_scanner_progress():

    try:
        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path, timeout=15) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("CREATE TABLE IF NOT EXISTS processed_objects (file_id INTEGER PRIMARY KEY)")
                conn.execute("DELETE FROM processed_objects")
                conn.commit()
                
        if load_config().get("enable_logging"):
            import logging
            logging.info("Object scanner progress has been reset.")
            
        return {"message": "Object scanner progress has been reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reset object scanner progress: {e}")