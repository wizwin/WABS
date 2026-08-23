from fastapi import APIRouter, Body, Request, HTTPException, Depends
from pathlib import Path
import json
import sqlite3
import shutil
import sys
import threading
import time
import re
import os
import platform
from sqlalchemy import func, text, Integer

from backend.app.database import SessionLocal, FileIndex, VirtualFolder, VirtualFolderFile
from backend.app.config import load_config, save_config, get_thumbnail_dir
from backend.app.constants import (
    STANDARD_CATEGORIES,
    SEARCHABLE_DOCUMENT_CATEGORIES
)
from backend.app.utils.paths import get_ai_db_path, get_relationships_db_path
from backend.app.relationships_database import (
    export_relationships_internal,
    import_relationships_internal
)
from backend.app.utils.cache import EXEMPLAR_CACHE
from backend.app.utils.utils import _resolve_path, parse_tags, find_file_by_path_smart
import backend.app.shared_state as shared_state
from backend.app.utils.validators import check_no_scanners_running, lock_data_operation
from backend.app.state import STATE
from backend.app.routes.tags import export_tags_internal, import_tags_internal
from backend.app.utils.log_utils import log_operation

router = APIRouter()

@router.post("/log/frontend")
def log_frontend_message(body: dict = Body(...)):
    msg = body.get("message", "")
    log_operation(f"[FRONTEND] {msg}", user_logs_enabled=True)
    return {"status": "ok"}

@router.get("/stats")
def stats():
    cfg = load_config()
    with SessionLocal() as s:
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
        
        try:
            doc_count = s.query(func.count(FileIndex.id)).filter(
                FileIndex.category.in_(SEARCHABLE_DOCUMENT_CATEGORIES),
                text("files.id IN (SELECT file_id FROM processed_text)")
            ).scalar() or 0
            stats_dict["searchable_documents"] = int(doc_count)
        except Exception:
            stats_dict["searchable_documents"] = 0

        stats_dict["known_faces"] = 0
        stats_dict["unknown_faces"] = 0
        stats_dict["tagged_objects"] = 0
        stats_dict["untagged_media"] = 0

        try:
            untagged_count = s.query(func.count(FileIndex.id)).filter(
                FileIndex.category == 'photo',
                (FileIndex.tags.is_(None) | (FileIndex.tags == '') | (~FileIndex.tags.like('%object:%') & ~FileIndex.tags.like('%person:%') & ~FileIndex.tags.like('%ocr%')))
            ).scalar() or 0
            stats_dict["untagged_media"] = int(untagged_count)
        except Exception:
            pass

        ai_db_path = get_ai_db_path()
        if ai_db_path.exists():
            try:
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='faces'")
                    if cursor.fetchone():
                        hidden_people = cfg.get("hidden_people")
                        if hidden_people is None:
                            hidden_people = cfg.get("ui_preferences", {}).get("hidden_people", [])
                        if not isinstance(hidden_people, list):
                            hidden_people = []
                            
                        hidden_ids = set()
                        hidden_names = []
                        for pid in hidden_people:
                            if isinstance(pid, (int, float)) or (isinstance(pid, str) and pid.isdigit()):
                                hidden_ids.add(str(int(float(pid))))
                            elif isinstance(pid, str):
                                hidden_names.append(pid)
                                
                        if hidden_names:
                            placeholders = ",".join("?" for _ in hidden_names)
                            try:
                                cursor.execute(f"SELECT id FROM people WHERE name IN ({placeholders})", hidden_names)
                                for r in cursor.fetchall():
                                    hidden_ids.add(str(r[0]))
                            except Exception:
                                pass
                                
                        hidden_clause = f" AND people.id NOT IN ({','.join(hidden_ids)})" if hidden_ids else ""
                        
                        cursor.execute(f"SELECT COUNT(DISTINCT people.id) FROM faces JOIN people ON faces.person_id = people.id WHERE people.name NOT LIKE 'Unknown Person%' {hidden_clause}")
                        stats_dict["known_faces"] = cursor.fetchone()[0] or 0
                        
                        cursor.execute(f"SELECT COUNT(DISTINCT people.id) FROM faces JOIN people ON faces.person_id = people.id WHERE people.name LIKE 'Unknown Person%' {hidden_clause}")
                        stats_dict["unknown_faces"] = cursor.fetchone()[0] or 0
                        
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='processed_objects'")
                    if cursor.fetchone():
                        cursor.execute("SELECT COUNT(DISTINCT file_id) FROM processed_objects")
                        stats_dict["tagged_objects"] = cursor.fetchone()[0] or 0
            except Exception as e:
                print(f"Error fetching AI stats: {e}")
                
        try:
            folder_count = s.query(func.count(VirtualFolder.id)).filter(VirtualFolder.parent_id.is_(None)).scalar() or 0
            stats_dict["virtual_folders"] = int(folder_count)
        except Exception as e:
            print(f"Error fetching virtual folder stats: {e}")
            stats_dict["virtual_folders"] = 0
            
        return stats_dict

@router.get("/timeline")
def timeline(category: str = "all"):
    with SessionLocal() as s:
        exif_date = func.nullif(func.json_extract(FileIndex.metadata_json, '$.date'), '')
        exif_date_norm = func.nullif(func.replace(func.substr(exif_date, 1, 10), ':', '-'), '')
        mod_date = func.nullif(func.substr(FileIndex.modified, 1, 10), '')
        best_date_str = func.coalesce(exif_date_norm, mod_date)
        best_date = func.date(best_date_str)
        
        q = s.query(best_date.label("date"), func.count(FileIndex.id))
        if category != "all":
            if category == "other":
                q = q.filter(~FileIndex.category.in_(STANDARD_CATEGORIES))
            elif category == "duplicates":
                dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                q = q.filter(FileIndex.size.in_(dup_sizes))
            elif category == "searchable_documents":
                q = q.filter(FileIndex.category.in_(SEARCHABLE_DOCUMENT_CATEGORIES), text("files.id IN (SELECT file_id FROM processed_text)"))
            elif category == "tagged_objects":
                q = q.filter(FileIndex.tags.like('%object:%'))
            else:
                q = q.filter(FileIndex.category == category)
        
        q = q.filter(best_date.isnot(None))
        q = q.filter(func.substr(best_date, 1, 4) > '1900')
        q = q.group_by('date').order_by('date')
        rows = q.all()
        return [{"date": r[0], "count": r[1]} for r in rows if r[0]]

@router.get("/choose-path")
def choose_path_api(mode: str = "directory"):
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        if mode == "directory":
            path = filedialog.askdirectory(parent=root, title="Select Directory")
        else:
            path = filedialog.askopenfilename(parent=root, title="Select File")
        root.destroy()
        return {"path": path or ""}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dialog failed: {exc}")

