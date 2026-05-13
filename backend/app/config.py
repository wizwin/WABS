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
    "backup_path":"C:/Backup",
    "database_path":"./database/archive.db",
    "thumbnail_path":"./cache/thumbnails",
    "thumbnail_size":256,
    "ai_enabled":False,
    "ai_provider":"OpenAI",
    "ai_model":"gpt-4o-mini",
    "openai_api_key":"",
    "path_mapping_enabled":False,
    "original_backup_path":"C:/Backup"
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

    # Decode the API key into memory if the obfuscated version exists
    if "openai_api_key_enc" in config:
        config["openai_api_key"] = _decode_key(config.pop("openai_api_key_enc"))

    for key, value in DEFAULT.items():
        config.setdefault(key, value)

    return config

def save_config(data):
    save_data = data.copy()
    # Obfuscate the API key before writing it to the disk
    if "openai_api_key" in save_data:
        save_data["openai_api_key_enc"] = _encode_key(save_data.pop("openai_api_key"))
        
    with open(CFG,"w") as f:
        yaml.dump(save_data, f)