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

def is_safe_mei_folder(folder_path: str) -> bool:
    try:
        import tempfile
        temp_dir = os.path.abspath(tempfile.gettempdir())
        target_dir = os.path.abspath(folder_path)
        
        # 1. Must be a subdirectory of the system temp directory
        if os.path.commonpath([temp_dir, target_dir]) != temp_dir:
            return False
            
        # 2. Must not be the temp directory itself
        if target_dir == temp_dir:
            return False
            
        # 3. The folder name must start with '_MEI'
        folder_name = os.path.basename(target_dir)
        if not folder_name.startswith('_MEI'):
            return False
            
        return True
    except Exception:
        return False


def clean_old_mei_folders():
    if not getattr(sys, 'frozen', False):
        return

    import tempfile
    from pathlib import Path
    
    temp_path = tempfile.gettempdir()
    current_mei = getattr(sys, '_MEIPASS', None)
    if not current_mei:
        return
        
    current_mei = os.path.abspath(current_mei)
    
    # Resolve base_dir (project root)
    base_dir = Path(sys.executable).parent
    cache_dir = base_dir / "cache"
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
        
    temp_dirs_file = cache_dir / "temp_dirs.txt"
    
    # Read existing registered folders
    registered_folders = set()
    if temp_dirs_file.exists():
        try:
            with open(temp_dirs_file, "r", encoding="utf-8") as f:
                for line in f:
                    path = line.strip()
                    if path:
                        registered_folders.add(os.path.abspath(path))
        except Exception:
            pass
            
    # Add current one to the registered list so it can be cleaned up next time if it fails now
    registered_folders.add(current_mei)
    
    # Also find folders matching _MEI* pattern to register them (handles legacy leftovers)
    mei_pattern = os.path.join(temp_path, '_MEI*')
    for folder in glob.glob(mei_pattern):
        folder = os.path.abspath(folder)
        if folder == current_mei:
            continue
        try:
            if is_wabs_temp_folder(folder):
                registered_folders.add(folder)
        except Exception:
            continue
            
    # Try to clean up all other folders in the registered list
    still_present = set()
    for folder in registered_folders:
        if folder == current_mei:
            still_present.add(folder)
            continue
            
        if not is_safe_mei_folder(folder):
            continue
            
        if os.path.exists(folder):
            if sys.platform != 'win32':
                try:
                    if is_folder_in_use_on_linux(folder):
                        still_present.add(folder)
                        continue
                except Exception:
                    pass
            try:
                shutil.rmtree(folder)
            except Exception:
                still_present.add(folder)
        # If it doesn't exist, we don't add it to still_present (it's gone!)
        
    # Write updated list back
    try:
        with open(temp_dirs_file, "w", encoding="utf-8") as f:
            for folder in sorted(still_present):
                f.write(folder + "\n")
    except Exception:
        pass


def spawn_detached_cleanup():
    if not getattr(sys, 'frozen', False):
        return
        
    current_mei = getattr(sys, '_MEIPASS', None)
    if not current_mei:
        return
        
    current_mei = os.path.abspath(current_mei)
    if not is_safe_mei_folder(current_mei):
        return
    
    # Spawn a detached process to delete the folder after a short delay
    import subprocess
    if sys.platform == 'win32':
        # On Windows, use a ping delay and rmdir
        cmd = f'ping 127.0.0.1 -n 4 >nul & rmdir /s /q "{current_mei}"'
        try:
            # CREATE_NO_WINDOW (0x08000000) completely suppresses the cmd console window
            # CREATE_NEW_PROCESS_GROUP (0x00000200) detaches from parent terminal signals
            subprocess.Popen(
                cmd,
                shell=True,
                creationflags=0x08000000 | 0x00000200,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL
            )
        except Exception:
            pass
    else:
        # On Linux/macOS
        cmd = f'sleep 3 && rm -rf "{current_mei}"'
        try:
            subprocess.Popen(
                cmd,
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL
            )
        except Exception:
            pass

if __name__ == "__main__":
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
    print(f"WABS Server v{__version__} starting up...", flush=True)

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

    if getattr(sys, 'frozen', False):
        try:
            spawn_detached_cleanup()
        except Exception:
            pass