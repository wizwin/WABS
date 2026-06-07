import sys
from pathlib import Path
from backend.app.config import load_config

def get_ai_db_path() -> Path:
    cfg = load_config()
    db_path = cfg.get("database_path")
    if not db_path:
        p = Path("archive.db")
    else:
        p = Path(db_path)
        
    if not p.is_absolute():
        if getattr(sys, 'frozen', False):
            p = Path(sys.executable).parent / p
        else:
            p = Path(__file__).resolve().parent.parent.parent / p
            
    if p.parent.is_file():
        return p.parent.parent / "ai_metadata.db"
    return p.parent / "ai_metadata.db"

def get_bundled_model_path(model_filename: str) -> str:
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller extracts bundled files to a temporary _MEIPASS folder
        return str(Path(sys._MEIPASS) / "backend" / model_filename)
    # Development mode: resolve relative to backend directory
    return str(Path(__file__).parent.parent.parent / model_filename)