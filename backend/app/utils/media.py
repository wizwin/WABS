import traceback
from pathlib import Path
from fastapi.responses import FileResponse, Response



def get_cv2_dnn_backends():
    try:
        import cv2
    except ImportError:
        return 0, 0
    has_cuda = False
    try:
        if cv2 is not None and hasattr(cv2, 'cuda') and cv2.cuda.getCudaEnabledDeviceCount() > 0:
            has_cuda = True
    except Exception:
        pass
    if has_cuda:
        return getattr(cv2.dnn, 'DNN_BACKEND_CUDA', 0), getattr(cv2.dnn, 'DNN_TARGET_CUDA', 0)
    return getattr(cv2.dnn, 'DNN_BACKEND_DEFAULT', 0), getattr(cv2.dnn, 'DNN_TARGET_CPU', 0)

def generate_photo_thumbnail(file_path: Path, cached_thumb: Path) -> bool:
    success = False
    try:
        import cv2
    except ImportError:
        cv2 = None
    if cv2 is not None:
        try:
            import numpy as np
            img_array = np.fromfile(str(file_path), np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is not None:
                height, width = img.shape[:2]
                scaling_factor = min(400 / width, 400 / height)
                if scaling_factor < 1.0:
                    new_size = (int(width * scaling_factor), int(height * scaling_factor))
                    resized_img = cv2.resize(img, new_size, interpolation=cv2.INTER_AREA)
                else:
                    resized_img = img
                    
                is_success, buffer = cv2.imencode(".jpg", resized_img)
                if is_success:
                    with open(str(cached_thumb), "wb") as f:
                        f.write(buffer.tobytes())
                    success = True
        except Exception as e:
            print(f"OpenCV photo cache failed for {file_path.name}: {e}")
            
    if not success:
        try:
            from PIL import Image, ImageOps
            with Image.open(file_path) as pil_img:
                pil_img = ImageOps.exif_transpose(pil_img)
                if pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
                pil_img.thumbnail((400, 400), Image.Resampling.LANCZOS)
                pil_img.save(str(cached_thumb), "JPEG", quality=85)
                success = True
        except Exception as e:
            print(f"Pillow photo cache fallback failed for {file_path.name}: {e}")

    return success


def generate_video_thumbnail(file_path: Path, cached_thumb: Path) -> bool:
    try:
        import cv2
    except ImportError:
        cv2 = None
    if cv2 is not None:
        try:
            hw_params = []
            if hasattr(cv2, 'CAP_PROP_HW_ACCELERATION') and hasattr(cv2, 'VIDEO_ACCELERATION_ANY'):
                hw_params = [cv2.CAP_PROP_HW_ACCELERATION, cv2.VIDEO_ACCELERATION_ANY]

            # Try FFmpeg backend first for speed, fallback to auto-discovery for H.265/HEVC
            if hw_params:
                cap = cv2.VideoCapture(str(file_path), cv2.CAP_FFMPEG, hw_params)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(str(file_path), cv2.CAP_ANY, hw_params)
            else:
                cap = cv2.VideoCapture(str(file_path), cv2.CAP_FFMPEG)

            if not cap.isOpened():
                cap = cv2.VideoCapture(str(file_path))
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if frame_count > 0:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_count * 0.1)) # Skip to 10% to avoid black start frames
            success, frame = cap.read()
            if not success:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                success, frame = cap.read()
            if success:
                height, width = frame.shape[:2]
                scaling_factor = min(400 / width, 300 / height)
                new_size = (int(width * scaling_factor), int(height * scaling_factor))
                resized_frame = cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)
                is_success, buffer = cv2.imencode(".jpg", resized_frame)
                if is_success:
                    with open(str(cached_thumb), "wb") as f:
                        f.write(buffer.tobytes())
                cap.release()
                return is_success
            cap.release()
        except Exception as e:
            print(f"ERROR: Video thumbnail error for {file_path}: {e}")
            traceback.print_exc()
    return False


def generate_document_thumbnail(file_path: Path, cached_thumb: Path, theme: str) -> Response | None:
    if file_path.suffix.lower() == ".pdf":
        try:
            import fitz
        except ImportError:
            fitz = None
        if fitz is not None:
            try:
                doc = fitz.open(str(file_path))
                
                if doc.needs_pass:
                    doc.close()
                    bg_fill = '#f8fafc' if theme == 'light' else '#111827'
                    text_fill_1 = '#0f172a' if theme == 'light' else '#94a3b8'
                    text_fill_2 = '#334155' if theme == 'light' else '#64748b'
                    placeholder = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>
  <rect width='400' height='300' fill='{bg_fill}'/>
  <text x='50%' y='45%' fill='{text_fill_1}' font-family='Segoe UI,Arial' font-size='22' text-anchor='middle'>Preview unavailable</text>
  <text x='50%' y='60%' fill='{text_fill_2}' font-family='Segoe UI,Arial' font-size='16' text-anchor='middle'>ENCRYPTED PDF</text>
