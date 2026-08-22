import sys
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, event, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker

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

# Provide a safe default for the database path if it's missing from config.yaml
db_path = cfg.get("database_path", "archive.db")
db = Path(db_path)

if not db.is_absolute():
    if getattr(sys, 'frozen', False):
        db = Path(sys.executable).parent / db
    else:
        db = Path(__file__).resolve().parent.parent.parent / db

try:
    db.parent.mkdir(parents=True, exist_ok=True)
except FileExistsError:
    if db.parent.is_file():
        db = db.parent
    else:
        raise

engine = create_engine(
    f"sqlite:///{db.resolve()}",
    connect_args={"check_same_thread":False}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
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

Base.metadata.create_all(engine)

from sqlalchemy import text
with engine.connect() as conn:
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

with engine.begin() as conn:
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_category ON files(category)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_size ON files(size)"))
    try:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_date ON files (
                coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10))
            )
        """))
    except Exception as e:
        print(f"Warning: Could not create index idx_files_date: {e}")

    try:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_size_cast ON files (
                CAST(size AS INTEGER)
            )
        """))
    except Exception as e:
        print(f"Warning: Could not create index idx_files_size_cast: {e}")

    try:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_category_date ON files (
                category,
                coalesce(replace(substr(json_extract(metadata_json, '$.date'), 1, 10), ':', '-'), substr(modified, 1, 10))
            )
        """))
    except Exception as e:
        print(f"Warning: Could not create index idx_files_category_date: {e}")

    try:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_category_size ON files (
                category,
                CAST(size AS INTEGER)
            )
        """))
    except Exception as e:
        print(f"Warning: Could not create index idx_files_category_size: {e}")

    try:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_category_filename ON files (category, filename)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_files_category_extension ON files (category, extension)"))
    except Exception as e:
        print(f"Warning: Could not create index category_filename/extension: {e}")
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