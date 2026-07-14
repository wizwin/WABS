import os
import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Body, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, Integer, text, or_
from pydantic import BaseModel

from pathlib import Path
from backend.app.database import SessionLocal, FileIndex, VirtualFolder, VirtualFolderFile
from backend.app.config import load_config
from backend.app.utils.utils import _resolve_path
from backend.app.utils.search import _build_search_query, _parse_regex_pattern
import backend.app.shared_state as shared_state
from backend.app.constants import (
    STANDARD_CATEGORIES,
    SEARCH_PREFIXES,
    SEARCHABLE_DOCUMENT_CATEGORIES
)

import re

INVALID_CHARS_REGEX = re.compile(r'[<>:"/\\|?*]')
RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"}

def validate_folder_name(name: str):
    name_clean = name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Folder name cannot be empty")
    if INVALID_CHARS_REGEX.search(name_clean):
        raise HTTPException(status_code=400, detail="Folder name contains invalid characters: < > : \" / \\ | ? *")
    if name_clean.upper() in RESERVED_NAMES:
        raise HTTPException(status_code=400, detail=f"Folder name '{name_clean}' is a reserved system name")
    return name_clean

router = APIRouter()

# Helper models for Pydantic
class VirtualFolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    is_dynamic: bool = False
    query: Optional[str] = None
    metadata_json: Optional[str] = None

class VirtualFolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    is_dynamic: Optional[bool] = None
    query: Optional[str] = None
    metadata_json: Optional[str] = None

class FileAssociationRequest(BaseModel):
    file_ids: List[int]
    paths: Optional[List[str]] = None
    recursive: Optional[bool] = True

def get_relative_segments(path_str: str) -> list[str]:
    cfg = load_config()
    backup_configs = cfg.get("backup_configs", [])
    norm_path = path_str.replace('\\', '/').lower()
    
    matched_prefix = None
    longest_match = -1
    
    for config in backup_configs:
        bp = config.get("backup_path")
        if bp:
            bp_norm = bp.replace('\\', '/').lower()
            if bp_norm.endswith('/') and len(bp_norm) > 3:
                bp_norm = bp_norm[:-1]
            if norm_path.startswith(bp_norm + '/') or norm_path == bp_norm:
                if len(bp_norm) > longest_match:
                    longest_match = len(bp_norm)
                    matched_prefix = bp_norm
                    
    path_clean = path_str.replace('\\', '/')
    if matched_prefix:
        rel = path_clean[longest_match:].strip('/')
    else:
        import re
        rel = re.sub(r'^[a-zA-Z]:', '', path_clean).strip('/')
        
    return [s for s in rel.split('/') if s]

def copy_virtual_folder_hierarchy(s, src_folder_id: int, dest_parent_id: int, visited=None):
    if visited is None:
        visited = set()
    if src_folder_id in visited:
        return
    visited.add(src_folder_id)

    src_folder = s.get(VirtualFolder, src_folder_id)
    if not src_folder:
        return
        
    vf = s.query(VirtualFolder).filter(
        VirtualFolder.parent_id == dest_parent_id,
        func.lower(VirtualFolder.name) == src_folder.name.lower()
    ).first()
    
    if not vf:
        vf = VirtualFolder(
            name=src_folder.name,
            parent_id=dest_parent_id,
            is_dynamic=src_folder.is_dynamic,
            query=src_folder.query,
            metadata_json=src_folder.metadata_json
        )
        s.add(vf)
        s.flush()
        
    manual_rows = s.query(VirtualFolderFile.file_id).filter(VirtualFolderFile.virtual_folder_id == src_folder_id).all()
    for r in manual_rows:
        exists = s.query(VirtualFolderFile).filter(
            VirtualFolderFile.virtual_folder_id == vf.id,
            VirtualFolderFile.file_id == r[0]
        ).first()
        if not exists:
            s.add(VirtualFolderFile(virtual_folder_id=vf.id, file_id=r[0]))
            
    children = s.query(VirtualFolder).filter(VirtualFolder.parent_id == src_folder_id).all()
    for child in children:
        copy_virtual_folder_hierarchy(s, child.id, vf.id, visited)

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

def cleanup_orphans(s):
    try:
        # Delete associations where folder doesn't exist
        s.execute(text("""
            DELETE FROM virtual_folder_files 
            WHERE virtual_folder_id NOT IN (SELECT id FROM virtual_folders)
        """))
        # Delete folders where parent is set but doesn't exist
        s.execute(text("""
            DELETE FROM virtual_folders 
            WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM virtual_folders)
        """))
        s.commit()
    except Exception as e:
        print(f"Error cleaning up orphans: {e}")

def delete_folder_recursive(s, folder_id: int):
    # Fetch all descendants iteratively
    folder_ids = get_folder_and_descendants_ids(s, folder_id)
    if not folder_ids:
        return
        
    # Bulk delete files in these folders
    s.query(VirtualFolderFile).filter(VirtualFolderFile.virtual_folder_id.in_(folder_ids)).delete(synchronize_session=False)
    
    # Bulk delete folders
    s.query(VirtualFolder).filter(VirtualFolder.id.in_(folder_ids)).delete(synchronize_session=False)

