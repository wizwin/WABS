import multiprocessing
import os
import sys
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

def on_startup():
    ip = get_local_ip()
    port = 8000
    # Automatically open the user's default web browser locally
    webbrowser.open(f"http://127.0.0.1:{port}")
    
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        messagebox.showinfo(
            "WABS Server Started", 
            f"WABS is now running in the background.\n\n"
            f"Access on this PC: http://127.0.0.1:{port}\n"
            f"Access on your phone: http://{ip}:{port}"
        )
        root.destroy()
    except Exception:
        pass

if __name__ == "__main__":
    # Freeze support is required for PyInstaller bundles to run on Windows
    multiprocessing.freeze_support()
    
    # Wait 1.5 seconds for Uvicorn to start, then run the startup popup and open the browser
    threading.Timer(1.5, on_startup).start()

    # We instantiate the server manually to gain access to the server object
    # for a graceful shutdown.
    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    server = uvicorn.Server(config)

    # Attach the server object to the app's state so it can be accessed from endpoints
    app.state.server = server

    server.run()