import re
from sqlalchemy import or_, and_, func, Integer, text
from backend.app.database import FileIndex
from backend.app.constants import STANDARD_CATEGORIES, CATEGORY_EXTENSIONS

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

def _parse_size_in_bytes(val_str):
    if not val_str:
        return None
    val_str = val_str.strip().lower()
    m = re.match(r"^(\d+(?:\.\d+)?)\s*([kmgtp]?b?)$", val_str)
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "b"
    mult = 1
    if unit in ("k", "kb"): mult = 1024
    elif unit in ("m", "mb"): mult = 1024**2
    elif unit in ("g", "gb"): mult = 1024**3
    elif unit in ("t", "tb"): mult = 1024**4
    elif unit in ("p", "pb"): mult = 1024**5
    return int(num * mult)

def _build_size_filter(val):
    val = val.strip()
    size_col = func.cast(FileIndex.size, Integer)
    
    # Check for range: e.g. 100MB-5GB
    range_match = re.match(r"^(\d+(?:\.\d+)?\s*[kmgtp]?b?)\s*-\s*(\d+(?:\.\d+)?\s*[kmgtp]?b?)$", val, re.IGNORECASE)
    if range_match:
        b1 = _parse_size_in_bytes(range_match.group(1))
        b2 = _parse_size_in_bytes(range_match.group(2))
        if b1 is not None and b2 is not None:
            return and_(size_col >= min(b1, b2), size_col <= max(b1, b2))
            
    # Handle multiple comparisons separated by comma or space (e.g. >100MB, <5GB or >100MB <5GB)
    parts = [p.strip() for p in re.split(r'[, ]+', val) if p.strip()]
    conds = []
    for part in parts:
        op = ""
        for prefix in (">=", "<=", ">", "<", "==", "="):
            if part.startswith(prefix):
                op = prefix
                part_val = part[len(prefix):]
                break
        else:
            op = "="
            part_val = part
            
        b = _parse_size_in_bytes(part_val)
        if b is not None:
            if op == ">=": conds.append(size_col >= b)
            elif op == "<=": conds.append(size_col <= b)
            elif op == ">": conds.append(size_col > b)
            elif op == "<": conds.append(size_col < b)
            elif op in ("=", "=="): conds.append(size_col == b)
        else:
            conds.append(func.lower(FileIndex.size).like(f"{part}%"))
            
    if not conds:
        return None
    return and_(*conds) if len(conds) > 1 else conds[0]

def _parse_duration_seconds(val_str):
    if not val_str:
        return None
    val_str = val_str.strip().lower()
    if ":" in val_str:
        parts = val_str.split(":")
        try:
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        except ValueError:
            return None
            
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds|m|min|mins|minutes|h|hr|hrs|hours)?$", val_str)
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "s"
    mult = 1
    if unit in ("m", "min", "mins", "minutes"): mult = 60
    elif unit in ("h", "hr", "hrs", "hours"): mult = 3600
    return int(num * mult)

def _build_duration_filter(val):
    val = val.strip()
    duration_col = func.coalesce(
        func.cast(func.json_extract(FileIndex.metadata_json, '$.duration'), Integer),
        func.cast(func.json_extract(FileIndex.metadata_json, '$.format.duration'), Integer),
        func.cast(func.json_extract(FileIndex.metadata_json, '$.length'), Integer),
        0
    )
    
    # Check for range: e.g. 5m-1h
    range_match = re.match(r"^(\d+(?:\.\d+)?\s*(?:[smh]|min|sec|hr)?)\s*-\s*(\d+(?:\.\d+)?\s*(?:[smh]|min|sec|hr)?)$", val, re.IGNORECASE)
    if range_match:
        d1 = _parse_duration_seconds(range_match.group(1))
        d2 = _parse_duration_seconds(range_match.group(2))
        if d1 is not None and d2 is not None:
            return and_(duration_col >= min(d1, d2), duration_col <= max(d1, d2))
            
    # Handle multiple comparisons separated by comma or space (e.g. >5m, <1h or >5m <1h)
    parts = [p.strip() for p in re.split(r'[, ]+', val) if p.strip()]
    conds = []
    for part in parts:
        op = ""
        for prefix in (">=", "<=", ">", "<", "==", "="):
            if part.startswith(prefix):
                op = prefix
                part_val = part[len(prefix):]
                break
        else:
            op = "="
            part_val = part
            
        d = _parse_duration_seconds(part_val)
        if d is not None:
            if op == ">=": conds.append(duration_col >= d)
            elif op == "<=": conds.append(duration_col <= d)
            elif op == ">": conds.append(duration_col > d)
            elif op == "<": conds.append(duration_col < d)
            elif op in ("=", "=="): conds.append(duration_col == d)
        else:
            conds.append(func.lower(func.coalesce(FileIndex.metadata_json, '')).contains(part.lower()))
            
    if not conds:
        return None
    return and_(*conds) if len(conds) > 1 else conds[0]

