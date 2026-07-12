import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.database import SessionLocal, FileIndex, VirtualFolder, VirtualFolderFile
from backend.app.routes.virtual_folders import delete_folder_recursive

def test_virtual_folder_crud():
    with SessionLocal() as s:
        # Clear tables
        s.query(VirtualFolderFile).delete()
        s.query(VirtualFolder).delete()
        s.query(FileIndex).delete()
        s.commit()
        
        # Insert files
        f1 = FileIndex(path="C:/songs/song1.mp3", filename="song1.mp3", category="audio", size="1000", extension=".mp3")
        f2 = FileIndex(path="C:/photos/pic1.jpg", filename="pic1.jpg", category="photo", size="3000", extension=".jpg")
        s.add_all([f1, f2])
        s.commit()
        s.refresh(f1)
        s.refresh(f2)
        
        # Create Root Folder
        root = VirtualFolder(name="RootFolder", parent_id=None, is_dynamic=0, query=None)
        s.add(root)
        s.commit()
        s.refresh(root)
        
        # Create Subfolder
        sub = VirtualFolder(name="SubFolder", parent_id=root.id, is_dynamic=0, query=None)
        s.add(sub)
        s.commit()
        s.refresh(sub)
        
        # Associate file to Subfolder
        assoc = VirtualFolderFile(virtual_folder_id=sub.id, file_id=f1.id)
        s.add(assoc)
        s.commit()
        
        # Verify setup
        all_folders = s.query(VirtualFolder).all()
        assert len(all_folders) == 2, "Should have 2 virtual folders"
        
        # Recursive delete parent folder
        delete_folder_recursive(s, root.id)
        s.commit()
        
        # Check that child folder was recursively deleted
        remaining_folders = s.query(VirtualFolder).all()
        assert len(remaining_folders) == 0, "All folders should be deleted after recursive deletion"
        
        # Check that file association was also deleted
        remaining_assocs = s.query(VirtualFolderFile).all()
        assert len(remaining_assocs) == 0, "All file associations should be deleted"
        
        print("CRUD AND RECURSIVE DELETION TEST PASSED!")

def test_cycle_safe_deletion_and_copy():
    with SessionLocal() as s:
        # Clear tables
        s.query(VirtualFolderFile).delete()
        s.query(VirtualFolder).delete()
        s.commit()

        # Create two folders
        f1 = VirtualFolder(name="Loop1", parent_id=None)
        s.add(f1)
        s.commit()
        s.refresh(f1)

        f2 = VirtualFolder(name="Loop2", parent_id=f1.id)
        s.add(f2)
        s.commit()
        s.refresh(f2)

        # Intentionally introduce a cycle in database (f1 parent set to f2)
        f1.parent_id = f2.id
        s.commit()

        # Test that recursive delete is cycle-safe and terminates
        delete_folder_recursive(s, f1.id)
        s.commit()

        remaining = s.query(VirtualFolder).all()
        # Should delete f1 and f2 cleanly
        assert len(remaining) == 0, "Circular loop folders should be deleted successfully"
        print("CYCLE SAFE DELETION TEST PASSED!")

if __name__ == "__main__":
    test_virtual_folder_crud()
    test_cycle_safe_deletion_and_copy()
