from pathlib import Path
import json
import mimetypes
import os
import platform
import re
import subprocess
import shutil
import sys

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, or_
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
    from backend.app.database import SessionLocal, FileIndex
    from backend.app.config import load_config, save_config
    from backend.app.indexer import start as start_indexing, STATE as INDEXER_STATE
except ModuleNotFoundError:
    from database import SessionLocal, FileIndex
    from config import load_config, save_config
    from indexer import start as start_indexing, STATE as INDEXER_STATE

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
...

@app.on_event("startup")
def startup_event():
    try:
        with SessionLocal() as s:
            count = s.query(FileIndex).count()
            INDEXER_STATE["indexed"] = count
            INDEXER_STATE["current"] = count
    except Exception:
        pass

def _parse_json(value):
    if not value:
        return {}
    try:
        return json.loads(value)
    except Exception:
        return {}


def _build_item(r):
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
        "thumbnail": f"/preview/{r.id}?v={v}"
    }


def _resolve_path(original_path: Path) -> Path:
    if original_path.exists():
        return original_path

    cfg = load_config()
    if not cfg.get("path_mapping_enabled"):
        return original_path

    source_root = Path(cfg.get("original_backup_path") or cfg.get("backup_path", ""))
    target_root = Path(cfg.get("backup_path", ""))
    if not source_root or not target_root:
        return original_path

    try:
        relative = original_path.relative_to(source_root)
    except Exception:
        return original_path

    mapped = target_root / relative
    if mapped.exists():
        return mapped

    return original_path


def _normalize_date_tokens(token):
    token = token.strip()
    if m := re.match(r"^(\d{4})(?:[-/](\d{2})(?:[-/](\d{2}))?)?$", token):
        year, month, day = m.groups()
        tags = [f"date:{year}"]
        if month:
            tags.append(f"date:{year}-{month}")
            if day:
                tags.append(f"date:{year}-{month}-{day}")
                tags.append(f"date:{month}/{day}/{year}")
                tags.append(f"date:{day}/{month}/{year}")
            else:
                tags.append(f"date:{month}/{year}")
        return tags
    if m := re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", token):
        p1, p2, year = m.groups()
        p1 = p1.zfill(2)
        p2 = p2.zfill(2)
        return [
            f"date:{year}",
            f"date:{year}-{p1}",
            f"date:{year}-{p2}",
            f"date:{year}-{p1}-{p2}",
            f"date:{year}-{p2}-{p1}",
            f"date:{p1}/{p2}/{year}",
            f"date:{p2}/{p1}/{year}"
        ]
    return [f"date:{token}"]


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

    tokens = query.split()
    filters = []
    tag_tokens = []
    specific_filters = []

    for token in tokens:
        lower_token = token.lower()
        if lower_token.startswith("date:"):
            tag_tokens.extend(_normalize_date_tokens(token[len("date:"):]))
        elif lower_token.startswith("tag:"):
            tag_tokens.append(token[len("tag:"):].lower())
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
            specific_filters.append(text_filter(FileIndex.size, val))
        elif lower_token.startswith("length:"):
            val = lower_token[len("length:"):]
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
    return q

@app.get("/files")
def files(category:str="all", offset:int=0, limit:int=50):
    with SessionLocal() as s:
        q = s.query(FileIndex)
        if category != "all":
            if category == "other":
                standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                q = q.filter(~FileIndex.category.in_(standard))
            else:
                q = q.filter(FileIndex.category == category)
        rows = q.offset(offset).limit(limit).all()
        return [_build_item(r) for r in rows]