@router.get("/settings")
def settings():
    cfg = load_config()
    if not isinstance(cfg, dict):
        cfg = {}
        
    defaults = {
        "database_path": "archive.db",
        "thumbnail_path": "thumbnails",
        "enable_logging": False,
        "theme": "dark",
        "enable_photo_thumbnail_cache": False,
        "photo_thumbnail_size_limit_mb": 5,
        "allow_unverified_deletion": False,
        "animations_enabled": True,
        "show_full_timeline": False,
        "show_tree_view": True,
        "read_only_mode": True,
        "ai_enabled": False,
        "ai_provider": "",
        "ai_model": "",
        "ai_api_key": "",
        "face_sensitivity": "medium",
        "face_clustering_sensitivity": "medium",
        "object_sensitivity": "medium",
        "min_unknown_photos": 1,
        "document_scan_depth": "low",
        "text_extraction_limit": 300,
        "ocr_enabled": False,
        "ocr_max_pages": 3,
        "ocr_only_no_ai_tags": True,
        "ocr_cpu_threads": 4,
        "opencv_cpu_threads": 4,
        "ocr_det_limit_side_len": 736,
        "ocr_det_limit_type": "min",
        "run_face_scan": False,
        "run_object_scan": False,
        "run_document_scan": False,
        "backup_configs": [],
        "smart_searches": [],
        "auto_run_on_startup": False,
        "view_type": "flat",
        "me_name": "",
        "people_category_filter": "all"
    }

    def merge_defaults(config, defaults_dict):
        for key, default_value in defaults_dict.items():
            if key not in config:
                config[key] = default_value
            elif isinstance(default_value, dict) and isinstance(config[key], dict):
                merge_defaults(config[key], default_value)
        return config
        
    return merge_defaults(cfg, defaults)

@router.post("/settings", dependencies=[Depends(lock_data_operation)])
def save(data:dict):
    if "photo_thumbnail_size_limit_mb" in data:
        try:
            val = float(data["photo_thumbnail_size_limit_mb"])
            if val < 0.1:
                data["photo_thumbnail_size_limit_mb"] = 0.1
            else:
                data["photo_thumbnail_size_limit_mb"] = val
        except (ValueError, TypeError):
            data["photo_thumbnail_size_limit_mb"] = 0.1

    save_config(data)
    shared_state.LOGGING_ENABLED = data.get("enable_logging", False)
    
    # Apply startup configurations
    try:
        from backend.app.utils.startup import update_startup_setting
        update_startup_setting(data.get("auto_run_on_startup", False))
    except Exception as e:
        print(f"Error updating startup settings: {e}")
    
    # Apply thread limits dynamically
    try:
        from backend.app.utils.indexer import reset_ocr_engine
        reset_ocr_engine()
    except Exception:
        pass
        
    try:
        import cv2
        opencv_threads = int(data.get("opencv_cpu_threads", 4))
        if opencv_threads > 0:
            cv2.setNumThreads(opencv_threads)
    except Exception:
        pass

    if load_config().get("enable_logging"):
        import logging
        logging.info("Configuration file updated. Dynamic thread limits applied and OCR engine cache reset.")
    return {"saved":True}

def _mask_api_key(key: str) -> str:
    if not key or key == "dummy-key":
        return "[none/dummy]"
    if len(key) <= 6:
        return "***"
    return f"{key[:3]}...{key[-3:]}"

@router.post("/system/test-ai")
def test_ai(payload: dict = Body(...)):
    import urllib.request
    import urllib.error
    import json
    import time
    
    t0 = time.time()
    provider = payload.get("ai_provider") or "https://api.openai.com/v1"
    model = payload.get("ai_model") or "gpt-3.5-turbo"
    api_key = payload.get("ai_api_key") or "dummy-key"
    
    provider = provider.rstrip("/")
    if provider.endswith("/chat/completions"):
        provider = provider[:-17]
        
    endpoint = f"{provider}/chat/completions"
    masked_key = _mask_api_key(api_key)
    print(f"[AI_API] [TEST] Testing connection to endpoint='{endpoint}', model='{model}', key={masked_key}")
    log_operation(f"[AI_API] [TEST] Initiating connection test to endpoint='{endpoint}', model='{model}', key={masked_key}", user_logs_enabled=True)
    
    req_data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "Say hello!"}],
        "max_tokens": 15
    }).encode("utf-8")
    
    req = urllib.request.Request(endpoint, data=req_data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            elapsed_ms = (time.time() - t0) * 1000
            resp_data = json.loads(response.read().decode("utf-8"))
            reply = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"[AI_API] [TEST] Success in {elapsed_ms:.1f}ms - HTTP 200 - Reply length={len(reply)} chars")
            log_operation(f"[AI_API] [TEST] Success in {elapsed_ms:.1f}ms - HTTP 200", user_logs_enabled=True)
            return {"success": True, "reply": reply}
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.time() - t0) * 1000
        err_msg = e.read().decode("utf-8", errors="ignore")
        print(f"[AI_API] [TEST] Failed in {elapsed_ms:.1f}ms - HTTP {e.code}: {err_msg}")
        log_operation(f"[AI_API] [TEST] Failed in {elapsed_ms:.1f}ms - HTTP {e.code}", user_logs_enabled=True)
        raise HTTPException(status_code=e.code, detail=f"HTTP {e.code}: {err_msg}")
    except Exception as e:
        elapsed_ms = (time.time() - t0) * 1000
        err_str = str(e) or type(e).__name__
        print(f"[AI_API] [TEST] Failed in {elapsed_ms:.1f}ms - Error: {err_str}")
        log_operation(f"[AI_API] [TEST] Failed in {elapsed_ms:.1f}ms - Error: {err_str}", user_logs_enabled=True)
        raise HTTPException(status_code=500, detail=f"Request failed: {err_str}")

def _sanitize_ai_search_query(reply: str) -> str:
    if not reply:
        return ""
    
    clean = reply.strip()
    
    # 1. Handle JSON response if LLM returned JSON object
    if clean.startswith("{") and clean.endswith("}"):
        try:
            parsed = json.loads(clean)
            if isinstance(parsed, dict):
                for k in ("query", "search", "result", "output", "wabs_query", "search_query"):
                    if k in parsed and isinstance(parsed[k], str):
                        clean = parsed[k].strip()
                        break
        except Exception:
            pass
            
    # 2. Strip Markdown code blocks (e.g. ```wabs ... ```, ```bash ... ```, ``` ... ```)
    code_block_match = re.search(r'```(?:[a-zA-Z0-9_-]*\n)?([\s\S]*?)```', clean)
    if code_block_match:
        clean = code_block_match.group(1).strip()
        
    # 3. Strip inline backticks `...`
    if clean.startswith("`") and clean.endswith("`"):
        clean = clean.strip("`").strip()

    # 4. Handle multi-line output or conversational filler
    lines = [line.strip() for line in clean.splitlines() if line.strip()]
    candidate_line = clean
    if len(lines) > 1:
        for line in lines:
            lower_l = line.lower()
            if lower_l.startswith(("here is", "this query", "note:", "explanation:", "you can use", "i have translated", "search result:", "assistant:")):
                continue
            if any(indicator in line for indicator in ("type:", "person:", "object:", "tag:", "rel:", "date:", "size:", "length:", "aspect:", "resolution:", "fps:", "camera:", "artist:", "album:", "genre:", "*.")) or (":" in line and not line.endswith(":")):
                candidate_line = line
                break
        else:
            for line in lines:
                lower_l = line.lower()
                if not lower_l.startswith(("here is", "this query", "note:", "explanation:", "you can use", "i have", "assistant:")):
                    candidate_line = line
                    break
            else:
                candidate_line = lines[0]
                
    clean = candidate_line.strip()
    
    # 5. Extract portion after arrow if tiny model echoed prompt with -> or =>
    if "->" in clean:
        clean = clean.split("->")[-1].strip()
    elif "=>" in clean:
        clean = clean.split("=>")[-1].strip()
    elif "-->" in clean:
        clean = clean.split("-->")[-1].strip()

    # 6. Remove common leading prefixes generated by LLMs
    prefix_patterns = [
        r'^(?:query|search\s*query|wabs\s*query|result|output|search|translated\s*query|command|assistant)\s*[:=-]\s*',
        r'^(?:the\s*(?:search\s*)?query\s*is\s*[:=-]?\s*)',
        r'^(?:here\s*is\s*(?:the\s*)?(?:search\s*)?query\s*[:=-]?\s*)',
        r'^(?:user\s*:\s*.*?->\s*)',
        r'^[->=:]+\s*'
    ]
    for pat in prefix_patterns:
        clean = re.sub(pat, '', clean, flags=re.IGNORECASE).strip()
        
    # 7. Strip enclosing quotes ("..." or '...')
    if (clean.startswith('"') and clean.endswith('"')) or (clean.startswith("'") and clean.endswith("'")):
        clean = clean[1:-1].strip()
        
    # 8. Strip trailing explanations if any remain on newline
    if "\n" in clean:
        clean = clean.split("\n")[0].strip()

    # 9. Clean any leading stray symbols
    clean = clean.lstrip("->=: \t")

    return clean

