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

def get_relationships_db_path() -> Path:
    ai_path = get_ai_db_path()
    return ai_path.parent / "relationships.db"

def get_bundled_model_path(model_filename: str) -> str:
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller extracts bundled files to a temporary _MEIPASS folder
        return str(Path(sys._MEIPASS) / "backend" / model_filename)
    # Development mode: resolve relative to backend directory
    return str(Path(__file__).parent.parent.parent / model_filename)

def check_models_exist(scan_type: str):
    from fastapi import HTTPException
    import os
    
    missing = []
    if scan_type == "face":
        yunet = get_bundled_model_path("face_detection_yunet_2023mar.onnx")
        sface = get_bundled_model_path("face_recognition_sface_2021dec.onnx")
        if not os.path.exists(yunet):
            missing.append("face_detection_yunet_2023mar.onnx")
        if not os.path.exists(sface):
            missing.append("face_recognition_sface_2021dec.onnx")
            
    elif scan_type == "object":
        mobilenet = get_bundled_model_path("mobilenetv2-small.onnx")
        yunet = get_bundled_model_path("face_detection_yunet_2023mar.onnx")
        if not os.path.exists(mobilenet):
            missing.append("mobilenetv2-small.onnx")
        if not os.path.exists(yunet):
            missing.append("face_detection_yunet_2023mar.onnx")
            
    elif scan_type == "document":
        det = get_bundled_model_path("paddleOCR_det.onnx")
        rec = get_bundled_model_path("paddleOCR_rec.onnx")
        dct = get_bundled_model_path("paddleOCR_dict.txt")
        if not os.path.exists(det):
            missing.append("paddleOCR_det.onnx")
        if not os.path.exists(rec):
            missing.append("paddleOCR_rec.onnx")
        if not os.path.exists(dct):
            missing.append("paddleOCR_dict.txt")
            
    if missing:
        msg = f"Required files not found: {', '.join(missing)}. "
        if hasattr(sys, '_MEIPASS'):
            msg += "The temporary application folder contents may have been deleted. Please restart the application."
        else:
            msg += "Ensure these files are present in the backend folder."
        raise HTTPException(status_code=400, detail=msg)