def _build_date_filter(val):
    val = val.strip()
    exif_date = func.json_extract(FileIndex.metadata_json, '$.date')
    exif_date_norm = func.replace(exif_date, ':', '-')
    date_field = func.coalesce(exif_date_norm, FileIndex.modified, "")
    
    # Handle comma- or space-separated multiple dates/ranges: e.g. 2020-2022, 2023-10-25
    sub_parts = [p.strip() for p in re.split(r'[, ]+', val) if p.strip()]
    or_conds = []
    
    for sub in sub_parts:
        # Range: 2020-2022
        if m_range := re.match(r"^(\d{4})\s*-\s*(\d{4})$", sub):
            start_year, end_year = m_range.groups()
            s_y, e_y = min(int(start_year), int(end_year)), max(int(start_year), int(end_year))
            or_conds.append(func.substr(date_field, 1, 4).between(f"{s_y}", f"{e_y}"))
        # Comparison: >2020, <2023, >=2020-01-01, etc.
        elif m_comp := re.match(r"^(>=|<=|>|<|=)\s*(\d{4}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?)$", sub):
            op, target = m_comp.groups()
            target_norm = target.replace("/", "-")
            target_len = len(target_norm)
            cmp_field = func.substr(date_field, 1, target_len)
            if op == ">=": or_conds.append(cmp_field >= target_norm)
            elif op == "<=": or_conds.append(cmp_field <= target_norm)
            elif op == ">": or_conds.append(cmp_field > target_norm)
            elif op == "<": or_conds.append(cmp_field < target_norm)
            elif op == "=": or_conds.append(cmp_field == target_norm)
        # Date format: MM-DD-YYYY or DD-MM-YYYY
        elif m_dmy := re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", sub):
            p1, p2, year = m_dmy.groups()
            p1, p2 = p1.zfill(2), p2.zfill(2)
            or_conds.append(or_(
                func.lower(date_field).contains(f"{year}-{p1}-{p2}"),
                func.lower(date_field).contains(f"{year}-{p2}-{p1}")
            ))
        # Exact year (YYYY) or Year-Month (YYYY-MM) or ISO date (YYYY-MM-DD)
        elif re.match(r"^\d{4}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?$", sub):
            target_norm = sub.replace("/", "-")
            or_conds.append(func.substr(date_field, 1, len(target_norm)) == target_norm)
        else:
            or_conds.append(or_(
                func.lower(func.coalesce(FileIndex.modified, "")).contains(sub.lower()),
                func.lower(func.coalesce(exif_date, "")).contains(sub.lower()),
                func.lower(func.coalesce(exif_date_norm, "")).contains(sub.lower())
            ))
            
    if not or_conds:
        return None
    return or_(*or_conds) if len(or_conds) > 1 else or_conds[0]

def _build_type_filter(val):
    # Support comma-separated types: type:audio,video
    types = [t.strip().lower() for t in re.split(r'[, ]+', val) if t.strip()]
    conds = []
    for t in types:
        t_ext = t if t.startswith(".") else "." + t
        conds.append(or_(
            func.lower(FileIndex.category) == t,
            func.lower(FileIndex.extension) == t_ext,
            func.lower(FileIndex.extension) == t
        ))
    if not conds:
        return None
    return or_(*conds) if len(conds) > 1 else conds[0]

