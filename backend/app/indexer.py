import json
import os
import re
import time
import traceback
import hashlib
from pathlib import Path
from threading import Thread

try:
    from backend.app.database import SessionLocal, FileIndex
    from backend.app.config import load_config
    from backend.app.state import STATE
    from sqlalchemy import func
except ModuleNotFoundError:
    from database import SessionLocal, FileIndex
    from config import load_config
    from state import STATE
    from sqlalchemy import func

try:
    from PIL import Image, ExifTags
except ImportError:
    Image = None
    ExifTags = None

try:
    import fitz
except ImportError:
    fitz = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import mutagen
except ImportError:
    mutagen = None

try:
    import pefile
except ImportError:
    pefile = None

try:
    import filetype
except ImportError:
    filetype = None

worker = None

def classify(ext):
    ext = ext.lower()
    if ext in [".jpg",".jpeg",".png",".webp",".gif",".bmp",".tiff",".raw",".svg",".ico",".xcf"]:
        return "photo"
    if ext in [".mp4",".mkv",".avi",".mov",".wmv",".flv",".webm",".m4v",".mpg",".mpeg"]:
        return "video"
    if ext in [".mp3",".wav",".flac",".aac",".ogg",".m4a",".wma",".alac"]:
        return "audio"
    if ext in [".pdf",".doc",".docx",".txt",".rtf",".odt",".xls",".xlsx",".ppt",".pptx",".csv",".md",".log"]:
        return "document"
    if ext in [".epub",".mobi",".azw3",".cbz",".cbr",".chm"]:
        return "ebook"
    if ext in [".py",".js",".jsx",".ts",".tsx",".html",".css",".json",".xml",".yaml",".yml",".c",".cpp",".h",".java",".cs",".go",".rs",".rb",".php",".sh",".bat",".ps1",".sql",".ini"]:
        return "code"
    if ext in [".ttf",".otf",".woff",".woff2",".eot"]:
        return "font"
    if ext in [".db",".sqlite",".sqlite3",".mdb",".accdb"] or re.match(r"^\.crypt\d{2,}$", ext):
        return "database"
    if ext in [".zip",".rar",".7z",".tar",".gz",".bz2",".xz"]:
        return "compressed"
    if ext in [".exe",".msi",".apk",".dmg",".deb",".rpm",".appimage"]:
        return "installer"
    if ext in [".bin",".dat",".iso",".img",".vmdk",".vdi",".qcow2",".mpb"]:
        return "binary"
    return "other"


def build_tags(metadata, category, ext, path_obj=None):
    tags = [category or "other", ext.lower().lstrip('.')]
    if isinstance(metadata, dict):
        if "date" in metadata:
            tags.extend(metadata["date"] if isinstance(metadata["date"], list) else [metadata["date"]])
        if "camera" in metadata:
            tags.append(metadata["camera"].lower())
            
    if path_obj:
        # 1. Tokenize parent directory names (e.g., "Summer_Vacation" -> "summer", "vacation")
        for part in path_obj.parts[:-1]:
            words = re.findall(r'[a-zA-Z0-9]+', part)
            tags.extend([w.lower() for w in words if len(w) > 2])
            
        # 2. Tokenize the filename itself
        words = re.findall(r'[a-zA-Z0-9]+', path_obj.stem)
        tags.extend([w.lower() for w in words if len(w) > 2])
        
    return ",".join(set(tags))


