import sqlite3
from pathlib import Path
from backend.app.utils.paths import get_relationships_db_path

RECIPROCAL_RELATIONS = {
    "spouse": "spouse",
    "partner": "partner",
    "parent": "child",
    "child": "parent",
    "sibling": "sibling",
    "relative": "relative"
}

def init_relationships_database(rel_db_path: Path = None):
    """
    Initializes the sidecar database for Relationships and Person Categorization.
    Keeps social classifications and relationship networks safely separated from
    machine-generated face data.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    else:
        rel_db_path = Path(rel_db_path)
        
    rel_db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(rel_db_path))
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    
    # TABLE: persons
    # Stable person registry independent of ai_metadata.db auto-increment IDs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS persons (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            ai_person_id    INTEGER,
            is_me           INTEGER DEFAULT 0,
            linked_at       TEXT,
            created_at      TEXT
        )
    ''')
    
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_name ON persons(name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_persons_ai_link ON persons(ai_person_id)')
    
    # Safe migration for is_me if upgrading older database
    try:
        cursor.execute("ALTER TABLE persons ADD COLUMN is_me INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
        
    # TABLE: person_social
    # Categorization and relationship details attached to stable persons.id
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS person_social (
            person_id       INTEGER PRIMARY KEY,
            category        TEXT,
            subcategory     TEXT,
            relation_label  TEXT,
            updated_at      TEXT
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ps_category ON person_social(category)')

    # TABLE: person_connections
    # Directed and reciprocal inter-person relationships (spouse, parent, child, sibling)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS person_connections (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id           INTEGER NOT NULL,
            related_person_id   INTEGER NOT NULL,
            relation_type       TEXT NOT NULL,
            created_at          TEXT,
            UNIQUE(person_id, related_person_id, relation_type)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_pc_person ON person_connections(person_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_pc_related ON person_connections(related_person_id)')
    
    conn.commit()
    conn.close()

def add_person_connection(person_id: int, related_person_id: int, relation_type: str, rel_db_path: Path = None) -> bool:
    """
    Adds a connection between two persons (and the reciprocal relation).
    """
    if person_id == related_person_id:
        return False
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    init_relationships_database(rel_db_path)

    rel_type = relation_type.strip().lower()
    reciprocal_type = RECIPROCAL_RELATIONS.get(rel_type, "relative")

    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO person_connections (person_id, related_person_id, relation_type, created_at)
            VALUES (?, ?, ?, datetime('now'))
        """, (person_id, related_person_id, rel_type))
        cursor.execute("""
            INSERT OR REPLACE INTO person_connections (person_id, related_person_id, relation_type, created_at)
            VALUES (?, ?, ?, datetime('now'))
        """, (related_person_id, person_id, reciprocal_type))
        conn.commit()
    return True

def remove_person_connection(person_id: int, related_person_id: int, relation_type: str = None, rel_db_path: Path = None) -> bool:
    """
    Removes a connection between two persons and its reciprocal relation.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return False

    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        if relation_type:
            rel_type = relation_type.strip().lower()
            reciprocal_type = RECIPROCAL_RELATIONS.get(rel_type, "relative")
            cursor.execute("DELETE FROM person_connections WHERE person_id = ? AND related_person_id = ? AND relation_type = ?", (person_id, related_person_id, rel_type))
            cursor.execute("DELETE FROM person_connections WHERE person_id = ? AND related_person_id = ? AND relation_type = ?", (related_person_id, person_id, reciprocal_type))
        else:
            cursor.execute("DELETE FROM person_connections WHERE person_id = ? AND related_person_id = ?", (person_id, related_person_id))
            cursor.execute("DELETE FROM person_connections WHERE person_id = ? AND related_person_id = ?", (related_person_id, person_id))
        conn.commit()
    return True

def get_person_connections(person_id: int, rel_db_path: Path = None) -> list:
    """
    Retrieves all direct connections for a person.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return []

    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        query = """
            SELECT pc.id, pc.person_id, pc.related_person_id, pc.relation_type, pc.created_at,
                   p.name as related_name, p.ai_person_id as related_ai_person_id, p.is_me as related_is_me,
                   ps.category as related_category, ps.subcategory as related_subcategory, ps.relation_label as related_relation_label
            FROM person_connections pc
            JOIN persons p ON pc.related_person_id = p.id
            LEFT JOIN person_social ps ON p.id = ps.person_id
            WHERE pc.person_id = ?
            ORDER BY pc.relation_type ASC, p.name ASC
        """
        rows = cursor.execute(query, (person_id,)).fetchall()
        return [dict(r) for r in rows]