def _is_tiny_model(model: str) -> bool:
    if not model:
        return False
    m_lower = model.lower()
    if "gemini" in m_lower or "gpt-4" in m_lower or "claude" in m_lower:
        return False
    tiny_patterns = [
        "1b", "1.5b", "2b", "3b", "0.5b", "-mini", ":mini", "_mini", "tiny", "small", "phi-", "phi3", "phi4-mini",
        "smollm", "mobile", "gemma:2b", "gemma-2b", "qwen-1.5b", "qwen2.5:1.5b", "qwen2.5:3b",
        "qwen:1.5b", "qwen:0.5b", "llama3.2:1b", "llama3.2:3b", "llama-3.2-1b", "llama-3.2-3b"
    ]
    return any(p in m_lower for p in tiny_patterns)

def _build_ai_search_messages(prompt: str, is_tiny: bool = False):
    if is_tiny:
        sys_content = (
            "You are a search query translator for WABS media library. "
            "Convert user requests into search query syntax. "
            "Output ONLY the query syntax keywords. No explanations, no markdown, no arrows.\n"
            "Syntax:\n"
            "- type:photo, type:video, type:document, type:audio, type:code, type:pdf\n"
            "- person:<name> (e.g. person:Alice, person:\"John Doe\")\n"
            "- rel:<relation> (e.g. rel:spouse, rel:parent, rel:child, rel:sibling, rel:friend)\n"
            "- object:<thing> (e.g. object:car, object:dog, object:pizza, object:beach, object:sunset)\n"
            "- date:<YYYY or YYYY-MM> (e.g. date:2024, date:2023-05)\n"
            "- size:<op><val> (e.g. size:>5mb, size:>1gb)\n"
            "- resolution:<spec> (e.g. resolution:4k, resolution:1080p)\n"
            "- aspect:<aspect> (e.g. aspect:landscape, aspect:portrait)\n"
            "- tag:<tag> (e.g. tag:ocr)\n"
            "- camera:<camera>, artist:<artist>, genre:<genre>"
        )
        return [
            {"role": "system", "content": sys_content},
            {"role": "user", "content": "photos of trees taken in 2024"},
            {"role": "assistant", "content": "object:tree date:2024 type:photo"},
            {"role": "user", "content": "Alice and Bob eating sushi in Tokyo"},
            {"role": "assistant", "content": "person:Alice person:Bob object:sushi Tokyo type:photo"},
            {"role": "user", "content": "Amazon invoices or receipts scanned with OCR in 2023"},
            {"role": "assistant", "content": "type:document tag:ocr Amazon invoice date:2023"},
            {"role": "user", "content": "4K drone video from 2023"},
            {"role": "assistant", "content": "type:video resolution:4k drone date:2023"},
            {"role": "user", "content": "photos of my mother and father"},
            {"role": "assistant", "content": "rel:mother rel:father type:photo"},
            {"role": "user", "content": prompt}
        ]
    else:
        sys_content = _get_system_prompt(is_tiny=False)
        return [
            {"role": "system", "content": sys_content},
            {"role": "user", "content": prompt}
        ]

def _get_system_prompt(is_tiny: bool = False) -> str:
    return """You are the WABS Search Query Translator. Translate user search requests into WABS search syntax.
Output ONLY the final query string on a single line. Never output explanations, notes, code blocks, or conversational filler.

### WABS SEARCH SYNTAX SPECIFICATION:
- People: person:<name> or person:"<full name>" or comma list person:Alice,Bob
- Relations: rel:<relation> or rel:"<relation>" or comma list rel:spouse,child (e.g., rel:spouse, rel:wife, rel:husband, rel:parent, rel:mother, rel:father, rel:dad, rel:mom, rel:child, rel:son, rel:daughter, rel:kids, rel:sibling, rel:brother, rel:sister, rel:grandparent, rel:aunt, rel:uncle, rel:cousin, rel:in-law, rel:"close friend", rel:colleague, rel:classmate, rel:neighbor) or category:family / category:friends / category:others
- Food & Drinks: object:<food> (e.g., object:pizza, object:cake, object:burger, object:salad, object:coffee, object:pasta, object:sushi, object:wine, object:beer, object:"ice cream", object:dessert, object:dinner, object:lunch, object:breakfast)
- Objects & Scenes: object:<object> (e.g., object:car, object:dog, object:cat, object:bicycle, object:laptop, object:guitar, object:beach, object:mountain, object:tree, object:boat, object:building)
- Locations: Location name directly as keyword or quoted phrase (e.g., Paris, Tokyo, Hawaii, London, Rome, "New York", "San Francisco", "Grand Canyon")
- Types & Formats: type:<category_or_extension> or comma list type:audio,video
  - Categories: type:photo, type:video, type:audio, type:document, type:ebook, type:code, type:compressed, type:installer, type:binary, type:database, type:font
  - Extensions: type:pdf, type:docx, type:xlsx, type:pptx, type:py, type:js, type:cpp, type:sql, type:mp3, type:flac, type:wav, type:mp4, type:mkv, type:zip, type:rar, type:iso, type:exe
- Aspect Ratio: aspect:<orientation> (aspect:landscape, aspect:portrait, aspect:square)
- Resolution & Video Specs: resolution:<spec> (resolution:4k, resolution:1080p, resolution:720p, resolution:>=1080p, resolution:>=4k) and fps:<fps> (fps:60, fps:>=60)
- Dates & Ranges: date:<YYYY>, date:<YYYY-MM>, date:<YYYY-MM-DD>, date:<YYYY-YYYY> (e.g., date:2024, date:2020-2023, date:2022-06-2022-08 for Summer 2022)
- Size: size:<operator><value> (operators: >=, <=, >, <, =; units: kb, mb, gb, tb; e.g., size:>5mb, size:100mb-5gb)
- Duration: length:<operator><value> (operators: >=, <=, >, <, =; units: s, m, h; e.g., length:>3m, length:5m-1h)
- Audio/Video Specs: camera:<camera>, artist:<artist>, album:<album>, genre:<genre>
- OCR & Tags: tag:<tag> (e.g., tag:ocr, tag:work)
- Boolean Operators: Use '+' to require a term (+tag:ocr, +person:Alice) or '-' to exclude a term (-tag:temp, -person:Bob, -object:cat)
- Wildcards: Use '*' (*.jpg, *.pdf, *backup*)
- Multi-Word Phrases: Enclose multi-word terms in double quotes ("John Doe", "New York", "machine learning", rel:"close friend")

### EXAMPLES:
User: photos of trees taken on a canon camera in 2024
object:tree camera:canon date:2024

User: show all ocr-ed PDFs with testString and person Name1 but not Someone
*.pdf testString +person:Name1 -person:Someone

User: documents with tag ocr containing Name1 Name2
tag:ocr "Name1 Name2"

User: audio files by SomeArtist longer than 3 minutes
type:audio artist:SomeArtist length:>3m

User: slow motion 4K drone videos from summer 2023
type:video resolution:4k fps:>=60 drone date:2023-06-2023-08

User: Amazon invoices or receipts scanned with OCR in 2023
type:document tag:ocr Amazon invoice date:2023

User: Python scripts with FastAPI and SQLAlchemy
type:code *.py FastAPI SQLAlchemy

User: SQL database migration scripts from 2024
type:sql migration date:2024

User: photos of Alice and Charlie eating burgers at the beach
person:Alice person:Charlie object:burger object:beach type:photo

User: video of family dinner in New York with dad and mom from 2021
rel:father rel:mother object:dinner "New York" date:2021 type:video

User: landscape wallpaper photos of mountains in 4K
object:mountain aspect:landscape resolution:4k type:photo

User: vertical portraits of Jane at sunset
person:Jane aspect:portrait object:sunset type:photo

User: pictures of Bob playing guitar in Paris
person:Bob object:guitar Paris type:photo

User: photos of my spouse and children having breakfast in London
rel:spouse rel:child object:breakfast London type:photo

User: Jazz or Rock songs longer than 5 minutes by Miles Davis
type:audio genre:jazz,rock artist:"Miles Davis" length:>5m

User: ZIP or RAR backup archives over 2GB from 2023
type:compressed backup size:>2gb date:2023

### STRICT OUTPUT RULE:
Return ONLY the raw WABS query string on one single line. No quotes, no markdown, no conversational text."""

