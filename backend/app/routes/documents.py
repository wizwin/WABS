import threading
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from backend.app.database import SessionLocal
import backend.app.state as app_state
from backend.app.state import STATE
from backend.app.utils.indexer import _process_unified_scanners

router = APIRouter()

document_scanner_thread = None

@router.post("/scan-documents")
def scan_documents():
    global document_scanner_thread
    with app_state.scanner_lock:
        if app_state.document_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.combined_scanner_running or STATE.get("running"):
            raise HTTPException(status_code=400, detail="Another scanning process is already running. Please stop it before starting a new one.")
        app_state.document_scanner_running = True
        app_state.combined_scanner_stopped = False
        STATE["stopped"] = False
        STATE["document_scanner_stopped"] = False
        STATE["paused"] = False
        document_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": False, "run_face": False, "run_object": False, "run_document": True})
        document_scanner_thread.start()
    return {"message": "Document text extraction started in the background."}

@router.post("/stop-scan-documents")
def stop_scan_documents():
    with app_state.scanner_lock:
        STATE["document_scanner_stopped"] = True
        if not app_state.document_scanner_running:
            return {"message": "Document text extractor is not running or already stopped."}
    return {"message": "Stopping document text extractor."}

@router.post("/reset-document-scanner-progress")
def reset_document_scanner_progress():
    with app_state.scanner_lock:
        if app_state.document_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.combined_scanner_running or STATE.get("running"):
            raise HTTPException(status_code=400, detail="Cannot reset progress while a scan is running. Please stop it first.")
    try:
        with SessionLocal() as s:
            s.execute(text("CREATE TABLE IF NOT EXISTS processed_text (file_id INTEGER PRIMARY KEY)"))
            s.execute(text("CREATE VIRTUAL TABLE IF NOT EXISTS file_text_fts USING fts5(file_id UNINDEXED, content)"))
            s.execute(text("DELETE FROM processed_text"))
            s.execute(text("DELETE FROM file_text_fts"))
            s.commit()
        return {"message": "Document scanner progress has been reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reset document scanner progress: {e}")