def get_all_person_connections(rel_db_path: Path = None) -> list:
    """
    Retrieves all person connections across all persons.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return []

    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        query = """
            SELECT pc.id, pc.person_id, pc.related_person_id, pc.relation_type, pc.created_at,
                   p1.name as person_name, p1.ai_person_id as person_ai_id,
                   p2.name as related_name, p2.ai_person_id as related_ai_person_id
            FROM person_connections pc
            JOIN persons p1 ON pc.person_id = p1.id
            JOIN persons p2 ON pc.related_person_id = p2.id
            ORDER BY pc.person_id ASC, pc.relation_type ASC
        """
        rows = cursor.execute(query).fetchall()
        return [dict(r) for r in rows]

def sync_person_rename(ai_person_id: int, new_name: str, rel_db_path: Path = None):
    """
    Synchronizes a person rename from ai_metadata.db into relationships.db.
    Handles auto-relink on rescan if a record with the same name exists unlinked.
    """
    if not new_name or new_name.startswith("Unknown Person"):
        return
        
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        init_relationships_database(rel_db_path)
        
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        # 1. Check if record already linked by ai_person_id
        cursor.execute("SELECT id FROM persons WHERE ai_person_id = ?", (ai_person_id,))
        row = cursor.fetchone()
        
        if row:
            cursor.execute("UPDATE persons SET name = ?, linked_at = datetime('now') WHERE id = ?", (new_name, row[0]))
            print(f"[RELATIONSHIPS] Synced rename for person id={row[0]} (ai_id={ai_person_id})")
        else:
            # 2. Check if an unlinked record exists with this name (recovery case after rescan/wipe)
            cursor.execute("SELECT id FROM persons WHERE name = ?", (new_name,))
            name_row = cursor.fetchone()
            if name_row:
                cursor.execute("UPDATE persons SET ai_person_id = ?, linked_at = datetime('now') WHERE id = ?", (ai_person_id, name_row[0]))
                print(f"[RELATIONSHIPS] Auto-relinked existing person id={name_row[0]} to ai_id={ai_person_id}")
            else:
                # 3. Create new person record
                cursor.execute(
                    "INSERT INTO persons (name, ai_person_id, is_me, linked_at, created_at) VALUES (?, ?, 0, datetime('now'), datetime('now'))",
                    (new_name, ai_person_id)
                )
                print(f"[RELATIONSHIPS] Registered new person in sidecar (ai_id={ai_person_id})")
        conn.commit()

def unlink_person(ai_person_id: int, rel_db_path: Path = None):
    """
    Soft-unlinks ai_person_id when a person is deleted from ai_metadata.db.
    Preserves all social categories and labels.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return
        
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("UPDATE persons SET ai_person_id = NULL WHERE ai_person_id = ?", (ai_person_id,))
        conn.commit()
        print(f"[RELATIONSHIPS] Soft-unlinked ai_person_id={ai_person_id} preserving relationship metadata")

