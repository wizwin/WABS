from pathlib import Path
import json
import mimetypes
import os
import platform
import re
import subprocess
import sqlite3
import shutil
import sys
import threading
import traceback
import time

from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, or_, Integer
from fastapi.staticfiles import StaticFiles

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import fitz
except ImportError:
    fitz = None

try:
    import docx
except ImportError:
    docx = None

try:
    from backend.app.database import SessionLocal, FileIndex
    from backend.app.config import load_config, save_config
    from backend.app.indexer import start as start_indexing, STATE as STATE
    from backend.app.ai_database import init_ai_database
except ModuleNotFoundError:
    from database import SessionLocal, FileIndex
    from config import load_config, save_config
    from indexer import start as start_indexing, STATE as STATE

app = FastAPI()

def get_log_path() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent / "wabs.log"
    else:
        return Path(__file__).resolve().parent.parent.parent / "wabs.log"

LOGGING_ENABLED = False
LOG_FILE_PATH = get_log_path()

class PrintLogger:
    def __init__(self, stream, max_bytes=5*1024*1024):
        self.stream = stream
        self.max_bytes = max_bytes
        self.current_size = 0
        try:
            if LOG_FILE_PATH.exists():
                self.current_size = LOG_FILE_PATH.stat().st_size
        except Exception:
            pass

    def rotate(self):
        try:
            if LOG_FILE_PATH.exists():
                backup_path = LOG_FILE_PATH.with_suffix('.1.log')
                if backup_path.exists():
                    backup_path.unlink()
                LOG_FILE_PATH.rename(backup_path)
            self.current_size = 0
        except Exception:
            pass

    def write(self, data):
        if not data:
            return
        if self.stream:
            self.stream.write(data)
            self.stream.flush()
        if LOGGING_ENABLED:
            try:
                data_len = len(data.encode('utf-8'))
                if self.current_size + data_len > self.max_bytes:
                    self.rotate()
                with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
                    f.write(data)
                self.current_size += data_len
            except Exception:
                pass

    def flush(self):
        if self.stream:
            self.stream.flush()

    def isatty(self):
        if self.stream and hasattr(self.stream, 'isatty'):
            return self.stream.isatty()
        return False

sys.stdout = PrintLogger(sys.stdout)
sys.stderr = PrintLogger(sys.stderr)

# Removed heavy face recognition dependencies.
# We will now use cv2 (OpenCV) exclusively for face detection and recognition.

face_scanner_thread = None
face_scanner_running = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
from pydantic import BaseModel

@app.on_event("startup")
def startup_event():
    global LOGGING_ENABLED
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    try:
        cfg = load_config()
        LOGGING_ENABLED = cfg.get("enable_logging", False)
    except Exception:
        pass
    try:
        with SessionLocal() as s:
            count = s.query(FileIndex).count()
            STATE["indexed"] = count
            STATE["current"] = count
    except Exception as e:
        print(f"CRITICAL: Startup database connection failed: {e}")
        traceback.print_exc()

def _parse_json(value):
    if not value:
        return {}
    try:
        return json.loads(value)
    except Exception:
        return {}


def _build_item(r, cache_flag=""):
    v = str(r.modified).replace(" ", "_").replace(":", "") if r.modified else "0"
    return {
        "id": r.id,
        "filename": r.filename,
        "path": r.path,
        "category": r.category,
        "size": r.size,
        "modified": r.modified,
        "extension": r.extension,
        "tags": r.tags,
        "metadata": _parse_json(r.metadata_json),
        "thumbnail": f"/preview/{r.id}?v={v}{cache_flag}"
    }


def get_ai_db_path() -> Path:
    cfg = load_config()
    db_path = cfg.get("database_path")
    if not db_path:
        p = Path("archive.db")
    else:
        p = Path(db_path)
        
    if not p.is_absolute():
        if getattr(sys, 'frozen', False):
            p = Path(sys.executable).parent / p
        else:
            p = Path(__file__).resolve().parent.parent.parent / p
            
    if p.parent.is_file():
        return p.parent.parent / "ai_metadata.db"
    return p.parent / "ai_metadata.db"

def _resolve_path(original_path: Path) -> Path:
    cfg = load_config()
    backup_configs = cfg.get("backup_configs", [])

    for config in backup_configs:
        if config.get("path_mapping_enabled"):
            source_root_str = config.get("backup_path")
            target_root_str = config.get("mapped_backup_path")

            if source_root_str and target_root_str:
                try:
                    # Pre-normalize slashes to ensure Windows network paths (\\) 
                    # parse correctly into .parts even if running on Linux/Mac (/)
                    normalized_orig = str(original_path).replace('\\', os.sep).replace('/', os.sep)
                    normalized_src = source_root_str.replace('\\', os.sep).replace('/', os.sep)
                    
                    src_path = Path(normalized_src)
                    tgt_path = Path(target_root_str)
                    
                    orig_parts = Path(normalized_orig).parts
                    src_parts = src_path.parts
                    
                    if len(orig_parts) >= len(src_parts):
                        # Verify the components actually match before splicing
                        match = True
                        for i in range(len(src_parts)):
                            orig_part = orig_parts[i]
                            src_part = src_parts[i]
                            if platform.system() == "Windows":
                                orig_part = orig_part.lower()
                                src_part = src_part.lower()
                            if orig_part != src_part:
                                match = False
                                break
                        if match:
                            return tgt_path.joinpath(*orig_parts[len(src_parts):])
                except Exception as e:
                    print(f"WARNING: Path remapping failed for {original_path}: {e}")
                    traceback.print_exc()

    # This part is reached if remapping is OFF, or if the path was not applicable for remapping.
    return original_path

def get_bundled_model_path(model_filename: str) -> str:
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller extracts bundled files to a temporary _MEIPASS folder
        return str(Path(sys._MEIPASS) / "backend" / model_filename)
    # Development mode: resolve relative to backend directory
    return str(Path(__file__).parent.parent / model_filename)


def _parse_regex_pattern(query):
    if len(query) < 3 or not query.startswith("/"):
        return None
    last_slash = query.rfind("/")
    if last_slash == 0:
        return None

    pattern = query[1:last_slash]
    flags = query[last_slash + 1:]
    re_flags = 0
    if "i" in flags:
        re_flags |= re.IGNORECASE
    try:
        return re.compile(pattern, re_flags)
    except re.error:
        return None


def _build_search_query(query, s, q_base=None):
    if q_base is None:
        q_base = s.query(FileIndex)
    query = query.strip()
    if not query:
        return q_base

    def text_filter(field, term):
        return func.lower(func.coalesce(field, "")).contains(term)

    raw_tokens = re.findall(r'(?:[^\s"]|"(?:\\.|[^"])*")+', query)
    tokens = [t.replace('"', '') for t in raw_tokens]
    filters = []
    tag_tokens = []
    and_tag_tokens = []
    specific_filters = []
    exclude_filters = []

    for token in tokens:
        lower_token = token.lower()
        if lower_token.startswith("-") and len(lower_token) > 1:
            val = lower_token[1:]
            if val.startswith("tag:"):
                tag_val = token[len("-tag:"):]
                exclude_filters.append(or_(
                    text_filter(FileIndex.tags, tag_val.lower()),
                    text_filter(FileIndex.path, tag_val.lower()),
                    text_filter(FileIndex.filename, tag_val.lower()),
                    text_filter(FileIndex.metadata_json, tag_val.lower())
                ))
            elif val.startswith("object:"):
                exclude_filters.append(or_(
                    text_filter(FileIndex.tags, val),
                    text_filter(FileIndex.path, val),
                    text_filter(FileIndex.filename, val),
                    text_filter(FileIndex.metadata_json, val)
                ))
            elif val.startswith("person:"):
                exclude_filters.append(or_(
                    text_filter(FileIndex.tags, val),
                    text_filter(FileIndex.path, val),
                    text_filter(FileIndex.filename, val),
                    text_filter(FileIndex.metadata_json, val)
                ))
            elif val.startswith("type:"):
                t_val = val[len("type:"):]
                t_val_ext = t_val if t_val.startswith(".") else "." + t_val
                exclude_filters.append(or_(
                    func.lower(FileIndex.extension) == t_val_ext,
                    func.lower(FileIndex.category) == t_val
                ))
            elif val.startswith("name:"):
                n_val = val[len("name:"):]
                exclude_filters.append(text_filter(FileIndex.filename, n_val))
            else:
                exclude_filters.append(or_(
                    text_filter(FileIndex.filename, val),
                    text_filter(FileIndex.path, val),
                    text_filter(FileIndex.tags, val),
                    text_filter(FileIndex.metadata_json, val)
                ))
            continue
        if lower_token.startswith("date:"):
            val = lower_token[len("date:"):]
            # Date range like YYYY-YYYY
            if m_range := re.match(r"^(\d{4})-(\d{4})$", val):
                start_year, end_year = m_range.groups()
                if int(start_year) <= int(end_year):
                    specific_filters.append(FileIndex.modified >= f"{start_year}-01-01")
                    specific_filters.append(FileIndex.modified < f"{int(end_year) + 1}-01-01")
            # Intelligently parse mm/dd/yyyy or dd/mm/yyyy
            elif m := re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", val):
                p1, p2, year = m.groups()
                p1, p2 = p1.zfill(2), p2.zfill(2)
                specific_filters.append(or_(
                    text_filter(FileIndex.modified, f"{year}-{p1}-{p2}"),
                    text_filter(FileIndex.modified, f"{year}-{p2}-{p1}")
                ))
            else:
                specific_filters.append(text_filter(FileIndex.modified, val))
        elif lower_token.startswith("+tag:"):
            and_tag_tokens.append(token[len("+tag:"):].lower())
        elif lower_token.startswith("tag:"):
            tag_tokens.append(token[len("tag:"):].lower())
        elif lower_token.startswith("+object:"):
            and_tag_tokens.append(lower_token[1:])
        elif lower_token.startswith("object:"):
            tag_tokens.append(lower_token)
        elif lower_token.startswith("+person:"):
            and_tag_tokens.append(lower_token[1:])
        elif lower_token.startswith("person:"):
            tag_tokens.append(lower_token)
        elif lower_token.startswith("type:"):
            val = lower_token[len("type:"):]
            val_ext = val if val.startswith(".") else "." + val
            specific_filters.append(or_(
                func.lower(FileIndex.extension) == val_ext,
                func.lower(FileIndex.category) == val
            ))
        elif lower_token.startswith("name:"):
            val = lower_token[len("name:"):]
            specific_filters.append(text_filter(FileIndex.filename, val))
        elif lower_token.startswith("size:"):
            val = lower_token[len("size:"):]
            operator = ""
            if val.startswith(">="):
                operator, val = ">=", val[2:]
            elif val.startswith("<="):
                operator, val = "<=", val[2:]
            elif val.startswith(">"):
                operator, val = ">", val[1:]
            elif val.startswith("<"):
                operator, val = "<", val[1:]
                
            bytes_val = None
            if m := re.match(r"^(\d+(?:\.\d+)?)\s*([kmgtp]?b)?$", val.lower()):
                num, unit = float(m.group(1)), m.group(2)
                mult = 1
                if unit == "kb": mult = 1024
                elif unit == "mb": mult = 1024**2
                elif unit == "gb": mult = 1024**3
                elif unit == "tb": mult = 1024**4
                elif unit == "pb": mult = 1024**5
                bytes_val = int(num * mult)
                
            if operator and bytes_val is not None:
                size_col = func.cast(FileIndex.size, Integer)
                if operator == ">=": specific_filters.append(size_col >= bytes_val)
                elif operator == "<=": specific_filters.append(size_col <= bytes_val)
                elif operator == ">": specific_filters.append(size_col > bytes_val)
                elif operator == "<": specific_filters.append(size_col < bytes_val)
            else:
                specific_filters.append(func.lower(FileIndex.size).like(f"{val}%"))
        elif lower_token.startswith("length:"):
            val = lower_token[len("length:"):]
            operator = ""
            if val.startswith(">="):
                operator, val = ">=", val[2:]
            elif val.startswith("<="):
                operator, val = "<=", val[2:]
            elif val.startswith(">"):
                operator, val = ">", val[1:]
            elif val.startswith("<"):
                operator, val = "<", val[1:]
                
            num_val = None
            if m := re.match(r"^(\d+(?:\.\d+)?)\s*([smh])?$", val.lower()):
                num, unit = float(m.group(1)), m.group(2)
                mult = 1
                if unit == "m": mult = 60
                elif unit == "h": mult = 3600
                num_val = num * mult
                
            if operator and num_val is not None:
                duration_col = func.cast(func.json_extract(FileIndex.metadata_json, '$.duration'), Integer)
                fmt_duration_col = func.cast(func.json_extract(FileIndex.metadata_json, '$.format.duration'), Integer)
                length_col = func.cast(func.json_extract(FileIndex.metadata_json, '$.length'), Integer)
                val_col = func.coalesce(duration_col, fmt_duration_col, length_col)
                
                if operator == ">=": specific_filters.append(val_col >= num_val)
                elif operator == "<=": specific_filters.append(val_col <= num_val)
                elif operator == ">": specific_filters.append(val_col > num_val)
                elif operator == "<": specific_filters.append(val_col < num_val)
            else:
                specific_filters.append(text_filter(FileIndex.metadata_json, val))
        elif "*" in lower_token:
            like_val = lower_token.replace("*", "%")
            specific_filters.append(func.lower(func.coalesce(FileIndex.filename, "")).like(like_val))
        else:
            filters.append(lower_token)

    q = q_base
    for sf in specific_filters:
        q = q.filter(sf)

    if filters:
        for term in filters:
            q = q.filter(or_(
                text_filter(FileIndex.filename, term),
                text_filter(FileIndex.path, term),
                text_filter(FileIndex.tags, term),
                text_filter(FileIndex.metadata_json, term)
            ))
    if tag_tokens:
        q = q.filter(or_(*[
            or_(
                text_filter(FileIndex.tags, tag),
                text_filter(FileIndex.path, tag),
                text_filter(FileIndex.filename, tag),
                text_filter(FileIndex.metadata_json, tag)
            )
            for tag in tag_tokens
        ]))
    if and_tag_tokens:
        for tag in and_tag_tokens:
            q = q.filter(or_(
                text_filter(FileIndex.tags, tag),
                text_filter(FileIndex.path, tag),
                text_filter(FileIndex.filename, tag),
                text_filter(FileIndex.metadata_json, tag)
            ))
    if exclude_filters:
        for ef in exclude_filters:
            q = q.filter(~ef)
    return q

