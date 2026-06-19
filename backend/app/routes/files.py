import os
import platform
import shutil
import json
import mimetypes
import subprocess
from pathlib import Path

# FastAPI & Router
from fastapi import APIRouter, Body, HTTPException, Depends
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import func, Integer, text

# Project Dependencies
from backend.app.database import SessionLocal, FileIndex
from backend.app.config import load_config
from backend.app.utils.utils import _resolve_path
from backend.app.utils.media import generate_photo_thumbnail, generate_video_thumbnail, generate_document_thumbnail
from backend.app.utils.indexer import PLAIN_TEXT_EXTENSIONS
from backend.app.utils.validators import check_no_scanners_running, lock_data_operation
import backend.app.shared_state as shared_state
from backend.app.state import STATE

router = APIRouter()

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

@router.get("/files")
def files(category:str="all", offset:int=0, limit:int=50, sort_by:str="date", sort_order:str="desc"):
    cfg = load_config()
    ui_prefs = cfg.get("ui_preferences") or {}
    cache_enabled = cfg.get("enable_photo_thumbnail_cache")
    if cache_enabled is None:
        cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
    cache_flag = "&tc=1" if cache_enabled else ""

    def generate():
        with SessionLocal() as s:
            q = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.category, FileIndex.size, FileIndex.modified, FileIndex.extension, FileIndex.tags, FileIndex.metadata_json)
            if category != "all":
                if category == "other":
                    standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                    q = q.filter(~FileIndex.category.in_(standard))
                elif category == "duplicates":
                    dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                    q = q.filter(FileIndex.size.in_(dup_sizes))
                    q = q.order_by(func.cast(FileIndex.size, Integer).desc(), FileIndex.id)
                elif category == "searchable_documents":
                    q = q.filter(FileIndex.category.in_(['document', 'ebook', 'code']), text("files.id IN (SELECT file_id FROM processed_text)"))
                elif category == "untagged":
                    q = q.filter(FileIndex.category == 'photo', (FileIndex.tags.is_(None) | (~FileIndex.tags.like('%object:%') & ~FileIndex.tags.like('%person:%'))))
                else:
                    q = q.filter(FileIndex.category == category)
                    
            if category != "duplicates":
                if sort_by == "date":
                    order_expr = "coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10))"
                    if sort_order == "asc":
                        q = q.order_by(text(f"{order_expr} ASC"), FileIndex.id)
                    else:
                        q = q.order_by(text(f"{order_expr} DESC"), FileIndex.id)
                elif sort_by == "size":
                    if sort_order == "asc":
                        q = q.order_by(text("CAST(size AS INTEGER) ASC"), FileIndex.id)
                    else:
                        q = q.order_by(text("CAST(size AS INTEGER) DESC"), FileIndex.id)
                elif sort_by == "filename":
                    if sort_order == "asc":
                        q = q.order_by(FileIndex.filename.asc(), FileIndex.id)
                    else:
                        q = q.order_by(FileIndex.filename.desc(), FileIndex.id)
                elif sort_by == "extension":
                    if sort_order == "asc":
                        q = q.order_by(FileIndex.extension.asc(), FileIndex.id)
                    else:
                        q = q.order_by(FileIndex.extension.desc(), FileIndex.id)

            yield "["
            first = True
            for r in q.offset(offset).limit(limit).yield_per(1000):
                if shared_state.APP_SHUTTING_DOWN:
                    break
                if not first: yield ","
                first = False
                yield json.dumps(_build_item(r, cache_flag))
            yield "]"
            
    return StreamingResponse(generate(), media_type="application/json")