def _normalize_metadata_value(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode('utf-8', errors='ignore')
        except Exception:
            return str(value)
    if isinstance(value, (list, tuple, set)):
        return [_normalize_metadata_value(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _normalize_metadata_value(v) for k, v in value.items()}
    return str(value)


def extract_metadata_for_file(path, category):
    metadata = {"file_type": category}
    tags = []

    if category == "photo" and Image is not None:
        try:
            with Image.open(path) as img:
                metadata["format"] = img.format
                metadata["mode"] = img.mode
                metadata["size"] = img.size
                if hasattr(img, "getexif"):
                    exif = img.getexif()
                    if exif:
                        if hasattr(exif, 'get_ifd'):
                            try:
                                gps_ifd = exif.get_ifd(0x8825) # 0x8825 is the standard GPS IFD
                                if gps_ifd and 1 in gps_ifd and 2 in gps_ifd and 3 in gps_ifd and 4 in gps_ifd:
                                    def _dms_to_dec(dms, ref):
                                        try:
                                            d = float(dms[0])
                                            m = float(dms[1])
                                            s = float(dms[2])
                                            dec = d + (m / 60.0) + (s / 3600.0)
                                            return -dec if ref in ['S', 'W'] else dec
                                        except Exception:
                                            return None
                                    lat = _dms_to_dec(gps_ifd[2], gps_ifd[1])
                                    lon = _dms_to_dec(gps_ifd[4], gps_ifd[3])
                                    if lat is not None and lon is not None:
                                        metadata["gps"] = {"latitude": round(lat, 6), "longitude": round(lon, 6)}
                                        tags.append("location")
                            except Exception:
                                pass
                        mapped = {}
                        for tag_id, value in exif.items():
                            tag = ExifTags.TAGS.get(tag_id, tag_id)
                            mapped[tag] = _normalize_metadata_value(value)
                        metadata["exif"] = mapped
                        date = mapped.get("DateTimeOriginal") or mapped.get("DateTime")
                        if date:
                            date_text = str(date)
                            metadata["date"] = date_text
                            if m := re.match(r"(\d{4}):(\d{2}):(\d{2})", date_text):
                                year, month, day = m.groups()
                                tags.append(f"date:{year}")
                                tags.append(f"date:{year}-{month}")
                                tags.append(f"date:{year}-{month}-{day}")
                                tags.append(f"date:{month}/{day}/{year}")
                        if "Model" in mapped:
                            metadata["camera"] = mapped["Model"]
        except Exception:
            metadata["error"] = "Failed to extract image metadata"
    else:
        metadata["file_name"] = path.name
        metadata["file_extension"] = path.suffix.lower()
        
        if category == "document":
            if path.suffix.lower() == ".pdf":
                if fitz is not None:
                    try:
                        doc = fitz.open(str(path))
                        metadata["pages"] = doc.page_count
                        doc.close()
                    except Exception:
                        pass
            elif path.suffix.lower() in [".txt", ".md", ".csv", ".log"]:
                try:
                    if path.stat().st_size < 10 * 1024 * 1024:  # Skip line counting for text files > 10MB
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = sum(1 for _ in f)
                        metadata["lines"] = lines
                        metadata["pages"] = max(1, (lines + 49) // 50)  # Estimate ~50 lines per page
                except Exception:
                    pass
        elif category == "code":
            try:
                if path.stat().st_size < 10 * 1024 * 1024:  # Skip line counting for code files > 10MB
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        metadata["loc"] = sum(1 for _ in f)
            except Exception:
                pass
        elif category == "video" and cv2 is not None:
            try:
                cap = cv2.VideoCapture(str(path))
                if cap.isOpened():
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    
                    if width > 0 and height > 0:
                        metadata["resolution"] = f"{width}x{height}"
                    if fps > 0:
                        metadata["fps"] = round(fps, 2)
                        if frame_count > 0:
                            metadata["duration_seconds"] = round(frame_count / fps, 2)
                    cap.release()
            except Exception:
                pass
        elif category == "audio" and mutagen is not None:
            try:
                audio = mutagen.File(str(path))
                if audio is not None:
                    if hasattr(audio, 'info') and audio.info is not None:
                        if hasattr(audio.info, 'length') and audio.info.length:
                            metadata['duration_seconds'] = round(audio.info.length, 2)
                        if hasattr(audio.info, 'bitrate') and audio.info.bitrate:
                            metadata['bitrate'] = audio.info.bitrate
                        if hasattr(audio.info, 'sample_rate') and audio.info.sample_rate:
                            metadata['sample_rate'] = audio.info.sample_rate
                    
                    if hasattr(audio, 'tags') and audio.tags:
                        for key, value in audio.tags.items():
                            if not value:
                                continue
                            val_str = str(value[0]) if isinstance(value, list) else str(value)
                            key_lower = key.lower()
                            
                            if key_lower in ['title', 'tit2', '\xa9nam']:
                                metadata['title'] = val_str
                            elif key_lower in ['artist', 'tpe1', '\xa9art']:
                                metadata['artist'] = val_str
                                tags.append(f"artist:{val_str.lower()}")
                            elif key_lower in ['album', 'talb', '\xa9alb']:
                                metadata['album'] = val_str
                            elif key_lower in ['genre', 'tcon', '\xa9gen']:
                                metadata['genre'] = val_str
                                tags.append(f"genre:{val_str.lower()}")
                            elif key_lower in ['date', 'tyer', 'tdrc', '\xa9day']:
                                metadata['date'] = val_str
                                tags.append(f"date:{val_str}")
            except Exception:
                pass
        elif category in ["installer", "binary"] and path.suffix.lower() in [".exe", ".dll", ".sys"] and pefile is not None:
            try:
                # fast_load=True ensures it barely reads the PE headers, making it nearly instant
                pe = pefile.PE(str(path), fast_load=True)
                pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_RESOURCE']])
                
                metadata["machine"] = "x64" if pe.FILE_HEADER.Machine == 0x8664 else "x86" if pe.FILE_HEADER.Machine == 0x014c else hex(pe.FILE_HEADER.Machine)
                
                if hasattr(pe, 'FileInfo'):
                    for entry in pe.FileInfo:
                        for structure in entry:
                            if hasattr(structure, 'StringTable'):
                                for st_entry in structure.StringTable:
                                    for key, val in st_entry.entries.items():
                                        try:
                                            k = key.decode('utf-8', 'ignore')
                                            v = val.decode('utf-8', 'ignore').strip()
                                            if v and k in ['FileDescription', 'CompanyName', 'FileVersion', 'ProductName']:
                                                metadata[k] = v
                                                if k == 'CompanyName':
                                                    tags.append(f"company:{v.lower().replace(' ', '')}")
                                        except Exception:
                                            pass
            except Exception:
                pass
                
    return metadata, tags


def llm_classify(metadata, ext, cfg):
    if not ext and not metadata:
        return None
        
    provider_url = cfg.get("ai_provider", "").strip()
    api_key = cfg.get("openai_api_key", "").strip()
    
    if not provider_url or provider_url.lower() == "openai":
        api_url = "https://api.openai.com/v1/chat/completions"
        if not api_key:
            return None
    else:
        api_url = provider_url
        if not api_key:
            api_key = "local-dummy-key"
            
    model = cfg.get("ai_model") or "gpt-4o-mini"
    
    prompt = f"Identify the specific file type or category for a file with the extension '{ext}'. Reply with a short, highly descriptive category (e.g., 'Source Code', '3D Model', 'Audio', 'Configuration', 'Disk Image'). Maximum 2 words. Only reply with the category name, no punctuation."
    
    data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 10
    }).encode("utf-8")
    
    req = urllib.request.Request(api_url, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    })
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res = json.loads(response.read().decode())
            category = res.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            category = re.sub(r'[\'"\.]', '', category).title()
            if category and len(category) <= 25:
                return category
    except Exception as e:
        print(f"LLM Classification error for extension {ext}: {e}")
    return None


