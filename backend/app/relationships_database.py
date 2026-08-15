import sqlite3
from pathlib import Path
from backend.app.utils.paths import get_relationships_db_path

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
    
    conn.commit()
    conn.close()

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
            cursor.execute("UPDATE persons SET ai_person_id = NULL WHERE id = ?", (old_row[0],))
        conn.commit()

def export_relationships_internal(rel_db_path: Path = None) -> dict:
    """
    Exports all relationship and categorization data as a portable dictionary.
    """
    if rel_db_path is None:
        rel_db_path = get_relationships_db_path()
    if not rel_db_path.exists():
        return {"persons": [], "person_social": []}
        
    with sqlite3.connect(str(rel_db_path), timeout=10) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        persons = [dict(r) for r in cursor.execute("SELECT id, name, ai_person_id, is_me, linked_at, created_at FROM persons").fetchall()]
        social = [dict(r) for r in cursor.execute("SELECT person_id, category, subcategory, relation_label, updated_at FROM person_social").fetchall()]
    print(f"[RELATIONSHIPS] Exported {len(persons)} persons and {len(social)} social records")
    return {"persons": persons, "person_social": social}

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
        conn.commit()
    print(f"[RELATIONSHIPS] Imported {len(persons)} persons and {len(social)} social relationship records")

