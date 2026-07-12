import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def debug_all_dbs():
    root = Path("e:/SDE/Projects/GenAI/WABS")
    db_files = list(root.glob("**/archive.db")) + list(root.glob("**/*.db"))
    # unique files
    db_files = list(set(db_files))
    
    print(f"Found DB files: {db_files}")
    for db_path in db_files:
        print(f"\n=========================================")
        print(f"INSPECTING DATABASE: {db_path}")
        print(f"=========================================")
        try:
            engine = create_engine(f"sqlite:///{db_path}")
            Session = sessionmaker(bind=engine)
            with Session() as s:
                # Check tables
                tables = [row[0] for row in s.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).all()]
                print(f"Tables in DB: {tables}")
                
                if "virtual_folders" in tables:
                    folders = s.execute(text("SELECT id, name, query, is_dynamic FROM virtual_folders")).all()
                    print(f"--- VIRTUAL FOLDERS ({len(folders)}) ---")
                    for f in folders:
                        print(f"ID: {f[0]}, Name: {f[1]}, Query: {f[2]}, IsDynamic: {f[3]}")
                else:
                    print("No virtual_folders table found.")
                    
                if "virtual_folder_files" in tables:
                    assocs = s.execute(text("SELECT virtual_folder_id, file_id FROM virtual_folder_files")).all()
                    print(f"--- ASSOCIATIONS ({len(assocs)}) ---")
                    for a in assocs:
                        # Get path
                        path = s.execute(text("SELECT path FROM files WHERE id = :id"), {"id": a[1]}).scalar()
                        print(f"Folder ID: {a[0]}, File ID: {a[1]}, Path: {path}")
                else:
                    print("No virtual_folder_files table found.")
        except Exception as e:
            print(f"Failed to inspect DB {db_path}: {e}")

if __name__ == "__main__":
    debug_all_dbs()
