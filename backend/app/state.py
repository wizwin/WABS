import sys
import types
import threading

STATE = {
    "running": False,
    "paused": False,
    "stopped": False,
    "update_only": False,
    "last_root": "",
    "current": 0,
    "total": 0,
    "current_file": "",
    "status": "Idle",
    "indexed": 0,
    "face_scanner_running": False,
    "object_scanner_running": False,
    "document_scanner_running": False,
    "combined_scanner_running": False,
    "face_scanner_stopped": False,
    "object_scanner_stopped": False,
    "document_scanner_stopped": False,
    "combined_scanner_stopped": False,
    "face_scanner_current_file": "",
    "object_scanner_current_file": "",
    "document_scanner_current_file": "",
    "face_scanner_total": 0,
    "face_scanner_current": 0,
    "object_scanner_total": 0,
    "object_scanner_current": 0,
    "document_scanner_total": 0,
    "document_scanner_current": 0,
    "hasher_running": False,
    "hasher_stopped": False,
    "hasher_total": 0,
    "hasher_current": 0,
    "hasher_current_file": "",
    "duplicates_status_changed_at": 0,
    "export_running": False,
    "export_folder_id": None,
    "export_total": 0,
    "export_current": 0,
    "export_current_file": "",
    "export_error": ""
}

scanner_lock = threading.Lock()
combined_scanner_thread = None

# Custom module class to transparently proxy module-level variable reads/writes
# to the STATE dictionary, ensuring a single source of truth.
class StateModule(types.ModuleType):
    def __getattr__(self, name):
        if name in STATE:
            return STATE[name]
        raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

    def __setattr__(self, name, value):
        if name in STATE:
            STATE[name] = value
        else:
            super().__setattr__(name, value)

# Swap class of the current module instance to support properties
sys.modules[__name__].__class__ = StateModule