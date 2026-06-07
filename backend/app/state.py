import threading

STATE = {
    "running": False,
    "paused": False,
    "stopped": False,
    "current": 0,
    "total": 0,
    "current_file": "",
    "status": "Idle",
    "indexed": 0
}

scanner_lock = threading.Lock()
combined_scanner_thread = None

face_scanner_running = False
object_scanner_running = False
document_scanner_running = False
combined_scanner_running = False
combined_scanner_stopped = False