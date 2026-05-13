import sys
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from backend.app.config import load_config
except ModuleNotFoundError:
    from config import load_config

cfg = load_config()

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
