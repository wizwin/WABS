import threading
import webbrowser
import sys
from pathlib import Path
from PIL import Image, ImageDraw

_tray_icon = None
_tray_lock = threading.Lock()

def create_default_icon():
    # Create an image with a dark blue background and a white "W"
    image = Image.new('RGBA', (64, 64), color=(15, 23, 42, 255))
    dc = ImageDraw.Draw(image)
    # Draw a nice circle
    dc.ellipse([8, 8, 56, 56], fill=(56, 189, 248, 255)) # Sky blue color
    # Draw a white W
    dc.line([20, 20, 28, 44], fill=(255, 255, 255, 255), width=4)
    dc.line([28, 44, 32, 32], fill=(255, 255, 255, 255), width=4)
    dc.line([32, 32, 36, 44], fill=(255, 255, 255, 255), width=4)
    dc.line([36, 44, 44, 20], fill=(255, 255, 255, 255), width=4)
    return image

def load_icon_image():
    # In frozen mode: BASE is where sys.executable is.
    # In dev mode: BASE is where run.py is.
    if getattr(sys, 'frozen', False):
        base_dir = Path(sys.executable).parent
    else:
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
    
    icon_path = base_dir / "icon.ico"
    if icon_path.exists():
        try:
            return Image.open(icon_path)
        except Exception:
            pass
    return create_default_icon()

def _create_icon(server, port):
    import pystray
    icon_image = load_icon_image()
    
    def on_open_wabs(icon, item):
        webbrowser.open(f"http://127.0.0.1:{port}")
        
    def on_open_settings(icon, item):
        webbrowser.open(f"http://127.0.0.1:{port}/#settings")
        
    def on_shutdown(icon, item):
        icon.stop()
        server.should_exit = True
        # Give uvicorn 3 s to drain, then force-close connections,
        # then hard-kill if the event loop is still stuck.
        def _force_exit():
            import time as _time, os as _os
            _time.sleep(3.0)
            server.force_exit = True
            _time.sleep(3.0)
            _os._exit(0)
        threading.Thread(target=_force_exit, daemon=True).start()
        
    menu = pystray.Menu(
        pystray.MenuItem("Open WABS", on_open_wabs),
        pystray.MenuItem("Settings", on_open_settings),
        pystray.MenuItem("Shutdown", on_shutdown)
    )
    
    return pystray.Icon("WABS", icon_image, "WABS Backend", menu)

def _print_xlib_warning():
    print("\n" + "="*80)
    print("WARNING: WABS system tray is using the legacy 'xlib' backend.")
    print("On modern Ubuntu/GNOME (especially under Wayland), the 'xlib' backend")
    print("does not support interactive right-click/left-click menus.")
    print("\nTo enable full menu support, please install the AppIndicator dependencies:")
    print("  1. Install system packages:")
    print("     sudo apt update")
    print("     sudo apt install python3-gi gir1.2-appindicator3-0.1")
    print("  2. Allow your virtual environment (venv) to access system packages, or")
    print("     install pygobject inside your venv (requires libcairo2-dev and libgirepository1.0-dev):")
    print("     pip install pygobject")
    print("="*80 + "\n")

def start_tray_icon(server, port):
    global _tray_icon
    try:
        _tray_icon = _create_icon(server, port)
        icon_module = _tray_icon.__class__.__module__
        print(f"System tray icon initialized using backend: {icon_module}")
        if "_xlib" in icon_module:
            _print_xlib_warning()
        
        # Run in a daemon thread so it doesn't block python shutdown (used for Windows)
        t = threading.Thread(target=_tray_icon.run, daemon=True)
        t.start()
        print("System tray icon started successfully in background.")
    except Exception as e:
        print(f"Could not initialize system tray: {e}")

def run_tray_icon(server, port):
    global _tray_icon
    try:
        _tray_icon = _create_icon(server, port)
        icon_module = _tray_icon.__class__.__module__
        print(f"System tray icon initialized using backend: {icon_module}")
        if "_xlib" in icon_module:
            _print_xlib_warning()

        print("System tray icon running on main thread.")
        _tray_icon.run()  # Blocks until icon.stop() is called (used for Linux)
    except Exception as e:
        print(f"Could not run system tray icon: {e}")

def stop_tray_icon():
    global _tray_icon
    with _tray_lock:
        if _tray_icon is not None:
            try:
                _tray_icon.stop()
                print("System tray icon stopped.")
            except KeyboardInterrupt:
                pass
            except BaseException as e:
                print(f"Could not stop system tray: {e}")
            _tray_icon = None
