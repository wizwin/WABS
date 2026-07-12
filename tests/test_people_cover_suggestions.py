import os
import sys
import sqlite3
import shutil
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.utils.paths import get_ai_db_path
from backend.app.database import SessionLocal, FileIndex, Base, engine

# Mock _evaluate_image_faces
import backend.app.routes.people as people_route
import backend.app.utils.media as media_utils

# Create dummy mock function
def mock_evaluate_image_faces(file_path, yunet_path):
    # Deterministic mock score: file_1 gets 100, file_2 gets 95, file_3 gets 90, file_4 gets 85, file_5 gets 80, file_6 gets 40
    # Files 1 to 5 will be in the top 50% candidate pool (scores >= 50). File 6 will be excluded.
    path_str = str(file_path)
    if "mock_file_1" in path_str:
        return [{"area": 10000, "sharpness": 1.0, "score": 100.0}]
    elif "mock_file_2" in path_str:
        return [{"area": 9000, "sharpness": 1.0, "score": 95.0}]
    elif "mock_file_3" in path_str:
        return [{"area": 8000, "sharpness": 1.0, "score": 90.0}]
    elif "mock_file_4" in path_str:
        return [{"area": 7000, "sharpness": 1.0, "score": 85.0}]
    elif "mock_file_5" in path_str:
        return [{"area": 6000, "sharpness": 1.0, "score": 80.0}]
    elif "mock_file_6" in path_str:
        return [{"area": 5000, "sharpness": 1.0, "score": 40.0}]
    return []

# Apply the mock
people_route._evaluate_image_faces = mock_evaluate_image_faces

def init_test_ai_db(ai_db_path):
    with sqlite3.connect(ai_db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS people (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT DEFAULT 'Unknown Person',
                            thumbnail_file_id INTEGER
                          )''')
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_people_name ON people(name)")
        cursor.execute('''CREATE TABLE IF NOT EXISTS faces (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            person_id INTEGER,
                            file_id INTEGER,
                            embedding_json TEXT,
                            FOREIGN KEY(person_id) REFERENCES people(id)
                        )''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_faces_person_file ON faces(person_id, file_id)")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_faces_unique ON faces(person_id, file_id, embedding_json)")
        cursor.execute('''CREATE TABLE IF NOT EXISTS processed_files (
                            file_id INTEGER PRIMARY KEY
                        )''')
        conn.commit()

def main():
    print("Initializing AI database...")
    ai_db_path = get_ai_db_path()
    os.makedirs(os.path.dirname(ai_db_path), exist_ok=True)
    init_test_ai_db(ai_db_path)
    
    print("Setting up mock database objects...")
    
    session = SessionLocal()
    
    mock_files = []
    # Clean up any previous test mock files from FileIndex
    session.query(FileIndex).filter(FileIndex.path.like("%mock_file_%")).delete(synchronize_session=False)
    session.commit()
    
    # Insert 6 mock files
    for i in range(1, 7):
        file_path = f"mock_file_{i}.jpg"
        p = Path(file_path)
        with open(p, "w") as f:
            f.write("mock")
        
        db_file = FileIndex(path=file_path)
        session.add(db_file)
        session.flush()
        mock_files.append(db_file)
    
    session.commit()
    
    file_ids = [f.id for f in mock_files]
    print(f"Created mock file records with IDs: {file_ids}")
    
    ai_db_path = get_ai_db_path()
    os.makedirs(os.path.dirname(ai_db_path), exist_ok=True)
    
    # Setup faces table for person_id = 999
    with sqlite3.connect(ai_db_path) as conn:
        cursor = conn.cursor()
        
        # Ensure person 999 exists in people table
        cursor.execute("INSERT OR IGNORE INTO people (id, name, thumbnail_file_id) VALUES (999, 'Mock Person', NULL)")
        
        # Delete any existing faces for person 999
        cursor.execute("DELETE FROM faces WHERE person_id = 999")
        
        # Insert faces with embedding_json = '[1]'
        for fid in file_ids:
            cursor.execute("INSERT INTO faces (file_id, person_id, embedding_json) VALUES (?, 999, '[1]')", (fid,))
            
        conn.commit()

    print("\nRunning auto_suggest_thumbnail multiple times for Mock Person (ID: 999)")
    
    selections = []
    current_thumb = None
    
    for i in range(1, 21):
        with sqlite3.connect(ai_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT thumbnail_file_id FROM people WHERE id = 999")
            current_thumb = cursor.fetchone()[0]
            
        res = people_route.auto_suggest_thumbnail(999)
        new_thumb = res["new_thumbnail_id"]
        score = res["score"]
        
        mock_idx = next(idx for idx, f in enumerate(mock_files, 1) if f.id == new_thumb)
        prev_idx = next((idx for idx, f in enumerate(mock_files, 1) if f.id == current_thumb), None)
        
        print(f"Iteration {i:02d}: Previous Cover: {prev_idx or 'None'} -> New Cover: {mock_idx} (Score: {score})")
        selections.append(mock_idx)
        
    print("\nTest statistics:")
    print(f"Total iterations: {len(selections)}")
    from collections import Counter
    counts = Counter(selections)
    print(f"Selection counts: {dict(counts)}")
    
    # Verify candidate 6 was never selected (since score 40 < 50% of 100)
    assert 6 not in selections, "ERROR: Candidate 6 (score 40) was selected, but it should be excluded (score < 50% of best)!"
    print("SUCCESS: Candidate 6 was correctly excluded from the candidate pool.")
    
    # Verify that we rotate (no adjacent items are the same)
    consecutive_matches = 0
    for j in range(len(selections) - 1):
        if selections[j] == selections[j+1]:
            consecutive_matches += 1
            
    print(f"Consecutive identical selections: {consecutive_matches}")
    assert consecutive_matches == 0, "ERROR: Thumbnail didn't change on consecutive clicks!"
    print("SUCCESS: Zero consecutive identical selections. The cover changes on every click!")
    
    # Clean up database and temp files
    session.query(FileIndex).filter(FileIndex.id.in_(file_ids)).delete(synchronize_session=False)
    session.commit()
    
    with sqlite3.connect(ai_db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM faces WHERE person_id = 999")
        cursor.execute("DELETE FROM people WHERE id = 999")
        conn.commit()
        
    for i in range(1, 7):
        p = Path(f"mock_file_{i}.jpg")
        if p.exists():
            p.unlink()
            
    print("\nAll cleanup finished. Tests passed successfully!")

if __name__ == "__main__":
    main()
