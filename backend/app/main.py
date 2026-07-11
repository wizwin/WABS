from pathlib import Path
import sys
import os
import traceback
import time

# Prevent thread spinning and busy-waiting in background thread pools (OpenMP, OpenBLAS)
os.environ["OMP_WAIT_POLICY"] = "passive"
os.environ["OPENBLAS_MAIN_FREE"] = "1"
os.environ["OPENBLAS_THREAD_TIMEOUT"] = "10"

# Configure CPU threading limits globally before importing other libraries
try:
    from backend.app.config import load_config
    cfg = load_config()
    ocr_threads = cfg.get("ocr_cpu_threads", 4)
    opencv_threads = cfg.get("opencv_cpu_threads", 4)

    if ocr_threads > 0:
        os.environ["OMP_NUM_THREADS"] = str(ocr_threads)
        os.environ["MKL_NUM_THREADS"] = str(ocr_threads)

    if opencv_threads > 0:
        os.environ["OPENBLAS_NUM_THREADS"] = str(opencv_threads)
        os.environ["OPENCV_NUM_THREADS"] = str(opencv_threads)
except Exception:
    pass


from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles

# Add imports from Backend (FastAPI) Modularization
from backend.app.routes.files import router as files_router
from backend.app.routes.indexer import router as indexer_router
from backend.app.routes.search import router as search_router
from backend.app.routes.system import router as system_router
from backend.app.routes.tags import router as tags_router
from backend.app.routes.documents import router as documents_router
from backend.app.routes.people import router as people_router
from backend.app.routes.virtual_folders import router as virtual_folders_router
import backend.app.shared_state as shared_state

try:
    from backend.app.database import SessionLocal, FileIndex
    from backend.app.config import load_config, save_config
    from backend.app.utils.indexer import start_indexing
    import backend.app.state as app_state
    from backend.app.state import STATE
    from backend.app.ai_database import init_ai_database
except ModuleNotFoundError:
    from database import SessionLocal, FileIndex
    from config import load_config, save_config
    from utils.indexer import start_indexing
    import state as app_state
    from state import STATE

app = FastAPI()

app.include_router(files_router)
app.include_router(indexer_router)
app.include_router(search_router)
app.include_router(system_router)
app.include_router(tags_router)
app.include_router(documents_router)
app.include_router(people_router)
app.include_router(virtual_folders_router)

import asyncio

@app.on_event("startup")
async def suppress_harmless_asyncio_errors():
    # Create expression indexes to make chronological and size sorting instantaneous
    try:
        from backend.app.database import SessionLocal
        with SessionLocal() as s:
            s.execute(text("CREATE INDEX IF NOT EXISTS idx_files_best_date ON files (coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10)))"))
            s.execute(text("CREATE INDEX IF NOT EXISTS idx_files_size ON files (CAST(size AS INTEGER))"))
            s.commit()
    except Exception as e:
        print("Database optimization index creation failed:", e)

    if sys.platform == "win32":
        loop = asyncio.get_running_loop()
        default_handler = loop.get_exception_handler()
        def custom_exception_handler(loop, context):
            exc = context.get('exception')
            if isinstance(exc, ConnectionResetError) and getattr(exc, 'winerror', None) == 10054:
                return # Silence harmless browser disconnection errors
            if default_handler:
                default_handler(loop, context)
            else:
                loop.default_exception_handler(context)
        loop.set_exception_handler(custom_exception_handler)

    # POST-STARTUP MEMORY TRIM:
    # After the server starts, the frontend immediately fetches /directories (Tree View) and
    # /virtual-folders — both of which allocate temporary Python objects. We schedule a GC
    # and working-set trim 10 seconds after startup (enough time for those calls to complete)
    # to return the memory to the OS before the 30-minute idle timer would normally kick in.
    async def post_startup_trim():
        await asyncio.sleep(10)
        try:
            import gc
            gc.collect()
            # On Windows, trim the process working set to release pages the GC freed
            if sys.platform == 'win32':
                import ctypes
                import os as _os
                PROCESS_QUERY_INFORMATION = 0x0400
                PROCESS_SET_QUOTA = 0x0100
                handle = ctypes.windll.kernel32.OpenProcess(
                    PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, False, _os.getpid()
                )
                if handle:
                    ctypes.windll.psapi.EmptyWorkingSet(handle)
                    ctypes.windll.kernel32.CloseHandle(handle)
        except Exception as e:
            print(f"Post-startup memory trim failed (non-critical): {e}")

    asyncio.create_task(post_startup_trim())

