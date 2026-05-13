import multiprocessing
import uvicorn
from backend.app.main import app

if __name__ == "__main__":
    # Freeze support is required for PyInstaller bundles to run on Windows
    multiprocessing.freeze_support()
    
    print("Starting WABS Server on http://127.0.0.1:8000")
    print("Please open your web browser to this address.")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")