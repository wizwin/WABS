import multiprocessing
import os
import sys
import glob

if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

# Restore original library paths to prevent PyInstaller conflicts with system GUI libraries
if sys.platform != "win32" and getattr(sys, 'frozen', False) and not os.environ.get("WABS_REEXECUTED"):
    env = os.environ.copy()
    for var in ["LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"]:
        orig = var + "_ORIG"
        if orig in env:
            env[var] = env[orig]
        else:
            env.pop(var, None)
    env["WABS_REEXECUTED"] = "1"
    try:
        os.execve(sys.executable, sys.argv, env)
    except Exception as e:
        sys.stderr.write(f"Failed to re-execute with clean library path: {e}\n")

# Prevent thread spinning and busy-waiting in background thread pools (OpenMP, OpenBLAS)
os.environ["OMP_WAIT_POLICY"] = "passive"
os.environ["OPENBLAS_MAIN_FREE"] = "1"
os.environ["OPENBLAS_THREAD_TIMEOUT"] = "10"

import threading
import webbrowser
import socket
import uvicorn
import asyncio
from backend.app.main import app

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
    try:
        from backend.app.config import load_config
        cfg = load_config()
        allow_lan = cfg.get("allow_lan_access", False)
    except Exception:
        allow_lan = False

    ip = get_local_ip()
    # Automatically open the user's default web browser locally
    if open_browser:
        webbrowser.open(f"http://127.0.0.1:{port}")
    
    if show_info:
        if allow_lan:
            info_text = (
                "WABS is running in the background (LAN Access: ENABLED).\n\n"
                f"Access on this PC: http://127.0.0.1:{port}\n"
                f"Access on your phone: http://{ip}:{port}"
            )
        else:
            info_text = (
                "WABS is running in secure local mode.\n\n"
                f"Access on this PC: http://127.0.0.1:{port}\n\n"
                "(LAN access is disabled for security. Enable in Settings if you want to access from your phone)"
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

def is_leftover_dll_only_folder(folder_path: str) -> bool:
    try:
        items = os.listdir(folder_path)
        if not items:
            return True
            
        for item in items:
            item_path = os.path.join(folder_path, item)
            if os.path.isdir(item_path):
                return False
                
        allowed_files = {
            'msvcp140.dll',
            'vcruntime140.dll',
            'vcruntime140_1.dll',
            'vcruntime140_2.dll',
            'python3.dll',
            'python310.dll',
            'python311.dll',
            'python312.dll'
        }
        
        for item in items:
            if item.lower() not in (f.lower() for f in allowed_files):
                return False
                
        return True
    except Exception:
        return False

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
    
    temp_path = tempfile.gettempdir()
    current_mei = getattr(sys, '_MEIPASS', None)
    if not current_mei:
        return
        
    current_mei = os.path.abspath(current_mei)
    
    # Scan for folders matching _MEI* pattern
    mei_pattern = os.path.join(temp_path, '_MEI*')
    for folder in glob.glob(mei_pattern):
        folder = os.path.abspath(folder)
        if folder == current_mei:
            continue
            
        if not is_safe_mei_folder(folder):
            continue
            
        try:
            if is_wabs_temp_folder(folder) or is_leftover_dll_only_folder(folder):
                if os.path.exists(folder):
                    if sys.platform != 'win32':
                        try:
                            if is_folder_in_use_on_linux(folder):
                                continue
                        except Exception:
                            pass
                    shutil.rmtree(folder)
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
    
    import subprocess
    if sys.platform == 'win32':
        # On Windows, try to rename the folder first to ensure it's not locked.
        # If it's locked, wait and retry. If/when we can rename it, delete the renamed folder.
        # If it is still locked after 10 retries, do nothing (keeps it intact so startup cleans it up).
        parent_dir = os.path.dirname(current_mei)
        folder_name = os.path.basename(current_mei)
        target_name = f"{folder_name}_to_delete"
        target_path = os.path.join(parent_dir, target_name)
        
        if not is_safe_mei_folder(target_path):
            return
            
        cmd = (
            f'for /L %%i in (1,1,10) do ('
            f'ren "{current_mei}" "{target_name}" && ('
            f'rmdir /s /q "{target_path}" & exit'
            f') || ('
            f'ping 127.0.0.1 -n 2 >nul'
            f')'
            f')'
        )
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

_MEI_LOCKED_FILES = []

def lock_mei_files():
    if not getattr(sys, 'frozen', False):
        return
        
    current_mei = getattr(sys, '_MEIPASS', None)
    if not current_mei:
        return
        
    current_mei = os.path.abspath(current_mei)
    if not is_safe_mei_folder(current_mei):
        return
        
    # Walk sys._MEIPASS recursively and lock static files (onnx models, frontends, txts)
    # on Windows by keeping open read handles.
    locked_count = 0
    for root, dirs, files in os.walk(current_mei):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in ('.onnx', '.txt', '.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.yaml'):
                filepath = os.path.join(root, file)
                try:
                    f = open(filepath, 'rb')
                    _MEI_LOCKED_FILES.append(f)
                    locked_count += 1
                except Exception:
                    pass
    if locked_count > 0:
        print(f"Successfully locked {locked_count} static assets in temporary folder to prevent deletion.", flush=True)

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
        try:
            lock_mei_files()
        except Exception as e:
            print(f"Failed to lock temporary files: {e}", flush=True)
    
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

    try:
        from backend.app.config import load_config
        cfg = load_config()
        allow_lan = cfg.get("allow_lan_access", False)
    except Exception:
        allow_lan = False

    bind_host = "0.0.0.0" if allow_lan else "127.0.0.1"

    # Check if port is already in use to prevent duplicate launches
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((bind_host, port))
    except OSError:
        msg = f"Port {port} is already in use.\nAnother instance of WABS or another application is already running."
        print(f"Error: {msg}", file=sys.stderr, flush=True)
        try:
            import tkinter as tk
            from tkinter import messagebox
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("WABS Launch Error", msg)
            root.destroy()
        except Exception:
            pass
        sys.exit(1)

    # Wait 1.5 seconds for Uvicorn to start, then run the startup popup and open the browser
    threading.Timer(1.5, on_startup, args=[port, show_info_popup, open_browser_flag]).start()

    # We instantiate the server manually to gain access to the server object
    # for a graceful shutdown.
    config = uvicorn.Config(app, host=bind_host, port=port, log_level="info")
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

    class SuppressPystrayDockErrorFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            if record.exc_info:
                exc_type, exc_value, _ = record.exc_info
                if exc_type is not None:
                    if issubclass(exc_type, (KeyboardInterrupt, asyncio.CancelledError)):
                        return False
                    if issubclass(exc_type, AssertionError) and "Failed to dock icon" in str(record.msg):
                        return False
            if "Failed to dock icon" in record.getMessage():
                return False
            return True

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(logger_name).addFilter(SuppressShutdownNoiseFilter())

    logging.getLogger("pystray").addFilter(SuppressPystrayDockErrorFilter())

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

    os._exit(0)