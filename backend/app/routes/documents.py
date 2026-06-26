import threading
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text

from backend.app.database import SessionLocal
import backend.app.state as app_state
from backend.app.state import STATE
from backend.app.utils.indexer import _process_unified_scanners
from backend.app.config import load_config
from backend.app.utils.validators import check_no_scanners_running, lock_data_operation, wait_for_stopping_scanners

router = APIRouter()

document_scanner_thread = None

@router.post("/scan-documents")
def scan_documents():
    global document_scanner_thread
    from backend.app.utils.paths import check_models_exist
    check_models_exist("document")
    wait_for_stopping_scanners()
    with app_state.scanner_lock:
        if app_state.document_scanner_running or app_state.face_scanner_running or app_state.object_scanner_running or app_state.combined_scanner_running or STATE.get("running") or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            raise HTTPException(status_code=400, detail="Another scanning process is already running. Please stop it before starting a new one.")
        app_state.document_scanner_running = True
        app_state.combined_scanner_stopped = False
        STATE["stopped"] = False
        STATE["document_scanner_stopped"] = False
        STATE["paused"] = False
        document_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": False, "run_face": False, "run_object": False, "run_document": True}, daemon=True)
        document_scanner_thread.start()
        
    if load_config().get("enable_logging"):
        import logging
        logging.info("Document text extraction started in the background.")
        
    return {"message": "Document text extraction started in the background."}

@router.post("/stop-scan-documents")
def stop_scan_documents():
    with app_state.scanner_lock:
        if not app_state.document_scanner_running:
            return {"message": "Document text extractor is not running or already stopped."}
        STATE["document_scanner_stopped"] = True
        if not app_state.combined_scanner_running:
            STATE["stopped"] = True
            app_state.combined_scanner_stopped = True
            
    if load_config().get("enable_logging"):
        import logging
        logging.info("Stopping document text extractor.")
        
    return {"message": "Stopping document text extractor."}

@router.post("/reset-document-scanner-progress", dependencies=[Depends(lock_data_operation)])
def reset_document_scanner_progress():

    try:
        with SessionLocal() as s:
            s.execute(text("CREATE TABLE IF NOT EXISTS processed_text (file_id INTEGER PRIMARY KEY)"))
            s.execute(text("CREATE VIRTUAL TABLE IF NOT EXISTS file_text_fts USING fts5(file_id UNINDEXED, content)"))
            s.execute(text("DELETE FROM processed_text"))
            s.execute(text("DELETE FROM file_text_fts"))
            # Remove "ocr" tag from all files' tags
            update_tags_query = """
                UPDATE files 
                SET tags = CASE 
                    WHEN tags = 'ocr' THEN ''
                    WHEN tags LIKE 'ocr,%' THEN SUBSTR(tags, 5)
                    WHEN tags LIKE '%,ocr' THEN SUBSTR(tags, 1, LENGTH(tags) - 4)
                    WHEN tags LIKE '%,ocr,%' THEN REPLACE(tags, ',ocr,', ',')
                    ELSE tags
                END
                WHERE tags LIKE '%ocr%';
            """
            s.execute(text(update_tags_query))
            s.commit()
            
        if load_config().get("enable_logging"):
            import logging
            logging.info("Document scanner progress has been reset.")
            
        return {"message": "Document scanner progress has been reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reset document scanner progress: {e}")