@router.post("/system/generate-search")
def generate_search(payload: dict = Body(...)):
    import urllib.request
    import urllib.error
    import json
    import time
    
    t0 = time.time()
    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    cfg = load_config()
    provider = payload.get("ai_provider") or cfg.get("ai_provider") or "https://api.openai.com/v1"
    model = payload.get("ai_model") or cfg.get("ai_model") or "gpt-3.5-turbo"
    api_key = payload.get("ai_api_key") or cfg.get("ai_api_key") or "dummy-key"
    
    provider = provider.rstrip("/")
    if provider.endswith("/chat/completions"):
        provider = provider[:-17]
        
    endpoint = f"{provider}/chat/completions"
    
    is_tiny = _is_tiny_model(model)
    max_tokens = 100 if is_tiny else 200
    masked_key = _mask_api_key(api_key)
    
    print(f"[AI_API] [GENERATE_SEARCH] Executing query generation with model='{model}', prompt_length={len(prompt)} chars, endpoint='{endpoint}', key={masked_key}")
    log_operation(f"[AI_API] [GENERATE_SEARCH] Request started: model='{model}', prompt_length={len(prompt)} chars, endpoint='{endpoint}', key={masked_key}", user_logs_enabled=True)

    def do_request(messages: list, max_t: int):
        req_data = json.dumps({
            "model": model,
            "messages": messages,
            "temperature": 0.0,
            "max_tokens": max_t
        }).encode("utf-8")
        
        req = urllib.request.Request(endpoint, data=req_data, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        })
        with urllib.request.urlopen(req, timeout=60) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            raw_reply = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return _sanitize_ai_search_query(raw_reply)
            
    try:
        messages = _build_ai_search_messages(prompt, is_tiny=is_tiny)
        cleaned_query = do_request(messages, max_tokens)
        elapsed_ms = (time.time() - t0) * 1000
        print(f"[AI_API] [GENERATE_SEARCH] Success in {elapsed_ms:.1f}ms - Output query_length={len(cleaned_query)} chars")
        log_operation(f"[AI_API] [GENERATE_SEARCH] Success in {elapsed_ms:.1f}ms - Output query_length={len(cleaned_query)} chars", user_logs_enabled=True)
        return {"success": True, "query": cleaned_query}
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.time() - t0) * 1000
        err_msg = e.read().decode("utf-8", errors="ignore")
        # If failure was context length or model size on extended prompt, fallback to compact multi-turn prompt automatically
        if not is_tiny and e.code in (400, 413, 422) and any(kw in err_msg.lower() for kw in ("context", "token", "length", "too large", "maximum")):
            try:
                compact_messages = _build_ai_search_messages(prompt, is_tiny=True)
                cleaned_query = do_request(compact_messages, 100)
                print(f"[AI_API] [GENERATE_SEARCH] Fallback success in {(time.time() - t0)*1000:.1f}ms")
                return {"success": True, "query": cleaned_query}
            except Exception:
                pass
        print(f"[AI_API] [GENERATE_SEARCH] Failed in {elapsed_ms:.1f}ms - HTTP {e.code}: {err_msg}")
        log_operation(f"[AI_API] [GENERATE_SEARCH] Failed in {elapsed_ms:.1f}ms - HTTP {e.code}", user_logs_enabled=True)
        raise HTTPException(status_code=e.code, detail=f"HTTP {e.code}: {err_msg}")
    except Exception as e:
        elapsed_ms = (time.time() - t0) * 1000
        if not is_tiny:
            try:
                compact_messages = _build_ai_search_messages(prompt, is_tiny=True)
                cleaned_query = do_request(compact_messages, 100)
                print(f"[AI_API] [GENERATE_SEARCH] Fallback success in {(time.time() - t0)*1000:.1f}ms")
                return {"success": True, "query": cleaned_query}
            except Exception:
                pass
        err_str = str(e) or type(e).__name__
        print(f"[AI_API] [GENERATE_SEARCH] Failed in {elapsed_ms:.1f}ms - Error: {err_str}")
        log_operation(f"[AI_API] [GENERATE_SEARCH] Failed in {elapsed_ms:.1f}ms - Error: {err_str}", user_logs_enabled=True)
        raise HTTPException(status_code=500, detail=f"Request failed: {err_str}")

@router.post("/clear-cache", dependencies=[Depends(lock_data_operation)])
def clear_cache():

    import logging
    cfg = load_config()
    thumb_dir = get_thumbnail_dir()
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

@router.post("/system/cancel-data-operation")
def cancel_data_operation():
    STATE["cancel_data_operation"] = True
    return {"status": "cancelling"}

@router.post("/shutdown")
def shutdown(request: Request):
    shared_state.APP_SHUTTING_DOWN = True
    import logging
    logging_enabled = load_config().get("enable_logging")
    if hasattr(request.app.state, 'server'):
        server = request.app.state.server
        def graceful_shutdown():
            time.sleep(2.0)
            if logging_enabled:
                logging.info("Server is shutting down (Production method).")

            # Stop the tray icon immediately from this thread so it
            # disappears even if server.run() takes time to return.
            try:
                from backend.app.utils.tray import stop_tray_icon
                stop_tray_icon()
            except Exception:
                pass

            # Signal uvicorn to start its graceful drain.
            server.should_exit = True

            # Give uvicorn 3 seconds to drain open connections.
            time.sleep(3.0)

            # Force-close any connections that are still open
            # (e.g. browser keep-alive connections that never closed).
            server.force_exit = True
            if logging_enabled:
                logging.info("Server force-exit flag set.")

            # Final safety net: if the process is still alive after another
            # 3 seconds (e.g. uvicorn event loop is stuck), hard-kill it.
            time.sleep(3.0)
            import os as _os
            _os._exit(0)
        threading.Thread(target=graceful_shutdown, daemon=True).start()
        return {"shutdown": True, "message": "Server is shutting down..."}
    else:
        import os
        import signal
        def dev_shutdown():
            time.sleep(2.0)
            if logging_enabled:
                logging.info("Server shutdown signal sent (Development method).")
            os.kill(os.getpid(), signal.SIGTERM)
        threading.Thread(target=dev_shutdown).start()
        return {"shutdown": True, "message": "Server shutdown signal sent..."}

