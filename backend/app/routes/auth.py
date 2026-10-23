import logging
from fastapi import APIRouter, Request, Response, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional

from backend.app.config import load_config, save_config
from backend.app.database import get_db_setting, get_db_setting_with_sig, set_db_setting, delete_db_setting
from backend.app.utils.security import (
    hash_pin,
    verify_pin,
    check_lockout,
    record_failed_attempt,
    reset_failed_attempts,
    create_session,
    validate_session,
    revoke_session,
    revoke_all_sessions,
    is_security_pin_enabled,
    invalidate_security_cache,
    clear_thumbnail_cache,
    calculate_pin_signature,
    verify_pin_signature,
    check_db_pin_tampered,
    reseal_db_pin,
    MAX_FAILED_ATTEMPTS
)

logger = logging.getLogger("wabs.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

def get_client_ip(request: Request) -> str:
    # Use client host IP for anti brute-force tracking
    return request.client.host if request.client else "127.0.0.1"

def extract_token(request: Request) -> Optional[str]:
    # 1. Check X-Session-Token header
    token = request.headers.get("X-Session-Token")
    if not token:
        # 2. Check Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        # 3. Check Cookie (sent automatically by browser with <img>, <video>, <audio>, <a> tags)
        token = request.cookies.get("wabs_session_token")
    if not token:
        # 4. Check Query parameter
        token = request.query_params.get("token") or request.query_params.get("session_token")
    return token

def _get_stored_pin_credentials():
    """
    Retrieves stored hash and salt from the active archive.db (db_settings table),
    falling back to config.yaml if needed during transition.
    """
    h_val, sig = get_db_setting_with_sig("security_pin_hash")
    s_val = get_db_setting("security_pin_salt")
    if h_val and s_val:
        return h_val, s_val, sig
    cfg = load_config()
    return cfg.get("security_pin_hash", ""), cfg.get("security_pin_salt", ""), ""

def _store_pin_credentials(h_hex: str, s_hex: str):
    """
    Stores PIN hash and salt in archive.db (db_settings table) with HMAC anti-tamper signature.
    """
    sig = calculate_pin_signature(h_hex, s_hex) if h_hex and s_hex else ""
    if h_hex and s_hex:
        set_db_setting("security_pin_hash", h_hex, sig)
        set_db_setting("security_pin_salt", s_hex)
        set_db_setting("pin_sealed_flag", "1")
        # Keep an encrypted/hashed recovery reference to verify master PIN if externally tampered
        set_db_setting("recovery_pin_hash", h_hex, sig)
        set_db_setting("recovery_pin_salt", s_hex)
    else:
        delete_db_setting("security_pin_hash")
        delete_db_setting("security_pin_salt")
        delete_db_setting("pin_sealed_flag")
        delete_db_setting("recovery_pin_hash")
        delete_db_setting("recovery_pin_salt")
    
    # Ensure config.yaml does not store the PIN
    cfg = load_config()
    if "security_pin_hash" in cfg or "security_pin_salt" in cfg:
        cfg.pop("security_pin_hash", None)
        cfg.pop("security_pin_salt", None)
        save_config(cfg)
    invalidate_security_cache()

class PinSetupRequest(BaseModel):
    pin: str

class PinLoginRequest(BaseModel):
    pin: str

class PinChangeRequest(BaseModel):
    current_pin: str
    new_pin: str

class PinDisableRequest(BaseModel):
    current_pin: str

class ResealRequest(BaseModel):
    pin: str

@router.get("/status")
def get_auth_status(request: Request):
    client_ip = get_client_ip(request)
    is_locked, remaining_seconds = check_lockout(client_ip)
    is_tampered = check_db_pin_tampered()
    pin_enabled = is_security_pin_enabled()
    
    token = extract_token(request)
    is_auth = False
    if is_tampered:
        # Tampered state: access is strictly blocked until resealed with original master PIN
        is_auth = False
    elif not pin_enabled:
        # If PIN protection is not configured, user is automatically authenticated
        is_auth = True
    elif token and validate_session(token):
        is_auth = True

    cfg = load_config()
    return {
        "pin_enabled": pin_enabled,
        "is_authenticated": is_auth,
        "is_locked_out": is_locked,
        "is_tampered": is_tampered,
        "lockout_remaining_seconds": remaining_seconds,
        "auto_lock_minutes": cfg.get("auto_lock_minutes", 15),
        "allow_lan_access": cfg.get("allow_lan_access", False),
        "ai_redact_personal_info": cfg.get("ai_redact_personal_info", True),
        "clear_cache_on_exit": cfg.get("clear_cache_on_exit", False)
    }

@router.post("/setup")
def setup_pin(payload: PinSetupRequest, request: Request, response: Response = None):
    client_ip = get_client_ip(request)
    if is_security_pin_enabled():
        logger.warning(f"[Auth] PIN setup rejected for '{client_ip}': PIN already configured.")
        raise HTTPException(status_code=400, detail="Security PIN is already set. Use change-pin instead.")
    
    pin = payload.pin.strip()
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 12:
        raise HTTPException(status_code=400, detail="PIN must be between 4 and 12 digits (numbers only).")

    h_hex, s_hex = hash_pin(pin)
    _store_pin_credentials(h_hex, s_hex)

    logger.info(f"[Auth] Master PIN successfully initialized and enabled in archive.db from '{client_ip}'.")
    # Automatically issue session token upon successful setup
    token = create_session(client_ip)
    if response:
        response.set_cookie(key="wabs_session_token", value=token, max_age=14 * 86400, path="/", samesite="lax")
    return {"status": "success", "message": "Security PIN enabled successfully.", "token": token}

@router.post("/login")
def login_pin(payload: PinLoginRequest, request: Request, response: Response = None):
    client_ip = get_client_ip(request)
    is_locked, remaining_seconds = check_lockout(client_ip)
    if is_locked:
        logger.warning(f"[Auth] Login attempt blocked: client '{client_ip}' is locked out ({remaining_seconds}s remaining).")
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Please try again in {remaining_seconds} seconds."
        )

    # Check if database has been tampered with externally
    if check_db_pin_tampered():
        logger.critical(f"[Auth] Access denied for '{client_ip}': Database security PIN was tampered with or removed externally.")
        raise HTTPException(
            status_code=403,
            detail="Database security credentials were modified or removed externally. Please enter the original Master PIN to verify and reseal the database."
        )

    if not is_security_pin_enabled():
        token = create_session(client_ip)
        if response:
            response.set_cookie(key="wabs_session_token", value=token, max_age=14 * 86400, path="/", samesite="lax")
        return {"status": "success", "token": token}

    pin_candidate = payload.pin.strip()
    if not pin_candidate.isdigit():
        raise HTTPException(status_code=400, detail="PIN must contain digits only.")

    stored_hash, stored_salt, stored_sig = _get_stored_pin_credentials()

    if verify_pin(pin_candidate, stored_hash, stored_salt):
        reset_failed_attempts(client_ip)
        token = create_session(client_ip)
        if response:
            response.set_cookie(key="wabs_session_token", value=token, max_age=14 * 86400, path="/", samesite="lax")
        logger.info(f"[Auth] Master PIN successfully verified. Session granted to '{client_ip}'.")
        return {"status": "success", "token": token}
    else:
        record_failed_attempt(client_ip)
        is_locked_now, remaining_lock = check_lockout(client_ip)
        if is_locked_now:
            logger.error(f"[Auth] Master PIN verification failed. Client '{client_ip}' is now locked out for {remaining_lock}s.")
            raise HTTPException(
                status_code=429,
                detail=f"Incorrect PIN. Account locked for {remaining_lock} seconds."
            )
        logger.warning(f"[Auth] Master PIN verification failed for '{client_ip}'.")
        raise HTTPException(status_code=401, detail="Incorrect PIN. Please try again.")

