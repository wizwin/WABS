import sqlite3
import json
import struct
import base64
import random

def test_roundtrip():
    print("Starting Face Export/Import optimization verification...")

    # 1. Generate a mock 128-dimensional embedding
    original_embedding = [random.uniform(-1.0, 1.0) for _ in range(128)]
    embedding_json_str = json.dumps(original_embedding)
    print(f"Original JSON array length: {len(embedding_json_str)} characters")

    # 2. Simulate Export logic (pack to float32, encode to Base64)
    packed = struct.pack(f"{len(original_embedding)}f", *original_embedding)
    b64_encoded = base64.b64encode(packed).decode("ascii")
    print(f"Base64 encoded float32 length: {len(b64_encoded)} characters")
    
    # Assert size reduction is ~72%
    savings = (len(embedding_json_str) - len(b64_encoded)) / len(embedding_json_str) * 100
    print(f"Size savings: {savings:.2f}%")
    assert len(b64_encoded) == 684, f"Expected 684 chars, got {len(b64_encoded)}"

    # 3. Simulate Import logic (decode Base64, unpack float32, verify)
    decoded_bytes = base64.b64decode(b64_encoded)
    num_floats = len(decoded_bytes) // 4
    unpacked_embedding = list(struct.unpack(f"{num_floats}f", decoded_bytes))

    # Assert floats match close to float32 precision
    for orig, unp in zip(original_embedding, unpacked_embedding):
        assert abs(orig - unp) < 1e-6, f"Precision mismatch: {orig} vs {unp}"
    print("Embeddings match perfectly within float32 precision limits!")

    # 4. Simulate SQLite integrations for import and export
    # Create an in-memory db simulating AI DB and WABS files DB
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    
    # Create schema
    cursor.execute("CREATE TABLE files (id INTEGER PRIMARY KEY, path TEXT UNIQUE, tags TEXT)")
    cursor.execute("CREATE TABLE people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, thumbnail_file_id INTEGER)")
    cursor.execute("CREATE TABLE faces (id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER, file_id INTEGER, embedding_json TEXT)")
    
    # Insert a mock file
    file_path = "C:/photos/face_image.jpg"
    cursor.execute("INSERT INTO files (id, path, tags) VALUES (1, ?, '')", (file_path,))
    
    # Insert person and face into source DB state
    cursor.execute("INSERT INTO people (name, thumbnail_file_id) VALUES ('Alice Smith', 1)")
    person_id = cursor.lastrowid
    cursor.execute("INSERT INTO faces (person_id, file_id, embedding_json) VALUES (?, 1, ?)", (person_id, embedding_json_str))
    
    conn.commit()

    # Simulate /system/export-people database query and serialization
    cursor.execute("SELECT id, name, thumbnail_file_id FROM people WHERE name NOT LIKE 'Unknown Person%'")
    people_rows = cursor.fetchall()
    
    export_data = []
    for pid, name, thumb_id in people_rows:
        thumb_path = None
        if thumb_id:
            # Look up path
            cursor.execute("SELECT path FROM files WHERE id = ?", (thumb_id,))
            row = cursor.fetchone()
            if row:
                thumb_path = row[0]
                
        cursor.execute("SELECT file_id, embedding_json FROM faces WHERE person_id = ?", (pid,))
        faces = []
        for fid, emb_json in cursor.fetchall():
            cursor.execute("SELECT path FROM files WHERE id = ?", (fid,))
            frow = cursor.fetchone()
            if frow:
                # Pack to base64
                floats = json.loads(emb_json)
                packed_emb = struct.pack(f"{len(floats)}f", *floats)
                emb_b64 = base64.b64encode(packed_emb).decode("ascii")
                faces.append({"path": frow[0], "embedding": emb_b64})
        if faces:
            export_data.append({"name": name, "thumbnail_path": thumb_path, "faces": faces})

    print("Export data generated successfully:")
    print(json.dumps(export_data, indent=2))
    assert export_data[0]["name"] == "Alice Smith"
    assert export_data[0]["thumbnail_path"] == file_path
    assert export_data[0]["faces"][0]["path"] == file_path
    assert export_data[0]["faces"][0]["embedding"] == b64_encoded

    # Clear people and faces table to simulate fresh import
    cursor.execute("DELETE FROM faces")
    cursor.execute("DELETE FROM people")
    cursor.execute("UPDATE files SET tags = ''")
    conn.commit()

    # Simulate /system/import-people route with payload
    payload = export_data
    path_cache = {}
    
    for person_data in payload:
        name = person_data.get("name")
        cursor.execute("INSERT OR IGNORE INTO people (name) VALUES (?)", (name,))
        cursor.execute("SELECT id FROM people WHERE name = ?", (name,))
        person_id = cursor.fetchone()[0]
        
        faces = person_data.get("faces", [])
        for face in faces:
            path = face.get("path")
            embedding_data = face.get("embedding")
            
            # cache lookup
            if path not in path_cache:
                cursor.execute("SELECT id FROM files WHERE path = ?", (path,))
                row = cursor.fetchone()
                path_cache[path] = row[0] if row else None
            
            file_id = path_cache[path]
            if not file_id:
                continue
                
            # Decode
            decoded = base64.b64decode(embedding_data)
            num_floats = len(decoded) // 4
            unpacked = struct.unpack(f"{num_floats}f", decoded)
            imported_emb_json = json.dumps(list(unpacked))
            
            cursor.execute("INSERT OR IGNORE INTO faces (person_id, file_id, embedding_json) VALUES (?, ?, ?)", (person_id, file_id, imported_emb_json))
            
            # Tag file
            cursor.execute("SELECT tags FROM files WHERE id = ?", (file_id,))
            tags_str = cursor.fetchone()[0]
            current_tags = set((tags_str or "").split())
            new_tag = f"person:{name}"
            if new_tag not in current_tags:
                current_tags.add(new_tag)
                updated_tags = " ".join(sorted(current_tags))
                cursor.execute("UPDATE files SET tags = ? WHERE id = ?", (updated_tags, file_id))

        thumb_path = person_data.get("thumbnail_path")
        if thumb_path:
            if thumb_path not in path_cache:
                cursor.execute("SELECT id FROM files WHERE path = ?", (thumb_path,))
                row = cursor.fetchone()
                path_cache[thumb_path] = row[0] if row else None
            
            thumb_fid = path_cache[thumb_path]
            if thumb_fid:
                cursor.execute("UPDATE people SET thumbnail_file_id = ? WHERE id = ?", (thumb_fid, person_id))

    conn.commit()

    # Verify the imported data
    cursor.execute("SELECT id, name, thumbnail_file_id FROM people")
    p_rows = cursor.fetchall()
    assert len(p_rows) == 1
    assert p_rows[0][1] == "Alice Smith"
    assert p_rows[0][2] == 1

    cursor.execute("SELECT person_id, file_id, embedding_json FROM faces")
    f_rows = cursor.fetchall()
    assert len(f_rows) == 1
    assert f_rows[0][0] == p_rows[0][0] # correct person_id
    assert f_rows[0][1] == 1
    
    # Assert floats match
    imported_floats = json.loads(f_rows[0][2])
    for orig, imp in zip(original_embedding, imported_floats):
        assert abs(orig - imp) < 1e-6

    # Verify tagging
    cursor.execute("SELECT tags FROM files WHERE id = 1")
    tags_row = cursor.fetchone()
    assert tags_row[0] == "person:Alice Smith"

    print("Verification completed successfully! All assertions passed!")
    conn.close()

if __name__ == "__main__":
    test_roundtrip()
