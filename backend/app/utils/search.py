import re
from sqlalchemy import or_, func, Integer
from backend.app.database import FileIndex

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
            elif val.startswith("camera:"):
                c_val = val[len("camera:"):]
                exclude_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.camera')).contains(c_val))
            elif val.startswith("resolution:"):
                r_val = val[len("resolution:"):]
                exclude_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.resolution')).contains(r_val))
            elif val.startswith("artist:"):
                a_val = val[len("artist:"):]
                exclude_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.artist')).contains(a_val))
            elif val.startswith("album:"):
                al_val = val[len("album:"):]
                exclude_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.album')).contains(al_val))
            elif val.startswith("genre:"):
                g_val = val[len("genre:"):]
                exclude_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.genre')).contains(g_val))
            elif val.startswith("meta:"):
                orig_val = token[1:]
                parts = orig_val[5:].split(":", 1)
                if len(parts) == 2:
                    exclude_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, f'$.{parts[0]}')).contains(parts[1].lower()))
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
            
            exif_date = func.json_extract(FileIndex.metadata_json, '$.date')
            exif_date_norm = func.replace(exif_date, ':', '-')
            
            def date_filter(term):
                return or_(
                    func.lower(func.coalesce(FileIndex.modified, "")).contains(term),
                    func.lower(func.coalesce(exif_date, "")).contains(term),
                    func.lower(func.coalesce(exif_date_norm, "")).contains(term)
                )

            if m_range := re.match(r"^(\d{4})-(\d{4})$", val):
                start_year, end_year = m_range.groups()
                if int(start_year) <= int(end_year):
                    specific_filters.append(or_(
                        func.substr(func.coalesce(exif_date_norm, FileIndex.modified, "0000"), 1, 4).between(f"{start_year}", f"{int(end_year)}")
                    ))
            elif m := re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", val):
                p1, p2, year = m.groups()
                p1, p2 = p1.zfill(2), p2.zfill(2)
                specific_filters.append(or_(
                    date_filter(f"{year}-{p1}-{p2}"),
                    date_filter(f"{year}-{p2}-{p1}")
                ))
            else:
                specific_filters.append(date_filter(val))
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
            elif val.startswith("="):
                operator, val = "=", val[1:]
                
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
                elif operator == "=": specific_filters.append(size_col == bytes_val)
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
            elif val.startswith("="):
                operator, val = "=", val[1:]
                
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
                elif operator == "=": specific_filters.append(val_col == num_val)
            else:
                specific_filters.append(text_filter(FileIndex.metadata_json, val))
        elif lower_token.startswith("camera:"):
            val = lower_token[len("camera:"):]
            specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.camera')).contains(val))
        elif lower_token.startswith("resolution:"):
            val = lower_token[len("resolution:"):]
            specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.resolution')).contains(val))
        elif lower_token.startswith("artist:"):
            val = lower_token[len("artist:"):]
            specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.artist')).contains(val))
        elif lower_token.startswith("album:"):
            val = lower_token[len("album:"):]
            specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.album')).contains(val))
        elif lower_token.startswith("genre:"):
            val = lower_token[len("genre:"):]
            specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.genre')).contains(val))
        elif lower_token.startswith("meta:"):
            parts = token[5:].split(":", 1)
            if len(parts) == 2:
                specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, f'$.{parts[0]}')).contains(parts[1].lower()))
        elif lower_token.startswith("fps:"):
            val = lower_token[len("fps:"):]
            operator = ""
            if val.startswith(">="): operator, val = ">=", val[2:]
            elif val.startswith("<="): operator, val = "<=", val[2:]
            elif val.startswith(">"): operator, val = ">", val[1:]
            elif val.startswith("<"): operator, val = "<", val[1:]
            
            try:
                num_val = float(val)
                fps_col = func.json_extract(FileIndex.metadata_json, '$.fps')
                if operator == ">=": specific_filters.append(fps_col >= num_val)
                elif operator == "<=": specific_filters.append(fps_col <= num_val)
                elif operator == ">": specific_filters.append(fps_col > num_val)
                elif operator == "<": specific_filters.append(fps_col < num_val)
                else: specific_filters.append(fps_col == num_val)
            except ValueError:
                specific_filters.append(func.lower(func.json_extract(FileIndex.metadata_json, '$.fps')).contains(val))
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
                func.coalesce(FileIndex.tags, '') == tag,
                func.coalesce(FileIndex.tags, '').like(f'%,{tag}'),
                func.coalesce(FileIndex.tags, '').like(f'{tag},%'),
                func.coalesce(FileIndex.tags, '').like(f'%,{tag},%')
            )
            for tag in tag_tokens
        ]))
    if and_tag_tokens:
        for tag in and_tag_tokens:
            q = q.filter(or_(
                func.coalesce(FileIndex.tags, '') == tag,
                func.coalesce(FileIndex.tags, '').like(f'%,{tag}'),
                func.coalesce(FileIndex.tags, '').like(f'{tag},%'),
                func.coalesce(FileIndex.tags, '').like(f'%,{tag},%')
            ))
    if exclude_filters:
        for ef in exclude_filters:
            q = q.filter(~ef)
    return q