@router.post("/reseal")
def reseal_database(payload: ResealRequest, request: Request, response: Response = None):
    """
    Reseals a tampered database if the user enters the original Master PIN.
    """
    client_ip = get_client_ip(request)
    pin = payload.pin.strip()
    if not pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must contain digits only.")

    if not check_db_pin_tampered():
        raise HTTPException(status_code=400, detail="Database is not in tampered state.")

    success = reseal_db_pin(pin)
    if success:
        reset_failed_attempts(client_ip)
        token = create_session(client_ip)
        if response:
            response.set_cookie(key="wabs_session_token", value=token, max_age=14 * 86400, path="/", samesite="lax")
        logger.info(f"[Auth] Database successfully verified and resealed by '{client_ip}'.")
        return {"status": "success", "message": "Original Master PIN verified. Database resealed successfully.", "token": token}
    else:
        record_failed_attempt(client_ip)
        raise HTTPException(status_code=401, detail="Incorrect Master PIN. Could not reseal database.")

@router.post("/logout")
def logout(request: Request, response: Response = None):
    client_ip = get_client_ip(request)
    token = extract_token(request)
    if token:
        revoke_session(token)
        logger.info(f"[Auth] Session explicitly terminated by client '{client_ip}'.")
    if response:
        response.delete_cookie(key="wabs_session_token", path="/")
    return {"status": "success", "message": "Logged out successfully."}