@app.get("/search")
def search(query:str="", category:str="all", offset:int=0, limit:int=50):
    with SessionLocal() as s:
        q_base = s.query(FileIndex)
        if category != "all":
            if category == "other":
                standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                q_base = q_base.filter(~FileIndex.category.in_(standard))
            else:
                q_base = q_base.filter(FileIndex.category == category)

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
            return [_build_item(r) for r in filtered]

        q = _build_search_query(query, s, q_base)
        rows = q.offset(offset).limit(limit).all()
        return [_build_item(r) for r in rows]

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
                        cv2.imwrite(str(cached_thumb), resized_frame)
                        cap.release()
                        return FileResponse(str(cached_thumb), media_type="image/jpeg")
                    cap.release()
                except Exception as e:
                    print(f"Video thumbnail error: {e}")
                    
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
                        page = doc.load_page(0)
                        pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                        pix.save(str(cached_thumb))
                        doc.close()
                        return FileResponse(str(cached_thumb), media_type="image/jpeg")
                    except Exception as e:
                        print(f"PDF thumbnail error: {e}")
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
                        print(f"Text thumbnail error: {e}")

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
                print(f"Failed to delete {path_str}: {e}")
        session.commit()
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
                print(f"Failed to copy {path_str}: {e}")
    return {"copied": copied_count}

@app.post("/move-files")
def move_files(paths: list[str] = Body(...), destination: str = Body(...)):
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
                    print(f"Failed to move {path_str}: {e}")
        session.commit()
    return {"moved": moved_count, "updates": updates}

@app.get("/stats")
def stats():
    with SessionLocal() as s:
        # Grouping drastically speeds up counting for millions of rows compared to 5 separate counts
        results = s.query(FileIndex.category, func.count(FileIndex.id)).group_by(FileIndex.category).all()
        stats_dict = {"total": 0, "photos": 0, "videos": 0, "audio": 0, "documents": 0, "ebooks": 0, "code": 0, "fonts": 0, "databases": 0, "compressed": 0, "installers": 0, "binaries": 0, "others": 0}
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
        return stats_dict

@app.get("/indexer/status")
def indexer_status():
    return INDEXER_STATE

@app.post("/indexer/start")
def indexer_start():
    if INDEXER_STATE.get("running"):
        return {"started": True, "ignored": True}
    INDEXER_STATE["update_only"] = False
    start_indexing()
    return {"started": INDEXER_STATE["running"]}

@app.post("/indexer/pause")
def indexer_pause():
    if INDEXER_STATE["running"] and not INDEXER_STATE["paused"]:
        INDEXER_STATE["paused"] = True
        INDEXER_STATE["status"] = "Paused"
    return INDEXER_STATE

@app.post("/indexer/resume")
def indexer_resume():
    if not INDEXER_STATE.get("running"):
        # App was closed or stopped. Resume intelligently continues from the DB state.
        INDEXER_STATE["update_only"] = True
        start_indexing()
        return {"resumed_from_db": True}
    if INDEXER_STATE.get("running") and INDEXER_STATE.get("paused"):
        INDEXER_STATE["paused"] = False
        INDEXER_STATE["status"] = "Indexing"
    return INDEXER_STATE

@app.post("/indexer/stop")
def indexer_stop():
    if INDEXER_STATE["running"]:
        INDEXER_STATE["stopped"] = True
        INDEXER_STATE["paused"] = False
        INDEXER_STATE["status"] = "Stopping..."
    return INDEXER_STATE

@app.post("/indexer/update")
def indexer_update():
    if INDEXER_STATE.get("running"):
        return {"updating": False, "ignored": True}
    INDEXER_STATE["update_only"] = True
    start_indexing()
    return {"updating": True}

@app.post("/indexer/reindex")
def indexer_reindex():
    if INDEXER_STATE.get("running"):
        return {"reindexing": False, "ignored": True}
    with SessionLocal() as s:
        s.query(FileIndex).delete()
        s.commit()

    cfg = load_config()
    # Safely rmtree ONLY our isolated cache directory, ignoring the parent folder entirely
    thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
    if thumb_dir.exists() and thumb_dir.is_dir():
        try:
            shutil.rmtree(thumb_dir)
        except Exception as e:
            print(f"Failed to clear thumbnails directory: {e}")

    INDEXER_STATE["indexed"] = 0
    INDEXER_STATE["current"] = 0
    INDEXER_STATE["total"] = 0
    INDEXER_STATE["update_only"] = False
    start_indexing()
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
    return load_config()

@app.post("/settings")
def save(data:dict):
    save_config(data)
    return {"saved":True}

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