@app.get("/files")
def files(category:str="all", offset:int=0, limit:int=50):
    cfg = load_config()
    ui_prefs = cfg.get("ui_preferences", {})
    cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", cfg.get("enable_photo_thumbnail_cache", False))
    cache_flag = "&tc=1" if cache_enabled else ""

    with SessionLocal() as s:
        q = s.query(FileIndex)
        if category != "all":
            if category == "other":
                standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                q = q.filter(~FileIndex.category.in_(standard))
            elif category == "duplicates":
                dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                q = q.filter(FileIndex.size.in_(dup_sizes))
                q = q.order_by(func.cast(FileIndex.size, Integer).desc(), FileIndex.id)
            else:
                q = q.filter(FileIndex.category == category)
        rows = q.offset(offset).limit(limit).all()
        return [_build_item(r, cache_flag) for r in rows]

@app.get("/search")
def search(query:str="", category:str="all", offset:int=0, limit:int=50):
    cfg = load_config()
    ui_prefs = cfg.get("ui_preferences", {})
    cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", cfg.get("enable_photo_thumbnail_cache", False))
    cache_flag = "&tc=1" if cache_enabled else ""

    from sqlalchemy import text
    with SessionLocal() as s:
        q_base = s.query(FileIndex)
        if category != "all":
            if category == "other":
                standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                q_base = q_base.filter(~FileIndex.category.in_(standard))
            elif category == "duplicates":
                dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                q_base = q_base.filter(FileIndex.size.in_(dup_sizes))
                q_base = q_base.order_by(func.cast(FileIndex.size, Integer).desc(), FileIndex.id)
            else:
                q_base = q_base.filter(FileIndex.category == category)

        query = query.strip()
        if not query:
            rows = q_base.offset(offset).limit(limit).all()
            return [_build_item(r, cache_flag) for r in rows]

        regex = _parse_regex_pattern(query)
        if regex:
            filtered = []
            match_count = 0
            # yield_per prevents loading millions of rows into memory at once
            for r in q_base.yield_per(1000):
                haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                if regex.search(haystack):
                    if match_count >= offset:
                        filtered.append(r)
                    match_count += 1
                    if len(filtered) == limit:
                        break
            return [_build_item(r, cache_flag) for r in filtered]

        # Fallback to standard builder for custom search parameters (date:, size:, etc)
        search_prefixes = ["date:", "tag:", "type:", "name:", "size:", "length:", "object:", "person:"]
        if any(prefix in query.lower() for prefix in search_prefixes) or "*" in query or query.startswith("-") or " -" in query or query.startswith("+") or " +" in query:
            q = _build_search_query(query, s, q_base)
            rows = q.offset(offset).limit(limit).all()
            return [_build_item(r, cache_flag) for r in rows]
            
        # FTS5 Lightning-Fast Search Path
        safe_query = query.replace('"', '""').replace("'", "''")
        fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
        if not fts_terms:
            return []
            
        fts_query = " AND ".join(fts_terms)
        
        matching_ids = s.execute(
            text("SELECT rowid FROM files_fts WHERE files_fts MATCH :q ORDER BY rank LIMIT 1000"),
            {"q": fts_query}
        ).scalars().all()

        if not matching_ids:
            return []
            
        rows = q_base.filter(FileIndex.id.in_(matching_ids)).all()
        id_to_row = {r.id: r for r in rows}
        sorted_rows = [id_to_row[i] for i in matching_ids if i in id_to_row]
        
        return [_build_item(r, cache_flag) for r in sorted_rows[offset:offset+limit]]

@app.get("/search/suggestions")
def search_suggestions(q: str = "", limit: int = 5):
    from sqlalchemy import text
    import difflib
    
    q = q.strip().lower()
    if not q:
        return {"type": "none", "suggestions": [], "last_word": ""}
        
    words = q.split()
    last_word = words[-1]
    
    with SessionLocal() as s:
        # 1. Try Auto-complete (fast prefix match) using the FTS5 Vocab table
        results = s.execute(
            text("SELECT term FROM files_fts_vocab WHERE term LIKE :prefix ORDER BY doc DESC LIMIT :limit"),
            {"prefix": f"{last_word}%", "limit": limit}
        ).scalars().all()
        
        if results:
            return {"type": "autocomplete", "suggestions": results, "last_word": last_word}
            
        # 2. Try "Did you mean?" (spell-check fuzzy match) if no exact prefixes exist
        if len(last_word) >= 3:
            all_terms = s.execute(
                text("SELECT term FROM files_fts_vocab WHERE length(term) BETWEEN :min_l AND :max_l ORDER BY doc DESC LIMIT 1000"),
                {"min_l": len(last_word)-2, "max_l": len(last_word)+2}
            ).scalars().all()
            
            close_matches = difflib.get_close_matches(last_word, all_terms, n=limit, cutoff=0.7)
            if close_matches:
                return {"type": "did_you_mean", "suggestions": close_matches, "last_word": last_word}
                
    return {"type": "none", "suggestions": [], "last_word": last_word}

