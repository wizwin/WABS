import sys
import os
import time
import logging
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, event, ForeignKey, text
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import declarative_base, sessionmaker

if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("wabs.database")

try:
    from backend.app.config import load_config
except ModuleNotFoundError:
    from config import load_config

cfg = load_config()

if not cfg.get("backup_configs"):
    cfg["backup_configs"] = [{
        "id": "default",
        "name": "Default Backup Location",
        "backup_path": cfg.get("backup_path", ""),
        "mapped_backup_path": cfg.get("mapped_backup_path", ""),
        "path_mapping_enabled": cfg.get("path_mapping_enabled", False),
        "read_only_mode": cfg.get("read_only_mode", True)
    }]

def resolve_db_path(target_path_str: str) -> Path:
    p = Path(target_path_str)
    if not p.is_absolute():
        if getattr(sys, 'frozen', False):
            p = Path(sys.executable).parent / p
        else:
            p = Path(__file__).resolve().parent.parent.parent / p
    # If the user selected or passed a directory path rather than a .db file, append archive.db
    if p.is_dir() or p.suffix.lower() not in ('.db', '.sqlite', '.sqlite3'):
        p = p / "archive.db"
    return p

DATABASE_OFFLINE = False
OFFLINE_DB_PATH = ""

# Provide a safe default for the database path if it's missing from config.yaml
db_path = cfg.get("database_path", "archive.db")
db = resolve_db_path(db_path)

drive_accessible = True
if sys.platform == "win32" and db.drive:
    drive_root = db.drive + "\\"
    if not os.path.exists(drive_root):
        drive_accessible = False
        logger.critical(f"[Database] CRITICAL: Drive '{db.drive}' is not mounted or accessible for path: '{db}'")

if drive_accessible:
    try:
        db.parent.mkdir(parents=True, exist_ok=True)
        engine_url = f"sqlite:///{db.resolve()}"
    except (OSError, Exception) as e:
        drive_accessible = False
        logger.critical(f"[Database] CRITICAL: Cannot access database path '{db}': {e}")

if not drive_accessible:
    DATABASE_OFFLINE = True
    OFFLINE_DB_PATH = str(db)
    logger.critical(f"[Database] CRITICAL: Database at '{db}' cannot be loaded. Starting in configuration mode so paths can be set in Settings.")
    standby_dir = Path(__file__).resolve().parent.parent.parent / "database"
    try:
        standby_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    standby_db = standby_dir / "standby.db"
    engine_url = f"sqlite:///{standby_db.resolve()}"

engine = create_engine(
    engine_url,
    connect_args={"check_same_thread": False},
    poolclass=NullPool
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA busy_timeout = 30000")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class FileIndex(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True)
    path = Column(String, unique=True, index=True)
    filename = Column(String, index=True)
    category = Column(String)
    size = Column(String)
    extension = Column(String)
    modified = Column(String)
    tags = Column(String)
    metadata_json = Column(String)

class VirtualFolder(Base):
    __tablename__ = "virtual_folders"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("virtual_folders.id", ondelete="CASCADE"), nullable=True)
    is_dynamic = Column(Integer, default=0) # 0 = manual, 1 = dynamic/query-based
    query = Column(String, nullable=True)
    created_at = Column(String)
    metadata_json = Column(String, nullable=True)