@router.get("/preview/{item_id}")
def preview(item_id:int, theme: str = "dark"):
    with SessionLocal() as session:
        item = session.get(FileIndex, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        file_path = _resolve_path(Path(item.path))
        file_category = item.category

    cfg = load_config()

    # --- OFFLINE CACHE CHECK ---
    if file_category == "photo":
        ui_prefs = cfg.get("ui_preferences") or {}
        cache_enabled = cfg.get("enable_photo_thumbnail_cache")
        if cache_enabled is None:
            cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
        if str(cache_enabled).lower() in ("true", "1", "yes") or (file_path and file_path.suffix.lower() == ".dng"):
            cached_thumb = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "photos" / f"{item_id}.jpg"
            if cached_thumb.exists():
                return FileResponse(str(cached_thumb), media_type="image/jpeg")
    elif file_category == "video" or (file_category in ["document", "code"] and file_path.suffix.lower() == ".pdf"):
        cached_thumb = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / f"{item_id}.jpg"
        if cached_thumb.exists():
            return FileResponse(str(cached_thumb), media_type="image/jpeg")

    if file_path.exists() and file_path.is_file():
        if file_category == "photo":
            ui_prefs = cfg.get("ui_preferences") or {}
            cache_enabled = cfg.get("enable_photo_thumbnail_cache")
            if cache_enabled is None:
                cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
            
            is_dng = file_path.suffix.lower() == ".dng"
            if str(cache_enabled).lower() in ("true", "1", "yes") or is_dng:
                try:
                    limit_val = cfg.get("photo_thumbnail_size_limit_mb")
                    if limit_val is None:
                        limit_val = ui_prefs.get("photo_thumbnail_size_limit_mb", 5)
                    size_limit_mb = float(limit_val)
                    size_limit_bytes = size_limit_mb * 1024 * 1024
                    
                    if file_path.stat().st_size > size_limit_bytes or is_dng:
                        thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache" / "photos"
                        thumb_dir.mkdir(parents=True, exist_ok=True)
                        cached_thumb = thumb_dir / f"{item_id}.jpg"
                        
                        if cached_thumb.exists():
                            return FileResponse(str(cached_thumb), media_type="image/jpeg")
                            
                        success = generate_photo_thumbnail(file_path, cached_thumb)
                                
                        if success and cached_thumb.exists():
                            return FileResponse(str(cached_thumb), media_type="image/jpeg")
                except Exception as e:
                    print(f"Large photo/DNG thumbnail error: {e}")

            if not is_dng:
                media_type, _ = mimetypes.guess_type(str(file_path))
                return FileResponse(str(file_path), media_type=media_type or "application/octet-stream")
        elif file_category == "video":
            thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
            thumb_dir.mkdir(parents=True, exist_ok=True)
            
            cached_thumb = thumb_dir / f"{item_id}.jpg"
            if cached_thumb.exists():
                return FileResponse(str(cached_thumb), media_type="image/jpeg")
            
            success = generate_video_thumbnail(file_path, cached_thumb)
            if success and cached_thumb.exists():
                return FileResponse(str(cached_thumb), media_type="image/jpeg")
                    
        elif file_category in ["document", "code"] or file_path.suffix.lower() in PLAIN_TEXT_EXTENSIONS:
            if file_path.suffix.lower() == ".pdf":
                thumb_dir = Path(cfg.get("thumbnail_path") or "thumbnails") / ".wabs_cache"
                thumb_dir.mkdir(parents=True, exist_ok=True)
                
                cached_thumb = thumb_dir / f"{item_id}.jpg"
                if cached_thumb.exists():
                    return FileResponse(str(cached_thumb), media_type="image/jpeg")
                    
                response = generate_document_thumbnail(file_path, cached_thumb, theme)
                if response:
                    return response
            else:
                response = generate_document_thumbnail(file_path, None, theme)
                if response:
                    return response

    bg_fill = '#f8fafc' if theme == 'light' else '#111827'
    text_fill_1 = '#0f172a' if theme == 'light' else '#94a3b8'
    text_fill_2 = '#334155' if theme == 'light' else '#64748b'
    placeholder = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>
  <rect width='400' height='300' fill='{bg_fill}'/>
  <text x='50%' y='45%' fill='{text_fill_1}' font-family='Segoe UI,Arial' font-size='22' text-anchor='middle'>Preview unavailable</text>
  <text x='50%' y='60%' fill='{text_fill_2}' font-family='Segoe UI,Arial' font-size='16' text-anchor='middle'>{file_category.upper()}</text>
</svg>
""".strip()
    return Response(content=placeholder, media_type='image/svg+xml')

@router.post("/open/{item_id}")
def open_file(item_id:int):
    with SessionLocal() as session:
        item = session.get(FileIndex, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        return open_file_path(Path(item.path))

def get_clean_env():
    import os
    env = dict(os.environ)
    for var in ["LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"]:
        orig = var + "_ORIG"
        if orig in env:
            env[var] = env[orig]
        else:
            env.pop(var, None)
    return env

@router.post("/open-path")
def open_file_path(path: str = Body(..., embed=True)):
    file_path = _resolve_path(Path(path))
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")

    system_name = platform.system()
    try:
        if system_name == "Windows":
            norm_path = os.path.normpath(file_path)
            subprocess.Popen(f'start "" "{norm_path}"', shell=True)
        elif system_name == "Darwin":
            subprocess.Popen(["open", str(file_path)], env=get_clean_env())
        else:
            subprocess.Popen(["xdg-open", str(file_path)], env=get_clean_env())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to open file: {exc}")

    return {"opened": True, "path": str(file_path), "platform": system_name}

@router.post("/open-folder")
def open_folder(path: str = Body(..., embed=True)):
    resolved_path = _resolve_path(Path(path))
    folder_path = resolved_path.parent
    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    system_name = platform.system()
    try:
        if system_name == "Windows":
            if resolved_path.exists() and resolved_path.is_file():
                norm_path = os.path.normpath(resolved_path)
                subprocess.Popen(['explorer', '/select,', norm_path])
            else:
                norm_folder = os.path.normpath(folder_path)
                subprocess.Popen(['explorer', norm_folder])
        elif system_name == "Darwin":
            if resolved_path.exists() and resolved_path.is_file():
                subprocess.Popen(["open", "-R", str(resolved_path)], env=get_clean_env())
            else:
                subprocess.Popen(["open", str(folder_path)], env=get_clean_env())
        else:
            subprocess.Popen(["xdg-open", str(folder_path)], env=get_clean_env())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to open folder: {exc}")

    return {"opened": True, "path": str(folder_path), "platform": system_name}

@router.post("/delete-files", dependencies=[Depends(lock_data_operation)])
def delete_files(paths: list[str] = Body(..., embed=True)):
    """
    Deletes files from the disk and removes their entries from the database.
    Special code: Enforces Read-Only protections for specific backup locations.
    """
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
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
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

@router.post("/copy-files", dependencies=[Depends(lock_data_operation)])
def copy_files(paths: list[str] = Body(...), destination: str = Body(...)):
    """
    Copies multiple files to a selected destination directory.
    """
    dest_path = Path(destination)
    if not dest_path.exists() or not dest_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid destination directory")
    
    copied_count = 0
    for path_str in paths:
        if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
            raise HTTPException(status_code=400, detail="Operation cancelled")
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

@router.post("/move-files", dependencies=[Depends(lock_data_operation)])
def move_files(paths: list[str] = Body(...), destination: str = Body(...)):
    """
    Moves multiple files to a selected destination and updates their database paths.
    Special code: Enforces Read-Only protections to block movements out of protected backup locations.
    """
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
            if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                raise HTTPException(status_code=400, detail="Operation cancelled")
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