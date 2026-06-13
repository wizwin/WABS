from fastapi import HTTPException, Depends, Request
import backend.app.state as app_state
from backend.app.state import STATE
from backend.app.config import load_config
import logging
import inspect
import time

def wait_for_stopping_scanners():
    for _ in range(50):  # Wait up to 5 seconds
        any_stopping = False
        with app_state.scanner_lock:
            if (app_state.face_scanner_running and STATE.get("face_scanner_stopped")) or \
               (app_state.object_scanner_running and STATE.get("object_scanner_stopped")) or \
               (app_state.document_scanner_running and STATE.get("document_scanner_stopped")) or \
               (app_state.combined_scanner_running and app_state.combined_scanner_stopped) or \
               (STATE.get("running") and STATE.get("stopped")) or \
               (STATE.get("hasher_running") and STATE.get("hasher_stopped")):
                any_stopping = True
        if not any_stopping:
            break
        time.sleep(0.1)

def check_no_scanners_running():
    wait_for_stopping_scanners()
    if STATE.get("cancel_data_operation"):
        for _ in range(30):
            if not STATE.get("data_operation_running"):
                break
            time.sleep(0.1)
    with app_state.scanner_lock:
        if app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or app_state.combined_scanner_running or STATE.get("running") or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            if load_config().get("enable_logging"):
                caller = "unknown"
                for frame in inspect.stack():
                    if frame.function not in ["check_no_scanners_running", "lock_data_operation", "__enter__", "<module>"] and "fastapi" not in frame.filename and "starlette" not in frame.filename and "contextlib" not in frame.filename:
                        caller = frame.function
                        break
                logging.warning(f"Blocked API request to '{caller}': A background task is currently running.")
            raise HTTPException(status_code=400, detail="A background task is currently running. Please stop it before modifying data.")

def lock_data_operation(request: Request):
    wait_for_stopping_scanners()
    if STATE.get("cancel_data_operation"):
        for _ in range(30):
            if not STATE.get("data_operation_running"):
                break
            time.sleep(0.1)
    with app_state.scanner_lock:
        if app_state.face_scanner_running or app_state.object_scanner_running or app_state.document_scanner_running or app_state.combined_scanner_running or STATE.get("running") or STATE.get("data_operation_running") or STATE.get("hasher_running"):
            if load_config().get("enable_logging"):
                logging.warning(f"Blocked API request to '{request.url.path}': A background task is currently running.")
            raise HTTPException(status_code=400, detail="A background task is currently running. Please stop it before modifying data.")
        STATE["data_operation_running"] = True
        STATE["cancel_data_operation"] = False
    try:
        yield
    except BaseException:
        raise
    finally:
        with app_state.scanner_lock:
            STATE["data_operation_running"] = False
            STATE["cancel_data_operation"] = False