@router.post("/change-pin")
def change_pin(payload: PinChangeRequest, request: Request, response: Response = None):
    client_ip = get_client_ip(request)
    if not is_security_pin_enabled():
        raise HTTPException(status_code=400, detail="Security PIN is not enabled.")

    stored_hash, stored_salt, _ = _get_stored_pin_credentials()

    if not verify_pin(payload.current_pin.strip(), stored_hash, stored_salt):
        logger.warning(f"[Auth] PIN change rejected: incorrect current PIN from '{client_ip}'.")
        raise HTTPException(status_code=401, detail="Current PIN is incorrect.")

    new_pin = payload.new_pin.strip()
    if not new_pin.isdigit() or len(new_pin) < 4 or len(new_pin) > 12:
        raise HTTPException(status_code=400, detail="New PIN must be between 4 and 12 digits (numbers only).")

    h_hex, s_hex = hash_pin(new_pin)
    _store_pin_credentials(h_hex, s_hex)

    # Invalidate old sessions and issue new session token
    revoke_all_sessions()
    token = create_session(client_ip)
    if response:
        response.set_cookie(key="wabs_session_token", value=token, max_age=14 * 86400, path="/", samesite="lax")
    logger.info(f"[Auth] Master PIN updated by '{client_ip}' in archive.db. All existing sessions revoked.")
    return {"status": "success", "message": "PIN updated successfully.", "token": token}

@router.post("/disable-pin")
def disable_pin(payload: PinDisableRequest, request: Request, response: Response = None):
    client_ip = get_client_ip(request)
    if not is_security_pin_enabled():
        if response:
            response.delete_cookie(key="wabs_session_token", path="/")
        return {"status": "success", "message": "PIN is already disabled."}

    stored_hash, stored_salt, _ = _get_stored_pin_credentials()

    if not verify_pin(payload.current_pin.strip(), stored_hash, stored_salt):
        logger.warning(f"[Auth] PIN disable rejected: incorrect PIN from '{client_ip}'.")
        raise HTTPException(status_code=401, detail="Current PIN is incorrect.")

    _store_pin_credentials("", "")

    revoke_all_sessions()
    if response:
        response.delete_cookie(key="wabs_session_token", path="/")
    logger.info(f"[Auth] Master PIN protection has been disabled by '{client_ip}'.")
    return {"status": "success", "message": "Security PIN disabled."}

@router.post("/clear-cache")
def api_clear_cache(request: Request):
    client_ip = get_client_ip(request)
    # Require authentication if PIN is set
    if is_security_pin_enabled():
        token = extract_token(request)
        if not token or not validate_session(token):
            logger.warning(f"[Auth] Cache clear rejected: unauthenticated request from '{client_ip}'.")
            raise HTTPException(status_code=401, detail="Authentication required.")
    
    success = clear_thumbnail_cache()
    if success:
        logger.info(f"[Auth] Manual cache clear executed by '{client_ip}'.")
        return {"status": "success", "message": "Thumbnail cache cleared."}
    raise HTTPException(status_code=500, detail="Failed to clear thumbnail cache.")