@app.get("/preview/{item_id}")
def preview(item_id:int):
    with SessionLocal() as session:
        item = session.get(FileIndex, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        file_path = _resolve_path(Path(item.path))
        file_category = item.category

    if file_path.exists() and file_path.is_file():
        if file_category == "photo":
            cfg = load_config()
            ui_prefs = cfg.get("ui_preferences", {})
            cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", cfg.get("enable_photo_thumbnail_cache", False))
            
            if cache_enabled:
                try:
                    size_limit_mb = float(ui_prefs.get("photo_thumbnail_size_limit_mb", cfg.get("photo_thumbnail_size_limit_mb", 5)))
                    size_limit_bytes = size_limit_mb * 1024 * 1024
                    
                    if file_path.stat().st_size > size_limit_bytes:
                        thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "photos"
                        thumb_dir.mkdir(parents=True, exist_ok=True)
                        cached_thumb = thumb_dir / f"{file_path.stem}_{file_path.stat().st_size}.jpg"
                        
                        if cached_thumb.exists():
                            return FileResponse(str(cached_thumb), media_type="image/jpeg")
                            
                        if cv2 is not None:
                            import numpy as np
                            img_array = np.fromfile(str(file_path), np.uint8)
                            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                            if img is not None:
                                height, width = img.shape[:2]
                                scaling_factor = min(800 / width, 800 / height)
                                if scaling_factor < 1.0:
                                    new_size = (int(width * scaling_factor), int(height * scaling_factor))
                                    resized_img = cv2.resize(img, new_size, interpolation=cv2.INTER_AREA)
                                else:
                                    resized_img = img
                                    
                                is_success, buffer = cv2.imencode(".jpg", resized_img)
                                if is_success:
                                    with open(str(cached_thumb), "wb") as f:
                                        f.write(buffer.tobytes())
                                    if cached_thumb.exists():
                                        return FileResponse(str(cached_thumb), media_type="image/jpeg")
                except Exception as e:
                    print(f"Large photo thumbnail error: {e}")

            media_type, _ = mimetypes.guess_type(str(file_path))
            return FileResponse(str(file_path), media_type=media_type or "application/octet-stream")
        elif file_category == "video":
            cfg = load_config()
            # Enforce an isolated sub-directory so we never overwrite user files
            thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
            thumb_dir.mkdir(parents=True, exist_ok=True)
            
            cached_thumb = thumb_dir / f"{item_id}.jpg"
            if cached_thumb.exists():
                return FileResponse(str(cached_thumb), media_type="image/jpeg")
            
            if cv2 is not None:
                try:
                    cap = cv2.VideoCapture(str(file_path))
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    if frame_count > 0:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_count * 0.1)) # Skip to 10% to avoid black start frames
                    success, frame = cap.read()
                    if not success:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        success, frame = cap.read()
                    if success:
                        height, width = frame.shape[:2]
                        scaling_factor = min(400 / width, 300 / height)
                        new_size = (int(width * scaling_factor), int(height * scaling_factor))
                        resized_frame = cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)
                        is_success, buffer = cv2.imencode(".jpg", resized_frame)
                        if is_success:
                            with open(str(cached_thumb), "wb") as f:
                                f.write(buffer.tobytes())
                        cap.release()
                        if cached_thumb.exists():
                            return FileResponse(str(cached_thumb), media_type="image/jpeg")
                    cap.release()
                except Exception as e:
                    print(f"ERROR: Video thumbnail error for {file_path}: {e}")
                    traceback.print_exc()
                    
        elif file_category in ["document", "code"] or file_path.suffix.lower() in [".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".log"]:
            if file_path.suffix.lower() == ".pdf":
                cfg = load_config()
                # Enforce an isolated sub-directory so we never overwrite user files
                thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
                thumb_dir.mkdir(parents=True, exist_ok=True)
                
                cached_thumb = thumb_dir / f"{item_id}.jpg"
                if cached_thumb.exists():
                    return FileResponse(str(cached_thumb), media_type="image/jpeg")
                
                if fitz is not None:
                    try:
                        doc = fitz.open(str(file_path))
                        
                        if doc.needs_pass:
                            doc.close()
                            placeholder = """
<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>
  <rect width='400' height='300' fill='#111827'/>
  <text x='50%' y='45%' fill='#94a3b8' font-family='Segoe UI,Arial' font-size='22' text-anchor='middle'>Preview unavailable</text>
  <text x='50%' y='60%' fill='#64748b' font-family='Segoe UI,Arial' font-size='16' text-anchor='middle'>ENCRYPTED PDF</text>
</svg>
"""
                            return Response(content=placeholder, media_type='image/svg+xml')

                        page = doc.load_page(0)
                        pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                        pix.save(str(cached_thumb))
                        doc.close()
                        if cached_thumb.exists():
                            return FileResponse(str(cached_thumb), media_type="image/jpeg")
                    except Exception as e:
                        print(f"ERROR: PDF thumbnail error for {file_path}: {e}")
                        traceback.print_exc()
            elif file_path.suffix.lower() == ".docx" and docx is not None:
                try:
                    doc = docx.Document(str(file_path))
                    lines = []
                    for p in doc.paragraphs:
                        if p.text.strip():
                            lines.append(p.text.strip())
                        if len(lines) >= 11:
                            break
                    
                    svg_lines = ""
                    y = 28
                    for line in lines:
                        safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')[:50]
                        svg_lines += f"<text x='16' y='{y}' fill='#cbd5e1' font-family='monospace' font-size='13'>{safe_line}</text>\n"
                        y += 24
                        
                    text_svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>\n  <rect width='400' height='300' fill='#0f172a'/>\n{svg_lines}</svg>"
                    return Response(content=text_svg, media_type='image/svg+xml')
                except Exception as e:
                    print(f"ERROR: DOCX thumbnail error for {file_path}: {e}")
            else:
                text_extensions = [".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".py", ".js", ".html", ".css", ".c", ".cpp", ".h", ".java", ".cs", ".go", ".rs", ".rb", ".php", ".sh", ".bat", ".sql"]
                if file_path.suffix.lower() in text_extensions:
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = [f.readline().rstrip('\n') for _ in range(11)]
                        
                        svg_lines = ""
                        y = 28
                        for line in lines:
                            safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')[:50]
                            svg_lines += f"<text x='16' y='{y}' fill='#cbd5e1' font-family='monospace' font-size='13'>{safe_line}</text>\n"
                            y += 24
                            
                        text_svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>\n  <rect width='400' height='300' fill='#0f172a'/>\n{svg_lines}</svg>"
                        return Response(content=text_svg, media_type='image/svg+xml')
                    except Exception as e:
                        print(f"ERROR: Text thumbnail error for {file_path}: {e}")
                        traceback.print_exc()

    placeholder = """
<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>
  <rect width='400' height='300' fill='#111827'/>
  <text x='50%' y='45%' fill='#94a3b8' font-family='Segoe UI,Arial' font-size='22' text-anchor='middle'>Preview unavailable</text>
  <text x='50%' y='60%' fill='#64748b' font-family='Segoe UI,Arial' font-size='16' text-anchor='middle'>{}</text>
</svg>
""".format(file_category.upper())
    return Response(content=placeholder, media_type='image/svg+xml')

@app.post("/open/{item_id}")
def open_file(item_id:int):
    with SessionLocal() as session:
        item = session.get(FileIndex, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        return open_file_path(Path(item.path))

@app.post("/open-path")
def open_file_path(path: str = Body(..., embed=True)):
    file_path = _resolve_path(Path(path))
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")

    system_name = platform.system()
    try:
        if system_name == "Windows":
            subprocess.Popen(f'start "" "{file_path}"', shell=True)
        elif system_name == "Darwin":
            subprocess.Popen(["open", str(file_path)])
        else:
            subprocess.Popen(["xdg-open", str(file_path)])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to open file: {exc}")

    return {"opened": True, "path": str(file_path), "platform": system_name}

@app.post("/open-folder")
def open_folder(path: str = Body(..., embed=True)):
    folder_path = _resolve_path(Path(path)).parent
    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    system_name = platform.system()
    try:
        if system_name == "Windows":
            subprocess.Popen(f'start "" "{folder_path}"', shell=True)
        elif system_name == "Darwin":
            subprocess.Popen(["open", str(folder_path)])
        else:
            subprocess.Popen(["xdg-open", str(folder_path)])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to open folder: {exc}")

    return {"opened": True, "path": str(folder_path), "platform": system_name}

@app.post("/delete-files")
def delete_files(paths: list[str] = Body(..., embed=True)):
    cfg = load_config()
    if cfg.get("read_only_mode", True):
        raise HTTPException(status_code=403, detail="Read-Only Mode is enabled. Deletion is blocked.")

    backup_configs = cfg.get("backup_configs", [])
    for path_str in paths:
        for config in backup_configs:
            bp = config.get("backup_path")
            if bp and config.get("read_only_mode", True):
                orig_norm = os.path.normpath(path_str)
                bp_norm = os.path.normpath(bp)
                if platform.system() == "Windows":
                    if orig_norm.lower().startswith(bp_norm.lower()):
                        raise HTTPException(status_code=403, detail=f"Read-Only Mode is enabled for backup '{config.get('name', 'location')}'. Deletion is blocked.")
                else:
                    if orig_norm.startswith(bp_norm):
                        raise HTTPException(status_code=403, detail=f"Read-Only Mode is enabled for backup '{config.get('name', 'location')}'. Deletion is blocked.")

    deleted_count = 0
    with SessionLocal() as session:
        for path_str in paths:
            file_path = _resolve_path(Path(path_str))
            try:
                if file_path.exists() and file_path.is_file():
                    file_path.unlink() # Deletes file from disk
                session.query(FileIndex).filter(FileIndex.path == path_str).delete()
                deleted_count += 1
            except Exception as e:
                if cfg.get("enable_logging"):
                    import logging
                    logging.error(f"Critical error: Failed to delete {path_str}: {e}", exc_info=True)
                print(f"Failed to delete {path_str}: {e}")
        session.commit()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Deleted {deleted_count} files.")
    return {"deleted": deleted_count}

@app.post("/copy-files")
def copy_files(paths: list[str] = Body(...), destination: str = Body(...)):
    dest_path = Path(destination)
    if not dest_path.exists() or not dest_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid destination directory")
    
    copied_count = 0
    for path_str in paths:
        src = _resolve_path(Path(path_str))
        if src.exists() and src.is_file():
            try:
                shutil.copy2(src, dest_path / src.name)
                copied_count += 1
            except Exception as e:
                if load_config().get("enable_logging"):
                    import logging
                    logging.error(f"Critical error: Failed to copy {path_str}: {e}", exc_info=True)
                print(f"Failed to copy {path_str}: {e}")
    if load_config().get("enable_logging"):
        import logging
        logging.info(f"Successfully copied {copied_count} files to destination.")
    return {"copied": copied_count}

@app.post("/move-files")
def move_files(paths: list[str] = Body(...), destination: str = Body(...)):
    cfg = load_config()
    if cfg.get("read_only_mode", True):
        raise HTTPException(status_code=403, detail="Read-Only Mode is enabled. Moving files is blocked.")

    backup_configs = cfg.get("backup_configs", [])
    for path_str in paths:
        for config in backup_configs:
            bp = config.get("backup_path")
            if bp and config.get("read_only_mode", True):
                orig_norm = os.path.normpath(path_str)
                bp_norm = os.path.normpath(bp)
                if platform.system() == "Windows":
                    if orig_norm.lower().startswith(bp_norm.lower()):
                        raise HTTPException(status_code=403, detail=f"Read-Only Mode is enabled for backup '{config.get('name', 'location')}'. Moving files is blocked.")
                else:
                    if orig_norm.startswith(bp_norm):
                        raise HTTPException(status_code=403, detail=f"Read-Only Mode is enabled for backup '{config.get('name', 'location')}'. Moving files is blocked.")

    dest_path = Path(destination)
    if not dest_path.exists() or not dest_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid destination directory")
    
    moved_count = 0
    updates = {}
    with SessionLocal() as session:
        for path_str in paths:
            src = _resolve_path(Path(path_str))
            if src.exists() and src.is_file():
                try:
                    new_target = dest_path / src.name
                    shutil.move(str(src), str(new_target))
                    
                    db_item = session.query(FileIndex).filter(FileIndex.path == path_str).first()
                    if db_item:
                        db_item.path = str(new_target)
                    
                    updates[path_str] = str(new_target)
                    moved_count += 1
                except Exception as e:
                    if cfg.get("enable_logging"):
                        import logging
                        logging.error(f"Critical error: Failed to move {path_str}: {e}", exc_info=True)
                    print(f"Failed to move {path_str}: {e}")
        session.commit()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Successfully moved {moved_count} files to destination.")
    return {"moved": moved_count, "updates": updates}

@app.get("/stats")
def stats():
    with SessionLocal() as s:
        # Grouping drastically speeds up counting for millions of rows compared to 5 separate counts
        results = s.query(FileIndex.category, func.count(FileIndex.id)).group_by(FileIndex.category).all()
        stats_dict = {"total": 0, "duplicates": 0, "photos": 0, "videos": 0, "audio": 0, "documents": 0, "ebooks": 0, "code": 0, "fonts": 0, "databases": 0, "compressed": 0, "installers": 0, "binaries": 0, "others": 0}
        for cat, count in results:
            stats_dict["total"] += count
            if cat == "photo": stats_dict["photos"] += count
            elif cat == "video": stats_dict["videos"] += count
            elif cat == "audio": stats_dict["audio"] += count
            elif cat == "document": stats_dict["documents"] += count
            elif cat == "ebook": stats_dict["ebooks"] += count
            elif cat == "code": stats_dict["code"] += count
            elif cat == "font": stats_dict["fonts"] += count
            elif cat == "database": stats_dict["databases"] += count
            elif cat == "compressed": stats_dict["compressed"] += count
            elif cat == "installer": stats_dict["installers"] += count
            elif cat == "binary": stats_dict["binaries"] += count
            else: stats_dict["others"] += count
            
        dup_subq = s.query(func.count(FileIndex.id).label('c')).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1).subquery()
        dup_count = s.query(func.sum(dup_subq.c.c)).scalar() or 0
        stats_dict["duplicates"] = int(dup_count)
        
        stats_dict["known_faces"] = 0
        stats_dict["unknown_faces"] = 0
        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            try:
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='faces'")
                    if cursor.fetchone():
                        cursor.execute("SELECT COUNT(DISTINCT people.id) FROM faces JOIN people ON faces.person_id = people.id WHERE people.name NOT LIKE 'Unknown Person%'")
                        stats_dict["known_faces"] = cursor.fetchone()[0] or 0
                        
                        cursor.execute("SELECT COUNT(DISTINCT people.id) FROM faces JOIN people ON faces.person_id = people.id WHERE people.name LIKE 'Unknown Person%'")
                        stats_dict["unknown_faces"] = cursor.fetchone()[0] or 0
            except Exception as e:
                print(f"Error fetching AI stats: {e}")
                
        return stats_dict

@app.get("/timeline")
def timeline(category: str = "all"):
    with SessionLocal() as s:
        q = s.query(func.date(FileIndex.modified).label("date"), func.count(FileIndex.id))
        if category != "all":
            if category == "other":
                standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                q = q.filter(~FileIndex.category.in_(standard))
            elif category == "duplicates":
                dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                q = q.filter(FileIndex.size.in_(dup_sizes))
            else:
                q = q.filter(FileIndex.category == category)
        
        q = q.filter(FileIndex.modified.isnot(None))
        q = q.group_by('date').order_by('date')
        rows = q.all()
        return [{"date": r[0], "count": r[1]} for r in rows if r[0]]

class IndexRequest(BaseModel):
    tag: bool = False
    face: bool = False

@app.post("/indexer/set-options")
def indexer_set_options(req: IndexRequest):
    try:
        cfg = load_config()
        cfg["run_face_scan"] = req.face
        cfg["run_object_scan"] = req.tag
        save_config(cfg)
        return {"saved": True}
    except Exception as e:
        print(f"Warning: could not save scan options to config: {e}")
        raise HTTPException(status_code=500, detail="Could not save options")

@app.get("/indexer/status")
def indexer_status():
    status = dict(STATE)
    status["face_scanner_running"] = face_scanner_running
    status["object_scanner_running"] = object_scanner_running
    status["combined_scanner_running"] = combined_scanner_running
    status["combined_scanner_stopped"] = combined_scanner_stopped
    return status

@app.post("/indexer/start")
def indexer_start(req: IndexRequest = None):
    global combined_scanner_thread, combined_scanner_running, combined_scanner_stopped
    if req is None:
        req = IndexRequest()

    if cv2 is None and (req.tag or req.face):
        raise HTTPException(status_code=500, detail="OpenCV is required for face and object recognition.")
    if STATE.get("running") or combined_scanner_running:
        return {"started": True, "ignored": True}
    STATE["update_only"] = False

    if req.tag or req.face:
        combined_scanner_running = True
        combined_scanner_stopped = False
        combined_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": True, "run_object": req.tag, "run_face": req.face})
        combined_scanner_thread.start()
    else:
        start_indexing()
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive indexing started.")
    return {"started": STATE.get("running", True)}

@app.post("/indexer/pause")
def indexer_pause():
    if (STATE.get("running") or combined_scanner_running) and not STATE.get("paused"):
        STATE["paused"] = True
        STATE["status"] = "Paused"
    return STATE

@app.post("/indexer/resume")
def indexer_resume():
    if not STATE.get("running") and not combined_scanner_running:
        # App was closed or stopped. Resume intelligently continues from the DB state.
        STATE["update_only"] = True
        start_indexing()
        return {"resumed_from_db": True}
    if (STATE.get("running") or combined_scanner_running) and STATE.get("paused"):
        STATE["paused"] = False
        STATE["status"] = "Indexing & Scanning..." if combined_scanner_running else "Indexing"
    return STATE

@app.post("/indexer/stop")
def indexer_stop():
    if STATE.get("running") or combined_scanner_running:
        STATE["stopped"] = True
        STATE["paused"] = False
        STATE["status"] = "Stopping..."

    global combined_scanner_stopped, face_scanner_running, object_scanner_running
    combined_scanner_stopped = True
    face_scanner_running = False
    object_scanner_running = False
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive indexing stopped.")
    return STATE

@app.post("/indexer/update")
def indexer_update(req: IndexRequest = None):
    global combined_scanner_thread, combined_scanner_running, combined_scanner_stopped
    if req is None:
        req = IndexRequest()

    if cv2 is None and (req.tag or req.face):
        raise HTTPException(status_code=500, detail="OpenCV is required for face and object recognition.")
    if STATE.get("running") or combined_scanner_running:
        return {"updating": False, "ignored": True}
    STATE["update_only"] = True

    if req.tag or req.face:
        combined_scanner_running = True
        combined_scanner_stopped = False
        combined_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": True, "run_object": req.tag, "run_face": req.face})
        combined_scanner_thread.start()
    else:
        start_indexing()
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive indexing update started.")
    return {"updating": True}

@app.post("/indexer/reindex")
def indexer_reindex(req: IndexRequest = None):
    global combined_scanner_thread, combined_scanner_running, combined_scanner_stopped
    if req is None:
        req = IndexRequest()

    if cv2 is None and (req.tag or req.face):
        raise HTTPException(status_code=500, detail="OpenCV is required for face and object recognition.")
    if STATE.get("running") or combined_scanner_running:
        return {"reindexing": False, "ignored": True}
    with SessionLocal() as s:
        from sqlalchemy import text
        s.query(FileIndex).delete()
        try:
            s.execute(text("DELETE FROM sqlite_sequence WHERE name='files'"))
        except Exception:
            pass
        s.commit()

    cfg = load_config()
    # Safely rmtree ONLY our isolated cache directory, ignoring the parent folder entirely
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
    if thumb_dir.exists() and thumb_dir.is_dir():
        try:
            shutil.rmtree(thumb_dir)
        except Exception as e:
            print(f"Failed to clear thumbnails directory: {e}")

    ai_db_path = get_ai_db_path()
    if ai_db_path.exists():
        try:
            with sqlite3.connect(ai_db_path, timeout=15) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("DELETE FROM faces")
                conn.execute("DELETE FROM people")
                conn.execute("DELETE FROM processed_files")
                conn.execute("DELETE FROM processed_objects")
                try:
                    conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('faces', 'people', 'processed_files', 'processed_objects')")
                except Exception:
                    pass
                conn.commit()
        except Exception as e:
            print(f"Failed to clear AI database: {e}")

    STATE["indexed"] = 0
    STATE["current"] = 0
    STATE["total"] = 0
    STATE["update_only"] = False

    if req.tag or req.face:
        combined_scanner_running = True
        combined_scanner_stopped = False
        combined_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": True, "run_object": req.tag, "run_face": req.face})
        combined_scanner_thread.start()
    else:
        start_indexing()
    if load_config().get("enable_logging"):
        import logging
        logging.info("Archive re-indexing started.")
    return {"reindexing": True}

@app.get("/choose-path")
def choose_path_api(mode: str = "directory"):
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True) # Ensures the dialog appears above the browser
        if mode == "directory":
            path = filedialog.askdirectory(parent=root, title="Select Directory")
        else:
            path = filedialog.askopenfilename(parent=root, title="Select File")
        root.destroy()
        return {"path": path or ""}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dialog failed: {exc}")

@app.get("/settings")
def settings():
    cfg = load_config()
    if not isinstance(cfg, dict):
        cfg = {}
        
    # Define a schema of all possible settings and their defaults to ensure a complete config
    defaults = {
        "database_path": "archive.db",
        "thumbnail_path": "thumbnails",
        "enable_logging": False,
        "backup_configs": [],
        "ui_preferences": {
            "enable_photo_thumbnail_cache": False,
            "photo_thumbnail_size_limit_mb": 5,
            "allow_unverified_deletion": False,
            "animations_enabled": True,
            "show_full_timeline": False,
        },
        "smart_searches": [],
        "read_only_mode": True,
        "ai_enabled": False,
        "ai_provider": "",
        "ai_model": "",
        "openai_api_key": "",
        "face_sensitivity": "medium",
        "face_clustering_sensitivity": "medium",
        "object_sensitivity": "medium",
        "min_unknown_photos": 1,
        "run_face_scan": False,
        "run_object_scan": False,
    }

    # Recursively merge defaults into the loaded config to prevent crashes from missing keys
    def merge_defaults(config, defaults_dict):
        for key, default_value in defaults_dict.items():
            if key not in config:
                config[key] = default_value
            elif isinstance(default_value, dict) and isinstance(config[key], dict):
                merge_defaults(config[key], default_value)
        return config
        
    return merge_defaults(cfg, defaults)

@app.post("/settings")
def save(data:dict):
    global LOGGING_ENABLED
    save_config(data)
    LOGGING_ENABLED = data.get("enable_logging", False)
    # Log settings update
    if load_config().get("enable_logging"):
        import logging
        logging.info("Configuration file updated.")
    return {"saved":True}

@app.post("/clear-cache")
def clear_cache():
    import logging
    cfg = load_config()
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
    if thumb_dir.exists() and thumb_dir.is_dir():
        try:
            shutil.rmtree(thumb_dir)
            if cfg.get("enable_logging"):
                logging.info("Cleared thumbnail cache.")
            return {"cleared": True}
        except Exception as e:
            if cfg.get("enable_logging"):
                logging.error(f"Critical error: Failed to clear cache: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")
    return {"cleared": True, "message": "Cache was already empty"}

@app.post("/shutdown")
def shutdown(request: Request):
    import logging
    logging_enabled = load_config().get("enable_logging")
    # To achieve a graceful shutdown, we access the server instance stored in the app state
    # by run.py and set its `should_exit` flag. This is the production method.
    if hasattr(request.app.state, 'server'):
        server = request.app.state.server
        # We run this in a thread to allow the HTTP response to be sent to the client first.
        def graceful_shutdown():
            time.sleep(0.5) # A small delay to ensure the response is sent.
            if logging_enabled:
                logging.info("Server is shutting down (Production method).")
            server.should_exit = True
        threading.Thread(target=graceful_shutdown).start()
        return {"shutdown": True, "message": "Server is shutting down..."}
    # Fallback for development mode (e.g., running with `uvicorn main:app --reload`)
    else:
        import os
        import signal
        def dev_shutdown():
            time.sleep(0.5) # A small delay to ensure the response is sent.
            # This sends a termination signal that Uvicorn's CLI runner will catch
            # and use to perform a graceful shutdown.
            if logging_enabled:
                logging.info("Server shutdown signal sent (Development method).")
            os.kill(os.getpid(), signal.SIGTERM)
        threading.Thread(target=dev_shutdown).start()
        return {"shutdown": True, "message": "Server shutdown signal sent..."}

@app.post("/verify-duplicates")
def verify_duplicates():
    try:
        from backend.app.indexer import background_lazy_hasher
    except ModuleNotFoundError:
        from indexer import background_lazy_hasher
    import threading
    threading.Thread(target=background_lazy_hasher, daemon=True).start()
    return {"status": "started"}

@app.post("/stop-verify-duplicates")
def stop_verify_duplicates():
    try:
        from backend.app.state import STATE
    except ModuleNotFoundError:
        from state import STATE
    STATE["hasher_stopped"] = True
    return {"status": "stopping"}

def _cosine_similarity(vec1, vec2):
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = sum(a * a for a in vec1) ** 0.5
    norm_b = sum(b * b for b in vec2) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

def _process_unified_scanners(run_index: bool = False, run_face: bool = False, run_object: bool = False):
    global face_scanner_running, object_scanner_running, combined_scanner_running
    global combined_scanner_stopped
    
    if run_face:
        face_scanner_running = True
    if run_object:
        object_scanner_running = True
        STATE["object_scanner_stopped"] = False

    try:
        import numpy as np
        import os
        import time
        try:
            from backend.app.indexer import classify, extract_metadata_for_file, build_tags
        except ModuleNotFoundError:
            from indexer import classify, extract_metadata_for_file, build_tags
            
        cfg = load_config()
        ai_db_path = get_ai_db_path()

        # --- Object Setup ---
        net, classes, object_threshold = None, None, 0.15
        if run_object:
            model_path = get_bundled_model_path("mobilenetv2-small.onnx")
            classes_path = get_bundled_model_path("imagenet_classes.txt")
            if Path(model_path).exists() and Path(classes_path).exists():
                net = cv2.dnn.readNetFromONNX(model_path)
                with open(classes_path, 'rt') as f:
                    classes = [line.strip() for line in f.readlines()]
            object_sensitivity = cfg.get("object_sensitivity", "medium")
            object_threshold = 0.10 if object_sensitivity == "high" else 0.30 if object_sensitivity == "low" else 0.15

        # --- Face Setup ---
        detector, recognizer, clusters, p_count = None, None, {}, 0
        face_threshold, cluster_threshold = 0.70, 0.55
        if run_face:
            yunet_path = get_bundled_model_path("face_detection_yunet_2023mar.onnx")
            sface_path = get_bundled_model_path("face_recognition_sface_2021dec.onnx")

            if Path(yunet_path).exists() and Path(sface_path).exists():
                detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320))
                face_sensitivity = cfg.get("face_sensitivity", "medium")
                face_threshold = 0.55 if face_sensitivity == "high" else 0.85 if face_sensitivity == "low" else 0.70
                detector.setScoreThreshold(face_threshold)
                recognizer = cv2.FaceRecognizerSF.create(sface_path, "")
            else:
                print("Face recognition models not found. Ensure .onnx files are in the backend folder.")
                return

            cluster_sensitivity = cfg.get("face_clustering_sensitivity", "medium")
            cluster_threshold = 0.65 if cluster_sensitivity == "high" else 0.45 if cluster_sensitivity == "low" else 0.55

        # --- DB Initialization ---
        face_processed_ids = set()
        object_processed_ids = set()

        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            if run_face:
                cursor.execute('''CREATE TABLE IF NOT EXISTS people (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT DEFAULT 'Unknown Person'
                              )''')
                cursor.execute('''CREATE TABLE IF NOT EXISTS faces (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    person_id INTEGER,
                                    file_id INTEGER,
                                    embedding_json TEXT,
                                    FOREIGN KEY(person_id) REFERENCES people(id)
                                )''')
                cursor.execute('''CREATE TABLE IF NOT EXISTS processed_files (
                                    file_id INTEGER PRIMARY KEY
                                )''')
                cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) SELECT DISTINCT file_id FROM faces")
                cursor.execute("SELECT file_id FROM processed_files")
                face_processed_ids = set(r[0] for r in cursor.fetchall())
                
                cursor.execute("SELECT person_id, embedding_json FROM faces WHERE embedding_json != '[]'")
                for p_id, emb_str in cursor.fetchall():
                    if p_id not in clusters:
                        clusters[p_id] = []
                    if len(clusters[p_id]) < 15:
                        clusters[p_id].append(json.loads(emb_str))
                cursor.execute("SELECT COUNT(id) FROM people")
                p_row = cursor.fetchone()
                p_count = p_row[0] if p_row else 0

            if run_object:
                cursor.execute('''CREATE TABLE IF NOT EXISTS processed_objects (file_id INTEGER PRIMARY KEY)''')
                cursor.execute("SELECT COUNT(*) FROM processed_objects")
                if cursor.fetchone()[0] == 0:
                    with SessionLocal() as s:
                        tagged_photos = s.query(FileIndex.id).filter(FileIndex.category == 'photo', FileIndex.tags.like('%object:%')).all()
                        for (p_id,) in tagged_photos:
                            cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (p_id,))
                cursor.execute("SELECT file_id FROM processed_objects")
                object_processed_ids = set(r[0] for r in cursor.fetchall())
            conn.commit()

        # --- Build File List ---
        files_to_process = []
        if run_index:
            backup_configs = cfg.get("backup_configs", [])
            roots = [Path(c.get("backup_path", "")) for c in backup_configs if c.get("backup_path")]
            valid_roots = [r for r in roots if r.exists() and r.is_dir()]
            for root_path in valid_roots:
                for dirpath, _, filenames in os.walk(str(root_path)):
                    for f in filenames:
                        files_to_process.append(os.path.join(dirpath, f))
        else:
            with SessionLocal() as s:
                photos = s.query(FileIndex.path).filter(FileIndex.category == 'photo').all()
                files_to_process = [p[0] for p in photos]

        total_files = len(files_to_process)
        if run_index:
            STATE["total"] = total_files
            STATE["current"] = 0
            STATE["indexed"] = 0
            STATE["status"] = "Indexing & Scanning..."
            STATE["running"] = True
        if run_face:
            STATE["face_scanner_total"] = total_files
            STATE["face_scanner_current"] = 0
        if run_object:
            STATE["object_scanner_total"] = total_files
            STATE["object_scanner_current"] = 0
            
        processed_count = 0
        
        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            with SessionLocal() as session:
                # Store only path-to-id mapping for fast lookups without massive RAM usage
                path_to_id = {r[0]: r[1] for r in session.query(FileIndex.path, FileIndex.id).all()}
                
                for idx, file_str in enumerate(files_to_process):
                    while STATE.get("paused"):
                        time.sleep(0.5)
                        if combined_scanner_stopped or (run_index and STATE.get("stopped")):
                            break

                    if combined_scanner_stopped or (run_index and STATE.get("stopped")):
                        break
                        
                    file = Path(file_str)
                    if not file.exists():
                        continue
                        
                    if run_index:
                        STATE["current"] += 1
                        STATE["current_file"] = str(file)
                    if run_face and face_scanner_running:
                        STATE["face_scanner_current"] += 1
                        STATE["face_scanner_current_file"] = file.name
                    if run_object and not STATE.get("object_scanner_stopped"):
                        STATE["object_scanner_current"] += 1
                        STATE["object_scanner_current_file"] = file.name

                    # --- 1. Indexing Phase ---
                    db_item_id = path_to_id.get(file_str)
                    db_item = session.get(FileIndex, db_item_id) if db_item_id else None
                    if run_index:
                        try:
                            modified_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(file.stat().st_mtime))
                            file_size = str(file.stat().st_size)
                            
                            if not db_item:
                                category = classify(file.suffix)
                                metadata, extra_tags = extract_metadata_for_file(file, category)
                                tags = build_tags(metadata, category, file.suffix, file)
                                if extra_tags: tags = ",".join(set(tags.split(",") + extra_tags))
                                
                                db_item = FileIndex(
                                    path=str(file), filename=file.name, category=category,
                                    size=file_size, modified=modified_time, extension=file.suffix,
                                    tags=tags, metadata_json=json.dumps(metadata)
                                )
                                session.add(db_item)
                                session.flush()
                                STATE["indexed"] += 1
                                if STATE["indexed"] % 50 == 0:
                                    session.commit()
                                path_to_id[file_str] = db_item.id
                            else:
                                if db_item.size != file_size or db_item.modified != modified_time:
                                    category = classify(file.suffix)
                                    metadata, extra_tags = extract_metadata_for_file(file, category)
                                    tags = build_tags(metadata, category, file.suffix, file)
                                    if extra_tags: tags = ",".join(set(tags.split(",") + extra_tags))
                                    db_item.size = file_size
                                    db_item.modified = modified_time
                                    db_item.metadata_json = json.dumps(metadata)
                                    db_item.tags = tags
                                    STATE["indexed"] += 1
                                    if STATE["indexed"] % 50 == 0:
                                        session.commit()
                        except Exception as e:
                            print(f"Index error on {file.name}: {e}")
                            continue

                    # Skip AI phase if the file is not an image
                    if not db_item or db_item.category != 'photo':
                        continue

                    # --- 2. AI Phase ---
                    obj_stopped = STATE.get("object_scanner_stopped", False)
                    needs_face = run_face and face_scanner_running and db_item.id not in face_processed_ids
                    needs_object = run_object and not obj_stopped and db_item.id not in object_processed_ids
                    
                    if not needs_face and not needs_object:
                        continue
                        
                    filename_lower = db_item.filename.lower() if db_item.filename else ""
                    if "screenshot" in filename_lower or "meme" in filename_lower:
                        if needs_face: cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (db_item.id,))
                        if needs_object: cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (db_item.id,))
                        processed_count += 1
                        if processed_count % 50 == 0:
                            conn.commit()
                            session.commit()
                        continue

                    # --- OPTIMIZATION: Read file ONCE from disk for both ML models ---
                    try:
                        img_array = np.fromfile(str(file), np.uint8)
                        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                    except Exception:
                        continue

                    if img is None:
                        if needs_face: cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (db_item.id,))
                        if needs_object: cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (db_item.id,))
                        processed_count += 1
                        if processed_count % 50 == 0:
                            conn.commit()
                            session.commit()
                        continue
                        
                    # --- Run Object Classifier ---
                    if needs_object and net is not None:
                        try:
                            o_img = cv2.resize(img, (224, 224))
                            o_img = cv2.cvtColor(o_img, cv2.COLOR_BGR2RGB)
                            o_img = o_img.astype(np.float32) / 255.0
                            o_img -= np.array([0.485, 0.456, 0.406])
                            o_img /= np.array([0.229, 0.224, 0.225])
                            o_img = o_img.transpose(2, 0, 1)
                            o_img = np.expand_dims(o_img, axis=0)
                            o_img = np.ascontiguousarray(o_img)

                            net.setInput(o_img)
                            preds = net.forward().flatten()
                            exp_preds = np.exp(preds - np.max(preds))
                            probs = exp_preds / np.sum(exp_preds)
                            
                            classIds = np.argsort(probs)[-5:][::-1]
                            new_tags = []
                            for classId in classIds:
                                if probs[classId] > object_threshold:
                                    label = classes[classId].split(',')[0].strip().lower().replace(" ", "_")
                                    new_tags.append(f"object:{label}")
                                    
                            if new_tags:
                                current_tags = db_item.tags or ""
                                for tag in new_tags:
                                    if tag not in current_tags:
                                        current_tags = f"{current_tags} {tag}".strip()
                                db_item.tags = current_tags
                        except Exception as e:
                            print(f"ERROR: Failed to classify {file.name}: {e}")
                            
                        cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (db_item.id,))
                        object_processed_ids.add(db_item.id)

                    # --- Run Face Detector ---
                    if needs_face and detector is not None:
                        try:
                            height, width, _ = img.shape
                            target_dim = 800
                            scale = 1.0
                            if max(height, width) > target_dim:
                                scale = target_dim / max(height, width)
                                new_w, new_h = int(width * scale), int(height * scale)
                                det_img = cv2.resize(img, (new_w, new_h))
                                detector.setInputSize((new_w, new_h))
                            else:
                                det_img = img
                                detector.setInputSize((width, height))
                                
                            success, faces = detector.detect(det_img)
                            
                            if faces is None:
                                target_dim = 320
                                scale = 1.0
                                if max(height, width) > target_dim:
                                    scale = target_dim / max(height, width)
                                    new_w, new_h = int(width * scale), int(height * scale)
                                    det_img = cv2.resize(img, (new_w, new_h))
                                    detector.setInputSize((new_w, new_h))
                                else:
                                    det_img = img
                                    detector.setInputSize((width, height))
                                try:
                                    success, faces = detector.detect(det_img)
                                except Exception:
                                    pass

                            if faces is not None:
                                if scale != 1.0:
                                    faces[:, :14] /= scale
                                for face in faces:
                                    face_align = recognizer.alignCrop(img, face)
                                    face_feature = recognizer.feature(face_align)
                                    embedding = face_feature[0].tolist()

                                    best_match_id = None
                                    best_sim = -1.0
                                    for person_id, rep_embs in clusters.items():
                                        for rep_emb in rep_embs:
                                            sim = _cosine_similarity(embedding, rep_emb)
                                            if sim > cluster_threshold and sim > best_sim:
                                                best_sim = sim
                                                best_match_id = person_id

                                    if best_match_id is None:
                                        p_count += 1
                                        cursor.execute("INSERT INTO people (name) VALUES (?)", (f"Unknown Person #{p_count}",))
                                        best_match_id = cursor.lastrowid
                                        clusters[best_match_id] = [embedding]
                                    else:
                                        if len(clusters[best_match_id]) < 15:
                                            clusters[best_match_id].append(embedding)
                                    
                                    cursor.execute("INSERT INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)",
                                                    (best_match_id, db_item.id, json.dumps(embedding)))
                        except Exception as e:
                            print(f"Face processing error on {file.name}: {e}")
                            
                        cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (db_item.id,))
                        face_processed_ids.add(db_item.id)

                    processed_count += 1
                    if processed_count % 50 == 0:
                        conn.commit()
                        session.commit()

            session.commit()
            conn.commit()

    except Exception as e:
        print(f"CRITICAL: Unified Worker Error: {e}")
        traceback.print_exc()
    finally:
        if run_index:
            STATE["running"] = False
            STATE["stopped"] = False
            STATE["status"] = "Idle"
        if run_face:
            face_scanner_running = False
            STATE["face_scanner_current_file"] = ""
        if run_object:
            object_scanner_running = False
            STATE["object_scanner_stopped"] = False
            STATE["object_scanner_current_file"] = ""
        combined_scanner_running = False
        combined_scanner_stopped = False

