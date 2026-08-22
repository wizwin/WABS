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
            metadata_json=json.dumps({"date": "2021:06:15 10:00:00", "camera": "Sony A7III", "width": 1920, "height": 1080, "resolution": "1920x1080"})
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
            metadata_json=json.dumps({"date": "2023:10:25 14:30:00", "camera": "Canon R5", "width": 1080, "height": 1920, "resolution": "1080x1920"})
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
            metadata_json=json.dumps({"duration": 1800, "resolution": "4K", "width": 3840, "height": 2160}) # 30m = 1800s
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

        print("Test 21: aspect:landscape")
        res = _build_search_query("aspect:landscape", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 4], f"Expected files [1, 4], got {res_ids}"
        print("  -> Passed")

        print("Test 22: aspect:portrait")
        res = _build_search_query("aspect:portrait", session).all()
        assert len(res) == 1 and res[0].id == 2, f"Expected file 2, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 23: resolution:4k")
        res = _build_search_query("resolution:4k", session).all()
        assert len(res) == 1 and res[0].id == 4, f"Expected file 4, got {[r.id for r in res]}"
        print("  -> Passed")

        print("Test 24: resolution:>=1080p")
        res = _build_search_query("resolution:>=1080p", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 2, 4], f"Expected files [1, 2, 4], got {res_ids}"
        print("  -> Passed")

        print("Test 25: comma-separated person:john,jane")
        res = _build_search_query("person:john,jane", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 2], f"Expected files [1, 2], got {res_ids}"
        print("  -> Passed")

        print("Test 26: comma-separated type:audio,video")
        res = _build_search_query("type:audio,video", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [3, 4], f"Expected files [3, 4], got {res_ids}"
        print("  -> Passed")

        print("Test 27: search_suggestions tag:")
        sugg = search_suggestions("tag:fam")
        assert sugg["type"] == "tag" and any("family_trip" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

        print("Test 28: search_suggestions type:")
        sugg = search_suggestions("type:aud")
        assert sugg["type"] == "tag" and any("type:audio" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

        print("Test 29: search_suggestions aspect:")
        sugg = search_suggestions("aspect:land")
        assert sugg["type"] == "tag" and any("aspect:landscape" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

        print("Test 30: search_suggestions resolution:")
        sugg = search_suggestions("resolution:4")
        assert sugg["type"] == "tag" and any("resolution:4k" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

        print("Test 31: AI Query Sanitizer (Tiny LLM & Large LLM outputs)")
        from backend.app.routes.system import _sanitize_ai_search_query
        
        # Test markdown code block
        assert _sanitize_ai_search_query("```wabs\ntype:document tag:ocr Amazon date:2023\n```") == "type:document tag:ocr Amazon date:2023"
        # Test Query: prefix
        assert _sanitize_ai_search_query("Query: person:Alice object:pizza type:photo") == "person:Alice object:pizza type:photo"
        # Test Search Query: prefix
        assert _sanitize_ai_search_query("Search Query: type:video resolution:4k fps:>=60") == "type:video resolution:4k fps:>=60"
        # Test JSON object from tiny model
        assert _sanitize_ai_search_query('{"query": "rel:spouse object:dinner \\"New York\\""}') == 'rel:spouse object:dinner "New York"'
        # Test conversational preamble and trailing text
        assert _sanitize_ai_search_query("Here is the search query:\nperson:Alice person:Bob Tokyo\nThis query will find photos of Alice and Bob.") == "person:Alice person:Bob Tokyo"
        # Test quoted string
        assert _sanitize_ai_search_query('"*.pdf "deep learning" Python"') == '*.pdf "deep learning" Python'
        # Test clean string from large model
        assert _sanitize_ai_search_query("type:audio genre:jazz,rock artist:\"Miles Davis\" length:>5m") == 'type:audio genre:jazz,rock artist:"Miles Davis" length:>5m'
        print("Test 32: Model Awareness & Dynamic Prompt Tiering")
        from backend.app.routes.system import _is_tiny_model, _get_system_prompt
        assert _is_tiny_model("llama3.2:1b") is True
        assert _is_tiny_model("qwen2.5:1.5b") is True
        assert _is_tiny_model("phi3:mini") is True
        assert _is_tiny_model("gpt-4o") is False
        assert _is_tiny_model("claude-3-5-sonnet") is False

        compact = _get_system_prompt(is_tiny=True)
        extended = _get_system_prompt(is_tiny=False)
        assert len(compact) < len(extended)
        assert len(compact.split()) < 120 # Ultra-compact for small context windows
        print("  -> Passed")

        print("Test 33: category:family and rel:spouse relationships search")
        from backend.app.utils.paths import get_relationships_db_path
        from backend.app.relationships_database import init_relationships_database
        
        rel_db_path = get_relationships_db_path()
        init_relationships_database(rel_db_path)
        with sqlite3.connect(str(rel_db_path)) as rconn:
            rconn.execute("DELETE FROM persons")
            rconn.execute("DELETE FROM person_social")
            rconn.execute("DELETE FROM person_connections")
            
            # Person 1: John Doe (Parent / Dad)
            rconn.execute("INSERT INTO persons (id, name, is_me) VALUES (1, 'John Doe', 0)")
            rconn.execute("INSERT INTO person_social (person_id, category, subcategory, relation_label) VALUES (1, 'Family', 'Parent', 'Dad')")
            
            # Person 2: Jane Smith (Spouse / Wife)
            rconn.execute("INSERT INTO persons (id, name, is_me) VALUES (2, 'Jane Smith', 0)")
            rconn.execute("INSERT INTO person_social (person_id, category, subcategory, relation_label) VALUES (2, 'Family', 'Spouse', 'Wife')")
            
            # Person 3: Me (Primary User)
            rconn.execute("INSERT INTO persons (id, name, is_me) VALUES (3, 'Me', 1)")
            rconn.execute("INSERT INTO person_connections (person_id, related_person_id, relation_type) VALUES (3, 2, 'spouse')")
            rconn.commit()

        # Test category:family (matches John Doe in File 1 and Jane Smith in File 2)
        res = _build_search_query("category:family", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 2], f"Expected files [1, 2], got {res_ids}"

        # Test rel:spouse (matches Jane Smith in File 2)
        res = _build_search_query("rel:spouse", session).all()
        assert len(res) == 1 and res[0].id == 2, f"Expected file 2 (Jane Smith), got {[r.id for r in res]}"

        # Test rel:wife (synonym matches Jane Smith in File 2)
        res = _build_search_query("rel:wife", session).all()
        assert len(res) == 1 and res[0].id == 2, f"Expected file 2 (Jane Smith), got {[r.id for r in res]}"

        # Test combined category:family rel:spouse
        res = _build_search_query("category:family rel:spouse", session).all()
        assert len(res) == 1 and res[0].id == 2, f"Expected file 2 (Jane Smith), got {[r.id for r in res]}"

        # Test rel:dad (synonym matches John Doe in File 1)
        res = _build_search_query("rel:dad", session).all()
        assert len(res) == 1 and res[0].id == 1, f"Expected file 1 (John Doe), got {[r.id for r in res]}"

        # Test category:photo (matches standard file category photo for files 1 and 2)
        res = _build_search_query("category:photo", session).all()
        res_ids = sorted([r.id for r in res])
        assert res_ids == [1, 2], f"Expected files [1, 2], got {res_ids}"

        # Test suggestions for rel: and category:
        sugg = search_suggestions("rel:wi")
        assert sugg["type"] == "tag" and any("rel:wife" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        sugg = search_suggestions("category:fam")
        assert sugg["type"] == "tag" and any("category:family" in s for s in sugg["suggestions"]), f"Unexpected suggestions: {sugg}"
        print("  -> Passed")

    print("\nALL SEARCH PATTERN TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_search_patterns()
