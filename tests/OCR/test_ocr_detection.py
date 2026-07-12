import sys
import time
import numpy as np
import cv2
from pathlib import Path
from PIL import Image, ImageOps

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.app.utils.paths import get_bundled_model_path

def run_ocr_detection_test():
    print("=== WABS OCR & Object Detection Test ===")
    
    ocr_dir = Path(__file__).resolve().parent
    image_files = list(ocr_dir.glob("*.jpg")) + list(ocr_dir.glob("*.png"))
    
    if not image_files:
        print(f"No test images found in {ocr_dir}")
        sys.exit(1)
        
    model_path = get_bundled_model_path("mobilenetv2-small.onnx")
    classes_path = get_bundled_model_path("imagenet_classes.txt")
    
    if not Path(model_path).exists():
        print(f"Model file not found: {model_path}")
        sys.exit(1)
        
    net = cv2.dnn.readNetFromONNX(model_path)
    with open(classes_path, 'r') as f:
        classes = [line.strip() for line in f.readlines()]
        
    print("Loaded MobilenetV2 ONNX and Classes mapping.")
    
    try:
        from rapidocr_onnxruntime import RapidOCR
        ocr_engine = RapidOCR()
        print("RapidOCR engine initialized successfully.")
    except Exception as e:
        print(f"Failed to load RapidOCR: {e}")
        sys.exit(1)
        
    for img_path in image_files:
        print(f"\nProcessing: {img_path.name}")
        
        # 1. Image Decode (PIL + OpenCV fallback)
        img = None
        try:
            with Image.open(img_path) as pil_img:
                if pil_img.mode in ('RGBA', 'LA') or (pil_img.mode == 'P' and 'transparency' in pil_img.info):
                    bg = Image.new("RGB", pil_img.size, (255, 255, 255))
                    if pil_img.mode == 'P':
                        pil_img = pil_img.convert('RGBA')
                    mask = pil_img.split()[3] if pil_img.mode == 'RGBA' else pil_img.split()[1]
                    bg.paste(pil_img, mask=mask)
                    bg = ImageOps.exif_transpose(bg)
                    img = cv2.cvtColor(np.array(bg), cv2.COLOR_RGB2BGR)
        except Exception as e:
            print(f"  PIL decode warning: {e}")
            
        if img is None:
            img_array = np.fromfile(str(img_path), np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
        if img is None:
            print(f"  ERROR: Failed to decode image {img_path.name}")
            continue
            
        h, w = img.shape[:2]
        print(f"  Dimensions: {w}x{h}")
        
        # 2. Object Classification
        start_classify = time.perf_counter()
        target_size = 224
        scale = min(target_size / w, target_size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
        
        o_img = np.full((target_size, target_size, 3), 255, dtype=np.uint8)
        dx = (target_size - new_w) // 2
        dy = (target_size - new_h) // 2
        o_img[dy:dy+new_h, dx:dx+new_w] = resized

        o_img = cv2.cvtColor(o_img, cv2.COLOR_BGR2RGB)
        o_img = o_img.astype(np.float32) / 255.0
        o_img -= np.array([0.485, 0.456, 0.406])
        o_img /= np.array([0.229, 0.224, 0.225])
        o_img = o_img.transpose(2, 0, 1)
        o_img = np.expand_dims(o_img, axis=0)
        o_img = np.ascontiguousarray(o_img)

        net.setInput(o_img)
        preds = net.forward().flatten()
        exp_preds = np.exp(preds - np.max(preds))
        probs = exp_preds / np.sum(exp_preds)
        
        best_id = np.argmax(probs)
        prediction = classes[best_id].split(',')[0].strip()
        prob = probs[best_id]
        end_classify = time.perf_counter()
        
        print(f"  Object Classifier: {prediction} ({prob*100:.1f}%) in {(end_classify - start_classify)*1000:.2f} ms")
        
        # 3. OCR Text Extraction
        start_ocr = time.perf_counter()
        ocr_results, _ = ocr_engine(img)
        end_ocr = time.perf_counter()
        
        print(f"  OCR Scan Time: {(end_ocr - start_ocr)*1000:.2f} ms")
        if ocr_results:
            print("  Extracted Text:")
            for res in ocr_results:
                try:
                    conf = f"{float(res[2]):.2f}"
                except Exception:
                    conf = str(res[2])
                print(f"    - {res[1]} (conf: {conf})")
        else:
            print("  No text detected.")

if __name__ == "__main__":
    run_ocr_detection_test()
