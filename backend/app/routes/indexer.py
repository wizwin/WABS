import threading
import sqlite3
import shutil
from pathlib import Path
def _get_cv2():
    try:
        import cv2
        return cv2
    except ImportError:
        return None

# FastAPI & Router
from fastapi import APIRouter, Body, HTTPException
from sqlalchemy import text

# Project Dependencies
from backend.app.config import load_config, save_config, get_thumbnail_dir
from backend.app.utils.utils import _resolve_path
import backend.app.state as app_state
from backend.app.state import STATE

# Local Dependencies (Adjust based on your exact file structures)
from backend.app.utils.indexer import start_indexing, _process_unified_scanners, background_lazy_hasher
from backend.app.database import SessionLocal, FileIndex
from backend.app.utils.paths import get_ai_db_path
from backend.app.utils.validators import wait_for_stopping_scanners
from pydantic import BaseModel

class IndexRequest(BaseModel):
    tag: bool = False
    face: bool = False
    document: bool = False

router = APIRouter()

@router.post("/verify-duplicates")
def verify_duplicates():
    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if STATE.get("running") or app_state.combined_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or STATE.get("hasher_running") or STATE.get("data_operation_running"):
            raise HTTPException(status_code=400, detail="Another scanning process is already running. Please stop it before starting a new one.")
    if load_config().get("enable_logging"):
        import logging
        logging.info("Duplicate verification started.")
    threading.Thread(target=background_lazy_hasher, daemon=True).start()
    return {"status": "started"}

@router.post("/stop-verify-duplicates")
def stop_verify_duplicates():
    if load_config().get("enable_logging"):
        import logging
        logging.info("Duplicate verification stopped.")
    with app_state.scanner_lock:
        STATE["hasher_stopped"] = True
        if not app_state.combined_scanner_running:
            STATE["stopped"] = True
            app_state.combined_scanner_stopped = True
    return {"status": "stopping"}

@router.post("/indexer/set-options")
def indexer_set_options(req: IndexRequest):
    try:
        cfg = load_config()
        cfg["run_face_scan"] = req.face
        cfg["run_object_scan"] = req.tag
        cfg["run_document_scan"] = req.document
        save_config(cfg)
        return {"saved": True}
    except Exception as e:
        print(f"Warning: could not save scan options to config: {e}")
        raise HTTPException(status_code=500, detail="Could not save options")

@router.get("/indexer/status")
def indexer_status():
    status = dict(STATE)
    status["face_scanner_running"] = app_state.face_scanner_running
    status["object_scanner_running"] = app_state.object_scanner_running
    status["document_scanner_running"] = app_state.document_scanner_running
    status["document_scanner_stopped"] = STATE.get("document_scanner_stopped", False)
    status["object_scanner_stopped"] = STATE.get("object_scanner_stopped", False)
    status["face_scanner_stopped"] = STATE.get("face_scanner_stopped", False)
    status["combined_scanner_running"] = app_state.combined_scanner_running
    status["combined_scanner_stopped"] = app_state.combined_scanner_stopped

    import sys
    if getattr(sys, 'frozen', False):
        from backend.app.utils.paths import get_bundled_model_path
        import os
        missing = []
        for model in ["face_detection_yunet_2023mar.onnx", "face_recognition_sface_2021dec.onnx", "mobilenetv2-small.onnx"]:
            path = get_bundled_model_path(model)
            if not os.path.exists(path):
                missing.append(model)
        if missing:
            status["system_warning"] = "Warning: Critical AI model files were deleted from the system temp folder. Please restart WABS to restore them."

    return status

@router.post("/indexer/start")
def indexer_start(req: IndexRequest = None):
    if req is None:
        req = IndexRequest()

    cv2 = _get_cv2()
    if cv2 is None and (req.tag or req.face or req.document):
        raise HTTPException(status_code=500, detail="OpenCV is required for AI recognition.")

    from backend.app.utils.paths import check_models_exist
    if req.face:
        check_models_exist("face")
    if req.tag:
        check_models_exist("object")
    if req.document:
        check_models_exist("document")

    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if STATE.get("running") or app_state.combined_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            return {"started": True, "ignored": True}
        STATE["update_only"] = False
        STATE["stopped"] = False

        if req.tag or req.face or req.document:
            app_state.combined_scanner_running = True
            app_state.combined_scanner_stopped = False
            app_state.combined_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": True, "run_object": req.tag, "run_face": req.face, "run_document": req.document}, daemon=True)
            app_state.combined_scanner_thread.start()
        else:
            start_indexing()
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive indexing started.")
    return {"started": STATE.get("running", True)}

@router.post("/indexer/pause")
def indexer_pause():
    with app_state.scanner_lock:
        if (STATE.get("running") or app_state.combined_scanner_running) and not STATE.get("paused"):
            STATE["paused"] = True
            STATE["status"] = "Paused"
    return STATE

