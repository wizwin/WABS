import sys
import numpy as np
import json
import time

def simulate_exemplar_curation():
    print("=== Simulating Optimized In-Memory Curation ===")
    
    # Generate 100 mock face embeddings (128D vectors)
    # To simulate age/expression variations, we will base them on 4 distinct templates
    templates = np.random.randn(4, 128)
    templates = templates / np.linalg.norm(templates, axis=1, keepdims=True)
    
    known_rows = []
    for i in range(100):
        # Choose a template and add some random noise
        template_idx = i % 4
        noise = np.random.randn(128) * 0.15
        vec = templates[template_idx] + noise
        vec = vec / np.linalg.norm(vec)
        
        # Add mock fields: face_id, file_id, embedding_json
        known_rows.append((i, i // 2, json.dumps(vec.tolist())))
        
    start_time = time.perf_counter()
    
    # ----------------------------------------------------
    # START ALGORITHM UNDER TEST
    # ----------------------------------------------------
    all_faces_info = []
    for face_id, file_id, emb_json in known_rows:
        try:
            emb = json.loads(emb_json)
            if emb and len(emb) == 128:
                all_faces_info.append({
                    "face_id": face_id,
                    "file_id": file_id,
                    "embedding": emb
                })
        except Exception:
            continue
            
    assert len(all_faces_info) == 100
    
    embs_matrix = np.array([f["embedding"] for f in all_faces_info], dtype=np.float32)
    
    # Calculate centroid
    centroid = np.mean(embs_matrix, axis=0)
    centroid_norm = centroid / (np.linalg.norm(centroid) or 1.0)
    
    # Calculate similarities
    norms = np.linalg.norm(embs_matrix, axis=1, keepdims=True)
    embs_matrix_normalized = embs_matrix / np.where(norms == 0, 1.0, norms)
    similarities = np.dot(embs_matrix_normalized, centroid_norm)
    
    # Sort indices
    sorted_indices = np.argsort(similarities)[::-1]
    
    selected_embeddings = []
    # 1. Add centroid
    selected_embeddings.append(centroid_norm.tolist())
    
    # 2. Add top 8 typical
    added_typical = set()
    for idx in sorted_indices:
        if len(selected_embeddings) >= 9:
            break
        face_id = all_faces_info[idx]["face_id"]
        selected_embeddings.append(all_faces_info[idx]["embedding"])
        added_typical.add(face_id)
        
    # 3. Add 6 extreme/diverse
    added_extreme_count = 0
    for idx in reversed(sorted_indices):
        if added_extreme_count >= 6:
            break
        face_id = all_faces_info[idx]["face_id"]
        if face_id in added_typical:
            continue
        if similarities[idx] >= 0.35:
            selected_embeddings.append(all_faces_info[idx]["embedding"])
            added_extreme_count += 1
            
    # 4. Add 10 timeline-distributed (mock date dictionary)
    file_dates = {i: f"2026-06-{str(i).zfill(2)}T12:00:00" for i in range(50)}
    for f in all_faces_info:
        f["date"] = file_dates.get(f["file_id"], "")
        
    all_faces_info_sorted = sorted(all_faces_info, key=lambda x: x["date"])
    total_sorted = len(all_faces_info_sorted)
    if total_sorted > 0:
        indices = np.linspace(0, total_sorted - 1, min(10, total_sorted), dtype=int)
        for idx in indices:
            emb = all_faces_info_sorted[idx]["embedding"]
            if emb not in selected_embeddings:
                selected_embeddings.append(emb)
                
    # Fill up to 25 if needed
    for f in all_faces_info:
        if len(selected_embeddings) >= 25:
            break
        if f["embedding"] not in selected_embeddings:
            selected_embeddings.append(f["embedding"])
            
    known_embeddings = selected_embeddings[:25]
    # ----------------------------------------------------
    # END ALGORITHM UNDER TEST
    # ----------------------------------------------------
    
    end_time = time.perf_counter()
    duration_ms = (end_time - start_time) * 1000
    
    print(f"Curation completed in: {duration_ms:.3f} ms")
    print(f"Number of reference embeddings: {len(known_embeddings)}")
    assert len(known_embeddings) == 25, "Must select exactly 25 embeddings"
    assert len(known_embeddings[0]) == 128, "Embeddings must be 128-dimensional"
    
    print("All mock exemplar curation assertions passed!")

if __name__ == '__main__':
    simulate_exemplar_curation()