</svg>
""".strip()
                    return Response(content=placeholder, media_type='image/svg+xml')

                page = doc.load_page(0)
                pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                pix.save(str(cached_thumb))
                doc.close()
                if cached_thumb.exists():
                    return FileResponse(str(cached_thumb), media_type="image/jpeg")
            except Exception as e:
                print(f"ERROR: PDF thumbnail error for {file_path}: {e}")
                traceback.print_exc()
    elif file_path.suffix.lower() == ".docx":
        try:
            import docx
        except ImportError:
            docx = None
        if docx is not None:
            try:
                doc = docx.Document(str(file_path))
                lines = []
                for p in doc.paragraphs:
                    if p.text.strip():
                        lines.append(p.text.strip())
                    if len(lines) >= 11:
                        break
                
                text_fill = '#0f172a' if theme == 'light' else '#cbd5e1'
                svg_lines = ""
                y = 28
                for line in lines:
                    clean_line = "".join(c for c in line[:50] if c.isprintable() or c == '\t').replace('\t', '    ')
                    safe_line = clean_line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    svg_lines += f"<text x='16' y='{y}' fill='{text_fill}' font-family='monospace' font-size='13'>{safe_line}</text>\n"
                    y += 24
                    
                bg_fill = '#f8fafc' if theme == 'light' else '#0f172a'
                text_svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>\n  <rect width='400' height='300' fill='{bg_fill}'/>\n{svg_lines}</svg>"
                return Response(content=text_svg, media_type='image/svg+xml')
            except Exception as e:
                print(f"ERROR: DOCX thumbnail error for {file_path}: {e}")
    else:
        text_extensions = [".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".py", ".js", ".html", ".htm", ".css", ".c", ".cpp", ".h", ".java", ".cs", ".go", ".rs", ".rb", ".php", ".sh", ".bat", ".sql"]
        if file_path.suffix.lower() in text_extensions:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = [f.readline().rstrip('\n') for _ in range(11)]
                
                text_fill = '#0f172a' if theme == 'light' else '#cbd5e1'
                svg_lines = ""
                y = 28
                for line in lines:
                    clean_line = "".join(c for c in line[:50] if c.isprintable() or c == '\t').replace('\t', '    ')
                    safe_line = clean_line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    svg_lines += f"<text x='16' y='{y}' fill='{text_fill}' font-family='monospace' font-size='13'>{safe_line}</text>\n"
                    y += 24
                    
                bg_fill = '#f8fafc' if theme == 'light' else '#0f172a'
                text_svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>\n  <rect width='400' height='300' fill='{bg_fill}'/>\n{svg_lines}</svg>"
                return Response(content=text_svg, media_type='image/svg+xml')
            except Exception as e:
                print(f"ERROR: Text thumbnail error for {file_path}: {e}")
                traceback.print_exc()
    return None

def _evaluate_image_faces(file_path, yunet_path: str):
    import backend.app.state as app_state
    is_scan_active = app_state.face_scanner_running or app_state.combined_scanner_running
    if (is_scan_active and (app_state.STATE.get("stopped") or app_state.STATE.get("face_scanner_stopped") or app_state.STATE.get("combined_scanner_stopped"))) or app_state.STATE.get("cancel_data_operation"):
        return []
        
    import numpy as np
    try:
        import cv2
    except ImportError:
        cv2 = None

    if cv2 is None:
        return []

    try:
        # Read dimensions first using PIL to optimize image decoding
        from PIL import Image
        decode_scale = 1.0
        width, height = 0, 0
        try:
            with Image.open(str(file_path)) as pil_img:
                width, height = pil_img.size
        except Exception:
            pass

        img_array = np.fromfile(str(file_path), np.uint8)
        img = None
        
        # If JPEG and very large, use scale-on-decode flags
        if width > 0 and height > 0 and str(file_path).lower().endswith(('.jpg', '.jpeg')):
            max_dim = max(width, height)
            if max_dim >= 3200:
                img = cv2.imdecode(img_array, cv2.IMREAD_REDUCED_COLOR_4)
                decode_scale = 0.25
            elif max_dim >= 1600:
                img = cv2.imdecode(img_array, cv2.IMREAD_REDUCED_COLOR_2)
                decode_scale = 0.5

        if img is None:
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if img is None:
            return []
        
        dec_h, dec_w = img.shape[:2]
        target_dim = 800
        scale = 1.0
        if max(dec_h, dec_w) > target_dim:
            scale = target_dim / max(dec_h, dec_w)
            new_w, new_h = int(dec_w * scale), int(dec_h * scale)
            det_img = cv2.resize(img, (new_w, new_h))
        else:
            det_img = img

        backend_id, target_id = get_cv2_dnn_backends()
        
        try:
            detector = cv2.FaceDetectorYN.create(yunet_path, "", (det_img.shape[1], det_img.shape[0]), 0.9, 0.3, 5000, backend_id, target_id)
        except Exception:
            detector = cv2.FaceDetectorYN.create(yunet_path, "", (det_img.shape[1], det_img.shape[0]))
        success, faces = detector.detect(det_img)
        
        results = []
        if faces is not None:
            for face in faces:
                # Coordinate in det_img space
                det_x, det_y, det_w, det_h = face[:4]
                
                # Scale back to img (decoded) space for cropping
                x_img = max(0, int(det_x / scale))
                y_img = max(0, int(det_y / scale))
                w_img = int(det_w / scale)
                h_img = int(det_h / scale)
                
                # Scale back to original dimensions for area calculation
                w_orig = int(det_w / (scale * decode_scale))
                h_orig = int(det_h / (scale * decode_scale))
                face_area = w_orig * h_orig
                
                face_crop = img[y_img:y_img+h_img, x_img:x_img+w_img]
                sharpness = 0.0
                if face_crop.size > 0:
                    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                    sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
                results.append({
                    "area": face_area,
                    "sharpness": sharpness,
                    "score": float(np.sqrt(face_area)) * sharpness if face_area > 0 else 0.0
                })
        return results
    except Exception:
        return []