def background_ai_categorize(cfg):
    if not cfg.get("ai_enabled"):
        return
    session = SessionLocal()
    try:
        items = session.query(FileIndex).filter(FileIndex.category == "other").limit(500).all()
        for item in items:
            suggested = llm_classify(json.loads(item.metadata_json or "{}"), item.extension or "", cfg)
            if suggested and suggested.lower() != "other":
                item.category = suggested
                tags = set(item.tags.split(",")) if item.tags else set()
                tags.add(suggested.lower())
                item.tags = ",".join(filter(bool, tags))
                session.add(item)
        session.commit()
    finally:
        session.close()

def background_lazy_hasher():
    if STATE.get("hasher_running"):
        return
    STATE["hasher_running"] = True
    STATE["hasher_stopped"] = False
    session = SessionLocal()
    try:
        # 1. Identify all sizes that have duplicates
        dup_sizes_query = session.query(FileIndex.size).filter(
            FileIndex.size != '0', 
            FileIndex.size.isnot(None)
        ).group_by(FileIndex.size).having(func.count(FileIndex.id) > 1).all()
        
        dup_sizes = [row[0] for row in dup_sizes_query]
        if not dup_sizes:
            return
            
        # 2. Fetch all files belonging to these duplicate size groups
        files = session.query(FileIndex).filter(FileIndex.size.in_(dup_sizes)).all()
        
        updates = 0
        for item in files:
            if STATE.get("hasher_stopped") or STATE.get("stopped"):
                break
            try:
                meta = json.loads(item.metadata_json or "{}")
                if "sha256" in meta:
                    continue
                    
                file_path = Path(item.path)
                if file_path.exists() and file_path.is_file():
                    hasher = hashlib.sha256()
                    with open(file_path, 'rb') as f:
                        for chunk in iter(lambda: f.read(4096 * 1024), b""): # Read in 4MB streaming chunks
                            hasher.update(chunk)
                    meta["sha256"] = hasher.hexdigest()
                    item.metadata_json = json.dumps(meta)
                    session.add(item)
                    updates += 1
                    
                    if updates >= 10:
                        session.commit()
                        updates = 0
            except Exception as e:
                pass
        if updates > 0:
            session.commit()
    except Exception as e:
        print(f"Lazy hasher error: {e}")
    finally:
        STATE["hasher_running"] = False
        session.close()

