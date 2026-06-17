import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import func, Integer, text

from backend.app.database import SessionLocal, FileIndex
from backend.app.config import load_config
from backend.app.utils.search import _build_search_query, _parse_regex_pattern

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

@router.get("/search")
def search(query:str="", category:str="all", offset:int=0, limit:int=50, sort_by:str="date", sort_order:str="desc"):
    cfg = load_config()
    ui_prefs = cfg.get("ui_preferences") or {}
    cache_enabled = cfg.get("enable_photo_thumbnail_cache")
    if cache_enabled is None:
        cache_enabled = ui_prefs.get("enable_photo_thumbnail_cache", False)
    cache_flag = "&tc=1" if str(cache_enabled).lower() in ("true", "1", "yes") else ""

    def generate():
        from sqlalchemy import text
        with SessionLocal() as s:
            q_base = s.query(FileIndex.id, FileIndex.filename, FileIndex.path, FileIndex.category, FileIndex.size, FileIndex.modified, FileIndex.extension, FileIndex.tags, FileIndex.metadata_json)
            if category != "all":
                if category == "other":
                    standard = ['photo', 'video', 'audio', 'document', 'ebook', 'code', 'font', 'database', 'compressed', 'installer', 'binary']
                    q_base = q_base.filter(~FileIndex.category.in_(standard))
                elif category == "duplicates":
                    dup_sizes = s.query(FileIndex.size).filter(FileIndex.size != '0', FileIndex.size.isnot(None)).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1)
                    q_base = q_base.filter(FileIndex.size.in_(dup_sizes))
                    q_base = q_base.order_by(func.cast(FileIndex.size, Integer).desc(), FileIndex.id)
                elif category == "searchable_documents":
                    q_base = q_base.filter(FileIndex.category.in_(['document', 'ebook', 'code']), text("files.id IN (SELECT file_id FROM processed_text)"))
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
            if not q_clean:
                yield "["
                first = True
                for r in q_base.offset(offset).limit(limit).yield_per(1000):
                    if not first: yield ","
                    first = False
                    yield json.dumps(_build_item(r, cache_flag))
                yield "]"
                return

            regex = _parse_regex_pattern(q_clean)
            if regex:
                filtered = []
                match_count = 0
                yield "["
                first = True
                for r in q_base.yield_per(1000):
                    haystack = f"{r.filename or ''} {r.path or ''} {r.tags or ''} {r.metadata_json or ''}"
                    if regex.search(haystack):
                        if match_count >= offset:
                            if not first: yield ","
                            first = False
                            yield json.dumps(_build_item(r, cache_flag))
                            filtered.append(r)
                        match_count += 1
                        if len(filtered) == limit:
                            break
                yield "]"
                return

            search_prefixes = [
                "date:", "tag:", "type:", "name:", "size:", "length:", "object:", "person:",
                "camera:", "resolution:", "fps:", "artist:", "album:", "genre:", "meta:"
            ]
            if any(prefix in q_clean.lower() for prefix in search_prefixes) or "*" in q_clean or q_clean.startswith("-") or " -" in q_clean or q_clean.startswith("+") or " +" in q_clean:
                q = _build_search_query(q_clean, s, q_base)
                yield "["
                first = True
                for r in q.offset(offset).limit(limit).yield_per(1000):
                    if not first: yield ","
                    first = False
                    yield json.dumps(_build_item(r, cache_flag))
                yield "]"
                return
                
            safe_query = q_clean.replace('"', '""').replace("'", "''")
            fts_terms = [f'"{word}" *' for word in safe_query.split() if word]
            if not fts_terms:
                yield "[]"
                return
                
            fts_query = " AND ".join(fts_terms)
            
            matching_ids = s.execute(
                text("""
                SELECT rowid FROM files_fts WHERE files_fts MATCH :q
                UNION
                SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :q
                LIMIT 1000
                """),
                {"q": fts_query}
            ).scalars().all()

            if not matching_ids:
                yield "[]"
                return
                
            rows = q_base.filter(FileIndex.id.in_(matching_ids)).all()
            id_to_row = {r.id: r for r in rows}
            sorted_rows = [id_to_row[i] for i in matching_ids if i in id_to_row]
            
            yield "["
            first = True
            for r in sorted_rows[offset:offset+limit]:
                if not first: yield ","
                first = False
                yield json.dumps(_build_item(r, cache_flag))
            yield "]"

    return StreamingResponse(generate(), media_type="application/json")

@router.get("/search/suggestions")
def search_suggestions(q: str = "", limit: int = 5):
    from sqlalchemy import text
    import difflib
    
    q = q.strip().lower()
    if not q:
        return {"type": "none", "suggestions": [], "last_word": ""}
        
    words = q.split()
    last_word = words[-1]
    
    if "*" in last_word or ":" in last_word:
        return {"type": "none", "suggestions": [], "last_word": last_word}
        
    # Strip leading search operators (+ or -) for spelling check
    prefix = ""
    if last_word.startswith("+") or last_word.startswith("-"):
        prefix = last_word[0]
        last_word = last_word[1:]
        
    if not last_word:
        return {"type": "none", "suggestions": [], "last_word": ""}
        
    with SessionLocal() as s:
        results = s.execute(
            text("SELECT term FROM files_fts_vocab WHERE term LIKE :prefix ORDER BY doc DESC LIMIT :limit"),
            {"prefix": f"{last_word}%", "limit": limit}
        ).scalars().all()
        
        if results:
            suggestions = [f"{prefix}{r}" for r in results]
            return {"type": "autocomplete", "suggestions": suggestions, "last_word": last_word}
            
        if len(last_word) >= 3:
            all_terms = s.execute(
                text("SELECT term FROM files_fts_vocab WHERE length(term) BETWEEN :min_l AND :max_l ORDER BY doc DESC LIMIT 1000"),
                {"min_l": len(last_word)-2, "max_l": len(last_word)+2}
            ).scalars().all()
            
            close_matches = difflib.get_close_matches(last_word, all_terms, n=limit, cutoff=0.7)
            
            valid_matches = []
            for m in close_matches:
                if m == last_word:
                    continue
                if last_word.startswith(m) and len(last_word) - len(m) <= 3:
                    continue
                valid_matches.append(m)
                
            if valid_matches:
                suggestions = [f"{prefix}{m}" for m in valid_matches]
                return {"type": "did_you_mean", "suggestions": suggestions, "last_word": last_word}
                
    return {"type": "none", "suggestions": [], "last_word": last_word}