@router.get("/system/debug-threads")
def debug_threads():
    import sys
    import threading
    import traceback
    
    threads_info = {}
    for thread_id, frame in sys._current_frames().items():
        thread_name = "Unknown"
        for t in threading.enumerate():
            if t.ident == thread_id:
                thread_name = t.name
                break
        
        stack = traceback.format_stack(frame)
        threads_info[str(thread_id)] = {
            "name": thread_name,
            "stack": stack
        }
    return threads_info

@router.post("/system/free-memory")
def free_memory():
    from backend.app.utils.memory import unload_heavy_modules
    unloaded = unload_heavy_modules()
    return {"status": "Memory released", "unloaded_modules": unloaded}

@router.post("/system/backup", dependencies=[Depends(lock_data_operation)])
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
            main_db_path = Path(__file__).resolve().parent.parent.parent.parent / main_db_path

    if getattr(sys, 'frozen', False):
        config_path = Path(sys.executable).parent / "config.yaml"
    else:
        config_path = Path(__file__).resolve().parent.parent.parent.parent / "config.yaml"

    try:
        if main_db_path.exists():
            with sqlite3.connect(main_db_path) as src, sqlite3.connect(dest_path / main_db_path.name) as dst:
                src.backup(dst)
        if ai_db_path.exists():
            with sqlite3.connect(ai_db_path) as src, sqlite3.connect(dest_path / ai_db_path.name) as dst:
                src.backup(dst)
        rel_db_path = get_relationships_db_path()
        if rel_db_path.exists():
            with sqlite3.connect(str(rel_db_path)) as src, sqlite3.connect(dest_path / rel_db_path.name) as dst:
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