def get_folder_files_recursive(s, folder_id: int) -> set:
    folder_ids = get_folder_and_descendants_ids(s, folder_id)
    file_ids = set()
    
    # 1. Bulk query manual file IDs for all these folders
    manual_rows = s.query(VirtualFolderFile.file_id).filter(
        VirtualFolderFile.virtual_folder_id.in_(folder_ids)
    ).all()
    for r in manual_rows:
        file_ids.add(r[0])
        
    # 2. Get dynamic matching file IDs for each folder
    folders = s.query(VirtualFolder).filter(VirtualFolder.id.in_(folder_ids)).all()
    for folder in folders:
        q_clean = (folder.query or "").strip()
        if q_clean:
            matching_ids = []
            regex = _parse_regex_pattern(q_clean)
            if regex:
                q_base = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.tags, FileIndex.metadata_json)
                for r in q_base.yield_per(1000):
                    haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                    if regex.search(haystack):
                        matching_ids.append(r.id)
            else:
                if any(prefix in q_clean.lower() for prefix in SEARCH_PREFIXES) or "*" in q_clean or q_clean.startswith("-") or " -" in q_clean or q_clean.startswith("+") or " +" in q_clean:
                    q_dyn = _build_search_query(q_clean, s, s.query(FileIndex.id))
                    matching_ids = [r[0] for r in q_dyn.all()]
                else:
                    safe_query = q_clean.replace('"', '""').replace("'", "''")
                    fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
                    if fts_terms:
                        fts_query = " AND ".join(fts_terms)
                        try:
                            matching_ids = s.execute(
                                text("""
                                SELECT rowid FROM files_fts WHERE files_fts MATCH :q
                                UNION
                                SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :q
                                """),
                                {"q": fts_query}
                            ).scalars().all()
                        except Exception:
                            matching_ids = []
            for f_id in matching_ids:
                file_ids.add(f_id)
                
    return file_ids
        
    return file_ids

def get_folder_counts(s, folder):
    all_file_ids = get_folder_files_recursive(s, folder.id)
    file_count = len(all_file_ids)
    
    # 3. Subfolder count
    subfolder_count = s.query(VirtualFolder).filter(VirtualFolder.parent_id == folder.id).count()
    
    return file_count, subfolder_count

@router.get("/virtual-folders")
def get_virtual_folders():
    # MEMORY OPTIMIZATION: This endpoint is called at startup and on every folder operation.
    # Previously it ran get_folder_files_recursive() for every folder to compute file counts,
    # which allocated large Python sets per folder and kept memory high (240+ MB idle).
    # Now, file_count is returned as None (lazy) and must be fetched separately via
    # GET /virtual-folders/{id}/count — only called when the VirtualFolders page is visible.
    # Subfolder count is cheap (a single COUNT query) and is still computed here.
    with SessionLocal() as s:
        cleanup_orphans(s)
        folders = s.query(VirtualFolder).all()
        result = []
        for f in folders:
            # Subfolder count: fast single COUNT query, safe to compute here
            subfolder_count = s.query(VirtualFolder).filter(VirtualFolder.parent_id == f.id).count()
            result.append({
                "id": f.id,
                "name": f.name,
                "parent_id": f.parent_id,
                "is_dynamic": bool(f.is_dynamic),
                "query": f.query,
                "created_at": f.created_at,
                "file_count": None,  # Lazy — fetched on demand via /virtual-folders/{id}/count
                "subfolder_count": subfolder_count,
                "metadata_json": f.metadata_json
            })
        return result

