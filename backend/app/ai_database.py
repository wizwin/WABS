import sqlite3
import os

def init_ai_database(ai_db_path="ai_metadata.db"):
    """
    Initializes the sidecar database for AI metadata (Facial Recognition).
    This keeps the main WABS database completely untouched.
    """
    # Connect to the sidecar database (creates it if it doesn't exist)
    conn = sqlite3.connect(ai_db_path)
    cursor = conn.cursor()
    
    # ==========================================
    # TABLE: faces
    # ==========================================
    # We DO NOT use a strict FOREIGN KEY constraint for file_id here because 
    # SQLite cannot enforce foreign keys across attached databases. We rely 
    # on logical matching between wabs.db (files.id) and ai_metadata.db (faces.file_id).
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS faces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            bounding_box TEXT,
            encoding BLOB,
            person_id INTEGER
        )
    ''')
    
    # ==========================================
    # TABLE: people
    # ==========================================
    # Stores the clusters of unique individuals found across the archive.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Unknown Person',
            cover_face_id INTEGER
        )
    ''')
    
    # ==========================================
    # INDICES (For Performance)
    # ==========================================
    # Create indices for faster lookups when joining with the main database
    # or querying all faces belonging to a specific person.
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_faces_file_id ON faces(file_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_faces_person_id ON faces(person_id)')

    # Ensure processed_objects table exists for backwards compatibility with older indices
    cursor.execute('CREATE TABLE IF NOT EXISTS processed_objects (file_id INTEGER PRIMARY KEY)')

    conn.commit()
    conn.close()