import sys
import gc
import time
import threading
import sqlite3
from pathlib import Path
import backend.app.shared_state as shared_state

def unload_heavy_modules():
    """
    Unloads heavy libraries from sys.modules and runs garbage collection
    to release memory back to the OS.
    """
    # Defer config load to avoid import loops
    from backend.app.config import load_config
    cfg = load_config()
    
    unloaded_modules = []
    
    with shared_state.MEMORY_LOCK:
        try:
            from backend.app.utils.indexer import reset_ocr_engine
            reset_ocr_engine()
        except Exception:
            pass

        modules_to_unload = ["fitz", "docx", "pptx", "openpyxl", "mutagen", "pefile", "filetype", "onnxruntime", "rapidocr_onnxruntime"]
        
        # Safely iterate and remove modules from sys.modules
        for mod in list(sys.modules.keys()):
            for target in modules_to_unload:
                if mod == target or mod.startswith(target + "."):
                    del sys.modules[mod]
                    unloaded_modules.append(mod)
                    break
                    
        if unloaded_modules:
            
            # Flush SQLite memory for the main database
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
                
            # Flush SQLite memory for the AI database
            from backend.app.utils.paths import get_ai_db_path
            try:
                ai_db = get_ai_db_path()
                if ai_db.exists():
                    with sqlite3.connect(ai_db) as db:
                        db.execute("PRAGMA shrink_memory")
            except Exception:
                pass
                
            if cfg.get("enable_logging", False):
                import logging
                logging.info(f"Unloaded idle modules and released memory: {unloaded_modules}")
            else:
                print(f"Unloaded idle modules and released memory: {unloaded_modules}")
                
        # Always run garbage collection and release memory back to the OS when WABS is idle
        gc.collect()
        
        # 1. Linux/glibc memory trimming
        try:
            import ctypes
            libc = ctypes.CDLL(None)
            if hasattr(libc, 'malloc_trim'):
                libc.malloc_trim(0)
        except Exception:
            pass
            
        # 2. Windows working set trimming
        if sys.platform == 'win32':
            try:
                import ctypes
                import os
                PROCESS_QUERY_INFORMATION = 0x0400
                PROCESS_SET_QUOTA = 0x0100
                handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, False, os.getpid())
                if handle:
                    ctypes.windll.psapi.EmptyWorkingSet(handle)
                    ctypes.windll.kernel32.CloseHandle(handle)
            except Exception:
                pass
            
    return unloaded_modules

def _check_and_unload_idle_modules():
    if getattr(shared_state, 'APP_SHUTTING_DOWN', False):
        return
        
    # Check if any scanner is currently active
    import backend.app.state as app_state
    scanners_active = any([
        app_state.STATE.get("running", False),
        app_state.STATE.get("hasher_running", False),
        app_state.combined_scanner_running,
        app_state.face_scanner_running,
        app_state.object_scanner_running,
        app_state.document_scanner_running,
    ])
    
    if scanners_active:
        shared_state.LAST_ACTIVITY_TIME = time.time()
        return

    from backend.app.config import load_config
    cfg = load_config()
    timeout = int(cfg.get("idle_unload_timeout_seconds", 1800)) # Default to 30 mins
    if timeout <= 0:
        return
    
    elapsed = time.time() - getattr(shared_state, 'LAST_ACTIVITY_TIME', 0)
    if elapsed >= timeout:
        unload_heavy_modules()

def start_idle_monitor():
    def loop():
        # Wait a bit on startup before checking
        time.sleep(30)
        while not getattr(shared_state, 'APP_SHUTTING_DOWN', False):
            try:
                _check_and_unload_idle_modules()
            except Exception as e:
                print(f"Error in idle memory monitor: {e}")
            # Check every 60 seconds
            for _ in range(60):
                if getattr(shared_state, 'APP_SHUTTING_DOWN', False):
                    break
                time.sleep(1)
                
    t = threading.Thread(target=loop, name="WABS-IdleMonitor", daemon=True)
    t.start()