@app.post("/scan-faces")
def scan_faces():
    if cv2 is None:
        raise HTTPException(status_code=500, detail="OpenCV is required for face recognition.")
    global face_scanner_thread, face_scanner_running
    if face_scanner_running:
        raise HTTPException(status_code=400, detail="Face scanning is already in progress.")
    face_scanner_running = True
    face_scanner_thread = threading.Thread(target=_process_unified_scanners, kwargs={"run_index": False, "run_face": True, "run_object": False})
    face_scanner_thread.start()
    return {"message": "Face scanning and clustering started in the background."}

@app.post("/stop-scan-faces")
def stop_scan_faces():
    global face_scanner_running
    if not face_scanner_running:
        raise HTTPException(status_code=400, detail="Face scanner is not running.")
    face_scanner_running = False
    return {"message": "Stopping face scanner."}

@app.get("/people")
def get_people(min_unknown_photos: int = 1):
    try:
        cfg = load_config()
        ai_db_path = get_ai_db_path()
        if not ai_db_path.exists():
            return []
        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.id, p.name, f.file_id, COUNT(f.id) as face_count
                FROM people p
                JOIN faces f ON p.id = f.person_id
                GROUP BY p.id
                HAVING p.name NOT LIKE 'Unknown Person%' OR face_count >= ?
                ORDER BY face_count DESC
            """, (min_unknown_photos,))
            
            results = []
            for row in cursor.fetchall():
                person_id, name, sample_file_id, count = row
                results.append({
                    "id": person_id, 
                    "name": name, 
                    "face_count": count, 
                    "thumbnail": f"/people/{person_id}/thumbnail"
                })
            return results
    except Exception as e:
        print(f"Error in /people API: {e}")
        return []

@app.get("/people/{person_id}/similar-unknowns")
def get_similar_unknowns(person_id: int, threshold: float = 0.60):
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        # Fetch known person's embeddings
        cursor.execute("SELECT embedding_json FROM faces WHERE person_id = ? AND embedding_json != '[]'", (person_id,))
        known_rows = cursor.fetchall()
        if not known_rows:
            raise HTTPException(status_code=404, detail="Known person faces not found.")
        
        known_embeddings = [json.loads(row[0]) for row in known_rows if row[0]]
        
        # Fetch all unknown persons and their embeddings
        cursor.execute("""
            SELECT p.id, p.name, f.embedding_json, 
                   (SELECT COUNT(id) FROM faces WHERE person_id = p.id) as photo_count,
                   f.file_id
            FROM people p
            JOIN faces f ON p.id = f.person_id
            WHERE p.name LIKE 'Unknown Person%' AND f.embedding_json != '[]'
        """)
        
        
        similar_profiles = {}
        for unk_person_id, unk_name, unk_embedding_json, photo_count, file_id in cursor:
            if not unk_embedding_json:
                continue
            unk_embedding = json.loads(unk_embedding_json)
            max_sim = 0.0
            for known_emb in known_embeddings:
                if known_emb:
                    sim = _cosine_similarity(known_emb, unk_embedding)
                    if sim > max_sim:
                        max_sim = sim
            if max_sim >= threshold:
                if unk_person_id not in similar_profiles or max_sim > similar_profiles[unk_person_id]["similarity"]:
                    similar_profiles[unk_person_id] = {
                        "id": unk_person_id, "name": unk_name, "similarity": round(float(max_sim), 3),
                        "face_count": photo_count, "thumbnail": f"/people/{unk_person_id}/thumbnail?v={file_id}_{photo_count}"
                    }
        results = list(similar_profiles.values())
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

@app.get("/people/{person_id}/thumbnail")
def get_person_thumbnail(person_id: int):
    if cv2 is None:
        raise HTTPException(status_code=500, detail="OpenCV not installed")
        
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT thumbnail_file_id FROM people WHERE id = ?", (person_id,))
            thumb_row = cursor.fetchone()
            thumb_file_id = thumb_row[0] if thumb_row else None
        except sqlite3.OperationalError:
            thumb_file_id = None
            
        face_row = None
        if thumb_file_id:
            cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ? AND file_id = ? LIMIT 1", (person_id, thumb_file_id))
            face_row = cursor.fetchone()
            
        if not face_row:
            cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ? LIMIT 1", (person_id,))
            face_row = cursor.fetchone()
            
        if not face_row:
            raise HTTPException(status_code=404, detail="Person not found")
        file_id, emb_json = face_row
        target_embedding = json.loads(emb_json)

    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    cached_face = thumb_dir / f"person_{person_id}.jpg"
    
    if cached_face.exists():
        return FileResponse(str(cached_face), media_type="image/jpeg")

    try:
        with SessionLocal() as s:
            file_item = s.query(FileIndex).filter(FileIndex.id == file_id).first()
            if not file_item:
                raise HTTPException(status_code=404, detail="Image not found")
        file_path = _resolve_path(Path(file_item.path))
        
        import numpy as np
        img_array = np.fromfile(str(file_path), np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            return preview(file_id)

        yunet_path = get_bundled_model_path("face_detection_yunet_2023mar.onnx")
        sface_path = get_bundled_model_path("face_recognition_sface_2021dec.onnx")

        if not Path(yunet_path).exists() or not Path(sface_path).exists():
            print("Face recognition models not found. Ensure .onnx files are in the backend folder.")
            return

        detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320))
        detector.setScoreThreshold(0.5)
        recognizer = cv2.FaceRecognizerSF.create(sface_path, "")

        height, width, _ = img.shape
        target_dim = 800
        scale = 1.0
        if max(height, width) > target_dim:
            scale = target_dim / max(height, width)
            new_w, new_h = int(width * scale), int(height * scale)
            det_img = cv2.resize(img, (new_w, new_h))
            detector.setInputSize((new_w, new_h))
        else:
            det_img = img
            detector.setInputSize((width, height))

        success, faces = detector.detect(det_img)

        if faces is None:
            target_dim = 320
            scale = 1.0
            if max(height, width) > target_dim:
                scale = target_dim / max(height, width)
                new_w, new_h = int(width * scale), int(height * scale)
                det_img = cv2.resize(img, (new_w, new_h))
                detector.setInputSize((new_w, new_h))
            else:
                det_img = img
                detector.setInputSize((width, height))
            success, faces = detector.detect(det_img)

        if faces is not None:
            if scale != 1.0:
                faces[:, :14] /= scale

            best_face_align = None
            best_sim = -1.0
            for face in faces:
                face_align = recognizer.alignCrop(img, face)
                face_feature = recognizer.feature(face_align)
                embedding = face_feature[0].tolist()
                sim = _cosine_similarity(embedding, target_embedding)
                if sim > best_sim:
                    best_sim = sim
                    best_face_align = face_align

            if best_face_align is not None:
                is_success, buffer = cv2.imencode(".jpg", best_face_align)
                if is_success:
                    with open(str(cached_face), "wb") as f:
                        f.write(buffer.tobytes())
                if cached_face.exists():
                    return FileResponse(str(cached_face), media_type="image/jpeg")

    except Exception as e:
        print(f"Failed to generate face thumbnail: {e}")

    # Fallback to the full image thumbnail if face crop fails
    return preview(file_id)

@app.get("/people/{person_id}/photos")
def get_person_photos(person_id: int, offset: int = 0, limit: int = 50):
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        return []
        
    ui_prefs = cfg.get("ui_preferences", {})
    cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", cfg.get("enable_photo_thumbnail_cache", False))
    cache_flag = "&tc=1" if cache_enabled else ""

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute(
            "SELECT file_id FROM faces WHERE person_id = ? GROUP BY file_id ORDER BY file_id DESC LIMIT ? OFFSET ?", 
            (person_id, limit, offset)
        )
        file_ids = [r[0] for r in cursor.fetchall()]
    if not file_ids:
        return []
    with SessionLocal() as s:
        results = []
        # Chunk queries to prevent SQLite IN() limitations and memory exhaustion
        for i in range(0, len(file_ids), 900):
            chunk = file_ids[i:i + 900]
            photos = s.query(FileIndex).filter(FileIndex.id.in_(chunk)).all()
            
            # Ensure the response maintains the exact ordered pagination from SQLite
            photo_dict = {p.id: _build_item(p, cache_flag) for p in photos}
            results.extend([photo_dict[fid] for fid in chunk if fid in photo_dict])
        return results

@app.post("/people/{person_id}/set-thumbnail")
def set_person_thumbnail(person_id: int, payload: dict = Body(...)):
    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        try:
            cursor.execute("ALTER TABLE people ADD COLUMN thumbnail_file_id INTEGER")
        except sqlite3.OperationalError:
            pass
            
        cursor.execute("UPDATE people SET thumbnail_file_id = ? WHERE id = ?", (file_id, person_id))
        conn.commit()
        
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
    cached_face = thumb_dir / f"person_{person_id}.jpg"
    if cached_face.exists():
        try:
            cached_face.unlink()
        except Exception:
            pass
            
    return {"success": True}

@app.post("/people/{person_id}/remove-photo")
def remove_person_photo(person_id: int, payload: dict = Body(...)):
    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        person_row = cursor.fetchone()
        person_name = person_row[0] if person_row else None
        
        cursor.execute("DELETE FROM faces WHERE person_id = ? AND file_id = ?", (person_id, file_id))
        deleted_count = cursor.rowcount
        
        try:
            cursor.execute("SELECT thumbnail_file_id FROM people WHERE id = ?", (person_id,))
            thumb_row = cursor.fetchone()
            if thumb_row and thumb_row[0] == file_id:
                cursor.execute("UPDATE people SET thumbnail_file_id = NULL WHERE id = ?", (person_id,))
        except sqlite3.OperationalError:
            pass
            
        conn.commit()
        
    if deleted_count > 0:
        if person_name and not person_name.startswith("Unknown Person"):
            with SessionLocal() as s:
                f = s.query(FileIndex).filter(FileIndex.id == file_id).first()
                if f and f.tags:
                    f.tags = f.tags.replace(f"person:{person_name}", "").replace("  ", " ").strip()
                    s.commit()

        thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "faces"
        cached_face = thumb_dir / f"person_{person_id}.jpg"
        if cached_face.exists():
            try:
                cached_face.unlink()
            except Exception:
                pass

    return {"success": True, "removed": deleted_count}

@app.post("/people/{person_id}/add-photo")
def add_person_photo(person_id: int, payload: dict = Body(...)):
    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        person_row = cursor.fetchone()
        if not person_row:
            raise HTTPException(status_code=404, detail="Person not found")
        person_name = person_row[0]
        
        cursor.execute("SELECT id FROM faces WHERE person_id = ? AND file_id = ?", (person_id, file_id))
        if cursor.fetchone():
            return {"success": True, "message": "Already tagged"}
            
        # Insert empty array since it's a manual tag (bypasses similarity checks)
        cursor.execute("INSERT INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)", (person_id, file_id, "[]"))
        conn.commit()
        
    if person_name and not person_name.startswith("Unknown Person"):
        with SessionLocal() as s:
            f = s.query(FileIndex).filter(FileIndex.id == file_id).first()
            if f:
                current_tags = f.tags or ""
                new_tag = f"person:{person_name}"
                if new_tag not in current_tags:
                    f.tags = f"{current_tags} {new_tag}".strip()
                    s.commit()

    return {"success": True}

@app.post("/people/{person_id}/rename")
def rename_person(person_id: int, payload: dict = Body(...)):
    new_name = payload.get("name", "Unknown Person").strip()
    if not new_name:
        new_name = "Unknown Person"

    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        old_name_row = cursor.fetchone()
        old_name = old_name_row[0] if old_name_row else "Unknown Person"
        
        cursor.execute("SELECT DISTINCT file_id FROM faces WHERE person_id = ?", (person_id,))
        file_ids = [r[0] for r in cursor.fetchall()]
        
        # Case-insensitive check to see if the target name already exists
        cursor.execute("SELECT id FROM people WHERE name COLLATE NOCASE = ? AND id != ?", (new_name, person_id))
        existing_person = cursor.fetchone()
        
        if existing_person:
            target_id = existing_person[0]
            # Auto-Merge: Reassign all faces to the existing person, then delete the duplicate
            cursor.execute("UPDATE faces SET person_id = ? WHERE person_id = ?", (target_id, person_id))
            cursor.execute("DELETE FROM people WHERE id = ?", (person_id,))
        else:
            # Standard Rename
            cursor.execute("UPDATE people SET name = ? WHERE id = ?", (new_name, person_id))
            
        conn.commit()
        
    if file_ids:
        with SessionLocal() as s:
            files_to_update = s.query(FileIndex).filter(FileIndex.id.in_(file_ids)).all()
            for f in files_to_update:
                current_tags = f.tags or ""
                if old_name and not old_name.startswith("Unknown Person"):
                    current_tags = current_tags.replace(f"person:{old_name}", "").replace("  ", " ").strip()
                if new_name and not new_name.startswith("Unknown Person"):
                    new_tag = f"person:{new_name}"
                    if new_tag not in current_tags:
                        current_tags = f"{current_tags} {new_tag}".strip()
                f.tags = current_tags
            s.commit()
            
    return {"success": True, "name": new_name}

@app.delete("/people/{person_id}")
def delete_person(person_id: int):
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
        old_name_row = cursor.fetchone()
        old_name = old_name_row[0] if old_name_row else "Unknown Person"
        
        cursor.execute("SELECT DISTINCT file_id FROM faces WHERE person_id = ?", (person_id,))
        file_ids = [r[0] for r in cursor.fetchall()]
        
        # Wipe the face embeddings and the person
        cursor.execute("DELETE FROM faces WHERE person_id = ?", (person_id,))
        cursor.execute("DELETE FROM people WHERE id = ?", (person_id,))
        conn.commit()
        
    # Clean up any tags from the main index
    if file_ids and old_name and not old_name.startswith("Unknown Person"):
        with SessionLocal() as s:
            files_to_update = s.query(FileIndex).filter(FileIndex.id.in_(file_ids)).all()
            for f in files_to_update:
                if f.tags:
                    f.tags = f.tags.replace(f"person:{old_name}", "").replace("  ", " ").strip()
            s.commit()
            
    return {"success": True, "deleted_id": person_id}

@app.post("/people/merge")
def merge_people(payload: dict = Body(...)):
    person_ids = payload.get("person_ids", [])
    if not person_ids or len(person_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two person IDs are required for merging.")
    
    cfg = load_config()
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
         raise HTTPException(status_code=404, detail="Database not found")
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        placeholders = ",".join("?" * len(person_ids))
        cursor.execute(f"SELECT id, name FROM people WHERE id IN ({placeholders})", person_ids)
        people_rows = cursor.fetchall()
        
        if not people_rows:
             raise HTTPException(status_code=404, detail="People not found.")
             
        people_rows.sort(key=lambda p: (0 if p[1] and not p[1].startswith("Unknown Person") else 1, p[0]))
        primary_id = people_rows[0][0]
        ids_to_merge = [p[0] for p in people_rows if p[0] != primary_id]
        
        for old_id in ids_to_merge:
            cursor.execute("UPDATE faces SET person_id = ? WHERE person_id = ?", (primary_id, old_id))
            cursor.execute("DELETE FROM people WHERE id = ?", (old_id,))
            
        conn.commit()
        
    return {"success": True, "merged_into": primary_id}

object_scanner_running = False
object_scanner_thread = None
object_scanner_current = 0
object_scanner_total = 0
object_scanner_stopped = False
object_scanner_current_file = ""

def _scan_and_tag_objects_worker():
    global object_scanner_running, object_scanner_current, object_scanner_total, object_scanner_stopped, object_scanner_current_file
    try:
        import numpy as np
        # model_path = get_bundled_model_path("mobilenetv2-small.onnx")
        model_path = get_bundled_model_path("mobilenetv2-small.onnx")
        classes_path = get_bundled_model_path("imagenet_classes.txt")
        
        if not Path(model_path).exists() or not Path(classes_path).exists():
            print("Object classification models not found. Ensure mobilenetv2-small.onnx and imagenet_classes.txt are in the backend folder.")
            return

        net = cv2.dnn.readNetFromONNX(model_path)
        with open(classes_path, 'rt') as f:
            classes = [line.strip() for line in f.readlines()]
            
        cfg = load_config()
        object_sensitivity = cfg.get("object_sensitivity", "medium")
        if object_sensitivity == "high":
            object_threshold = 0.10
        elif object_sensitivity == "low":
            object_threshold = 0.30
        else:
            object_threshold = 0.15
            
        ai_db_path = get_ai_db_path()
        with sqlite3.connect(ai_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''CREATE TABLE IF NOT EXISTS processed_objects (
                                file_id INTEGER PRIMARY KEY
                              )''')
            
            with SessionLocal() as s:
                # Seed existing tagged files to avoid rescanning legacy data
                cursor.execute("SELECT COUNT(*) FROM processed_objects")
                if cursor.fetchone()[0] == 0:
                    tagged_photos = s.query(FileIndex.id).filter(FileIndex.category == 'photo', FileIndex.tags.like('%object:%')).all()
                    for (p_id,) in tagged_photos:
                        cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (p_id,))
                    conn.commit()

                cursor.execute("SELECT file_id FROM processed_objects")
                processed_ids = set(r[0] for r in cursor.fetchall())

                # Fetch IDs instead of all objects to save memory on large datasets
                photo_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.category == 'photo').all()]
                
                STATE["object_scanner_total"] = len(photo_ids)
                STATE["object_scanner_current"] = 0
                processed_count = 0

                for photo_id in photo_ids:
                    if not object_scanner_running:
                        break
                        
                    photo = s.get(FileIndex, photo_id)
                    if not photo:
                        continue
                        
                    STATE["object_scanner_current"] += 1
                    STATE["object_scanner_current_file"] = photo.filename or "Unknown file"
                    
                    if photo.id in processed_ids:
                        continue
                        
                    filename_lower = photo.filename.lower() if photo.filename else ""
                    if "screenshot" in filename_lower or "meme" in filename_lower:
                        cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (photo.id,))
                        processed_count += 1
                        if processed_count % 50 == 0:
                            conn.commit()
                            s.commit()
                        continue

                    current_tags = photo.tags or ""
                    
                    file_path = _resolve_path(Path(photo.path))
                    if not file_path.exists():
                        continue
                    
                    try:
                        img_array = np.fromfile(str(file_path), np.uint8)
                        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                    except Exception:
                        img = cv2.imread(str(file_path))
                        
                    if img is None:
                        cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (photo.id,))
                        processed_count += 1
                        if processed_count % 50 == 0:
                            conn.commit()
                            s.commit()
                        continue
                        
                    try:
                        img = cv2.resize(img, (224, 224))
                        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                        img = img.astype(np.float32) / 255.0
                        img -= np.array([0.485, 0.456, 0.406])
                        img /= np.array([0.229, 0.224, 0.225])
                        img = img.transpose(2, 0, 1)
                        img = np.expand_dims(img, axis=0)
                        img = np.ascontiguousarray(img) # OpenCV strictly requires contiguous memory for DNN inputs!
                        
                        net.setInput(img)
                        preds = net.forward().flatten()
                        
                        # Apply Softmax to convert raw logits to proper probabilities (0.0 to 1.0)
                        exp_preds = np.exp(preds - np.max(preds))
                        probs = exp_preds / np.sum(exp_preds)

                        # Grab the top 5 highest confidence predictions
                        classIds = np.argsort(probs)[-5:][::-1]
                        new_tags = []
                        for classId in classIds:
                            confidence = probs[classId]
                            if confidence > object_threshold:
                                label = classes[classId].split(',')[0].strip().lower().replace(" ", "_")
                                new_tags.append(f"object:{label}")
                                
                        if new_tags:
                            for tag in new_tags:
                                if tag not in current_tags:
                                    current_tags = f"{current_tags} {tag}".strip()
                            photo.tags = current_tags
                    except Exception as e:
                        print(f"ERROR: Failed to classify {file_path.name}: {e}")
                        traceback.print_exc()
                        
                    cursor.execute("INSERT OR IGNORE INTO processed_objects (file_id) VALUES (?)", (photo.id,))
                    processed_count += 1
                    if processed_count % 50 == 0:
                        conn.commit()
                        s.commit()
                
                s.commit()
            conn.commit()
    except Exception as e:
        print(f"CRITICAL: Object Scanner Error: {e}")
        traceback.print_exc()
    finally:
        object_scanner_running = False
        STATE["object_scanner_stopped"] = False
        STATE["object_scanner_current_file"] = ""

@app.post("/scan-objects")
def scan_objects():
    global object_scanner_thread, object_scanner_running
    if object_scanner_running:
        raise HTTPException(status_code=400, detail="Object scanning is already in progress.")
    object_scanner_running = True
    STATE["object_scanner_stopped"] = False
    object_scanner_thread = threading.Thread(target=_scan_and_tag_objects_worker)
    object_scanner_thread.start()
    return {"message": "Object scanning started in the background."}

@app.post("/stop-scan-objects")
def stop_scan_objects():
    global object_scanner_running
    if not object_scanner_running:
        raise HTTPException(status_code=400, detail="Object scanner is not running.")
    object_scanner_running = False
    STATE["object_scanner_stopped"] = True
    return {"message": "Stopping object scanner."}

@app.post("/reset-object-scanner-progress")
def reset_object_scanner_progress():
    try:
        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path, timeout=15) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("CREATE TABLE IF NOT EXISTS processed_objects (file_id INTEGER PRIMARY KEY)")
                conn.execute("DELETE FROM processed_objects")
                conn.commit()
        return {"message": "Object scanner progress has been reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reset object scanner progress: {e}")

class TagUpdateRequest(BaseModel):
    file_ids: list[int]
    tags: list[str]



combined_scanner_running = False
combined_scanner_stopped = False
combined_scanner_thread = None

@app.post("/tags/add")
def add_tags(req: TagUpdateRequest):
    with SessionLocal() as s:
        # Chunk processing to avoid SQLite IN() limits and memory spikes
        for i in range(0, len(req.file_ids), 900):
            chunk = req.file_ids[i:i + 900]
            files_to_update = s.query(FileIndex).filter(FileIndex.id.in_(chunk)).all()
            for f in files_to_update:
                current_tags = set((f.tags or "").split())
                for tag in req.tags:
                    formatted_tag = f"object:{tag}" if ":" not in tag else tag
                    current_tags.add(formatted_tag)
                f.tags = " ".join(sorted(current_tags))
            s.commit()
    return {"status": "success"}

@app.post("/tags/remove")
def remove_tags(req: TagUpdateRequest):
    with SessionLocal() as s:
        for i in range(0, len(req.file_ids), 900):
            chunk = req.file_ids[i:i + 900]
            files_to_update = s.query(FileIndex).filter(FileIndex.id.in_(chunk)).all()
            for f in files_to_update:
                if not f.tags:
                    continue
                current_tags = set((f.tags or "").split())
                for tag in req.tags:
                    formatted_tag = f"object:{tag}" if ":" not in tag else tag
                    current_tags.discard(formatted_tag)
                f.tags = " ".join(sorted(current_tags))
            s.commit()
    return {"status": "success"}

@app.delete("/tags/objects/all")
def clear_all_object_tags():
    with SessionLocal() as s:
        # Fetch IDs first to save memory
        file_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.tags.like('%object:%')).all()]
        
        chunk_size = 1000
        for i in range(0, len(file_ids), chunk_size):
            chunk = file_ids[i:i + chunk_size]
            files = s.query(FileIndex).filter(FileIndex.id.in_(chunk)).all()
            for f in files:
                if f.tags:
                    # Split tags, filter out object tags, and rejoin
                    tags_list = [t for t in re.split(r'[\s,]+', f.tags) if not t.startswith('object:')]
                    f.tags = " ".join(filter(bool, tags_list))
            s.commit()

    return {"status": "success", "message": "All object tags have been cleared."}

@app.delete("/tags/objects/{tag_name}")
def delete_object_tag_globally(tag_name: str):
    tag_to_delete = tag_name
    if not tag_to_delete.startswith("object:"):
        tag_to_delete = f"object:{tag_to_delete}"

    with SessionLocal() as s:
        file_ids = [r[0] for r in s.query(FileIndex.id).filter(FileIndex.tags.like(f'%{tag_to_delete}%')).all()]
        
        chunk_size = 1000
        for i in range(0, len(file_ids), chunk_size):
            chunk = file_ids[i:i + chunk_size]
            files = s.query(FileIndex).filter(FileIndex.id.in_(chunk)).all()
            for f in files:
                if f.tags:
                    tags_list = [t for t in re.split(r'[\s,]+', f.tags) if t != tag_to_delete]
                    f.tags = " ".join(filter(bool, tags_list))
            s.commit()

    return {"status": "success", "deleted_tag": tag_to_delete}

@app.post("/system/free-memory")
def free_memory():
    import gc
    import sqlite3
    
    # 1. Force Python garbage collection to drop unreferenced objects
    gc.collect()
    
    # 2. Flush SQLite memory caches (FTS5 / Page Cache)
    cfg = load_config()
    db_path_str = cfg.get("database_path") or "archive.db"
    main_db_path = Path(db_path_str)
    if not main_db_path.is_absolute():
        if getattr(sys, 'frozen', False):
            main_db_path = Path(sys.executable).parent / main_db_path
        else:
            main_db_path = Path(__file__).resolve().parent.parent.parent / main_db_path

    try:
        if main_db_path.exists():
            with sqlite3.connect(main_db_path) as db:
                db.execute("PRAGMA shrink_memory")
    except Exception:
        pass
        
    ai_db_path = get_ai_db_path()
    try:
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path) as db:
                db.execute("PRAGMA shrink_memory")
    except Exception:
        pass

    if cfg.get("enable_logging"):
        import logging
        logging.info("System memory released via garbage collection and SQLite cache flush.")

    return {"status": "Memory released"}

@app.post("/system/backup")
def backup_databases(payload: dict = Body(...)):
    dest_dir = payload.get("destination")
    if not dest_dir:
        raise HTTPException(status_code=400, detail="Destination directory is required.")
        
    dest_path = Path(dest_dir)
    if not dest_path.exists() or not dest_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid destination directory.")
        
    ai_db_path = get_ai_db_path()
    cfg = load_config()
    db_path_str = cfg.get("database_path") or "archive.db"
    main_db_path = Path(db_path_str)
    if not main_db_path.is_absolute():
        if getattr(sys, 'frozen', False):
            main_db_path = Path(sys.executable).parent / main_db_path
        else:
            main_db_path = Path(__file__).resolve().parent.parent.parent / main_db_path

    if getattr(sys, 'frozen', False):
        config_path = Path(sys.executable).parent / "config.yaml"
    else:
        config_path = Path(__file__).resolve().parent.parent.parent / "config.yaml"

    try:
        if main_db_path.exists():
            with sqlite3.connect(main_db_path) as src, sqlite3.connect(dest_path / main_db_path.name) as dst:
                src.backup(dst)
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path) as src, sqlite3.connect(dest_path / ai_db_path.name) as dst:
                src.backup(dst)
        if config_path.exists():
            shutil.copy2(config_path, dest_path / config_path.name)
            
        if load_config().get("enable_logging"):
            import logging
            logging.info("Successfully backed up databases and config.")
        return {"success": True, "message": "Databases and config successfully backed up."}
    except Exception as e:
        if load_config().get("enable_logging"):
            import logging
            logging.error(f"Critical error: Backup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")

@app.get("/system/export-people")
def export_people():
    if load_config().get("enable_logging"):
        import logging
        logging.info("Exporting people data.")
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        return []
         
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id, name, thumbnail_file_id FROM people WHERE name NOT LIKE 'Unknown Person%'")
        except sqlite3.OperationalError:
            cursor.execute("SELECT id, name, NULL FROM people WHERE name NOT LIKE 'Unknown Person%'")
        people_rows = cursor.fetchall()
        
        export_data = []
        with SessionLocal() as s:
            for pid, name, thumb_id in people_rows:
                thumb_path = None
                if thumb_id:
                    thumb_file = s.get(FileIndex, thumb_id)
                    if thumb_file:
                        thumb_path = thumb_file.path
                        
                cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ?", (pid,))
                face_rows = cursor.fetchall()
                
                faces = []
                for fid, emb_json in face_rows:
                    f_item = s.get(FileIndex, fid)
                    if f_item:
                        faces.append({
                            "path": f_item.path,
                            "embedding": emb_json
                        })
                        
                if faces:
                    export_data.append({
                        "name": name,
                        "thumbnail_path": thumb_path,
                        "faces": faces
                    })
    return export_data

@app.post("/system/import-people")
def import_people(payload: list = Body(...)):
    ai_db_path = get_ai_db_path()
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS people (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT DEFAULT 'Unknown Person',
                            cover_face_id INTEGER
                      )''')
        cursor.execute('''CREATE TABLE IF NOT EXISTS faces (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            person_id INTEGER,
                            file_id INTEGER,
                            embedding_json TEXT,
                            FOREIGN KEY(person_id) REFERENCES people(id)
                        )''')
        cursor.execute('''CREATE TABLE IF NOT EXISTS processed_files (file_id INTEGER PRIMARY KEY)''')
        
        imported_people = 0
        imported_faces = 0
        with SessionLocal() as s:
            path_to_id = {}
            fallback_map = {}
            for r in s.query(FileIndex.path, FileIndex.id).all():
                p, fid = r[0], r[1]
                path_to_id[p] = fid
                try:
                    parts = Path(p).parts
                    key = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else parts[-1]
                    if key not in fallback_map: fallback_map[key] = []
                    fallback_map[key].append(fid)
                except Exception:
                    pass

            def get_fid(path_str):
                if not path_str: return None
                if path_str in path_to_id: return path_to_id[path_str]
                try:
                    parts = Path(path_str).parts
                    key = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else parts[-1]
                    matches = fallback_map.get(key, [])
                    if len(matches) == 1: return matches[0]
                except Exception:
                    pass
                return None

            for p_data in payload:
                name = p_data.get("name")
                if not name: continue
                cursor.execute("SELECT id FROM people WHERE name = ?", (name,))
                row = cursor.fetchone()
                if row: pid = row[0]
                else:
                    cursor.execute("INSERT INTO people (name) VALUES (?)", (name,))
                    pid = cursor.lastrowid
                    imported_people += 1
                thumb_path = p_data.get("thumbnail_path")
                thumb_fid = get_fid(thumb_path)
                for face in p_data.get("faces", []):
                    f_path = face.get("path")
                    emb = face.get("embedding")
                    fid = get_fid(f_path)
                    if fid:
                        cursor.execute("SELECT id FROM faces WHERE person_id = ? AND file_id = ?", (pid, fid))
                        face_row = cursor.fetchone()
                        if not face_row:
                            cursor.execute("INSERT INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)", (pid, fid, emb))
                            new_face_id = cursor.lastrowid
                            cursor.execute("INSERT OR IGNORE INTO processed_files (file_id) VALUES (?)", (fid,))
                            imported_faces += 1
                            db_item = s.get(FileIndex, fid)
                            if db_item:
                                current_tags = db_item.tags or ""
                                new_tag = f"person:{name}"
                                if new_tag not in current_tags:
                                    db_item.tags = f"{current_tags} {new_tag}".strip()
                        else:
                            new_face_id = face_row[0]
                            
                        if thumb_fid and fid == thumb_fid:
                            cursor.execute("UPDATE people SET cover_face_id = ? WHERE id = ?", (new_face_id, pid))
            s.commit()
        conn.commit()
    return {"success": True, "imported_people": imported_people, "imported_faces": imported_faces}

@app.get("/tags/objects")
def get_object_tags():
    with SessionLocal() as s:
        unique_tags = set()
        # Use yield_per to stream results instead of loading all strings into memory
        for r in s.query(FileIndex.tags).filter(FileIndex.tags.like('%object:%')).yield_per(1000):
            if r[0]:
                for tag in r[0].split():
                    if tag.startswith('object:'):
                        unique_tags.add(tag)
        return sorted(list(unique_tags))

@app.get("/system/export-tags")
def export_tags():
    if load_config().get("enable_logging"):
        import logging
        logging.info("Exporting tags data.")
    with SessionLocal() as s:
        # Stream all files that have any tags
        files = s.query(FileIndex.path, FileIndex.tags).filter(FileIndex.tags != None, FileIndex.tags != '').yield_per(1000)
        export_data = [{"path": path, "tags": tags} for path, tags in files]
        return export_data

@app.post("/system/import-tags")
def import_tags(payload: list = Body(...)):
    imported_count = 0
    with SessionLocal() as s:
        path_to_id = {}
        fallback_map = {}
        for r in s.query(FileIndex.path, FileIndex.id).all():
            p, fid = r[0], r[1]
            path_to_id[p] = fid
            try:
                parts = Path(p).parts
                key = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else parts[-1]
                if key not in fallback_map: fallback_map[key] = []
                fallback_map[key].append(fid)
            except Exception:
                pass

        def get_fid(path_str):
            if not path_str: return None
            if path_str in path_to_id: return path_to_id[path_str]
            try:
                parts = Path(path_str).parts
                key = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else parts[-1]
                matches = fallback_map.get(key, [])
                if len(matches) == 1: return matches[0]
            except Exception:
                pass
            return None
        
        chunk_size = 900
        for i in range(0, len(payload), chunk_size):
            chunk = payload[i:i + chunk_size]
            for item in chunk:
                path = item.get("path")
                new_tags = item.get("tags")
                if not path or not new_tags: 
                    continue
                
                file_id = get_fid(path)
                if file_id:
                    db_item = s.get(FileIndex, file_id)
                    if db_item:
                        current_tags = set((db_item.tags or "").split())
                        imported_tags = set(new_tags.split())
                        db_item.tags = " ".join(sorted(current_tags.union(imported_tags)))
                        imported_count += 1
            s.commit()
    return {"success": True, "imported_files": imported_count}

# --- Serve React Frontend (Production) ---
if hasattr(sys, '_MEIPASS'):
    # Running as a packaged PyInstaller executable
    frontend_dist = Path(sys._MEIPASS) / "frontend" / "dist"
else:
    # Running in normal development mode
    frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        path = frontend_dist / full_path
        if path.exists() and path.is_file():
            return FileResponse(str(path))
        return FileResponse(str(frontend_dist / "index.html"))