def merge_persons_rel(old_ai_id: int, target_ai_id: int, rel_db_path: Path = None):
    """
    Re-links relationship references when two people are merged in ai_metadata.db.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return
        
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM persons WHERE ai_person_id = ?", (old_ai_id,))
        old_row = cursor.fetchone()
        cursor.execute("SELECT id FROM persons WHERE ai_person_id = ?", (target_ai_id,))
        target_row = cursor.fetchone()
        
        if old_row and not target_row:
            cursor.execute("UPDATE persons SET ai_person_id = ? WHERE id = ?", (target_ai_id, old_row[0]))
            print(f"[RELATIONSHIPS] Re-linked merged person id={old_row[0]} to target ai_id={target_ai_id}")
        elif old_row and target_row:
            # Transfer social info if target is missing it
            cursor.execute("SELECT category, subcategory, relation_label FROM person_social WHERE person_id = ?", (old_row[0],))
            old_social = cursor.fetchone()
            if old_social and old_social[0]:
                cursor.execute("""
                    INSERT OR IGNORE INTO person_social (person_id, category, subcategory, relation_label, updated_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                """, (target_row[0], old_social[0], old_social[1], old_social[2]))
                print(f"[RELATIONSHIPS] Transferred social metadata from person id={old_row[0]} to target id={target_row[0]}")
            
            # Transfer inter-person connections
            try:
                cursor.execute("UPDATE OR IGNORE person_connections SET person_id = ? WHERE person_id = ?", (target_row[0], old_row[0]))
                cursor.execute("UPDATE OR IGNORE person_connections SET related_person_id = ? WHERE related_person_id = ?", (target_row[0], old_row[0]))
                cursor.execute("DELETE FROM person_connections WHERE person_id = ? OR related_person_id = ?", (old_row[0], old_row[0]))
            except Exception as e:
                print(f"[RELATIONSHIPS] Error migrating person_connections on merge: {e}")

            cursor.execute("UPDATE persons SET ai_person_id = NULL WHERE id = ?", (old_row[0],))
        conn.commit()

def export_relationships_internal(rel_db_path: Path = None) -> dict:
    """
    Exports all relationship, categorization, and connection data as a portable dictionary.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return {"persons": [], "person_social": [], "person_connections": []}
        
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        persons = [dict(r) for r in cursor.execute("SELECT id, name, ai_person_id, is_me, linked_at, created_at FROM persons").fetchall()]
        social = [dict(r) for r in cursor.execute("SELECT person_id, category, subcategory, relation_label, updated_at FROM person_social").fetchall()]
        try:
            connections = [dict(r) for r in cursor.execute("SELECT person_id, related_person_id, relation_type, created_at FROM person_connections").fetchall()]
        except sqlite3.OperationalError:
            connections = []
    print(f"[RELATIONSHIPS] Exported {len(persons)} persons, {len(social)} social records, and {len(connections)} connections")
    return {"persons": persons, "person_social": social, "person_connections": connections}

def import_relationships_internal(data: dict, rel_db_path: Path = None):
    """
    Imports relationship data from a dictionary using INSERT OR IGNORE
    to preserve any live user modifications.
    """
    if not data or not isinstance(data, dict):
        return
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    init_relationships_database(rel_db_path)
    
    persons = data.get("persons", [])
    social = data.get("person_social", [])
    connections = data.get("person_connections", [])
    
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        for p in persons:
            cursor.execute("""
                INSERT OR IGNORE INTO persons (id, name, ai_person_id, is_me, linked_at, created_at)
                VALUES (:id, :name, :ai_person_id, COALESCE(:is_me, 0), :linked_at, :created_at)
            """, {
                "id": p.get("id"),
                "name": p.get("name"),
                "ai_person_id": p.get("ai_person_id"),
                "is_me": p.get("is_me", 0),
                "linked_at": p.get("linked_at"),
                "created_at": p.get("created_at")
            })
        for s in social:
            cursor.execute("""
                INSERT OR IGNORE INTO person_social (person_id, category, subcategory, relation_label, updated_at)
                VALUES (:person_id, :category, :subcategory, :relation_label, :updated_at)
            """, {
                "person_id": s.get("person_id"),
                "category": s.get("category"),
                "subcategory": s.get("subcategory"),
                "relation_label": s.get("relation_label"),
                "updated_at": s.get("updated_at")
            })
        for c in connections:
            cursor.execute("""
                INSERT OR IGNORE INTO person_connections (person_id, related_person_id, relation_type, created_at)
                VALUES (:person_id, :related_person_id, :relation_type, :created_at)
            """, {
                "person_id": c.get("person_id"),
                "related_person_id": c.get("related_person_id"),
                "relation_type": c.get("relation_type"),
                "created_at": c.get("created_at")
            })
        conn.commit()
    print(f"[RELATIONSHIPS] Imported {len(persons)} persons, {len(social)} social, and {len(connections)} connections")

def generate_gedcom_export(root_rel_person_id: int = None, category_filter: str = None, rel_db_path: Path = None) -> str:
    """
    Generates a standard GEDCOM 5.5.1 string representation of the family graph,
    compatible with Gramps, Ancestry, FamilySearch, etc.
    """
    import datetime
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return ""
        
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        persons = {r["id"]: dict(r) for r in cursor.execute("SELECT id, name, ai_person_id, is_me FROM persons").fetchall()}
        social = {r["person_id"]: dict(r) for r in cursor.execute("SELECT person_id, category, subcategory, relation_label FROM person_social").fetchall()}
        try:
            connections = [dict(r) for r in cursor.execute("SELECT person_id, related_person_id, relation_type FROM person_connections").fetchall()]
        except sqlite3.OperationalError:
            connections = []

    if not persons:
        return ""

    # If category_filter is specified, filter by social category (or is_me root)
    if category_filter:
        cat_lower = category_filter.strip().lower()
        allowed_pids = {pid for pid, p in persons.items() if p.get("is_me") or social.get(pid, {}).get("category", "").lower() == cat_lower}
    else:
        allowed_pids = set(persons.keys())

    # If root_rel_person_id is specified, find reachable connected component
    if root_rel_person_id and root_rel_person_id in persons:
        visited = set([root_rel_person_id])
        queue = [root_rel_person_id]
        adj = {}
        for c in connections:
            adj.setdefault(c["person_id"], []).append(c["related_person_id"])
            adj.setdefault(c["related_person_id"], []).append(c["person_id"])
        while queue:
            curr = queue.pop(0)
            for neighbor in adj.get(curr, []):
                if neighbor in persons and neighbor not in visited and neighbor in allowed_pids:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        filtered_persons = {pid: persons[pid] for pid in visited}
    else:
        filtered_persons = {pid: persons[pid] for pid in allowed_pids if pid in persons}

    def infer_gender(pid):
        s = social.get(pid, {})
        text = f"{s.get('subcategory', '')} {s.get('relation_label', '')}".lower()
        female_keywords = ["mother", "mom", "wife", "daughter", "sister", "grandmother", "grandma", "aunt", "niece", "fiancée", "stepmother", "stepdaughter", "stepsister"]
        male_keywords = ["father", "dad", "husband", "son", "brother", "grandfather", "grandpa", "uncle", "nephew", "fiancé", "stepfather", "stepson", "stepbrother"]
        for k in female_keywords:
            if k in text:
                return "F"
        for k in male_keywords:
            if k in text:
                return "M"
        return "U"

    families = []
    fam_by_couple = {}
    fam_by_single_parent = {}

    processed_couples = set()
    for c in connections:
        p1, p2, rel = c["person_id"], c["related_person_id"], c["relation_type"]
        if p1 not in filtered_persons or p2 not in filtered_persons:
            continue
        if rel in ("spouse", "partner"):
            couple_key = tuple(sorted([p1, p2]))
            if couple_key not in processed_couples:
                processed_couples.add(couple_key)
                g1, g2 = infer_gender(p1), infer_gender(p2)
                husb = p1 if g1 == "M" or (g2 == "F" and g1 != "F") else p2
                wife = p2 if husb == p1 else p1
                fam_idx = len(families) + 1
                fam_obj = {
                    "id": fam_idx,
                    "husb": husb,
                    "wife": wife,
                    "children": []
                }
                families.append(fam_obj)
                fam_by_couple[couple_key] = fam_obj

    for c in connections:
        parent_id, child_id, rel = c["person_id"], c["related_person_id"], c["relation_type"]
        if parent_id not in filtered_persons or child_id not in filtered_persons:
            continue
        if rel == "parent":
            placed = False
            for couple_key, fam_obj in fam_by_couple.items():
                if parent_id in couple_key:
                    if child_id not in fam_obj["children"]:
                        fam_obj["children"].append(child_id)
                    placed = True
                    break
            if not placed:
                if parent_id not in fam_by_single_parent:
                    fam_idx = len(families) + 1
                    g = infer_gender(parent_id)
                    fam_obj = {
                        "id": fam_idx,
                        "husb": parent_id if g != "F" else None,
                        "wife": parent_id if g == "F" else None,
                        "children": []
                    }
                    families.append(fam_obj)
                    fam_by_single_parent[parent_id] = fam_obj
                if child_id not in fam_by_single_parent[parent_id]["children"]:
                    fam_by_single_parent[parent_id]["children"].append(child_id)

    ind_fams = {}
    ind_famc = {}
    for fam in families:
        if fam["husb"]:
            ind_fams.setdefault(fam["husb"], []).append(fam["id"])
        if fam["wife"]:
            ind_fams.setdefault(fam["wife"], []).append(fam["id"])
        for child_id in fam["children"]:
            ind_famc[child_id] = fam["id"]

    today_str = datetime.datetime.now().strftime("%d %b %Y").upper()
    lines = [
        "0 HEAD",
        "1 SOUR WABS",
        "2 VERS 1.0",
        "2 NAME WABS Family & Social Graph Intelligence",
        "1 DATE " + today_str,
        "1 GEDC",
        "2 VERS 5.5.1",
        "2 FORM LINEAGE-STRUCTURE",
        "1 CHAR UTF-8"
    ]

    for pid, p in filtered_persons.items():
        name = p.get("name", "Unknown")
        parts = name.strip().split()
        if len(parts) > 1:
            given = " ".join(parts[:-1])
            surname = parts[-1]
            ged_name = f"{given} /{surname}/"
        else:
            given = name
            surname = ""
            ged_name = f"/{name}/"
            
        gender = infer_gender(pid)
        s = social.get(pid, {})
        
        lines.append(f"0 @I{pid}@ INDI")
        lines.append(f"1 NAME {ged_name}")
        if given:
            lines.append(f"2 GIVN {given}")
        if surname:
            lines.append(f"2 SURN {surname}")
        lines.append(f"1 SEX {gender}")
        
        if s.get("category") or s.get("relation_label") or s.get("subcategory"):
            notes_text = f"WABS Relation: {s.get('category', '')}"
            if s.get('subcategory'):
                notes_text += f" - {s.get('subcategory')}"
            if s.get('relation_label'):
                notes_text += f" ({s.get('relation_label')})"
            lines.append(f"1 NOTE {notes_text}")
            
        for fam_id in ind_fams.get(pid, []):
            lines.append(f"1 FAMS @F{fam_id}@")
        if pid in ind_famc:
            lines.append(f"1 FAMC @F{ind_famc[pid]}@")

    for fam in families:
        lines.append(f"0 @F{fam['id']}@ FAM")
        if fam["husb"]:
            lines.append(f"1 HUSB @I{fam['husb']}@")
        if fam["wife"]:
            lines.append(f"1 WIFE @I{fam['wife']}@")
        for child_id in fam["children"]:
            lines.append(f"1 CHIL @I{child_id}@")

    lines.append("0 TRLR")
    return "\n".join(lines)

