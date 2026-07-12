import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.database import SessionLocal, FileIndex, VirtualFolder, VirtualFolderFile
from backend.app.routes.virtual_folders import get_virtual_folder_files

def test():
    with SessionLocal() as s:
        # Clear tables first
        s.query(VirtualFolderFile).delete()
        s.query(VirtualFolder).delete()
        s.query(FileIndex).delete()
        s.commit()
        
        # Insert 3 dummy files
        files = [
            FileIndex(path="C:/songs/song1.mp3", filename="song1.mp3", category="audio", size="1000", extension=".mp3"),
            FileIndex(path="C:/songs/song2.mp3", filename="song2.mp3", category="audio", size="2000", extension=".mp3"),
            FileIndex(path="C:/photos/pic1.jpg", filename="pic1.jpg", category="photo", size="3000", extension=".jpg")
        ]
        s.add_all(files)
        s.commit()
        for f in files:
            s.refresh(f)
            
        print("Inserted files:")
        for f in files:
            print(f"ID: {f.id}, Path: {f.path}")
            
        # Create a Virtual Folder
        folder = VirtualFolder(name="Favorites", parent_id=None, is_dynamic=0, query=None, created_at="2026-07-05 12:00:00")
        s.add(folder)
        s.commit()
        s.refresh(folder)
        print(f"\nCreated Virtual Folder: ID: {folder.id}, Name: {folder.name}")
        
        # Link song1.mp3 and pic1.jpg manually
        assoc1 = VirtualFolderFile(virtual_folder_id=folder.id, file_id=files[0].id)
        assoc2 = VirtualFolderFile(virtual_folder_id=folder.id, file_id=files[2].id)
        s.add_all([assoc1, assoc2])
        s.commit()
        folder_id = folder.id
        print("\nCreated file associations.")

    # Call get_virtual_folder_files directly to see if it yields correct results!
    print("\n--- Querying Virtual Folder Files via get_virtual_folder_files endpoint ---")
    response = get_virtual_folder_files(folder_id=folder_id)
    
    import asyncio
    async def consume_generator(iterator):
        chunks = []
        async for chunk in iterator:
            if isinstance(chunk, bytes):
                chunks.append(chunk.decode("utf-8"))
            else:
                chunks.append(chunk)
        return "".join(chunks)
        
    content = asyncio.run(consume_generator(response.body_iterator))
    print(f"Result JSON: {content}")
    
    # Parse json and check length
    import json
    data = json.loads(content)
    print(f"Parsed array length: {len(data)}")
    assert len(data) == 2, f"Expected 2 files, got {len(data)}"
    print("TEST PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test()
