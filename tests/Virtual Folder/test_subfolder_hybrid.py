import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.database import SessionLocal, FileIndex, VirtualFolder, VirtualFolderFile
from backend.app.routes.virtual_folders import get_virtual_folder_files

def test_hybrid_subfolder():
    with SessionLocal() as s:
        # Clear tables
        s.query(VirtualFolderFile).delete()
        s.query(VirtualFolder).delete()
        s.query(FileIndex).delete()
        s.commit()
        
        # Insert files:
        # File 1: audio file (mp3)
        # File 2: photo file (jpg)
        f1 = FileIndex(path="C:/songs/song1.mp3", filename="song1.mp3", category="audio", size="1000", extension=".mp3")
        f2 = FileIndex(path="C:/photos/pic1.jpg", filename="pic1.jpg", category="photo", size="3000", extension=".jpg")
        s.add_all([f1, f2])
        s.commit()
        s.refresh(f1)
        s.refresh(f2)
        
        # Create parent folder
        parent = VirtualFolder(name="ParentFolder", parent_id=None, is_dynamic=0, query=None, created_at="2026-07-05 12:00:00")
        s.add(parent)
        s.commit()
        s.refresh(parent)
        
        # Create subfolder with dynamic filter matching jpg (category:photo or extension:.jpg)
        # Wait, the user added a dynamic search filter.
        sub = VirtualFolder(name="SubFolder", parent_id=parent.id, is_dynamic=1, query="type:.jpg", created_at="2026-07-05 12:00:00")
        s.add(sub)
        s.commit()
        s.refresh(sub)
        
        # Now, manually associate f1 (the mp3 file, which does NOT match extension:.jpg) to the subfolder
        assoc = VirtualFolderFile(virtual_folder_id=sub.id, file_id=f1.id)
        s.add(assoc)
        s.commit()
        
        sub_id = sub.id
        f1_id = f1.id
        f2_id = f2.id

    # Call get_virtual_folder_files on the subfolder
    response = get_virtual_folder_files(folder_id=sub_id, category="all")
    
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
    
    import json
    data = json.loads(content)
    returned_ids = [file["id"] for file in data]
    print(f"Returned IDs: {returned_ids}")
    print(f"Manual File ID: {f1_id}, Dynamic File ID: {f2_id}")
    
    assert f1_id in returned_ids, "Manual file should be in returned files!"
    assert f2_id in returned_ids, "Dynamic file should be in returned files!"
    print("HYBRID TEST PASSED!")

if __name__ == "__main__":
    test_hybrid_subfolder()