def _build_tag_filter(val):
    parts = [p.strip().lower() for p in re.split(r'[,]+', val) if p.strip()]
    if not parts:
        parts = [val.strip().lower()]
    conds = []
    for p in parts:
        p_clean = p.strip('"\'')
        conds.append(or_(
            func.lower(func.coalesce(FileIndex.tags, '')).contains(p_clean),
            func.lower(func.coalesce(FileIndex.tags, '')).contains(f"object:{p_clean}"),
            func.lower(func.coalesce(FileIndex.tags, '')).contains(f"tag:{p_clean}"),
            func.lower(func.coalesce(FileIndex.tags, '')).contains(f"person:{p_clean}")
        ))
    return or_(*conds) if len(conds) > 1 else conds[0]

def _build_object_filter(val):
    parts = [p.strip().lower() for p in re.split(r'[,]+', val) if p.strip()]
    if not parts:
        parts = [val.strip().lower()]
    conds = []
    for p in parts:
        p_clean = p.strip('"\'')
        conds.append(or_(
            func.lower(func.coalesce(FileIndex.tags, '')).contains(f"object:{p_clean}"),
            func.lower(func.coalesce(FileIndex.tags, '')).contains(p_clean)
        ))
    return or_(*conds) if len(conds) > 1 else conds[0]

def _build_person_filter(val):
    parts = [p.strip().lower() for p in re.split(r'[,]+', val) if p.strip()]
    if not parts:
        parts = [val.strip().lower()]
    conds = []
    for p in parts:
        p_clean = p.strip('"\'')
        conds.append(or_(
            func.lower(func.coalesce(FileIndex.tags, '')).contains(f"person:{p_clean}"),
            func.lower(func.coalesce(FileIndex.tags, '')).contains(p_clean)
        ))
    return or_(*conds) if len(conds) > 1 else conds[0]

def _get_people_by_relation_or_category(term: str) -> list:
    """
    Returns person names matching a relationship subcategory, category, or label from relationships.db.
    """
    import sqlite3
    from backend.app.utils.paths import get_relationships_db_path
    rel_db = get_relationships_db_path()
    if not rel_db.exists():
        return []
    
    term_clean = term.strip().lower()
    matched_names = set()
    try:
        with sqlite3.connect(str(rel_db), timeout=5) as conn:
            c = conn.cursor()
            c.execute("""
                SELECT p.name
                FROM persons p
                JOIN person_social s ON p.id = s.person_id
                WHERE lower(s.category) = ? 
                   OR lower(s.subcategory) LIKE ?
                   OR lower(s.relation_label) LIKE ?
            """, (term_clean, f"%{term_clean}%", f"%{term_clean}%"))
            for row in c.fetchall():
                if row[0]:
                    matched_names.add(row[0])

            c.execute("""
                SELECT p2.name
                FROM person_connections c
                JOIN persons p2 ON c.related_person_id = p2.id
                WHERE lower(c.relation_type) LIKE ?
            """, (f"%{term_clean}%",))
            for row in c.fetchall():
                if row[0]:
                    matched_names.add(row[0])
    except Exception as e:
        print(f"[SEARCH] Error looking up relations: {e}")
    return list(matched_names)

def _build_relation_filter(val):
    parts = [p.strip().lower() for p in re.split(r'[,]+', val) if p.strip()]
    if not parts:
        parts = [val.strip().lower()]
    all_conds = []
    for p in parts:
        p_clean = p.strip('"\'')
        names = _get_people_by_relation_or_category(p_clean)
        if not names:
            all_conds.append(or_(
                func.lower(func.coalesce(FileIndex.tags, '')).contains(f"rel:{p_clean}"),
                func.lower(func.coalesce(FileIndex.tags, '')).contains(f"category:{p_clean}"),
                func.lower(func.coalesce(FileIndex.tags, '')).contains(f"person:{p_clean}"),
                func.lower(func.coalesce(FileIndex.tags, '')).contains(p_clean)
            ))
        else:
            person_conds = [
                or_(
                    func.lower(func.coalesce(FileIndex.tags, '')).contains(f"person:{name.lower()}"),
                    func.lower(func.coalesce(FileIndex.tags, '')).contains(name.lower())
                )
                for name in names
            ]
            all_conds.append(or_(*person_conds) if len(person_conds) > 1 else person_conds[0])
    return or_(*all_conds) if len(all_conds) > 1 else all_conds[0]