@router.post("/system/cleanup", dependencies=[Depends(lock_data_operation)])
def system_cleanup(clean_files: bool = True, clean_thumbnails: bool = True, delete_person_ids: list = None):
    """
    Performs database cleanup, unlinks orphaned thumbnails, and purges orphaned AI records.
    Special code: Protects backup directories that are currently offline from being purged.
    """
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"User started system cleanup (clean_files={clean_files}, clean_thumbnails={clean_thumbnails}, delete_person_ids={delete_person_ids}).")

    ai_db_path = get_ai_db_path()
    db_path_str = cfg.get("database_path") or "archive.db"
    main_db_path = Path(db_path_str)
    if not main_db_path.is_absolute():
        if getattr(sys, 'frozen', False):
            main_db_path = Path(sys.executable).parent / main_db_path
        else:
            main_db_path = Path(__file__).resolve().parent.parent.parent.parent / main_db_path

    # Retrieve configured active backup roots
    backup_configs = cfg.get("backup_configs", [])
    active_roots = [Path(c.get("backup_path", "")) for c in backup_configs if c.get("backup_path")]
    
    # Classify active roots into online and offline
    online_roots = [r for r in active_roots if r.exists()]
    offline_roots = [r for r in active_roots if not r.exists()]

    def is_path_matching_ignoring_drive(root_path: Path, file_path: Path) -> bool:
        try:
            # Get path parts ignoring Windows drive letter or anchor
            root_parts = root_path.parts[1:] if root_path.drive else root_path.parts
            file_parts = file_path.parts[1:] if file_path.drive else file_path.parts
            
            if len(file_parts) >= len(root_parts):
                if all(f.lower() == r.lower() for f, r in zip(file_parts[:len(root_parts)], root_parts)):
                    return True
        except Exception:
            pass
        return False

    missing_ids = []
    deleted_thumbnails_count = 0
    thumb_dir = get_thumbnail_dir()
    
    if clean_files:
        with SessionLocal() as s:
            for r in s.query(FileIndex.id, FileIndex.path).yield_per(1000):
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                fid, path_str = r[0], r[1]
                file_path = Path(path_str)
                resolved_file_path = _resolve_path(file_path)
                
                # Check if this file belongs to any active backup location
                belongs_to_active_config = False
                is_parent_offline = False
                
                # Check offline roots first to protect them
                for root in offline_roots:
                    if is_path_matching_ignoring_drive(root, file_path):
                        belongs_to_active_config = True
                        is_parent_offline = True
                        break
                        
                # If not matched to offline roots, check online roots
                if not is_parent_offline:
                    for root in online_roots:
                        if is_path_matching_ignoring_drive(root, file_path):
                            belongs_to_active_config = True
                            break

                # Safety evaluation:
                # 1. If the parent root is offline/unplugged, protect the file: DO NOT delete it!
                if is_parent_offline:
                    continue
                    
                # 2. If it belongs to an online active location but the file itself is missing, delete it.
                # 3. If it does NOT belong to any active backup location (i.e. removed from settings), delete it.
                if belongs_to_active_config:
                    if not resolved_file_path.exists():
                        missing_ids.append(fid)
                else:
                    # Removed from config - clean it up safely
                    missing_ids.append(fid)
                    
            if missing_ids:
                for i in range(0, len(missing_ids), 900):
                    if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                        raise HTTPException(status_code=400, detail="Operation cancelled")
                    chunk = missing_ids[i:i + 900]
                    s.query(FileIndex).filter(FileIndex.id.in_(chunk)).delete(synchronize_session=False)
                    s.execute(text(f"DELETE FROM processed_text WHERE file_id IN ({','.join(map(str, chunk))})"))
                    s.execute(text(f"DELETE FROM file_text_fts WHERE file_id IN ({','.join(map(str, chunk))})"))
                s.commit()

            # Clean any pre-existing orphaned text search records
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
            s.execute(text("DELETE FROM processed_text WHERE NOT EXISTS (SELECT 1 FROM files WHERE files.id = processed_text.file_id)"))
            s.execute(text("DELETE FROM file_text_fts WHERE NOT EXISTS (SELECT 1 FROM files WHERE files.id = file_text_fts.file_id)"))
            s.commit()

        # Clean AI metadata database records and profile thumbnails if they are orphaned
        if ai_db_path.exists():
            try:
                # 1. Fetch all distinct file_ids from the AI database tables
                faces_fids = set()
                pf_fids = set()
                po_fids = set()

                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    cursor = conn.cursor()
                    
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='faces'")
                    if cursor.fetchone():
                        cursor.execute("SELECT DISTINCT file_id FROM faces")
                        faces_fids = {r[0] for r in cursor.fetchall()}
                    
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='processed_files'")
                    if cursor.fetchone():
                        cursor.execute("SELECT file_id FROM processed_files")
                        pf_fids = {r[0] for r in cursor.fetchall()}
                    
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='processed_objects'")
                    if cursor.fetchone():
                        cursor.execute("SELECT file_id FROM processed_objects")
                        po_fids = {r[0] for r in cursor.fetchall()}

                all_ai_fids = faces_fids.union(pf_fids).union(po_fids)

                # 2. Check which of these file_ids still exist in the main database
                if all_ai_fids:
                    all_ai_fids_list = list(all_ai_fids)
                    existing_fids = set()
                    with SessionLocal() as s:
                        for i in range(0, len(all_ai_fids_list), 900):
                            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                                raise HTTPException(status_code=400, detail="Operation cancelled")
                            chunk = all_ai_fids_list[i:i+900]
                            rows = s.query(FileIndex.id).filter(FileIndex.id.in_(chunk)).all()
                            existing_fids.update(r[0] for r in rows)
                    
                    orphaned_fids = all_ai_fids - existing_fids
                    
                    # 3. Delete orphaned file_ids from the AI database
                    if orphaned_fids:
                        orphaned_list = list(orphaned_fids)
                        with sqlite3.connect(ai_db_path, timeout=15) as conn:
                            conn.execute("PRAGMA journal_mode=WAL;")
                            cursor = conn.cursor()
                            for i in range(0, len(orphaned_list), 900):
                                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                                    raise HTTPException(status_code=400, detail="Operation cancelled")
                                chunk = orphaned_list[i:i+900]
                                placeholders = ",".join("?" * len(chunk))
                                
                                cursor.execute(f"DELETE FROM faces WHERE file_id IN ({placeholders})", chunk)
                                cursor.execute(f"DELETE FROM processed_files WHERE file_id IN ({placeholders})", chunk)
                                cursor.execute(f"DELETE FROM processed_objects WHERE file_id IN ({placeholders})", chunk)
                            conn.commit()

                # 4. Find and delete people profiles that no longer have any faces
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    cursor = conn.cursor()
                    
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='people'")
                    if cursor.fetchone():
                        cursor.execute("""
                            SELECT id, name FROM people 
                            WHERE id NOT IN (SELECT DISTINCT person_id FROM faces)
                        """)
                        empty_people = cursor.fetchall()
                        
                        if empty_people:
                            empty_pids = [r[0] for r in empty_people]
                            for i in range(0, len(empty_pids), 900):
                                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                                    raise HTTPException(status_code=400, detail="Operation cancelled")
                                chunk = empty_pids[i:i+900]
                                placeholders = ",".join("?" * len(chunk))
                                cursor.execute(f"DELETE FROM people WHERE id IN ({placeholders})", chunk)
                                for pid in chunk:
                                    EXEMPLAR_CACHE.pop(pid, None)
                            conn.commit()
                            
                            # Clean up physical thumbnail pictures for these empty profiles
                            faces_thumb_dir = get_thumbnail_dir("faces")
                            if faces_thumb_dir.exists():
                                for r in empty_people:
                                    pid = r[0]
                                    thumb_path = faces_thumb_dir / f"person_{pid}.jpg"
                                    if thumb_path.exists():
                                        try:
                                            thumb_path.unlink()
                                            deleted_thumbnails_count += 1
                                        except Exception:
                                            pass

                # 5. Fix broken thumbnail_file_id pointers for remaining people
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='people'")
                    if cursor.fetchone():
                        cursor.execute("SELECT id, thumbnail_file_id FROM people WHERE thumbnail_file_id IS NOT NULL")
                        people_thumbs = cursor.fetchall()
                        if people_thumbs:
                            thumb_fids = {r[1] for r in people_thumbs}
                            thumb_fids_list = list(thumb_fids)
                            existing_thumb_fids = set()
                            with SessionLocal() as s:
                                for i in range(0, len(thumb_fids_list), 900):
                                    if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                                        raise HTTPException(status_code=400, detail="Operation cancelled")
                                    chunk = thumb_fids_list[i:i+900]
                                    rows = s.query(FileIndex.id).filter(FileIndex.id.in_(chunk)).all()
                                    existing_thumb_fids.update(r[0] for r in rows)
                            
                            orphaned_thumb_fids = thumb_fids - existing_thumb_fids
                            if orphaned_thumb_fids:
                                orphaned_thumb_list = list(orphaned_thumb_fids)
                                for i in range(0, len(orphaned_thumb_list), 900):
                                    if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                                        raise HTTPException(status_code=400, detail="Operation cancelled")
                                    chunk = orphaned_thumb_list[i:i+900]
                                    placeholders = ",".join("?" * len(chunk))
                                    cursor.execute(f"UPDATE people SET thumbnail_file_id = NULL WHERE thumbnail_file_id IN ({placeholders})", chunk)
                                conn.commit()

            except Exception as e:
                if cfg.get("enable_logging"):
                    import logging
                    logging.error(f"Error during AI database cleanup: {e}")

        # 6. Optimize and vacuum SQLite databases
        try:
            with sqlite3.connect(main_db_path, timeout=15) as conn:
                conn.execute("VACUUM")
        except Exception as e:
            if cfg.get("enable_logging"):
                import logging
                logging.warning(f"Failed to vacuum main database: {e}")

        if ai_db_path.exists():
            try:
                with sqlite3.connect(ai_db_path, timeout=15) as conn:
                    conn.execute("VACUUM")
            except Exception as e:
                if cfg.get("enable_logging"):
                    import logging
                    logging.warning(f"Failed to vacuum AI database: {e}")

        rel_db_path = get_relationships_db_path()
        if rel_db_path.exists():
            try:
                with sqlite3.connect(str(rel_db_path), timeout=15) as rconn:
                    rconn.execute("PRAGMA journal_mode=WAL;")
                    # Clean up truly orphaned persons (ai_person_id is NULL and name not in ai_metadata.db)
                    if ai_db_path.exists():
                        with sqlite3.connect(str(ai_db_path), timeout=10) as aconn:
                            ai_names = {r[0].lower() for r in aconn.execute("SELECT name FROM people WHERE name NOT LIKE 'Unknown Person%'").fetchall() if r[0]}
                            all_unlinked = rconn.execute("SELECT id, name FROM persons WHERE ai_person_id IS NULL AND is_me = 0").fetchall()
                            orphans = [r[0] for r in all_unlinked if not r[1] or r[1].lower() not in ai_names]
                            if orphans:
                                for i in range(0, len(orphans), 900):
                                    chunk = orphans[i:i+900]
                                    placeholders = ",".join("?" * len(chunk))
                                    rconn.execute(f"DELETE FROM person_social WHERE person_id IN ({placeholders})", chunk)
                                    rconn.execute(f"DELETE FROM persons WHERE id IN ({placeholders})", chunk)
                                rconn.commit()
                    rconn.execute("VACUUM")
            except Exception as e:
                if cfg.get("enable_logging"):
                    import logging
                    logging.warning(f"Failed to cleanup/vacuum relationships database: {e}")

    if clean_thumbnails:
        with SessionLocal() as s:
            valid_file_ids = {str(r[0]) for r in s.query(FileIndex.id).all()}

        if thumb_dir.exists():
            for f in thumb_dir.rglob('*.jpg'):
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                if f.is_file() and not f.name.startswith("person_") and f.stem not in valid_file_ids:
                    try:
                        f.unlink()
                        deleted_thumbnails_count += 1
                    except Exception:
                        pass

    if delete_person_ids:
        faces_thumb_dir = get_thumbnail_dir("faces")
        if faces_thumb_dir.exists():
            for pid in delete_person_ids:
                thumb_path = faces_thumb_dir / f"person_{pid}.jpg"
                if thumb_path.exists():
                    try:
                        thumb_path.unlink()
                        deleted_thumbnails_count += 1
                    except Exception:
                        pass

    if cfg.get("enable_logging"):
        import logging
        logging.info(f"System cleanup completed. Removed files: {len(missing_ids)}, Removed thumbnails: {deleted_thumbnails_count}.")

    return {"status": "success", "removed_files": len(missing_ids), "removed_thumbnails": deleted_thumbnails_count, "message": "Cleanup and optimization complete."}

