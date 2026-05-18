import sys
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String
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

db = Path(cfg["database_path"])

if not db.is_absolute():
    if getattr(sys, 'frozen', False):
        db = Path(sys.executable).parent / db
    else:
        db = Path(__file__).resolve().parent.parent.parent / db

db.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{db.resolve()}",
    connect_args={"check_same_thread":False}
)

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

with engine.begin() as conn:
    conn.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            filename, tags, 
            content='files', content_rowid='id'
        );
    """))
    conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, filename, tags) 
            VALUES (new.id, new.filename, new.tags);
        END;
    """))
    conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, filename, tags) 
            VALUES ('delete', old.id, old.filename, old.tags);
        END;
    """))
    conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, filename, tags) 
            VALUES ('delete', old.id, old.filename, old.tags);
            
            INSERT INTO files_fts(rowid, filename, tags) 
            VALUES (new.id, new.filename, new.tags);
        END;
    """))
    
    conn.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_vocab USING fts5vocab('files_fts', 'row');
    """))
