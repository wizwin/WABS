import os
import time
import secrets
import hashlib
import re
import shutil
import logging
from pathlib import Path
from typing import Tuple, Dict, List, Optional
from backend.app.config import load_config, save_config, get_thumbnail_dir

logger = logging.getLogger("wabs.security")

# In-memory active session tokens: token -> expiry timestamp
ACTIVE_SESSIONS: Dict[str, float] = {}

# Anti brute-force tracker: client_ip -> list of failure timestamps
FAILED_ATTEMPTS: Dict[str, List[float]] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes
SESSION_VALIDITY_SECONDS = 86400 * 14  # 14 days

_PIN_ENABLED_CACHE: Optional[bool] = None

def invalidate_security_cache():
    global _PIN_ENABLED_CACHE
    _PIN_ENABLED_CACHE = None

def hash_pin(pin: str, salt_hex: Optional[str] = None) -> Tuple[str, str]:
    """
    Hashes a PIN/password using PBKDF2-HMAC-SHA256 with 100,000 iterations.
    Returns (hash_hex, salt_hex).
    """
    if salt_hex:
        salt = bytes.fromhex(salt_hex)
    else:
        salt = secrets.token_bytes(16)
    
    derived = hashlib.pbkdf2_hmac(
        'sha256',
        pin.encode('utf-8'),
        salt,
        100000
    )
    return derived.hex(), salt.hex()

def verify_pin(pin: str, stored_hash_hex: str, stored_salt_hex: str) -> bool:
    """
    Constant-time comparison of candidate PIN against stored PBKDF2 hash.
    """
    if not stored_hash_hex or not stored_salt_hex or not pin:
        return False
    try:
        calculated_hash, _ = hash_pin(pin, stored_salt_hex)
        return secrets.compare_digest(calculated_hash, stored_hash_hex)
    except Exception:
        return False

def check_lockout(client_id: str) -> Tuple[bool, int]:
    """
    Checks if a client is locked out due to excessive failed PIN attempts.
    Returns (is_locked, remaining_lockout_seconds).
    """
    now = time.time()
    attempts = FAILED_ATTEMPTS.get(client_id, [])
    # Filter attempts within the lockout window
    recent_attempts = [t for t in attempts if (now - t) < LOCKOUT_DURATION_SECONDS]
    FAILED_ATTEMPTS[client_id] = recent_attempts

    if len(recent_attempts) >= MAX_FAILED_ATTEMPTS:
        oldest_relevant = min(recent_attempts)
        remaining = int(LOCKOUT_DURATION_SECONDS - (now - oldest_relevant))
        if remaining > 0:
            logger.warning(f"[Security] Client '{client_id}' is locked out ({remaining}s remaining).")
            return True, remaining
    return False, 0

def record_failed_attempt(client_id: str):
    """
    Records a failed PIN attempt timestamp for the client.
    """
    now = time.time()
    if client_id not in FAILED_ATTEMPTS:
        FAILED_ATTEMPTS[client_id] = []
    FAILED_ATTEMPTS[client_id].append(now)
    count = len([t for t in FAILED_ATTEMPTS[client_id] if (now - t) < LOCKOUT_DURATION_SECONDS])
    logger.warning(f"[Security] Failed authentication attempt from '{client_id}' (attempt {count}/{MAX_FAILED_ATTEMPTS}).")
    if count >= MAX_FAILED_ATTEMPTS:
        logger.error(f"[Security] Client '{client_id}' exceeded max attempts. Locked out for {LOCKOUT_DURATION_SECONDS}s.")

def reset_failed_attempts(client_id: str):
    """
    Resets failed attempts upon successful authentication.
    """
    if client_id in FAILED_ATTEMPTS:
        FAILED_ATTEMPTS.pop(client_id, None)
        logger.info(f"[Security] Cleared failed attempt history for client '{client_id}'.")

def create_session(client_id: str = "local") -> str:
    """
    Generates a cryptographically secure session token and stores it in memory.
    """
    clean_expired_sessions()
    token = secrets.token_urlsafe(32)
    expiry = time.time() + SESSION_VALIDITY_SECONDS
    ACTIVE_SESSIONS[token] = expiry
    logger.info(f"[Security] Generated new active session token for '{client_id}' (valid for 14 days).")
    return token

def validate_session(token: str) -> bool:
    """
    Validates if a session token is active and unexpired.
    """
    if not token:
        return False
    expiry = ACTIVE_SESSIONS.get(token)
    if not expiry:
        return False
    if time.time() > expiry:
        ACTIVE_SESSIONS.pop(token, None)
        logger.info("[Security] Expired session token pruned during validation.")
        return False
    return True

def revoke_session(token: str):
    """
    Revokes an active session token (log out).
    """
    if token in ACTIVE_SESSIONS:
        ACTIVE_SESSIONS.pop(token, None)
        logger.info("[Security] Session token revoked on logout.")

def revoke_all_sessions():
    """
    Invalidates all active sessions (e.g. when changing PIN).
    """
    count = len(ACTIVE_SESSIONS)
    ACTIVE_SESSIONS.clear()
    logger.info(f"[Security] All active sessions invalidated ({count} session(s) revoked).")

def clean_expired_sessions():
    """
    Purges expired session tokens.
    """
    now = time.time()
    expired = [k for k, v in ACTIVE_SESSIONS.items() if now > v]
    for k in expired:
        ACTIVE_SESSIONS.pop(k, None)
    if expired:
        logger.info(f"[Security] Pruned {len(expired)} expired session token(s).")

def is_security_pin_enabled() -> bool:
    """
    Returns True if a master PIN is set in config.
    """
    global _PIN_ENABLED_CACHE
    if _PIN_ENABLED_CACHE is not None:
        return _PIN_ENABLED_CACHE
    try:
        cfg = load_config()
        _PIN_ENABLED_CACHE = bool(cfg.get("security_pin_hash") and cfg.get("security_pin_salt"))
        return _PIN_ENABLED_CACHE
    except Exception:
        return False

# Regex patterns for Personally Identifiable Information (PII)
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}')
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
IP_REGEX = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')

def redact_pii(text: str) -> str:
    """
    Redacts phone numbers, email addresses, and IP addresses from text before external AI submission.
    """
    if not text or not isinstance(text, str):
        return text
    redacted = EMAIL_REGEX.sub("[EMAIL REDACTED]", text)
    redacted = PHONE_REGEX.sub("[PHONE REDACTED]", redacted)
    redacted = IP_REGEX.sub("[IP REDACTED]", redacted)
    if redacted != text:
        logger.info("[Security] Personal PII was detected and redacted prior to external AI transmission.")
    return redacted

def clear_thumbnail_cache() -> bool:
    """
    Empties the thumbnail and preview cache directory.
    """
    try:
        thumb_dir = get_thumbnail_dir()
        if thumb_dir.exists():
            deleted_count = 0
            for item in thumb_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)
                    deleted_count += 1
                elif item.is_file():
                    item.unlink(missing_ok=True)
                    deleted_count += 1
            logger.info(f"[Security] Thumbnail cache cleared ({deleted_count} items purged).")
        return True
    except Exception as e:
        logger.error(f"[Security] Error clearing thumbnail cache: {e}")
        return False