def run():

    cfg = load_config()
    backup_configs = cfg.get("backup_configs", [])
    if not backup_configs:
        backup_configs = [{"backup_path": cfg.get("backup_path", "")}]

    roots = [Path(c.get("backup_path", "")) for c in backup_configs if c.get("backup_path")]
    valid_roots = [r for r in roots if r.exists() and r.is_dir()]

    # --- Self-Healing: Re-evaluate 'other' files for newly added extensions ---
    try:
        with SessionLocal() as session:
            others = session.query(FileIndex).filter(FileIndex.category == 'other').all()
            updated_count = 0
            for item in others:
                new_cat = classify(item.extension or "")
                if new_cat != "other":
                    item.category = new_cat
                    tags = set(item.tags.split(",")) if item.tags else set()
                    tags.add(new_cat)
                    if "other" in tags:
                        tags.remove("other")
                    item.tags = ",".join(filter(bool, tags))
                    updated_count += 1
            if updated_count > 0:
                session.commit()
                print(f"Self-healed {updated_count} files from 'other' to their new categories.")
    except Exception as e:
        print(f"Pre-scan reclassification error: {e}")

    BATCH_SIZE = 500

    last_root_id = ",".join(str(r) for r in valid_roots)

    resume_index = 0
    if STATE.get("last_root") == last_root_id and STATE.get("indexed", 0) > 0:
        resume_index = STATE["indexed"]
    else:
        STATE["current"] = 0
        STATE["indexed"] = 0

    STATE["running"] = True
    STATE["paused"] = False
    STATE["stopped"] = False
    STATE["status"] = "Scanning"
    STATE["last_root"] = last_root_id
    if resume_index == 0:
        STATE["current"] = 0
        STATE["total"] = 0
    STATE["current_file"] = ""

    if not valid_roots:
        STATE["running"] = False
        STATE["status"] = "No valid backup paths configured or found."
        return

    try:
        with SessionLocal() as session:
            STATE["status"] = "Discovering files..."
            
            # Fast traversal using os.walk and pure strings to avoid Path object overhead
            raw_files = []
            for root_path in valid_roots:
                for dirpath, _, filenames in os.walk(str(root_path)):
                    for f in filenames:
                        raw_files.append(os.path.join(dirpath, f))
            
            raw_files.sort()

            STATE["total"] = len(raw_files)
            STATE["status"] = "Indexing"

            start_offset = 0
            is_update_only = STATE.get("update_only")
            if is_update_only:
                existing_paths = {r[0] for r in session.query(FileIndex.path).all()}
                files_to_process = [f for f in raw_files if f not in existing_paths]
                
                processed_count = len(raw_files) - len(files_to_process)
                STATE["indexed"] = processed_count
                STATE["total"] = len(raw_files)
                STATE["current"] = processed_count
                start_offset = processed_count
            elif resume_index > 0 and resume_index < len(raw_files):
                start_offset = resume_index
                files_to_process = raw_files[start_offset:]
                STATE["total"] = len(raw_files)
                STATE["current"] = start_offset
            elif resume_index >= len(raw_files):
                start_offset = len(raw_files)
                files_to_process = []
                STATE["total"] = len(raw_files)
                STATE["current"] = start_offset
            else:
                files_to_process = raw_files

            for idx, file_str in enumerate(files_to_process):

                file = Path(file_str)

                if STATE["stopped"]:
                    STATE["status"] = "Stopped"
                    break

                while STATE["paused"]:
                    STATE["status"] = "Paused"
                    time.sleep(0.3)
                    if STATE["stopped"]:
                        break

                if STATE["stopped"]:
                    STATE["status"] = "Stopped"
                    break

                real_idx = start_offset + idx
                STATE["current"] = real_idx + 1
                STATE["current_file"] = str(file)
                STATE["status"] = "Indexing"

                try:
                    modified_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(file.stat().st_mtime))
                    file_size = str(file.stat().st_size)
                    category = classify(file.suffix)
                    
                    if category == "other" and filetype is not None:
                        try:
                            kind = filetype.guess(str(file))
                            if kind:
                                mime = kind.mime
                                if mime.startswith('image/'): category = "photo"
                                elif mime.startswith('video/'): category = "video"
                                elif mime.startswith('audio/'): category = "audio"
                                elif mime.startswith('font/'): category = "font"
                                elif 'pdf' in mime: category = "document"
                                elif 'zip' in mime or 'compressed' in mime or 'tar' in mime: category = "compressed"
                                elif 'executable' in mime or 'msdownload' in mime: category = "installer"
                        except Exception:
                            pass

                    metadata, extra_tags = extract_metadata_for_file(file, category)
                    tags = build_tags(metadata, category, file.suffix, file)
                    if extra_tags:
                        tags = ",".join(set(tags.split(",") + extra_tags))

                    exists = None
                    if not is_update_only:
                        exists = session.query(FileIndex).filter_by(
                            path=str(file)
                        ).first()

                    if exists:
                        if exists.size != file_size or exists.modified != modified_time or exists.metadata_json != json.dumps(metadata) or exists.tags != tags:
                            exists.size = file_size
                            exists.modified = modified_time
                            exists.metadata_json = json.dumps(metadata)
                            exists.tags = tags
                            session.add(exists)
                    else:
                        session.add(
                            FileIndex(
                                path=str(file),
                                filename=file.name,
                                category=category,
                                size=file_size,
                                modified=modified_time,
                                extension=file.suffix,
                                tags=tags,
                                metadata_json=json.dumps(metadata)
                            )
                        )

                    if idx > 0 and idx % BATCH_SIZE == 0:
                        session.commit()
                except Exception as exc:
                    print(f"Indexer error processing {file}: {exc}")
                    traceback.print_exc()
                    session.rollback()
                    continue

            try:
                session.commit()
            except Exception as exc:
                print(f"Indexer final commit failed: {exc}")
                traceback.print_exc()
                session.rollback()

        if cfg.get("ai_enabled"):
            categorization_thread = Thread(target=background_ai_categorize, args=(cfg,), daemon=True)
            categorization_thread.start()
    except Exception as exc:
        print(f"Indexer exception: {exc}")
        traceback.print_exc()
        STATE["status"] = f"Error: {exc}"
    finally:
        STATE["running"] = False
        if STATE["stopped"]:
            STATE["status"] = "Stopped"
        elif not STATE["status"].startswith("Invalid backup path") and not STATE["status"].startswith("Error"):
            STATE["status"] = "Completed"
        STATE["indexed"] = STATE.get("current", 0)

def start():

    global worker

    if STATE["running"]:
        return

    STATE["running"] = True
    STATE["status"] = "Starting..."
    worker = Thread(target=run, daemon=True)
    worker.start()