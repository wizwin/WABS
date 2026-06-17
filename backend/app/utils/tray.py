import threading
import webbrowser
import sys
from pathlib import Path
from PIL import Image, ImageDraw

_tray_icon = None

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

def start_tray_icon(server, port):
    global _tray_icon
    try:
        import pystray
        
        icon_image = load_icon_image()
        
        def on_open_wabs(icon, item):
            webbrowser.open(f"http://127.0.0.1:{port}")
            
        def on_open_settings(icon, item):
            webbrowser.open(f"http://127.0.0.1:{port}/#settings")
            
        def on_shutdown(icon, item):
            icon.stop()
            server.should_exit = True
            
        menu = pystray.Menu(
            pystray.MenuItem("Open WABS", on_open_wabs),
            pystray.MenuItem("Settings", on_open_settings),
            pystray.MenuItem("Shutdown", on_shutdown)
        )
        
        _tray_icon = pystray.Icon("WABS", icon_image, "WABS Backend", menu)
        
        # Run in a daemon thread so it doesn't block python shutdown
        t = threading.Thread(target=_tray_icon.run, daemon=True)
        t.start()
        print("System tray icon started successfully.")
    except Exception as e:
        print(f"Could not initialize system tray: {e}")

def stop_tray_icon():
    global _tray_icon
    if _tray_icon is not None:
        try:
            _tray_icon.stop()
            print("System tray icon stopped.")
        except Exception as e:
            print(f"Could not stop system tray: {e}")
        _tray_icon = None
