import multiprocessing
import os
import sys
import asyncio
import shutil
import glob

# Prevent thread spinning and busy-waiting in background thread pools (OpenMP, OpenBLAS)
os.environ["OMP_WAIT_POLICY"] = "passive"
os.environ["OPENBLAS_MAIN_FREE"] = "1"
os.environ["OPENBLAS_THREAD_TIMEOUT"] = "10"

import threading
import webbrowser
import socket
import uvicorn
from backend.app.main import app

if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

def get_local_ip():
    try:
        # Create a dummy socket to figure out the local network IP automatically
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def on_startup(port, show_info=False, open_browser=True):
    ip = get_local_ip()
    # Automatically open the user's default web browser locally
    if open_browser:
        webbrowser.open(f"http://127.0.0.1:{port}")
    
    if show_info:
        info_text = (
            "WABS is now running in the background.\n\n"
            f"Access on this PC: http://127.0.0.1:{port}\n"
            f"Access on your phone: http://{ip}:{port}"
        )
        try:
            import tkinter as tk
            from tkinter import messagebox
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            messagebox.showinfo("WABS Server Started", info_text)
            root.destroy()
        except Exception:
            # Fallback for CLI mode or if tkinter fails
            print("\n--- WABS Server Information ---")
            print(info_text)
            print("-----------------------------\n")

def is_folder_in_use_on_linux(folder_path: str) -> bool:
    abs_folder = os.path.abspath(folder_path)
    
    # Check maps of all processes
    for maps_path in glob.glob('/proc/[0-9]*/maps'):
        try:
            with open(maps_path, 'r', errors='ignore') as f:
                if abs_folder in f.read():
                    return True
        except (PermissionError, FileNotFoundError):
            continue
            
    # Check cmdline of all processes
    for cmdline_path in glob.glob('/proc/[0-9]*/cmdline'):
        try:
            with open(cmdline_path, 'r', errors='ignore') as f:
                if abs_folder in f.read():
                    return True
        except (PermissionError, FileNotFoundError):
            continue
            
    # Check cwd of all processes
    for pid_dir in glob.glob('/proc/[0-9]*'):
        try:
            cwd_link = os.readlink(os.path.join(pid_dir, 'cwd'))
            if os.path.abspath(cwd_link) == abs_folder:
                return True
        except (PermissionError, FileNotFoundError, OSError):
            continue
            
    return False

def is_wabs_temp_folder(folder_path: str) -> bool:
    # A WABS temporary directory must contain the specific backend ONNX models and the frontend dist assets.
    backend_path = os.path.join(folder_path, 'backend')
    frontend_path = os.path.join(folder_path, 'frontend', 'dist')
    
    # Check for presence of at least one of our key ONNX models and the frontend index.html
    has_models = (
        os.path.exists(os.path.join(backend_path, 'face_recognition_sface_2021dec.onnx')) or
        os.path.exists(os.path.join(backend_path, 'mobilenetv2-small.onnx'))
    )
    has_frontend = os.path.exists(os.path.join(frontend_path, 'index.html'))
    
    return has_models and has_frontend

def clean_old_mei_folders():
    if not getattr(sys, 'frozen', False):
        return

    import tempfile
    
    temp_path = tempfile.gettempdir()
    current_mei = getattr(sys, '_MEIPASS', None)
    if not current_mei:
        return
        
    current_mei = os.path.abspath(current_mei)
    mei_pattern = os.path.join(temp_path, '_MEI*')
    
    for folder in glob.glob(mei_pattern):
        folder = os.path.abspath(folder)
        if folder == current_mei:
            continue
            
        # Safety check: ensure this folder belongs specifically to WABS to avoid touching other apps' files
        try:
            if not is_wabs_temp_folder(folder):
                continue
        except Exception:
            continue
            
        if sys.platform != 'win32':
            try:
                if is_folder_in_use_on_linux(folder):
                    continue
            except Exception:
                pass
                
        try:
            shutil.rmtree(folder)
        except Exception:
            pass

if __name__ == "__main__":
    # Freeze support is required for PyInstaller bundles to run on Windows
    multiprocessing.freeze_support()

    if '--multiprocessing-fork' not in sys.argv:
        try:
            clean_old_mei_folders()
        except Exception:
            pass
    
    show_info_popup = '--help' in sys.argv
    open_browser_flag = '--no-browser' not in sys.argv

    port = 8000
    if '--port' in sys.argv:
        try:
            port_index = sys.argv.index('--port')
            port = int(sys.argv[port_index + 1])
        except (ValueError, IndexError):
            print("Invalid port specified. Using default 8000.")
            port = 8000

    # Wait 1.5 seconds for Uvicorn to start, then run the startup popup and open the browser
    threading.Timer(1.5, on_startup, args=[port, show_info_popup, open_browser_flag]).start()

    # We instantiate the server manually to gain access to the server object
    # for a graceful shutdown.
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)

    # Attach the server object to the app's state so it can be accessed from endpoints
    app.state.server = server

    # Configure logging to suppress noisy KeyboardInterrupt and CancelledError tracebacks during shutdown
    import logging

    class SuppressShutdownNoiseFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            if record.exc_info:
                exc_type, exc_value, _ = record.exc_info
                if exc_type is not None and issubclass(exc_type, (KeyboardInterrupt, asyncio.CancelledError)):
                    return False
            return True

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(logger_name).addFilter(SuppressShutdownNoiseFilter())

    # Check if system tray icon should be run
    tray_available = False
    try:
        import pystray
        # On Linux, make sure GUI display environment is available
        if sys.platform != "win32":
            if not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
                raise ImportError("No display available")
        tray_available = True
    except Exception:
        tray_available = False

    if tray_available:
        import threading
        
        if sys.platform == "win32":
            # On Windows, keep the original working behavior:
            # Start the system tray icon in a background thread and block main thread with server.run()
            from backend.app.utils.tray import start_tray_icon, stop_tray_icon
            start_tray_icon(server, port)
            
            try:
                server.run()
            except (KeyboardInterrupt, asyncio.CancelledError):
                print("\nWABS Server stopped by user.")
            finally:
                stop_tray_icon()
        else:
            # On Linux/macOS, run tray icon on the main thread for responsive menus
            from backend.app.utils.tray import run_tray_icon, stop_tray_icon
            
            server_thread = threading.Thread(target=server.run, daemon=True)
            server_thread.start()
            
            try:
                run_tray_icon(server, port)
            except (KeyboardInterrupt, asyncio.CancelledError):
                print("\nWABS Server stopping...")
            finally:
                server.should_exit = True
                stop_tray_icon()
                server_thread.join(timeout=5)
    else:
        try:
            server.run()
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\nWABS Server stopped by user.")