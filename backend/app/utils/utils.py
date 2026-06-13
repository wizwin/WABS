import os
import platform
import shutil
from pathlib import Path

from backend.app.config import load_config

def _resolve_path(original_path: Path) -> Path:
    cfg = load_config()
    backup_configs = cfg.get("backup_configs", [])

    for config in backup_configs:
        if config.get("path_mapping_enabled"):
            source_root_str = config.get("backup_path")
            target_root_str = config.get("mapped_backup_path")

            if source_root_str and target_root_str:
                try:
                    # Pre-normalize slashes to ensure Windows network paths (\\) 
                    # parse correctly into .parts even if running on Linux/Mac (/)
                    normalized_orig = str(original_path).replace('\\', os.sep).replace('/', os.sep)
                    normalized_src = source_root_str.replace('\\', os.sep).replace('/', os.sep)
                    
                    src_path = Path(normalized_src)
                    tgt_path = Path(target_root_str)
                    
                    orig_parts = Path(normalized_orig).parts
                    src_parts = src_path.parts
                    
                    if len(orig_parts) >= len(src_parts):
                        # Verify the components actually match before splicing
                        match = True
                        for i in range(len(src_parts)):
                            orig_part = orig_parts[i]
                            src_part = src_parts[i]
                            if platform.system() == "Windows":
                                orig_part = orig_part.lower()
                                src_part = src_part.lower()
                            if orig_part != src_part:
                                match = False
                                break
                        if match:
                            return tgt_path.joinpath(*orig_parts[len(src_parts):])
                except Exception as e:
                    print(f"WARNING: Path remapping failed for {original_path}: {e}")
                    traceback.print_exc()

    # This part is reached if remapping is OFF, or if the path was not applicable for remapping.
    return original_path

def parse_tags(tags_str: str) -> set[str]:
    """
    Parses a tags string. Standardizes on comma separator, with a space-separated fallback
    to support un-normalized legacy databases.
    """
    if not tags_str:
        return set()
    if ',' not in tags_str:
        return {t.strip() for t in tags_str.split() if t.strip()}
    return {t.strip() for t in tags_str.split(',') if t.strip()}