def _build_metadata_field_filter(field_name: str, val: str):
    parts = [p.strip().lower() for p in re.split(r'[,]+', val) if p.strip()]
    if not parts:
        parts = [val.strip().lower()]
    conds = []
    for p in parts:
        p_clean = p.strip('"\'')
        conds.append(func.lower(func.coalesce(func.json_extract(FileIndex.metadata_json, f'$.{field_name}'), '')).contains(p_clean))
    return or_(*conds) if len(conds) > 1 else conds[0]

def _build_aspect_filter(val: str):
    val_clean = val.strip().lower()
    width_col = func.coalesce(func.cast(func.json_extract(FileIndex.metadata_json, '$.width'), Integer), 0)
    height_col = func.coalesce(func.cast(func.json_extract(FileIndex.metadata_json, '$.height'), Integer), 0)
    
    aspects = [a.strip().lower() for a in re.split(r'[, ]+', val_clean) if a.strip()]
    conds = []
    for a in aspects:
        a_clean = a.strip('"\'')
        if a_clean in ("landscape", "horizontal", "wide"):
            conds.append(and_(width_col > 0, height_col > 0, width_col > height_col))
        elif a_clean in ("portrait", "vertical", "tall"):
            conds.append(and_(width_col > 0, height_col > 0, height_col > width_col))
        elif a_clean in ("square", "1:1"):
            conds.append(and_(width_col > 0, height_col > 0, width_col == height_col))
        else:
            conds.append(func.lower(func.coalesce(FileIndex.metadata_json, '')).contains(a_clean))
    if not conds:
        return None
    return or_(*conds) if len(conds) > 1 else conds[0]

def _parse_resolution_dimension(val_str: str):
    if not val_str:
        return None, None
    val_str = val_str.strip().lower()
    if val_str in ("4k", "uhd", "2160p", "3840x2160"):
        return 3840, 2160
    elif val_str in ("2k", "1440p", "qhd", "2560x1440"):
        return 2560, 1440
    elif val_str in ("1080p", "fhd", "fullhd", "1920x1080"):
        return 1920, 1080
    elif val_str in ("720p", "hd", "1280x720"):
        return 1280, 720
    elif val_str in ("480p", "sd", "640x480"):
        return 640, 480
    m = re.match(r"^(\d+)\s*[xX*]\s*(\d+)$", val_str)
    if m:
        return int(m.group(1)), int(m.group(2))
    m_p = re.match(r"^(\d+)\s*p?$", val_str)
    if m_p:
        h = int(m_p.group(1))
        w = int(h * 16 / 9)
        return w, h
    return None, None

