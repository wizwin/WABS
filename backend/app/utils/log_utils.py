import logging

# Internal debug control switch (not exposed to user settings).
# Set to True to generate verbose logs for face detection, object recognition, text extraction, etc.
INTERNAL_DEBUG_VERBOSE = False

def log_operation(message, user_logs_enabled=False, is_verbose=False):
    """
    Logs critical operations or verbose debugging info based on internal switches and user settings.
    """
    if is_verbose and INTERNAL_DEBUG_VERBOSE:
        # Use print to ensure it shows up in the console regardless of the global logging level
        print(f"[VERBOSE] {message}")
    elif not is_verbose and user_logs_enabled:
        logging.info(f"[CRITICAL] {message}")