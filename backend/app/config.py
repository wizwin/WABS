import sys
import os
import hashlib
import uuid
import platform
import base64
from pathlib import Path
import yaml

if getattr(sys, 'frozen', False):
    BASE = Path(sys.executable).parent
else:
    BASE = Path(__file__).resolve().parent.parent.parent

CFG = BASE / "config.yaml"

DEFAULT = {
    "ai_api_key": "",
    "ai_enabled": False,
    "ai_model": "gpt-4o-mini",
    "ai_provider": "OpenAI",
    "allow_unverified_deletion": False,
    "animations_enabled": True,
    "backup_configs": [],
    "database_path": "./database/archive.db",
    "details_width": 317,
    "disable_lazy_loading": False,
    "enable_logging": False,
    "enable_photo_thumbnail_cache": True,
    "face_clustering_sensitivity": "medium",
    "face_sensitivity": "medium",
    "hidden_people": [],
    "lazy_load_chunk_size": 50,
    "min_unknown_photos": 1,
    "object_sensitivity": "medium",
    "path_mapping_enabled": False,
    "photo_thumbnail_size_limit_mb": 5,
    "pinned_people": [],
    "read_only_mode": True,
    "run_document_scan": False,
    "run_face_scan": False,
    "run_object_scan": False,
    "show_details": False,
    "show_full_timeline": False,
    "show_sidebar": True,
    "show_timeline": True,
    "show_tree_view": True,
    "sidebar_width": 237,
    "smart_searches": [],
    "document_scan_depth": "low",
    "text_extraction_limit": 300,
    "ocr_enabled": False,
    "ocr_max_pages": 3,
    "ocr_only_no_ai_tags": True,
    "ocr_cpu_threads": 4,
    "opencv_cpu_threads": 4,
    "ocr_det_limit_side_len": 736,
    "ocr_det_limit_type": "min",
    "theme": "dark",
    "thumbnail_path": "./cache/thumbnails",
    "thumbnail_size": 256,
    "auto_run_on_startup": False,
    "idle_unload_timeout_seconds": 1800
}

def _get_machine_key():
    # Bind the key to the specific hardware (Hostname, MAC address, and OS)
    seed = f"{platform.node()}_{uuid.getnode()}_{platform.system()}"
    # PBKDF2 with 100,000 iterations to derive a secure 32-byte key
    return hashlib.pbkdf2_hmac('sha256', seed.encode('utf-8'), b'wabs_secure_salt_v1', 100000)

def _encode_key(key_str):
    if not key_str: return ""
    m_key = _get_machine_key()
    iv = os.urandom(16) # Cryptographically secure random Initialization Vector
    
    plaintext = key_str.encode('utf-8')
    keystream = b""
    counter = 0
    
    # Stream Cipher: Generate keystream using SHA-256(Key + IV + Counter)
    while len(keystream) < len(plaintext):
        keystream += hashlib.sha256(m_key + iv + counter.to_bytes(4, 'big')).digest()
        counter += 1
        
    ciphertext = bytes(p ^ k for p, k in zip(plaintext, keystream))
    return base64.b64encode(iv + ciphertext).decode('utf-8')

def _decode_key(encoded_str):
    if not encoded_str: return ""
    try:
        data = base64.b64decode(encoded_str.encode('utf-8'))
        iv = data[:16]
        ciphertext = data[16:]
        
        m_key = _get_machine_key()
        keystream = b""
        counter = 0
        
        while len(keystream) < len(ciphertext):
            keystream += hashlib.sha256(m_key + iv + counter.to_bytes(4, 'big')).digest()
            counter += 1
            
        plaintext = bytes(c ^ k for c, k in zip(ciphertext, keystream))
        return plaintext.decode('utf-8')
    except Exception:
        return ""

def load_config():
    if not CFG.exists():
        save_config(DEFAULT)

    with open(CFG,"r") as f:
        config = yaml.safe_load(f) or {}

    # Flatten legacy ui_preferences if present in existing config
    if "ui_preferences" in config:
        ui_prefs = config.pop("ui_preferences")
        if isinstance(ui_prefs, dict):
            for k, v in ui_prefs.items():
                config.setdefault(k, v)

    # Decode the API key into memory if the obfuscated version exists
    if "ai_api_key_enc" in config:
        config["ai_api_key"] = _decode_key(config.pop("ai_api_key_enc"))

    for key, value in DEFAULT.items():
        config.setdefault(key, value)

    return config

def save_config(data):
    save_data = data.copy()
    # Remove legacy ui_preferences just in case it was passed
    save_data.pop("ui_preferences", None)

    # Obfuscate the API key before writing it to the disk
    if "ai_api_key" in save_data:
        save_data["ai_api_key_enc"] = _encode_key(save_data.pop("ai_api_key"))
        
    with open(CFG,"w") as f:
        yaml.dump(save_data, f)

def get_thumbnail_dir(category: str = None) -> Path:
    config = load_config()
    thumb_path = Path(config.get("thumbnail_path") or "thumbnails")
    if not thumb_path.is_absolute():
        thumb_path = BASE / thumb_path
    
    thumb_dir = thumb_path / ".wabs_cache"
    if category:
        thumb_dir = thumb_dir / category
        
    try:
        thumb_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Error creating thumbnail directory {thumb_dir}: {e}")
        
    return thumb_dir