@router.post("/indexer/resume")
def indexer_resume():
    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if not STATE.get("running") and not app_state.combined_scanner_running:
            if app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or STATE.get("data_operation_running") or STATE.get("hasher_running"):
                # Cannot resume main indexer while a standalone scanner is running
                return {"resumed_from_db": False, "ignored": True}
            # router was closed or stopped. Resume intelligently continues from the DB state.
            STATE["update_only"] = True
            start_indexing()
            return {"resumed_from_db": True}
        if (STATE.get("running") or app_state.combined_scanner_running) and STATE.get("paused"):
            STATE["paused"] = False
            STATE["status"] = "Indexing & Scanning..." if app_state.combined_scanner_running else "Indexing"
    return STATE

@router.post("/indexer/stop")
def indexer_stop():
    with app_state.scanner_lock:
        if STATE.get("running") or app_state.combined_scanner_running:
            STATE["stopped"] = True
            STATE["paused"] = False
            STATE["status"] = "Stopping..."

        app_state.combined_scanner_stopped = True
        STATE["face_scanner_stopped"] = True
        STATE["object_scanner_stopped"] = True
        STATE["document_scanner_stopped"] = True
        STATE["hasher_stopped"] = True
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive indexing stopped.")
    return STATE

@router.post("/indexer/update")
def indexer_update(req: IndexRequest = None):
    if req is None:
        req = IndexRequest()

    cv2 = _get_cv2()
    if cv2 is None and (req.tag or req.face or req.document):
        raise HTTPException(status_code=500, detail="OpenCV is required for AI recognition.")

    from backend.app.utils.paths import check_models_exist
    if req.face:
        check_models_exist("face")
    if req.tag:
        check_models_exist("object")
    if req.document:
        check_models_exist("document")

    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if STATE.get("running") or app_state.combined_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            return {"updating": False, "ignored": True}
        STATE["update_only"] = True
        STATE["stopped"] = False

        if req.tag or req.face or req.document:
            app_state.combined_scanner_running = True
            app_state.combined_scanner_stopped = False
            app_state.combined_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": True, "run_object": req.tag, "run_face": req.face, "run_document": req.document}, daemon=True)
            app_state.combined_scanner_thread.start()
        else:
            start_indexing()
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive indexing update started.")
    return {"updating": True}

@router.post("/indexer/reindex")
def indexer_reindex(req: IndexRequest = None):
    if req is None:
        req = IndexRequest()

    cv2 = _get_cv2()
    if cv2 is None and (req.tag or req.face or req.document):
        raise HTTPException(status_code=500, detail="OpenCV is required for AI recognition.")

    from backend.app.utils.paths import check_models_exist
    if req.face:
        check_models_exist("face")
    if req.tag:
        check_models_exist("object")
    if req.document:
        check_models_exist("document")

    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if STATE.get("running") or app_state.combined_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            return {"reindexing": False, "ignored": True}
        with SessionLocal() as s:
            from sqlalchemy import text
            s.query(FileIndex).delete()
            try:
                s.execute(text("DELETE FROM sqlite_sequence WHERE name='files'"))
            except Exception:
                pass
            try:
                s.execute(text("DELETE FROM processed_text"))
                s.execute(text("DELETE FROM file_text_fts"))
            except Exception:
                pass
            s.commit()

        cfg = load_config()
        # Safely rmtree ONLY our isolated cache directory, ignoring the parent folder entirely
        thumb_dir = get_thumbnail_dir()
        if thumb_dir.exists() and thumb_dir.is_dir():
            try:
                shutil.rmtree(thumb_dir)
            except Exception as e:
                print(f"Failed to clear thumbnails directory: {e}")

        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            try:
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    for table in ['faces', 'people', 'processed_files', 'processed_objects']:
                        try:
                            conn.execute(f"DELETE FROM {table}")
                        except sqlite3.OperationalError as e:
                            if "no such table" not in str(e).lower():
                                raise
                        try:
                            conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('faces', 'people', 'processed_files', 'processed_objects')")
                        except Exception:
                            pass
                        conn.commit()
            except Exception as e:
                print(f"Failed to clear AI database: {e}")

        STATE["indexed"] = 0
        STATE["current"] = 0
        STATE["total"] = 0
        STATE["update_only"] = False
        STATE["stopped"] = False

        if req.tag or req.face or req.document:
            app_state.combined_scanner_running = True
            app_state.combined_scanner_stopped = False
            app_state.combined_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": True, "run_object": req.tag, "run_face": req.face, "run_document": req.document}, daemon=True)
            app_state.combined_scanner_thread.start()
        else:
            start_indexing()
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive re-indexing started.")
    return {"reindexing": True}