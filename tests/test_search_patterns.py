import sys
import json
import os
import tempfile
import sqlite3
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database import SessionLocal, FileIndex, Base, engine
from backend.app.utils.search import _build_search_query, _tokenize_search_query
from backend.app.routes.search import search_suggestions

def setup_test_data(session):
    # Clear existing file index records for clean test run
    session.query(FileIndex).delete()
    session.commit()
    
    test_files = [
        FileIndex(
            id=1,
            path="C:/photos/vacation_car.jpg",
            filename="vacation_car.jpg",
            category="photo",
            size=str(200 * 1024 * 1024), # 200 MB
            modified="2021-06-15 10:00:00",
            extension=".jpg",
            tags="object:car,tag:family_trip,person:John Doe",
            metadata_json=json.dumps({"date": "2021:06:15 10:00:00", "camera": "Sony A7III"})
        ),
        FileIndex(
            id=2,
            path="C:/photos/vacation_beach.png",
            filename="vacation_beach.png",
            category="photo",
            size=str(50 * 1024 * 1024), # 50 MB
            modified="2023-10-25 14:30:00",
            extension=".png",
            tags="object:beach,tag:blur,person:Jane Smith",
            metadata_json=json.dumps({"date": "2023:10:25 14:30:00", "camera": "Canon R5"})
        ),
        FileIndex(
            id=3,
            path="C:/music/summer_song.mp3",
            filename="summer_song.mp3",
            category="audio",
            size=str(10 * 1024 * 1024), # 10 MB
            modified="2022-08-01 12:00:00",
            extension=".mp3",
            tags="tag:summer,genre:pop",
            metadata_json=json.dumps({"duration": 600, "artist": "The Artist", "genre": "Pop"}) # 10m = 600s
        ),
        FileIndex(
            id=4,
            path="C:/videos/road_trip.mp4",
            filename="road_trip.mp4",
            category="video",
            size=str(6 * 1024 * 1024 * 1024), # 6 GB
            modified="2020-03-10 09:00:00",
            extension=".mp4",
            tags="object:car,tag:travel",
            metadata_json=json.dumps({"duration": 1800, "resolution": "4K"}) # 30m = 1800s
        ),
        FileIndex(
            id=5,
            path="C:/docs/report_2024.pdf",
            filename="report_2024.pdf",
            category="document",
            size=str(2 * 1024 * 1024), # 2 MB
            modified="2024-01-10 08:00:00",
            extension=".pdf",
            tags="tag:work",
            metadata_json=json.dumps({"date": "2024-01-10"})
        ),
    ]
    
    for f in test_files:
        session.add(f)
    session.commit()

def test_search_patterns():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        setup_test_data(session)
        
        print("Test 1: type:audio")
        res = _build_search_query("type:audio", session).all()
        assert len(res) == 1 and res[0].id == 3, f"Expected file 3, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 2: type:mp3")
        res = _build_search_query("type:mp3", session).all()
        assert len(res) == 1 and res[0].id == 3, f"Expected file 3, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 3: object:car")
        res = _build_search_query("object:car", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 4], f"Expected files [1, 4], got {res_ids}"
        print("  -> Passed")

        print("Test 4: person:\"john doe\"")
        res = _build_search_query('person:"john doe"', session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 5: person:john")
        res = _build_search_query('person:john', session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 6: tag:family_trip")
        res = _build_search_query("tag:family_trip", session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 7: size:>100MB, <5GB")
        res = _build_search_query("size:>100MB, <5GB", session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1 (200MB), got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 8: size:>100MB <5GB")
        res = _build_search_query("size:>100MB <5GB", session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1 (200MB), got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 9: size:100MB-5GB")
        res = _build_search_query("size:100MB-5GB", session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1 (200MB), got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 10: length:>5m, <1h (duration)")
        res = _build_search_query("length:>5m, <1h", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [3, 4], f"Expected files [3, 4] (10m and 30m), got {res_ids}"
        print("  -> Passed")

        print("Test 11: length:>15m")
        res = _build_search_query("length:>15m", session).all()
        assert len(res) == 1 and res[0].id == 4, f"Expected file 4 (30m), got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 12: date:2020-2022, 2023-10-25")
        res = _build_search_query("date:2020-2022, 2023-10-25", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 2, 3, 4], f"Expected files [1, 2, 3, 4], got {res_ids}"
        print("  -> Passed")

        print("Test 13: date:2023-10-25")
        res = _build_search_query("date:2023-10-25", session).all()
        assert len(res) == 1 and res[0].id == 2, f"Expected file 2, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 14: *.mp3 wildcard")
        res = _build_search_query("*.mp3", session).all()
        assert len(res) == 1 and res[0].id == 3, f"Expected file 3, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 15: *vacation* wildcard")
        res = _build_search_query("*vacation*", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 2], f"Expected files [1, 2], got {res_ids}"
        print("  -> Passed")

        print("Test 16: Combine object:car -tag:blur")
        res = _build_search_query("object:car -tag:blur", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 4], f"Expected files [1, 4], got {res_ids}"
        print("  -> Passed")

        print("Test 17: Combine +object:car +type:photo")
        res = _build_search_query("+object:car +type:photo", session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 18: Match Any spaces (song beach)")
        res = _build_search_query("song beach", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [2, 3], f"Expected files [2, 3], got {res_ids}"
        print("  -> Passed")

        print("Test 19: Exclude -size:>100MB")
        res = _build_search_query("-size:>100MB", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [2, 3, 5], f"Expected files [2, 3, 5], got {res_ids}"
        print("  -> Passed")

        print("Test 20: Exclude -type:video")
        res = _build_search_query("-type:video", session).all()
        res_ids = sorted([r.id for r in res])
        assert 4 not in res_ids and len(res_ids) == 4, f"Expected files without file 4, got {res_ids}"
        print("  -> Passed")

        print("Test 21: search_suggestions tag:")
        sugg = search_suggestions("tag:fam")
        assert sugg["type"] == "tag" and any("family_trip" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

        print("Test 22: search_suggestions type:")
        sugg = search_suggestions("type:aud")
        assert sugg["type"] == "tag" and any("type:audio" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

    print("\nALL SEARCH PATTERN TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_search_patterns()
