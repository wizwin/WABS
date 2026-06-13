from fastapi import APIRouter, Body, HTTPException
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

router = APIRouter()

class TagUpdateRequest(BaseModel):
    file_ids: list[int]
    tags: list[str]

@router.post("/tags/add")
def add_tags(req: TagUpdateRequest):
    with SessionLocal() as s:
        for i in range(0, len(req.file_ids), 900):
            chunk = req.file_ids[i:i + 900]
            files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files_to_update:
                current_tags = set((tags or "").split())
                for tag in req.tags:
                    formatted_tag = f"object:{tag}" if ":" not in tag else tag
                    current_tags.add(formatted_tag)
                new_tags_str = " ".join(sorted(current_tags))
                if new_tags_str != tags:
                    mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    return {"status": "success"}

@router.post("/tags/remove")
def remove_tags(req: TagUpdateRequest):
    with SessionLocal() as s:
        for i in range(0, len(req.file_ids), 900):
            chunk = req.file_ids[i:i + 900]
            files_to_update = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files_to_update:
                if not tags:
                    continue
                current_tags = set((tags or "").split())
                for tag in req.tags:
                    formatted_tag = f"object:{tag}" if ":" not in tag else tag
                    current_tags.discard(formatted_tag)
                new_tags_str = " ".join(sorted(current_tags))
                if new_tags_str != tags:
                    mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    return {"status": "success"}

@router.delete("/tags/objects/all")
def clear_all_object_tags():
    with SessionLocal() as s:
        file_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.tags.like('%object:%')).all()]
        chunk_size = 1000
        for i in range(0, len(file_ids), chunk_size):
            chunk = file_ids[i:i + chunk_size]
            files = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files:
                if tags:
                    tags_list = [t for t in re.split(r'[\s,]+', tags) if not t.startswith('object:')]
                    new_tags_str = " ".join(filter(bool, tags_list))
                    if new_tags_str != tags:
                        mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    return {"status": "success", "message": "All object tags have been cleared."}

@router.delete("/tags/objects/{tag_name}")
def delete_object_tag_globally(tag_name: str):
    tag_to_delete = tag_name
    if not tag_to_delete.startswith("object:"):
        tag_to_delete = f"object:{tag_to_delete}"

    with SessionLocal() as s:
        file_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.tags.like(f'%{tag_to_delete}%')).all()]
        chunk_size = 1000
        for i in range(0, len(file_ids), chunk_size):
            chunk = file_ids[i:i + chunk_size]
            files = s.query(FileIndex.id, FileIndex.tags).filter(FileIndex.id.in_(chunk)).all()
            mappings = []
            for f_id, tags in files:
                if tags:
                    tags_list = [t for t in re.split(r'[\s,]+', tags) if t != tag_to_delete]
                    new_tags_str = " ".join(filter(bool, tags_list))
                    if new_tags_str != tags:
                        mappings.append({"id": f_id, "tags": new_tags_str})
            if mappings:
                s.bulk_update_mappings(FileIndex, mappings)
                s.commit()
    return {"status": "success", "deleted_tag": tag_to_delete}

@router.get("/tags/objects")
def get_object_tags():
    with SessionLocal() as s:
        unique_tags = set()
        for r in s.query(FileIndex.tags).filter(FileIndex.tags.like('%object:%')).yield_per(1000):
            if r[0]:
                for tag in r[0].split():
                    if tag.startswith('object:'):
                        unique_tags.add(tag)
        return sorted(list(unique_tags))

@router.get("/system/export-tags")
def export_tags():
    if load_config().get("enable_logging"):
        import logging
        logging.info("Exporting tags data.")
    with SessionLocal() as s:
        files = s.query(FileIndex.path, FileIndex.tags).filter(FileIndex.tags != None, FileIndex.tags != '').yield_per(1000)
        export_data = [{"path": path, "tags": tags} for path, tags in files]
        return export_data

@router.post("/system/import-tags")
def import_tags(payload: list = Body(...)):
    imported_count = 0
    with SessionLocal() as s:
        for item in payload:
            path = item.get("path")
            new_tags = item.get("tags")
            if not path or not new_tags: continue
            file_record = s.query(FileIndex).filter(FileIndex.path == path).first()
            if file_record:
                current_tags = set((file_record.tags or "").split())
                imported_tags = set(new_tags.split())
                new_tags_str = " ".join(sorted(current_tags.union(imported_tags)))
                if new_tags_str != file_record.tags:
                    file_record.tags = new_tags_str
                    imported_count += 1
        s.commit()
    return {"success": True, "imported_files": imported_count}

object_scanner_thread = None

@router.post("/scan-objects")
def scan_objects():
    global object_scanner_thread
    with app_state.scanner_lock:
        if app_state.object_scanner_running or app_state.face_scanner_running or app_state.document_scanner_running or app_state.combined_scanner_running or STATE.get("running"):
            raise HTTPException(status_code=400, detail="Another scanning process is already running. Please stop it before starting a new one.")
        app_state.object_scanner_running = True
        app_state.combined_scanner_stopped = False
        STATE["stopped"] = False
        STATE["object_scanner_stopped"] = False
        STATE["paused"] = False
        object_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": False, "run_face": False, "run_object": True, "run_document": False})
        object_scanner_thread.start()
    return {"message": "Object scanning started in the background."}

@router.post("/stop-scan-objects")
def stop_scan_objects():
    with app_state.scanner_lock:
        STATE["object_scanner_stopped"] = True
        if not app_state.object_scanner_running:
            return {"message": "Object scanner is not running or already stopped."}
    return {"message": "Stopping object scanner."}

@router.post("/reset-object-scanner-progress")
def reset_object_scanner_progress():
    with app_state.scanner_lock:
        if app_state.document_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.combined_scanner_running or STATE.get("running"):
            raise HTTPException(status_code=400, detail="Cannot reset progress while a scan is running. Please stop it first.")
    try:
        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path, timeout=15) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("CREATE TABLE IF NOT EXISTS processed_objects (file_id INTEGER PRIMARY KEY)")
                conn.execute("DELETE FROM processed_objects")
                conn.commit()
        return {"message": "Object scanner progress has been reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reset object scanner progress: {e}")