def _build_resolution_filter(val: str):
    val_clean = val.strip().lower()
    width_col = func.coalesce(func.cast(func.json_extract(FileIndex.metadata_json, '$.width'), Integer), 0)
    height_col = func.coalesce(func.cast(func.json_extract(FileIndex.metadata_json, '$.height'), Integer), 0)
    
    parts = [p.strip() for p in re.split(r'[, ]+', val_clean) if p.strip()]
    conds = []
    for part in parts:
        op = ""
        for prefix in (">=", "<=", ">", "<", "==", "="):
            if part.startswith(prefix):
                op = prefix
                part_val = part[len(prefix):]
                break
        else:
            op = "="
            part_val = part
            
        req_w, req_h = _parse_resolution_dimension(part_val)
        if req_w is not None and req_h is not None:
            target_min_dim = min(req_w, req_h)
            target_max_dim = max(req_w, req_h)
            dim_cond = None
            if op == ">=":
                dim_cond = and_(width_col > 0, height_col > 0, or_(
                    and_(width_col >= target_max_dim, height_col >= target_min_dim),
                    and_(height_col >= target_max_dim, width_col >= target_min_dim),
                    width_col >= target_max_dim,
                    height_col >= target_max_dim
                ))
            elif op == ">":
                dim_cond = and_(width_col > 0, height_col > 0, or_(
                    and_(width_col > target_max_dim, height_col > target_min_dim),
                    and_(height_col > target_max_dim, width_col > target_min_dim),
                    width_col > target_max_dim,
                    height_col > target_max_dim
                ))
            elif op == "<=":
                dim_cond = and_(width_col > 0, height_col > 0, or_(
                    and_(width_col <= target_max_dim, height_col <= target_min_dim),
                    and_(height_col <= target_max_dim, width_col <= target_min_dim)
                ))
            elif op == "<":
                dim_cond = and_(width_col > 0, height_col > 0, or_(
                    and_(width_col < target_max_dim, height_col < target_min_dim),
                    and_(height_col < target_max_dim, width_col < target_min_dim)
                ))
            elif op in ("=", "=="):
                dim_cond = or_(
                    and_(width_col == req_w, height_col == req_h),
                    and_(width_col == req_h, height_col == req_w),
                    func.lower(func.coalesce(func.json_extract(FileIndex.metadata_json, '$.resolution'), '')).contains(part_val),
                    func.lower(func.coalesce(FileIndex.metadata_json, '')).contains(part_val)
                )
            if dim_cond is not None:
                conds.append(dim_cond)
        else:
            conds.append(or_(
                func.lower(func.coalesce(func.json_extract(FileIndex.metadata_json, '$.resolution'), '')).contains(part.lower()),
                func.lower(func.coalesce(FileIndex.metadata_json, '')).contains(part.lower())
            ))
            
    if not conds:
        return None
    return or_(*conds) if len(conds) > 1 else conds[0]

def _build_wildcard_filter(val):
    like_val = val.lower().replace("*", "%").replace("?", "_")
    return or_(
        func.lower(func.coalesce(FileIndex.filename, "")).like(like_val),
        func.lower(func.coalesce(FileIndex.path, "")).like(like_val)
    )

def _tokenize_search_query(query):
    tokens = []
    pattern = re.compile(
        r'([+\-]?(?:date|tag|type|name|size|length|object|person|rel|relation|kinship|category|camera|resolution|aspect|fps|artist|album|genre|meta):(?:(?:"(?:\\.|[^"])*")|(?:[^\s"]+)))|'
        r'([+\-]?"(?:\\.|[^"])*")|'
        r'([^\s]+)'
    )
    for m in pattern.finditer(query):
        tok = m.group(0).strip()
        if tok:
            tokens.append(tok)
    return tokens

