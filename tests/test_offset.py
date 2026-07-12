import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database import SessionLocal, FileIndex, VirtualFolder, VirtualFolderFile
from backend.app.routes.files import get_file_offset

def test_file_offsets():
    with SessionLocal() as s:
        # Clear tables
        s.query(VirtualFolderFile).delete()
        s.query(VirtualFolder).delete()
        s.query(FileIndex).delete()
        s.commit()
        
        # Insert files
        fA = FileIndex(path="C:/photos/picA.jpg", filename="picA.jpg", category="photo", size="100", modified="2026-07-01 10:00:00", extension=".jpg")
        fB = FileIndex(path="C:/photos/picB.jpg", filename="picB.jpg", category="photo", size="200", modified="2026-07-02 10:00:00", extension=".jpg")
        fC = FileIndex(path="C:/photos/picC.jpg", filename="picC.jpg", category="photo", size="300", modified="2026-07-03 10:00:00", extension=".jpg")
        s.add_all([fA, fB, fC])
        s.commit()
        
        s.refresh(fA)
        s.refresh(fB)
        s.refresh(fC)
        
        idA, idB, idC = fA.id, fB.id, fC.id

    # 1. Size ascending: expected order A, B, C
    assert get_file_offset(file_id=idA, sort_by="size", sort_order="asc")["offset"] == 0
    assert get_file_offset(file_id=idB, sort_by="size", sort_order="asc")["offset"] == 1
    assert get_file_offset(file_id=idC, sort_by="size", sort_order="asc")["offset"] == 2

    # 2. Size descending: expected order C, B, A
    assert get_file_offset(file_id=idC, sort_by="size", sort_order="desc")["offset"] == 0
    assert get_file_offset(file_id=idB, sort_by="size", sort_order="desc")["offset"] == 1
    assert get_file_offset(file_id=idA, sort_by="size", sort_order="desc")["offset"] == 2

    # 3. Date ascending: expected order A, B, C
    assert get_file_offset(file_id=idA, sort_by="date", sort_order="asc")["offset"] == 0
    assert get_file_offset(file_id=idB, sort_by="date", sort_order="asc")["offset"] == 1
    assert get_file_offset(file_id=idC, sort_by="date", sort_order="asc")["offset"] == 2

    # 4. Date descending: expected order C, B, A
    assert get_file_offset(file_id=idC, sort_by="date", sort_order="desc")["offset"] == 0
    assert get_file_offset(file_id=idB, sort_by="date", sort_order="desc")["offset"] == 1
    assert get_file_offset(file_id=idA, sort_by="date", sort_order="desc")["offset"] == 2

    print("ALL OFFSET TESTS PASSED!")

if __name__ == "__main__":
    test_file_offsets()