@app.on_event("shutdown")
def graceful_os_shutdown():
    shared_state.APP_SHUTTING_DOWN = True
    import time
    import logging

    if sys.platform != "win32":
        try:
            from backend.app.utils.tray import stop_tray_icon
            stop_tray_icon()
        except Exception:
            pass

    try:
        if shared_state.LOGGING_ENABLED:
            logging.info("OS Shutdown / App termination detected. Stopping scanners gracefully...")
    except Exception:
        pass

    app_state.STATE["stopped"] = True
    app_state.STATE["hasher_stopped"] = True
    app_state.STATE["document_scanner_stopped"] = True
    app_state.STATE["object_scanner_stopped"] = True
    app_state.STATE["face_scanner_stopped"] = True
    app_state.combined_scanner_stopped = True

    for _ in range(30):
        is_running = any([
            app_state.STATE.get("running", False),
            app_state.STATE.get("hasher_running", False),
            app_state.combined_scanner_running,
            app_state.face_scanner_running,
            app_state.object_scanner_running,
            app_state.document_scanner_running,
            app_state.STATE.get("export_running", False),
        ])
        if not is_running:
            break
        time.sleep(1)
        
    try:
        from backend.app.utils.memory import unload_heavy_modules
        unload_heavy_modules()
    except Exception:
        pass

if sys.platform == 'win32':
    try:
        import win32api
        def console_ctrl_handler(ctrl_type):
            if ctrl_type in (2, 5, 6): 
                graceful_os_shutdown()
                return True
            return False
        win32api.SetConsoleCtrlHandler(console_ctrl_handler, True)
    except ImportError:
        pass

def get_log_path() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent / "wabs.log"
    else:
        return Path(__file__).resolve().parent.parent.parent / "wabs.log"

LOG_FILE_PATH = get_log_path()

class PrintLogger:
    def __init__(self, stream, max_bytes=5*1024*1024):
        self.stream = stream
        self.max_bytes = max_bytes
        self.current_size = 0
        try:
            if LOG_FILE_PATH.exists():
                self.current_size = LOG_FILE_PATH.stat().st_size
        except Exception:
            pass

    def rotate(self):
        try:
            if LOG_FILE_PATH.exists():
                backup_path = LOG_FILE_PATH.with_suffix('.1.log')
                if backup_path.exists():
                    backup_path.unlink()
                LOG_FILE_PATH.rename(backup_path)
            self.current_size = 0
        except Exception:
            pass

    def write(self, data):
        if not data:
            return
        if self.stream:
            self.stream.write(data)
            self.stream.flush()
        if shared_state.LOGGING_ENABLED:
            try:
                data_len = len(data.encode('utf-8'))
                if self.current_size + data_len > self.max_bytes:
                    self.rotate()
                with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
                    f.write(data)
                self.current_size += data_len
            except Exception:
                pass

    def flush(self):
        if self.stream:
            self.stream.flush()

    def isatty(self):
        if self.stream and hasattr(self.stream, 'isatty'):
            return self.stream.isatty()
        return False

sys.stdout = PrintLogger(sys.stdout)
sys.stderr = PrintLogger(sys.stderr)

@app.middleware("http")
async def track_activity_and_cache(request: Request, call_next):
    path = request.url.path
    # These paths are excluded from the idle activity timer so they don't prevent
    # the idle memory unload from firing after 30 minutes of genuine inactivity.
    # - /assets, /, /indexer/status, /stats: original exclusions (polling/static)
    # - /virtual-folders: called at startup and on every folder operation (Virtual Folder feature)
    # - /directories: called at startup to build the Tree View (Tree View feature)
    # Without these exclusions, the 30-min idle clock would reset on every page load,
    # keeping 240+ MB of memory allocated indefinitely.
    if not (path.startswith("/assets") or 
            path == "/" or 
            path == "/indexer/status" or 
            path == "/stats" or
            path == "/virtual-folders" or   # Virtual Folder list — loaded at startup
            path == "/directories"):         # Tree View directory list — loaded at startup
        shared_state.LAST_ACTIVITY_TIME = time.time()

    response = await call_next(request)
    if request.method == "GET" and response.status_code == 200:
        if path.endswith("/thumbnail") or "/preview/" in path:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
@app.on_event("startup")
def startup_event():
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    __version__ = "Unknown"
    try:
        from backend.app.version import __version__
    except ImportError:
        try:
            from app.version import __version__
        except ImportError:
            try:
                from version import __version__
            except ImportError:
                pass
    try:
        print(f"WABS Server v{__version__} starting up...", flush=True)
        logging.getLogger("uvicorn.error").info(f"WABS Server v{__version__} starting up...")
    except Exception as e:
        print(f"WABS Startup Version Log Error: {e}", flush=True)
    try:
        cfg = load_config()
        shared_state.LOGGING_ENABLED = cfg.get("enable_logging", False)
    except Exception:
        pass
    try:
        from backend.app.utils.memory import start_idle_monitor
        start_idle_monitor()
    except Exception as e:
        print(f"Failed to start idle memory monitor: {e}")
    try:
        with SessionLocal() as s:
            count = s.query(FileIndex).count()
            STATE["indexed"] = count
            STATE["current"] = count
    except Exception as e:
        print(f"CRITICAL: Startup database connection failed: {e}")
        traceback.print_exc()

# --- Serve React Frontend (Production) ---
if hasattr(sys, '_MEIPASS'):
    # Running as a packaged PyInstaller executable
    frontend_dist = Path(sys._MEIPASS) / "frontend" / "dist"
else:
    # Running in normal development mode
    frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        path = frontend_dist / full_path
        if path.exists() and path.is_file():
            return FileResponse(str(path))
        return FileResponse(str(frontend_dist / "index.html"))