@router.post("/system/purge-unknowns", dependencies=[Depends(lock_data_operation)])
def purge_unknowns(payload: dict = Body(...)):
    """
    Deletes small noisy Unknown profiles containing fewer than a threshold of photos.
    """
    threshold = int(payload.get("threshold", 3))
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"User started purging unknown profiles (threshold < {threshold}).")

    ai_db_path = get_ai_db_path()
    
    if not ai_db_path.exists():
        raise HTTPException(status_code=404, detail="AI Database not found")
        
    purged_count = 0
    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id 
            FROM people p 
            LEFT JOIN faces f ON p.id = f.person_id 
            WHERE p.name LIKE 'Unknown Person%' 
            GROUP BY p.id 
            HAVING COUNT(f.id) < ?
        """, (threshold,))
        
        ids_to_delete = [r[0] for r in cursor.fetchall()]
        
        if ids_to_delete:
            for i in range(0, len(ids_to_delete), 900):
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                chunk = ids_to_delete[i:i+900]
                placeholders = ",".join("?" * len(chunk))
                cursor.execute(f"DELETE FROM faces WHERE person_id IN ({placeholders})", chunk)
                cursor.execute(f"DELETE FROM people WHERE id IN ({placeholders})", chunk)
                for pid in chunk:
                    EXEMPLAR_CACHE.pop(pid, None)
            purged_count = len(ids_to_delete)
            conn.commit()
            
    system_cleanup(clean_files=False, clean_thumbnails=False, delete_person_ids=ids_to_delete)
    if cfg.get("enable_logging"):
        import logging
        logging.info(f"Purged {purged_count} small unknown profiles to reclaim space.")
        
    return {"status": "success", "purged_profiles": purged_count}

@router.get("/system/export-people", dependencies=[Depends(lock_data_operation)])
def export_people():
    """
    Exports named profiles and their embeddings as JSON.
    Special code: Packs float32 face arrays as Base64 strings, saving ~72% storage.
    """
    if load_config().get("enable_logging"):
        import logging
        logging.info("Exporting people data.")
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        return []
         
    import struct
    import base64

    with sqlite3.connect(ai_db_path, timeout=15) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id, name, thumbnail_file_id FROM people WHERE name NOT LIKE 'Unknown Person%'")
            people_rows = cursor.fetchall()
        except sqlite3.OperationalError:
            people_rows = []
        
        export_data = []
        with SessionLocal() as s:
            for pid, name, thumb_id in people_rows:
                if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                    raise HTTPException(status_code=400, detail="Operation cancelled")
                thumb_path = None
                if thumb_id:
                    thumb_file = s.get(FileIndex, thumb_id)
                    if thumb_file:
                        thumb_path = thumb_file.path
                cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ?", (pid,))
                faces = []
                for fid, emb_json in cursor.fetchall():
                    f_item = s.get(FileIndex, fid)
                    if f_item:
                        emb_b64 = ""
                        if emb_json:
                            try:
                                floats = json.loads(emb_json)
                                if floats:
                                    packed = struct.pack(f"{len(floats)}f", *floats)
                                    emb_b64 = base64.b64encode(packed).decode("ascii")
                            except Exception:
                                pass
                        faces.append({"path": f_item.path, "embedding": emb_b64})
                if faces:
                    export_data.append({"name": name, "thumbnail_path": thumb_path, "faces": faces})
    return export_data

@router.post("/system/import-people", dependencies=[Depends(lock_data_operation)])
def import_people(payload: list = Body(...)):
    """
    Imports profiles from JSON backup.
    Special code: Caches FileIndex objects in-memory to prevent duplicate DB lookup calls.
    """
    if load_config().get("enable_logging"):
        import logging
        logging.info(f"Importing {len(payload)} people profiles.")
    
    ai_db_path = get_ai_db_path()
    if not ai_db_path.exists():
        raise HTTPException(status_code=500, detail="AI Database not initialized.")
        
    import struct
    import base64

    imported_people_count = 0
    imported_faces_count = 0
    path_cache = {}

    try:
        with sqlite3.connect(ai_db_path, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            
            with SessionLocal() as session:
                for person_data in payload:
                    if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                        raise HTTPException(status_code=400, detail="Operation cancelled")
                    name = person_data.get("name")
                    if not name:
                        continue
                    
                    cursor.execute("INSERT OR IGNORE INTO people (name) VALUES (?)", (name,))
                    cursor.execute("SELECT id FROM people WHERE name = ?", (name,))
                    row = cursor.fetchone()
                    if not row:
                        continue
                    person_id = row[0]
                    
                    EXEMPLAR_CACHE.pop(person_id)
                    
                    faces = person_data.get("faces", [])
                    for face in faces:
                        path = face.get("path")
                        embedding_data = face.get("embedding")
                        if not path:
                            continue
                            
                        if path not in path_cache:
                            file_item = find_file_by_path_smart(session, path)
                            path_cache[path] = file_item
                        
                        file_item = path_cache[path]
                        if not file_item:
                            continue
                        file_id = file_item.id
                            
                        if isinstance(embedding_data, str) and embedding_data:
                            try:
                                decoded = base64.b64decode(embedding_data)
                                num_floats = len(decoded) // 4
                                unpacked = struct.unpack(f"{num_floats}f", decoded)
                                embedding_json = json.dumps(list(unpacked))
                            except Exception:
                                embedding_json = "[]"
                        else:
                            embedding_json = "[]"
                            
                        cursor.execute(
                            "INSERT OR IGNORE INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)",
                            (person_id, file_id, embedding_json)
                        )
                        if cursor.rowcount > 0:
                            imported_faces_count += 1
                            
                        if name and not name.startswith("Unknown Person"):
                            current_tags = parse_tags(file_item.tags)
                            new_tag = f"person:{name}"
                            if new_tag not in current_tags:
                                current_tags.add(new_tag)
                                file_item.tags = ",".join(sorted(current_tags))
                    
                    thumb_path = person_data.get("thumbnail_path")
                    if thumb_path:
                        if thumb_path not in path_cache:
                            thumb_file = session.query(FileIndex).filter(FileIndex.path == thumb_path).first()
                            path_cache[thumb_path] = thumb_file
                        
                        thumb_item = path_cache[thumb_path]
                        if thumb_item:
                            cursor.execute("UPDATE people SET thumbnail_file_id = ? WHERE id = ?", (thumb_item.id, person_id))
                            
                    imported_people_count += 1
                
                session.commit()
            conn.commit()
    except Exception as e:
        if load_config().get("enable_logging"):
            import logging
            logging.error(f"Error importing people profiles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
        
    return {
        "success": True,
        "imported_people": imported_people_count,
        "imported_faces": imported_faces_count
    }

# Helper functions for Virtual Folders import/export
def get_folder_path_names(s, folder):
    path = []
    current = folder
    while current.parent_id:
        parent = s.get(VirtualFolder, current.parent_id)
        if parent:
            path.insert(0, parent.name)
            current = parent
        else:
            break
    return path

def export_folders_internal(s):
    import datetime
    folders = s.query(VirtualFolder).all()
    export_data = []
    for f in folders:
        # Get manual file associations
        assoc_files = s.query(FileIndex.path).join(
            VirtualFolderFile, VirtualFolderFile.file_id == FileIndex.id
        ).filter(VirtualFolderFile.virtual_folder_id == f.id).all()
        file_paths = [r[0] for r in assoc_files]
        
        parent_path = get_folder_path_names(s, f)
        
        export_data.append({
            "name": f.name,
            "parent_path": parent_path,
            "is_dynamic": bool(f.is_dynamic),
            "query": f.query,
            "files": file_paths,
            "metadata_json": f.metadata_json
        })
    return export_data

def import_folders_internal(s, folders_data):
    import datetime
    sorted_data = sorted(folders_data, key=lambda x: len(x.get("parent_path", [])))
    folder_mapping = {}
    
    for item in sorted_data:
        name = item.get("name")
        parent_path = item.get("parent_path", [])
        is_dynamic = item.get("is_dynamic", False)
        query = item.get("query")
        files = item.get("files", [])
        
        metadata_json = item.get("metadata_json")
        
        parent_id = None
        current_path = []
        for p_name in parent_path:
            parent_key = (tuple(current_path), p_name)
            if parent_key in folder_mapping:
                parent_id = folder_mapping[parent_key]
            else:
                existing_parent = s.query(VirtualFolder).filter(
                    VirtualFolder.name == p_name,
                    VirtualFolder.parent_id == parent_id
                ).first()
                if existing_parent:
                    parent_id = existing_parent.id
                else:
                    new_p = VirtualFolder(
                        name=p_name,
                        parent_id=parent_id,
                        is_dynamic=0,
                        created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    )
                    s.add(new_p)
                    s.commit()
                    s.refresh(new_p)
                    parent_id = new_p.id
                folder_mapping[parent_key] = parent_id
            current_path.append(p_name)
            
        existing_folder = s.query(VirtualFolder).filter(
            VirtualFolder.name == name,
            VirtualFolder.parent_id == parent_id
        ).first()
        
        if existing_folder:
            folder = existing_folder
            folder.is_dynamic = 1 if is_dynamic else 0
            folder.query = query
            if metadata_json is not None:
                folder.metadata_json = metadata_json
        else:
            folder = VirtualFolder(
                name=name,
                parent_id=parent_id,
                is_dynamic=1 if is_dynamic else 0,
                query=query,
                created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                metadata_json=metadata_json
            )
            s.add(folder)
            s.commit()
            s.refresh(folder)
            
        my_key = (tuple(parent_path), name)
        folder_mapping[my_key] = folder.id
        
        if files:
            existing_rows = s.query(VirtualFolderFile.file_id).filter(
                VirtualFolderFile.virtual_folder_id == folder.id
            ).all()
            existing_ids = {r[0] for r in existing_rows}
            
            for path in files:
                f_item = s.query(FileIndex.id).filter(FileIndex.path == path).first()
                if f_item and f_item[0] not in existing_ids:
                    assoc = VirtualFolderFile(virtual_folder_id=folder.id, file_id=f_item[0])
                    s.add(assoc)
            s.commit()

# System endpoints for Virtual Folders and Combined Import/Export
@router.get("/system/export-folders")
def export_folders():
    with SessionLocal() as s:
        return export_folders_internal(s)

@router.post("/system/import-folders")
def import_folders(payload: list = Body(...)):
    with SessionLocal() as s:
        try:
            import_folders_internal(s, payload)
            return {"status": "success", "message": f"Successfully imported {len(payload)} folders"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/export-all", dependencies=[Depends(lock_data_operation)])
def export_all():
    from backend.app.config import load_config
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info("Combined WABS export started.")
    try:
        people_data = export_people()
        with SessionLocal() as s:
            folders_data = export_folders_internal(s)
            tags_data = export_tags_internal(s)
        config_data = cfg
        relationships_data = export_relationships_internal()
        if cfg.get("enable_logging"):
            import logging
            logging.info("Combined WABS export completed successfully.")
        return {
            "people": people_data,
            "folders": folders_data,
            "tags": tags_data,
            "config": config_data,
            "relationships": relationships_data
        }
    except Exception as e:
        if cfg.get("enable_logging"):
            import logging
            logging.error(f"Error during combined WABS export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/import-all", dependencies=[Depends(lock_data_operation)])
def import_all(payload: dict = Body(...)):
    from backend.app.config import load_config, save_config
    cfg = load_config()
    if cfg.get("enable_logging"):
        import logging
        logging.info("Combined WABS import started.")
    try:
        imported_people_count = 0
        imported_faces_count = 0
        config_imported = False
        
        people_data = payload.get("people")
        if people_data:
            res = import_people(people_data)
            imported_people_count = res.get("imported_people", 0)
            imported_faces_count = res.get("imported_faces", 0)
            
        with SessionLocal() as s:
            folders_data = payload.get("folders")
            if folders_data:
                import_folders_internal(s, folders_data)
                
            tags_data = payload.get("tags")
            if tags_data:
                import_tags_internal(s, tags_data)
                
        relationships_data = payload.get("relationships")
        if relationships_data:
            import_relationships_internal(relationships_data)
                
        config_data = payload.get("config")
        if config_data:
            current_cfg = load_config()
            db_path = current_cfg.get("database_path")
            thumb_path = current_cfg.get("thumbnail_path")
            
            current_cfg.update(config_data)
            
            if db_path:
                current_cfg["database_path"] = db_path
            if thumb_path:
                current_cfg["thumbnail_path"] = thumb_path
                
            save_config(current_cfg)
            config_imported = True
            
        folders_count = len(folders_data) if folders_data else 0
        tags_count = len(tags_data) if tags_data else 0
        relationships_count = len(relationships_data.get("person_social", [])) if (relationships_data and isinstance(relationships_data, dict)) else 0
        if cfg.get("enable_logging"):
            import logging
            logging.info(f"Combined WABS import completed successfully. Imported {imported_people_count} profiles, {imported_faces_count} faces, {folders_count} folders, {tags_count} tags, {relationships_count} relationships, config_imported={config_imported}.")
        return {
            "success": True,
            "imported_people": imported_people_count,
            "imported_faces": imported_faces_count,
            "imported_folders": folders_count,
            "imported_tags": tags_count,
            "imported_relationships": relationships_count,
            "config_imported": config_imported
        }
    except Exception as e:
        if cfg.get("enable_logging"):
            import logging
            logging.error(f"Error during combined WABS import: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/export-relationships", dependencies=[Depends(lock_data_operation)])
def export_relationships():
    """
    Exports all relationship and person categorization metadata as JSON.
    """
    data = export_relationships_internal()
    print(f"[SYSTEM] Exported relationships metadata: {len(data.get('persons', []))} persons, {len(data.get('person_social', []))} relationships")
    return data

@router.post("/system/import-relationships", dependencies=[Depends(lock_data_operation)])
def import_relationships(payload: dict = Body(...)):
    """
    Imports relationship and person categorization metadata from JSON.
    """
    try:
        import_relationships_internal(payload)
        print(f"[SYSTEM] Successfully imported relationships metadata payload")
        return {"status": "success", "message": "Relationships successfully imported."}
    except Exception as e:
        print(f"[SYSTEM] Failed to import relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import relationships: {e}")