def _build_search_query(query, s, q_base=None):
    if q_base is None:
        q_base = s.query(FileIndex)
    query = query.strip()
    if not query:
        return q_base

    def text_filter(field, term):
        return func.lower(func.coalesce(field, "")).contains(term)

    tokens = _tokenize_search_query(query)
    
    required_filters = []
    optional_filters = []
    exclude_filters = []
    
    i = 0
    while i < len(tokens):
        raw_token = tokens[i]
        i += 1
        
        sign = ""
        token = raw_token
        if token.startswith("+") and len(token) > 1:
            sign = "+"
            token = token[1:]
        elif token.startswith("-") and len(token) > 1:
            sign = "-"
            token = token[1:]
            
        lower_token = token.lower()
        
        prefix_matched = False
        for prefix in ("date:", "tag:", "type:", "name:", "size:", "length:", "object:", "person:",
                       "rel:", "relation:", "kinship:", "category:",
                       "camera:", "resolution:", "aspect:", "fps:", "artist:", "album:", "genre:", "meta:"):
            if lower_token.startswith(prefix):
                prefix_matched = True
                val = token[len(prefix):]
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                    
                # Lookahead for trailing comma or continuation (e.g. size:>100MB, <5GB or date:2020-2022, 2023-10-25)
                while i < len(tokens):
                    next_tok = tokens[i]
                    if val.endswith(",") or (prefix in ("size:", "length:", "resolution:") and re.match(r"^[><=]", next_tok)):
                        val = val.rstrip(",") + " " + next_tok
                        i += 1
                    else:
                        break
                        
                filter_cond = None
                if prefix == "date:": filter_cond = _build_date_filter(val)
                elif prefix == "type:": filter_cond = _build_type_filter(val)
                elif prefix == "size:": filter_cond = _build_size_filter(val)
                elif prefix == "length:": filter_cond = _build_duration_filter(val)
                elif prefix == "object:": filter_cond = _build_object_filter(val)
                elif prefix == "person:": filter_cond = _build_person_filter(val)
                elif prefix in ("rel:", "relation:", "kinship:", "category:"): filter_cond = _build_relation_filter(val)
                elif prefix == "tag:": filter_cond = _build_tag_filter(val)
                elif prefix == "name:": filter_cond = text_filter(FileIndex.filename, val.lower())
                elif prefix == "camera:": filter_cond = _build_metadata_field_filter("camera", val)
                elif prefix == "resolution:": filter_cond = _build_resolution_filter(val)
                elif prefix == "aspect:": filter_cond = _build_aspect_filter(val)
                elif prefix == "artist:": filter_cond = _build_metadata_field_filter("artist", val)
                elif prefix == "album:": filter_cond = _build_metadata_field_filter("album", val)
                elif prefix == "genre:": filter_cond = _build_metadata_field_filter("genre", val)
                elif prefix == "fps:":
                    fps_col = func.json_extract(FileIndex.metadata_json, '$.fps')
                    op = ""
                    for op_cand in (">=", "<=", ">", "<", "="):
                        if val.startswith(op_cand):
                            op = op_cand
                            val = val[len(op_cand):]
                            break
                    try:
                        num_v = float(val)
                        if op == ">=": filter_cond = fps_col >= num_v
                        elif op == "<=": filter_cond = fps_col <= num_v
                        elif op == ">": filter_cond = fps_col > num_v
                        elif op == "<": filter_cond = fps_col < num_v
                        else: filter_cond = fps_col == num_v
                    except ValueError:
                        filter_cond = func.lower(func.coalesce(fps_col, '')).contains(val.lower())
                elif prefix == "meta:":
                    parts = val.split(":", 1)
                    if len(parts) == 2:
                        filter_cond = func.lower(func.coalesce(func.json_extract(FileIndex.metadata_json, f'$.{parts[0]}'), '')).contains(parts[1].lower())
                        
                if filter_cond is not None:
                    if sign == "-":
                        exclude_filters.append(filter_cond)
                    else:
                        required_filters.append(filter_cond)
                break
                
        if prefix_matched:
            continue
            
        clean_word = token
        if (clean_word.startswith('"') and clean_word.endswith('"')) or (clean_word.startswith("'") and clean_word.endswith("'")):
            clean_word = clean_word[1:-1]
            
        if not clean_word:
            continue
            
        if "*" in clean_word or "?" in clean_word:
            w_cond = _build_wildcard_filter(clean_word)
            if sign == "-":
                exclude_filters.append(w_cond)
            elif sign == "+":
                required_filters.append(w_cond)
            else:
                optional_filters.append(w_cond)
            continue
            
        param_name = f"filter_fts_{i}"
        term_lower = clean_word.lower()
        t_cond = or_(
            text_filter(FileIndex.filename, term_lower),
            text_filter(FileIndex.path, term_lower),
            text_filter(FileIndex.tags, term_lower),
            text_filter(FileIndex.metadata_json, term_lower),
            text(f"files.id IN (SELECT rowid FROM files_fts WHERE files_fts MATCH :{param_name} UNION SELECT file_id FROM file_text_fts WHERE file_text_fts MATCH :{param_name})").bindparams(**{param_name: f'"{clean_word}" *'})
        )
        
        if sign == "-":
            exclude_filters.append(t_cond)
        elif sign == "+":
            required_filters.append(t_cond)
        else:
            optional_filters.append(t_cond)
            
    q = q_base
    for rf in required_filters:
        q = q.filter(rf)
        
    if optional_filters:
        q = q.filter(or_(*optional_filters))
        
    for ef in exclude_filters:
        q = q.filter(~ef)
        
    return q