class VirtualFolderFile(Base):
    __tablename__ = "virtual_folder_files"

    id = Column(Integer, primary_key=True)
    virtual_folder_id = Column(Integer, ForeignKey("virtual_folders.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)

def init_db(target_engine=None):
    if target_engine is None:
        global engine
        target_engine = engine

    Base.metadata.create_all(target_engine)

    with target_engine.connect() as conn:
        existing = [row[1] for row in conn.execute(text("PRAGMA table_info(files)"))]
        if "tags" not in existing:
            conn.execute(text("ALTER TABLE files ADD COLUMN tags TEXT"))
        if "metadata_json" not in existing:
            conn.execute(text("ALTER TABLE files ADD COLUMN metadata_json TEXT"))
            if "metadata" in existing:
                conn.execute(text("UPDATE files SET metadata_json=metadata WHERE metadata_json IS NULL OR metadata_json=''"))
                
        existing_vf = [row[1] for row in conn.execute(text("PRAGMA table_info(virtual_folders)"))]
        if "metadata_json" not in existing_vf:
            conn.execute(text("ALTER TABLE virtual_folders ADD COLUMN metadata_json TEXT"))

    with target_engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_category ON files(category)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_size ON files(size)"))
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_files_date ON files (
                    coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10))
                )
            """))
        except Exception:
            pass

        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_files_size_cast ON files (
                    CAST(size AS INTEGER)
                )
            """))
        except Exception:
            pass

        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_files_category_date ON files (
                    category,
                    coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10))
                )
            """))
        except Exception:
            pass

        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_files_category_size ON files (
                    category,
                    CAST(size AS INTEGER)
                )
            """))
        except Exception:
            pass

        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_category_filename ON files (category, filename)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_category_extension ON files (category, extension)"))
        except Exception:
            pass

        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                filename, tags, 
                content='files', content_rowid='id',
                tokenize='unicode61',
                prefix='2 3 4 5 6 7'
            );
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts(rowid, filename, tags) 
                VALUES (new.id, new.filename, new.tags);
            END;
        """))
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS file_text_fts USING fts5(file_id UNINDEXED, content);
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS processed_text (file_id INTEGER PRIMARY KEY);
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, filename, tags) 
                VALUES ('delete', old.id, old.filename, old.tags);
            END;
        """))
        conn.execute(text("DROP TRIGGER IF EXISTS files_au;"))
        conn.execute(text("""
            CREATE TRIGGER files_au AFTER UPDATE OF filename, tags ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, filename, tags) 
                VALUES ('delete', old.id, old.filename, old.tags);
                
                INSERT INTO files_fts(rowid, filename, tags) 
                VALUES (new.id, new.filename, new.tags);
            END;
        """))
        
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_vocab USING fts5vocab('files_fts', 'row');
        """))

# Initialize tables on import
init_db(engine)

def reconnect_database(new_path: str):
    """
    Reconnects the active SQLite engine to the database file at the new location.
    If pointing to an existing db, loads it. If pointing to a new location, initializes it.
    """
    global engine, SessionLocal, db, DATABASE_OFFLINE, OFFLINE_DB_PATH
    target_p = resolve_db_path(new_path)

    if sys.platform == "win32" and target_p.drive:
        if not os.path.exists(target_p.drive + "\\"):
            err = f"Drive '{target_p.drive}' is not mounted or accessible."
            logger.critical(f"[Database] {err}")
            raise OSError(err)

    try:
        target_p.parent.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.critical(f"[Database] Cannot access directory '{target_p.parent}': {e}")
        raise OSError(f"Cannot access directory: {e}")

    is_existing = target_p.exists() and target_p.is_file()

    if engine is not None:
        try:
            engine.dispose()
        except Exception:
            pass

    new_engine = create_engine(
        f"sqlite:///{target_p.resolve()}",
        connect_args={"check_same_thread": False},
        poolclass=NullPool
    )

    @event.listens_for(new_engine, "connect")
    def set_sqlite_pragma_reconnect(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA busy_timeout = 30000")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()

    SessionLocal.configure(bind=new_engine)
    engine = new_engine
    db = target_p
    DATABASE_OFFLINE = False
    OFFLINE_DB_PATH = ""

    # Ensure schema (creates tables/indexes if new, preserves data if existing)
    init_db(engine)

    # Initialize sidecars at new location (creates if new, loads if existing)
    try:
        from backend.app.ai_database import init_ai_database
        from backend.app.relationships_database import init_relationships_database
        sidecar_dir = target_p.parent.parent if target_p.parent.is_file() else target_p.parent
        init_ai_database(str(sidecar_dir / "ai_metadata.db"))
        init_relationships_database(sidecar_dir / "relationships.db")
    except Exception as e:
        logger.warning(f"[Database] Sidecar database init: {e}")

    if is_existing:
        logger.info(f"[Database] Successfully loaded existing database from: {target_p.resolve()}")
    else:
        logger.info(f"[Database] Successfully initialized new database at: {target_p.resolve()}")