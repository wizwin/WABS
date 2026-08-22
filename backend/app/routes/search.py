import json
from typing import Optional
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
def search(query:str="", category:str="all", offset:int=0, limit:int=50, sort_by:str="date", sort_order:str="desc", virtual_folder_id: Optional[int] = None):
    if virtual_folder_id is not None:
        from backend.app.routes.virtual_folders import search_virtual_folder_internal
        return search_virtual_folder_internal(query, category, offset, limit, sort_by, sort_order, virtual_folder_id)

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

            q = _build_search_query(q_clean, s, q_base)
            yield "["
            first = True
            for r in q.offset(offset).limit(limit).yield_per(1000):
                if not first: yield ","
                first = False
                yield json.dumps(_build_item(r, cache_flag))
            yield "]"

    return StreamingResponse(generate(), media_type="application/json")

@router.get("/search/suggestions")
def search_suggestions(q: str = "", limit: int = 5):
    from sqlalchemy import text
    import sqlite3
    import difflib
    from backend.app.constants import STANDARD_CATEGORIES, CATEGORY_EXTENSIONS
    from backend.app.utils.paths import get_ai_db_path
    
    q = q.strip()
    if not q:
        return {"type": "none", "suggestions": [], "last_word": ""}
        
    words = q.split()
    last_word = words[-1]
    
    # Strip leading search operators (+ or -)
    prefix = ""
    clean_word = last_word
    if clean_word.startswith("+") or clean_word.startswith("-"):
        prefix = clean_word[0]
        clean_word = clean_word[1:]
        
    if not clean_word:
        return {"type": "none", "suggestions": [], "last_word": ""}
        
    lower_clean = clean_word.lower()
    
    # Prefix suggestions for object:, person:, tag:, type:
    if lower_clean.startswith("object:"):
        sub_term = lower_clean[len("object:"):]
        with SessionLocal() as s:
            rows = s.execute(
                text("SELECT tags FROM files WHERE tags LIKE :pattern LIMIT 100"),
                {"pattern": f"%object:{sub_term}%"}
            ).scalars().all()
            found_tags = set()
            for r in rows:
                if not r: continue
                for tag in r.split(","):
                    t_clean = tag.strip()
                    if t_clean.lower().startswith(f"object:{sub_term}"):
                        found_tags.add(t_clean)
            if found_tags:
                suggs = [f"{prefix}{t}" for t in sorted(found_tags)[:limit]]
                return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}
        
    if lower_clean.startswith("person:"):
        sub_term = lower_clean[len("person:"):].strip('"\'')
        ai_db = get_ai_db_path()
        person_names = []
        if ai_db.exists():
            try:
                with sqlite3.connect(ai_db, timeout=5) as conn:
                    c = conn.cursor()
                    c.execute(
                        "SELECT name FROM people WHERE name NOT LIKE 'Unknown Person%' AND lower(name) LIKE ? ORDER BY name LIMIT ?",
                        (f"%{sub_term}%", limit)
                    )
                    person_names = [row[0] for row in c.fetchall()]
            except Exception:
                pass
        if not person_names:
            with SessionLocal() as s:
                rows = s.execute(
                    text("SELECT tags FROM files WHERE tags LIKE :pattern LIMIT 100"),
                    {"pattern": f"%person:{sub_term}%"}
                ).scalars().all()
                found = set()
                for r in rows:
                    if not r: continue
                    for tag in r.split(","):
                        t_clean = tag.strip()
                        if t_clean.lower().startswith("person:"):
                            p_name = t_clean[7:]
                            if sub_term in p_name.lower():
                                found.add(p_name)
                person_names = sorted(found)[:limit]
                
        if person_names:
            suggs = [f'{prefix}person:"{name}"' for name in person_names[:limit]]
            return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}
        
    if lower_clean.startswith("rel:") or lower_clean.startswith("relation:") or lower_clean.startswith("kinship:"):
        p_len = len("rel:") if lower_clean.startswith("rel:") else (len("relation:") if lower_clean.startswith("relation:") else len("kinship:"))
        sub_term = lower_clean[p_len:].strip('"\'')
        rel_presets = [
            "spouse", "parent", "child", "sibling", "grandparent", "aunt", "uncle",
            "cousin", "in-law", "close friend", "colleague", "classmate", "neighbor",
            "family", "friends", "others"
        ]
        matching = [r for r in rel_presets if sub_term in r]
        if matching:
            suggs = [f'{prefix}rel:{m}' if " " not in m else f'{prefix}rel:"{m}"' for m in matching[:limit]]
            return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}

    if lower_clean.startswith("category:"):
        sub_term = lower_clean[len("category:"):].strip('"\'')
        cat_presets = ["family", "friends", "others"]
        matching = [c for c in cat_presets if sub_term in c]
        if matching:
            suggs = [f'{prefix}category:{m}' for m in matching[:limit]]
            return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}

    if lower_clean.startswith("tag:"):
        sub_term = lower_clean[len("tag:"):]
        with SessionLocal() as s:
            rows = s.execute(
                text("SELECT tags FROM files WHERE tags IS NOT NULL AND tags != '' LIMIT 100")
            ).scalars().all()
            found_tags = set()
            for r in rows:
                if not r: continue
                for tag in r.split(","):
                    t_clean = tag.strip()
                    t_bare = t_clean.split(":", 1)[-1] if ":" in t_clean else t_clean
                    if t_bare.lower().startswith(sub_term):
                        found_tags.add(f"tag:{t_bare}")
            if found_tags:
                suggs = [f"{prefix}{t}" for t in sorted(found_tags)[:limit]]
                return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}
        
    if lower_clean.startswith("aspect:"):
        sub_term = lower_clean[len("aspect:"):].strip('"\'')
        aspect_presets = ["landscape", "portrait", "square"]
        matching = [a for a in aspect_presets if sub_term in a]
        if matching:
            suggs = [f"{prefix}aspect:{m}" for m in matching[:limit]]
            return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}

    if lower_clean.startswith("resolution:"):
        sub_term = lower_clean[len("resolution:"):].strip('"\'')
        res_presets = ["4k", "1080p", "720p", ">=1080p", ">=4k"]
        matching = [r for r in res_presets if sub_term in r]
        if matching:
            suggs = [f"{prefix}resolution:{m}" for m in matching[:limit]]
            return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}

    if lower_clean.startswith("type:"):
        sub_term = lower_clean[len("type:"):]
        matching = [c for c in STANDARD_CATEGORIES if c.startswith(sub_term)]
        if not matching:
            all_exts = [ext.lstrip(".") for exts in CATEGORY_EXTENSIONS.values() for ext in exts]
            matching = [e for e in all_exts if e.startswith(sub_term)]
        if matching:
            suggs = [f"{prefix}type:{m}" for m in matching[:limit]]
            return {"type": "tag", "suggestions": suggs, "last_word": last_word}
        return {"type": "none", "suggestions": [], "last_word": last_word}
        
    if "*" in lower_clean or ":" in lower_clean:
        return {"type": "none", "suggestions": [], "last_word": last_word}
        
    with SessionLocal() as s:
        results = s.execute(
            text("SELECT term FROM files_fts_vocab WHERE term LIKE :prefix ORDER BY doc DESC LIMIT :limit"),
            {"prefix": f"{lower_clean}%", "limit": limit}
        ).scalars().all()
        
        if results:
            suggestions = [f"{prefix}{r}" for r in results]
            return {"type": "autocomplete", "suggestions": suggestions, "last_word": last_word}
            
        if len(lower_clean) >= 3:
            all_terms = s.execute(
                text("SELECT term FROM files_fts_vocab WHERE length(term) BETWEEN :min_l AND :max_l ORDER BY doc DESC LIMIT 1000"),
                {"min_l": len(lower_clean)-2, "max_l": len(lower_clean)+2}
            ).scalars().all()
            
            close_matches = difflib.get_close_matches(lower_clean, all_terms, n=limit, cutoff=0.7)
            
            valid_matches = []
            for m in close_matches:
                if m == lower_clean:
                    continue
                if lower_clean.startswith(m) and len(lower_clean) - len(m) <= 3:
                    continue
                valid_matches.append(m)
                
            if valid_matches:
                suggestions = [f"{prefix}{m}" for m in valid_matches]
                return {"type": "did_you_mean", "suggestions": suggestions, "last_word": last_word}
                
    return {"type": "none", "suggestions": [], "last_word": last_word}