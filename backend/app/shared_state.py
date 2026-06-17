import time
import threading
LOGGING_ENABLED = False
APP_SHUTTING_DOWN = False
LAST_ACTIVITY_TIME = time.time()
MEMORY_LOCK = threading.Lock()