@router.get("/virtual-folders/{folder_id}/count")
def get_virtual_folder_count(folder_id: int):
    """
    Returns the recursive file count for a single virtual folder.
    This is a separate, on-demand endpoint so the main /virtual-folders list stays fast.
    The frontend calls this only when the VirtualFolders page is actively displayed,
    not on every startup or navigation event.
    """
    with SessionLocal() as s:
        folder = s.get(VirtualFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Virtual folder not found")
        # get_folder_files_recursive handles both manual files and dynamic query matches
        all_file_ids = get_folder_files_recursive(s, folder_id)
        return {"file_count": len(all_file_ids)}

@router.post("/virtual-folders")
def create_virtual_folder(folder: VirtualFolderCreate):
    name_clean = validate_folder_name(folder.name)
    with SessionLocal() as s:
        cleanup_orphans(s)
        new_folder = VirtualFolder(
            name=name_clean,
            parent_id=folder.parent_id,
            is_dynamic=1 if folder.is_dynamic else 0,
            query=folder.query,
            created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            metadata_json=folder.metadata_json
        )
        s.add(new_folder)
        s.commit()
        s.refresh(new_folder)
        return {
            "id": new_folder.id,
            "name": new_folder.name,
            "parent_id": new_folder.parent_id,
            "is_dynamic": bool(new_folder.is_dynamic),
            "query": new_folder.query,
            "created_at": new_folder.created_at,
            "metadata_json": new_folder.metadata_json
        }

@router.put("/virtual-folders/{folder_id}")
def update_virtual_folder(folder_id: int, req: VirtualFolderUpdate):
    with SessionLocal() as s:
        folder = s.get(VirtualFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Virtual folder not found")
        
        update_data = req.dict(exclude_unset=True)
        if "name" in update_data:
            name_clean = validate_folder_name(req.name)
            folder.name = name_clean
        if "parent_id" in update_data:
            if req.parent_id is not None:
                if req.parent_id == folder_id:
                    raise HTTPException(status_code=400, detail="Folder cannot be its own parent")
                descendants = get_folder_and_descendants_ids(s, folder_id)
                if req.parent_id in descendants:
                    raise HTTPException(status_code=400, detail="Folder cannot have its own descendant as a parent")
            folder.parent_id = req.parent_id
        if "is_dynamic" in update_data:
            folder.is_dynamic = 1 if req.is_dynamic else 0
        if "query" in update_data:
            folder.query = req.query
        if "metadata_json" in update_data:
            folder.metadata_json = req.metadata_json
            
        s.commit()
        s.refresh(folder)
        return {
            "id": folder.id,
            "name": folder.name,
            "parent_id": folder.parent_id,
            "is_dynamic": bool(folder.is_dynamic),
            "query": folder.query,
            "created_at": folder.created_at,
            "metadata_json": folder.metadata_json
        }

@router.delete("/virtual-folders/{folder_id}")
def delete_virtual_folder(folder_id: int):
    with SessionLocal() as s:
        folder = s.get(VirtualFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Virtual folder not found")
        
        delete_folder_recursive(s, folder_id)
        s.commit()
        cleanup_orphans(s)
        return {"status": "success", "message": f"Folder {folder_id} and all subfolders deleted successfully"}

@router.post("/virtual-folders/{folder_id}/files")
def add_files_to_virtual_folder(folder_id: int, req: FileAssociationRequest):
    with SessionLocal() as s:
        folder = s.get(VirtualFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Virtual folder not found")
            
        added_count = 0
        
        # 1. Handle individual file IDs
        if req.file_ids:
            existing_rows = s.query(VirtualFolderFile.file_id).filter(
                VirtualFolderFile.virtual_folder_id == folder_id,
                VirtualFolderFile.file_id.in_(req.file_ids)
            ).all()
            existing = {row[0] for row in existing_rows}
            to_add = set(req.file_ids) - existing
            for f_id in to_add:
                s.add(VirtualFolderFile(virtual_folder_id=folder_id, file_id=f_id))
            added_count += len(to_add)
            
        # 2. Handle paths (which can contain directory paths, file paths, or virtual folder paths)
        if req.paths:
            for path_str in req.paths:
                if not path_str:
                    continue
                    
                # A. Virtual Folder Path (e.g. virtual_folder:ID)
                if path_str.startswith("virtual_folder:"):
                    src_vf_id = int(path_str.split(":")[1])
                    descendants = get_folder_and_descendants_ids(s, src_vf_id)
                    if folder_id in descendants:
                        raise HTTPException(status_code=400, detail="Cannot copy a virtual folder into itself or its descendants")
                    try:
                        copy_virtual_folder_hierarchy(s, src_vf_id, folder_id)
                    except Exception as e:
                        print(f"Error copying virtual folder hierarchy: {e}")
                        
                # B. Physical Directory / File Path
                else:
                    folder_normalized = path_str.replace('\\', '/')
                    if not folder_normalized.endswith('/'):
                        folder_normalized += '/'
                        
                    normalized_path = func.replace(FileIndex.path, '\\', '/')
                    
                    # Check if this path represents a directory containing files in the database
                    has_children = s.query(FileIndex.id).filter(
                        normalized_path.like(folder_normalized + '%')
                    ).first() is not None
                    
                    if has_children:
                        # Extract the selected folder's base name
                        folder_name = path_str.replace('\\', '/').rstrip('/').split('/')[-1]
                        
                        # Create/resolve this subfolder directly under the target virtual folder
                        vf = s.query(VirtualFolder).filter(
                            VirtualFolder.parent_id == folder_id,
                            func.lower(VirtualFolder.name) == folder_name.lower()
                        ).first()
                        if not vf:
                            vf = VirtualFolder(name=folder_name, parent_id=folder_id)
                            s.add(vf)
                            s.flush()
                        current_parent_id = vf.id
                            
                        matching_files = s.query(FileIndex.id, FileIndex.path).filter(
                            normalized_path.like(folder_normalized + '%')
                        ).all()
                        
                        for f in matching_files:
                            f_path_clean = f.path.replace('\\', '/')
                            rel_to_base = f_path_clean[len(folder_normalized):]
                            parts = [p for p in rel_to_base.split('/')[:-1] if p]
                            
                            file_parent_id = current_parent_id
                            for part in parts:
                                vf = s.query(VirtualFolder).filter(
                                    VirtualFolder.parent_id == file_parent_id,
                                    func.lower(VirtualFolder.name) == part.lower()
                                ).first()
                                if not vf:
                                    vf = VirtualFolder(name=part, parent_id=file_parent_id)
                                    s.add(vf)
                                    s.flush()
                                file_parent_id = vf.id
                                
                            exists = s.query(VirtualFolderFile).filter(
                                VirtualFolderFile.virtual_folder_id == file_parent_id,
                                VirtualFolderFile.file_id == f.id
                            ).first()
                            if not exists:
                                s.add(VirtualFolderFile(virtual_folder_id=file_parent_id, file_id=f.id))
                                added_count += 1
                                
                    else:
                        # C. Individual File Path
                        db_file = s.query(FileIndex.id).filter(FileIndex.path == path_str).first()
                        if db_file:
                            exists = s.query(VirtualFolderFile).filter(
                                VirtualFolderFile.virtual_folder_id == folder_id,
                                VirtualFolderFile.file_id == db_file[0]
                            ).first()
                            if not exists:
                                s.add(VirtualFolderFile(virtual_folder_id=folder_id, file_id=db_file[0]))
                                added_count += 1

        s.commit()
        return {"status": "success", "added": added_count}

@router.post("/virtual-folders/{folder_id}/files/delete")
@router.delete("/virtual-folders/{folder_id}/files")
def remove_files_from_virtual_folder(folder_id: int, req: FileAssociationRequest):
    with SessionLocal() as s:
        folder = s.get(VirtualFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Virtual folder not found")
            
        resolved_ids = list(req.file_ids) if req.file_ids else []
        if req.paths:
            for path_str in req.paths:
                folder_normalized = path_str.replace('\\', '/')
                if not folder_normalized.endswith('/'):
                    folder_normalized += '/'
                
                normalized_path = func.replace(FileIndex.path, '\\', '/')
                matching_files = s.query(FileIndex.id).filter(
                    or_(
                        FileIndex.path == path_str,
                        normalized_path.like(folder_normalized + '%')
                    )
                ).all()
                resolved_ids.extend([row[0] for row in matching_files])

        if not resolved_ids:
            return {"status": "success", "removed": 0}

        if req.recursive:
            descendant_ids = get_folder_and_descendants_ids(s, folder_id)
        else:
            descendant_ids = [folder_id]
        
        # If any of the descendant folders containing the removed files are dynamic (rule-based),
        # convert them to manual folders so the user's manual removal/change is preserved.
        converted_any = False
        for fid in descendant_ids:
            fol = s.get(VirtualFolder, fid)
            if fol and fol.query and fol.query.strip():
                all_member_ids = get_virtual_folder_file_ids(s, fid)
                overlap = set(all_member_ids).intersection(resolved_ids)
                if overlap:
                    # Convert to manual: insert all current members as manual rows
                    for mid in all_member_ids:
                        exists = s.query(VirtualFolderFile).filter(
                            VirtualFolderFile.virtual_folder_id == fid,
                            VirtualFolderFile.file_id == mid
                        ).first()
                        if not exists:
                            s.add(VirtualFolderFile(virtual_folder_id=fid, file_id=mid))
                    fol.query = None
                    converted_any = True
        
        if converted_any:
            s.flush() # Write new manual rows so they can be deleted if they match resolved_ids

        deleted = s.query(VirtualFolderFile).filter(
            VirtualFolderFile.virtual_folder_id.in_(descendant_ids),
            VirtualFolderFile.file_id.in_(resolved_ids)
        ).delete(synchronize_session=False)
        
        s.commit()
        return {"status": "success", "removed": deleted}

def get_virtual_folder_file_ids(s, folder_id: int) -> list:
    folder = s.get(VirtualFolder, folder_id)
    if not folder:
        return []

    # 1. Get manual linked file IDs
    manual_rows = s.query(VirtualFolderFile.file_id).filter(VirtualFolderFile.virtual_folder_id == folder_id).all()
    manual_ids = [r[0] for r in manual_rows]

    # 2. Get dynamic matching file IDs (if query exists)
    matching_ids = []
    q_clean = (folder.query or "").strip()
    
    if q_clean:
        # Resolve dynamic folder query to a list of matching file IDs
        regex = _parse_regex_pattern(q_clean)
        if regex:
            q_base = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.tags, FileIndex.metadata_json)
            for r in q_base.yield_per(1000):
                haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                if regex.search(haystack):
                    matching_ids.append(r.id)
        else:
            if any(prefix in q_clean.lower() for prefix in SEARCH_PREFIXES) or "*" in q_clean or q_clean.startswith("-") or " -" in q_clean or q_clean.startswith("+") or " +" in q_clean:
                q_dyn = _build_search_query(q_clean, s, s.query(FileIndex.id))
                matching_ids = [r[0] for r in q_dyn.all()]
            else:
                safe_query = q_clean.replace('"', '""').replace("'", "''")
                fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
                if fts_terms:
                    fts_query = " AND ".join(fts_terms)
                    try:
                        matching_ids = s.execute(
                            text("""
                            SELECT rowid FROM files_fts WHERE files_fts MATCH :q
                            UNION
                            SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :q
                            """),
                            {"q": fts_query}
                        ).scalars().all()
                    except Exception:
                        matching_ids = []
                        
    if q_clean:
        return list(set(manual_ids + matching_ids))
    else:
        return manual_ids

def get_folder_and_descendants_ids(s, folder_id: int) -> list:
    # Fetch all folder IDs and their parent_ids in a single fast query
    rows = s.query(VirtualFolder.id, VirtualFolder.parent_id).all()
    
    # Build adjacency list in memory
    from collections import defaultdict
    adj = defaultdict(list)
    for fid, pid in rows:
        if pid is not None:
            adj[pid].append(fid)
            
    # BFS in memory to gather all descendant IDs
    folder_ids = []
    to_visit = [folder_id]
    visited = {folder_id}
    while to_visit:
        curr = to_visit.pop(0)
        folder_ids.append(curr)
        for child_id in adj[curr]:
            if child_id not in visited:
                visited.add(child_id)
                to_visit.append(child_id)
    return folder_ids

def get_virtual_folder_file_ids_recursive(s, folder_id: int) -> list:
    descendant_ids = get_folder_and_descendants_ids(s, folder_id)
    
    # 1. Bulk query all manual linked file IDs
    manual_rows = s.query(VirtualFolderFile.file_id).filter(VirtualFolderFile.virtual_folder_id.in_(descendant_ids)).all()
    all_file_ids = {r[0] for r in manual_rows}
    
    # 2. Process dynamic queries for descendants in bulk
    dyn_folders = s.query(VirtualFolder.id, VirtualFolder.query).filter(
        VirtualFolder.id.in_(descendant_ids),
        VirtualFolder.query.isnot(None),
        VirtualFolder.query != ""
    ).all()
    
    if dyn_folders:
        regex_folders = []
        fts_prefix_queries = []
        for fid, query_str in dyn_folders:
            q_clean = query_str.strip()
            if not q_clean:
                continue
            regex = _parse_regex_pattern(q_clean)
            if regex:
                regex_folders.append((fid, regex))
            else:
                fts_prefix_queries.append((fid, q_clean))
                
        if regex_folders:
            q_base = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.tags, FileIndex.metadata_json)
            for r in q_base.yield_per(1000):
                haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                for fid, regex in regex_folders:
                    if regex.search(haystack):
                        all_file_ids.add(r.id)
                        
        for fid, q_clean in fts_prefix_queries:
            if any(prefix in q_clean.lower() for prefix in SEARCH_PREFIXES) or "*" in q_clean or q_clean.startswith("-") or " -" in q_clean or q_clean.startswith("+") or " +" in q_clean:
                q_dyn = _build_search_query(q_clean, s, s.query(FileIndex.id))
                all_file_ids.update(r[0] for r in q_dyn.all())
            else:
                safe_query = q_clean.replace('"', '""').replace("'", "''")
                fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
                if fts_terms:
                    fts_query = " AND ".join(fts_terms)
                    try:
                        matching_ids = s.execute(
                            text("""
                            SELECT rowid FROM files_fts WHERE files_fts MATCH :q
                            UNION
                            SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :q
                            """),
                            {"q": fts_query}
                        ).scalars().all()
                        all_file_ids.update(matching_ids)
                    except Exception:
                        pass
                        
    return list(all_file_ids)


@router.get("/virtual-folders/{folder_id}/files")
def get_virtual_folder_files(
    folder_id: int,
    category: str = "all",
    offset: int = 0,
    limit: int = 50,
    sort_by: str = "date",
    sort_order: str = "desc",
    recursive: bool = False
):
    cfg = load_config()
    ui_prefs = cfg.get("ui_preferences") or {}
    cache_enabled = cfg.get("enable_photo_thumbnail_cache")
    if cache_enabled is None:
        cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
    cache_flag = "&tc=1" if str(cache_enabled).lower() in ("true", "1", "yes") else ""

    def generate():
        with SessionLocal() as s:
            try:
                if recursive:
                    combined_ids = get_virtual_folder_file_ids_recursive(s, folder_id)
                else:
                    combined_ids = get_virtual_folder_file_ids(s, folder_id)
                if not combined_ids:
                    yield "[]"
                    return
                
                # Use a temp table to avoid "too many SQL variables" sqlite error for large folders
                s.execute(text("CREATE TEMP TABLE IF NOT EXISTS temp_combined_ids (id INTEGER PRIMARY KEY)"))
                s.execute(text("DELETE FROM temp_combined_ids"))
                
                id_list = list(combined_ids)
                for i in range(0, len(id_list), 900):
                    chunk = id_list[i:i+900]
                    placeholders = ",".join(f"({x})" for x in chunk)
                    s.execute(text(f"INSERT INTO temp_combined_ids (id) VALUES {placeholders}"))
                
                q_base = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.category, FileIndex.size, FileIndex.modified, FileIndex.extension, FileIndex.tags, FileIndex.metadata_json)
                q = q_base.filter(text("files.id IN (SELECT id FROM temp_combined_ids)"))

                # Apply category filtering
                if category != "all":
                    if category == "other":
                        q = q.filter(~FileIndex.category.in_(STANDARD_CATEGORIES))
                    elif category == "duplicates":
                        dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                        q = q.filter(FileIndex.size.in_(dup_sizes))
                        q = q.order_by(func.cast(FileIndex.size, Integer).desc(), FileIndex.id)
                    elif category == "searchable_documents":
                        q = q.filter(FileIndex.category.in_(SEARCHABLE_DOCUMENT_CATEGORIES), text("files.id IN (SELECT file_id FROM processed_text)"))
                    elif category == "tagged_objects":
                        q = q.filter(FileIndex.tags.like('%object:%'))
                    elif category == "untagged":
                        q = q.filter(FileIndex.category == 'photo', (FileIndex.tags.is_(None) | (FileIndex.tags == '') | (~FileIndex.tags.like('%object:%') & ~FileIndex.tags.like('%person:%') & ~FileIndex.tags.like('%ocr%'))))
                    else:
                        q = q.filter(FileIndex.category == category)

                # Apply sorting
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
            finally:
                try:
                    s.execute(text("DROP TABLE IF EXISTS temp_combined_ids"))
                    s.commit()
                except Exception:
                    pass

    return StreamingResponse(generate(), media_type="application/json")

class ExportFolderRequest(BaseModel):
    target_path: str

def get_folder_files_internal(s, folder_id: int):
    folder = s.get(VirtualFolder, folder_id)
    if not folder:
        return []
    
    # 1. Get manual linked file IDs
    manual_rows = s.query(VirtualFolderFile.file_id).filter(VirtualFolderFile.virtual_folder_id == folder_id).all()
    manual_ids = [r[0] for r in manual_rows]
    
    # 2. Get dynamic matching file IDs
    matching_ids = []
    q_clean = (folder.query or "").strip()
    
    # Setup base query for filtering
    q_base = s.query(FileIndex)
    
    if q_clean:
        regex = _parse_regex_pattern(q_clean)
        if regex:
            for r in q_base.yield_per(1000):
                haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                if regex.search(haystack):
                    matching_ids.append(r.id)
        else:
            if any(prefix in q_clean.lower() for prefix in SEARCH_PREFIXES) or "*" in q_clean or q_clean.startswith("-") or " -" in q_clean or q_clean.startswith("+") or " +" in q_clean:
                q_dyn = _build_search_query(q_clean, s, s.query(FileIndex.id))
                matching_ids = [r[0] for r in q_dyn.all()]
            else:
                safe_query = q_clean.replace('"', '""').replace("'", "''")
                fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
                if fts_terms:
                    fts_query = " AND ".join(fts_terms)
                    try:
                        matching_ids = s.execute(
                            text("""
                            SELECT rowid FROM files_fts WHERE files_fts MATCH :q
                            UNION
                            SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :q
                            """),
                            {"q": fts_query}
                        ).scalars().all()
                    except Exception:
                        matching_ids = []
    
    combined_ids = list(set(manual_ids + matching_ids))
    if not combined_ids:
        return []
        
    results = []
    for i in range(0, len(combined_ids), 900):
        chunk = combined_ids[i:i+900]
        results.extend(s.query(FileIndex).filter(FileIndex.id.in_(chunk)).all())
    return results

def count_folder_files_recursive(s, folder_id: int) -> int:
    descendant_ids = get_folder_and_descendants_ids(s, folder_id)
    total = 0
    for fid in descendant_ids:
        total += len(get_folder_files_internal(s, fid))
    return total

def run_export_background(folder_id: int, target_root: str):
    import logging
    from backend.app.state import STATE
    import backend.app.shared_state as shared_state
    
    try:
        STATE["export_error"] = ""
        STATE["cancel_data_operation"] = False
        with SessionLocal() as s:
            folder = s.get(VirtualFolder, folder_id)
            if not folder:
                return
            
            total_files = count_folder_files_recursive(s, folder_id)
            STATE["export_total"] = total_files
            STATE["export_current"] = 0
            STATE["export_current_file"] = ""
            STATE["export_running"] = True
            STATE["export_folder_id"] = folder_id
            
            def export_recurse(folder_obj, current_target):
                import shutil
                os.makedirs(current_target, exist_ok=True)
                
                files = get_folder_files_internal(s, folder_obj.id)
                for f in files:
                    if shared_state.APP_SHUTTING_DOWN or STATE.get("cancel_data_operation"):
                        return False
                    if os.path.exists(f.path):
                        try:
                            STATE["export_current_file"] = os.path.basename(f.path)
                            dest_path = os.path.join(current_target, os.path.basename(f.path))
                            base, ext = os.path.splitext(os.path.basename(f.path))
                            counter = 1
                            while os.path.exists(dest_path):
                                dest_path = os.path.join(current_target, f"{base}_{counter}{ext}")
                                counter += 1
                            shutil.copy2(f.path, dest_path)
                        except Exception as e:
                            if shared_state.LOGGING_ENABLED:
                                logging.error(f"Error exporting file {f.path}: {e}", exc_info=True)
                            else:
                                print(f"Error exporting file {f.path}: {e}")
                        finally:
                            STATE["export_current"] += 1
                    else:
                        STATE["export_current"] += 1
                        
                children = s.query(VirtualFolder).filter(VirtualFolder.parent_id == folder_obj.id).all()
                for child in children:
                    child_target = os.path.join(current_target, child.name)
                    if not export_recurse(child, child_target):
                        return False
                return True
            
            success = export_recurse(folder, target_root)
            if not success:
                STATE["export_error"] = "Cancelled"
            
    except Exception as e:
        STATE["export_error"] = str(e)
        if shared_state.LOGGING_ENABLED:
            logging.error(f"Failed exporting virtual folder {folder_id}: {e}", exc_info=True)
        else:
            print(f"Failed exporting virtual folder {folder_id}: {e}")
    finally:
        STATE["export_running"] = False
        STATE["export_folder_id"] = None

@router.post("/virtual-folders/{folder_id}/export")
def export_virtual_folder(folder_id: int, req: ExportFolderRequest):
    from backend.app.state import STATE
    if STATE.get("export_running"):
        raise HTTPException(status_code=400, detail="Another export operation is already running.")
        
    with SessionLocal() as s:
        folder = s.get(VirtualFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Virtual folder not found")
        
        target_path = req.target_path.strip()
        if not target_path:
            raise HTTPException(status_code=400, detail="Target path cannot be empty")
            
        export_root = os.path.join(target_path, folder.name)
        
        from backend.app.state import STATE
        STATE["export_running"] = True
        STATE["export_folder_id"] = folder_id
        STATE["export_current"] = 0
        STATE["export_total"] = 0
        STATE["export_current_file"] = ""
        STATE["export_error"] = None
        
        import threading
        t = threading.Thread(target=run_export_background, args=(folder_id, export_root), daemon=True)
        t.start()
        
        return {"status": "success", "message": "Export started in background."}

def search_virtual_folder_internal(query: str = "", category: str = "all", offset: int = 0, limit: int = 50, sort_by: str = "date", sort_order: str = "desc", virtual_folder_id: int = None):
    from fastapi.responses import StreamingResponse
    from backend.app.routes.search import _build_item, _parse_json
    
    cfg = load_config()
    ui_prefs = cfg.get("ui_preferences") or {}
    cache_enabled = cfg.get("enable_photo_thumbnail_cache")
    if cache_enabled is None:
        cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
    cache_flag = "&tc=1" if str(cache_enabled).lower() in ("true", "1", "yes") else ""

    def generate():
        with SessionLocal() as s:
            try:
                descendant_ids = get_folder_and_descendants_ids(s, virtual_folder_id)
                q_base = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.category, FileIndex.size, FileIndex.modified, FileIndex.extension, FileIndex.tags, FileIndex.metadata_json)
                folder_file_ids = get_virtual_folder_file_ids_recursive(s, virtual_folder_id)
                
                if folder_file_ids:
                    s.execute(text("CREATE TEMP TABLE IF NOT EXISTS temp_search_ids (id INTEGER PRIMARY KEY)"))
                    s.execute(text("DELETE FROM temp_search_ids"))
                    
                    id_list = list(folder_file_ids)
                    for i in range(0, len(id_list), 900):
                        chunk = id_list[i:i+900]
                        placeholders = ",".join(f"({x})" for x in chunk)
                        s.execute(text(f"INSERT INTO temp_search_ids (id) VALUES {placeholders}"))
                    
                    q_base = q_base.filter(text("files.id IN (SELECT id FROM temp_search_ids)"))
                else:
                    q_base = q_base.filter(text("1 = 0"))

                if category != "all":
                    if category == "other":
                        q_base = q_base.filter(~FileIndex.category.in_(STANDARD_CATEGORIES))
                    elif category == "duplicates":
                        dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                        q_base = q_base.filter(FileIndex.size.in_(dup_sizes))
                        q_base = q_base.order_by(func.cast(FileIndex.size, Integer).desc(), FileIndex.id)
                    elif category == "searchable_documents":
                        q_base = q_base.filter(FileIndex.category.in_(SEARCHABLE_DOCUMENT_CATEGORIES), text("files.id IN (SELECT file_id FROM processed_text)"))
                    elif category == "tagged_objects":
                        q_base = q_base.filter(FileIndex.tags.like('%object:%'))
                    else:
                        q_base = q_base.filter(FileIndex.category == category)

                if category != "duplicates":
                    if sort_by == "date":
                        order_expr = "coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10))"
                        if sort_order == "asc":
                            q_base = q_base.order_by(text(f"{order_expr} ASC"), FileIndex.id)
                        else:
                            q_base = q_base.order_by(text(f"{order_expr} DESC"), FileIndex.id)
                    elif sort_by == "size":
                        if sort_order == "asc":
                            q_base = q_base.order_by(text("CAST(size AS INTEGER) ASC"), FileIndex.id)
                        else:
                            q_base = q_base.order_by(text("CAST(size AS INTEGER) DESC"), FileIndex.id)
                    elif sort_by == "filename":
                        if sort_order == "asc":
                            q_base = q_base.order_by(FileIndex.filename.asc(), FileIndex.id)
                        else:
                            q_base = q_base.order_by(FileIndex.filename.desc(), FileIndex.id)
                    elif sort_by == "extension":
                        if sort_order == "asc":
                            q_base = q_base.order_by(FileIndex.extension.asc(), FileIndex.id)
                        else:
                            q_base = q_base.order_by(FileIndex.extension.desc(), FileIndex.id)

                q_clean = query.strip()

                def yield_folders():
                    matching_folders = s.query(VirtualFolder).filter(
                        VirtualFolder.id.in_(descendant_ids),
                        VirtualFolder.name.like(f"%{q_clean}%")
                    ).all()
                    yield "["
                    first = True
                    for f in matching_folders[offset : offset + limit]:
                        if not first: yield ","
                        first = False
                        combined_ids = get_virtual_folder_file_ids_recursive(s, f.id)
                        file_count = len(combined_ids)
                        color = '#3b82f6'
                        if f.metadata_json:
                            try:
                                meta = json.loads(f.metadata_json)
                                if meta.get("color"):
                                    color = meta["color"]
                                elif meta.get("color_hsl"):
                                    color = meta["color_hsl"]
                            except Exception:
                                pass
                        folder_item = {
                            "id": f.id,
                            "name": f.name,
                            "parent_id": f.parent_id,
                            "filename": f.name,
                            "path": "",
                            "category": "virtual_folder",
                            "size": 0,
                            "modified": f.created_at or "",
                            "extension": "folder",
                            "tags": "",
                            "metadata": _parse_json(f.metadata_json),
                            "is_folder": True,
                            "color": color,
                            "file_count": file_count
                        }
                        yield json.dumps(folder_item)
                    yield "]"

                if not q_clean:
                    file_list = q_base.offset(offset).limit(limit).all()
                    if not file_list:
                        for chunk in yield_folders():
                            yield chunk
                        return

                    yield "["
                    first = True
                    for r in file_list:
                        if not first: yield ","
                        first = False
                        yield json.dumps(_build_item(r, cache_flag))
                    yield "]"
                    return

                file_results = []
                regex = _parse_regex_pattern(q_clean)
                if regex:
                    for r in q_base.yield_per(1000):
                        haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                        if regex.search(haystack):
                            file_results.append(r)
                elif any(prefix in q_clean.lower() for prefix in SEARCH_PREFIXES) or "*" in q_clean or q_clean.startswith("-") or " -" in q_clean or q_clean.startswith("+") or " +" in q_clean:
                    q = _build_search_query(q_clean, s, q_base)
                    file_results = q.all()
                else:
                    safe_query = q_clean.replace('"', '""').replace("'", "''")
                    fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
                    if fts_terms:
                        fts_query = " AND ".join(fts_terms)
                        try:
                            matching_ids = s.execute(
                                text("""
                                SELECT rowid FROM files_fts WHERE files_fts MATCH :q
                                UNION
                                SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :q
                                LIMIT 1000
                                """),
                                {"q": fts_query}
                            ).scalars().all()
                            if matching_ids:
                                rows = []
                                for chunk_start in range(0, len(matching_ids), 900):
                                    chunk_ids = matching_ids[chunk_start:chunk_start+900]
                                    rows.extend(q_base.filter(FileIndex.id.in_(chunk_ids)).all())
                                id_to_row = {r.id: r for r in rows}
                                file_results = [id_to_row[i] for i in matching_ids if i in id_to_row]
                        except Exception:
                            file_results = []

                if not file_results:
                    for chunk in yield_folders():
                        yield chunk
                    return

                yield "["
                first = True
                for r in file_results[offset : offset + limit]:
                    if not first: yield ","
                    first = False
                    yield json.dumps(_build_item(r, cache_flag))
                yield "]"
            finally:
                try:
                    s.execute(text("DROP TABLE IF EXISTS temp_search_ids"))
                    s.commit()
                except Exception:
                    pass

    return StreamingResponse(generate(), media_type="application/json")

@router.get("/files/{file_id}/virtual-folders")
def get_file_virtual_folders(file_id: int):
    with SessionLocal() as s:
        file_obj = s.get(FileIndex, file_id)
        if not file_obj:
            raise HTTPException(status_code=404, detail="File not found")
        
        folders = s.query(VirtualFolder).all()
        matched = []
        for f in folders:
            folder_file_ids = get_folder_files_recursive(s, f.id)
            if file_id in folder_file_ids:
                # Calculate depth and build lineage path
                depth = 0
                path_parts = []
                curr = f
                while curr:
                    path_parts.insert(0, curr.name)
                    if curr.parent_id:
                        depth += 1
                        curr = next((x for x in folders if x.id == curr.parent_id), None)
                    else:
                        curr = None
                
                matched.append({
                    "id": f.id,
                    "name": f.name,
                    "parent_id": f.parent_id,
                    "is_dynamic": f.is_dynamic,
                    "query": f.query,
                    "depth": depth,
                    "path": " / ".join(path_parts)
                })
        # Sort by depth descending so deepest child folder is matched first
        matched.sort(key=lambda x: x["depth"], reverse=True)
        for m in matched:
            del m["depth"]
        return matched
