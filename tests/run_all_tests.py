import subprocess
import sys
from pathlib import Path

def run_all_tests():
    print("==================================================")
    print("WABS Test Runner - Executing all test suites")
    print("==================================================")
    
    tests_dir = Path(__file__).resolve().parent
    
    # List of test scripts in execution order (dependencies and core tests first)
    test_scripts = [
        tests_dir / "test_shutdown.py",
        tests_dir / "release_diagnostic.py",
        tests_dir / "Virtual Folder" / "test_virtual_folders_crud.py",
        tests_dir / "Virtual Folder" / "test_subfolder_hybrid.py",
        tests_dir / "Virtual Folder" / "test_asynchronous_export.py",
        tests_dir / "test_offset.py",
        tests_dir / "OCR" / "test_ocr_detection.py",
        tests_dir / "test_face_exemplar.py",
        tests_dir / "test_people_import_export.py",
        tests_dir / "test_people_cover_suggestions.py",
    ]
    
    passed_tests = []
    failed_tests = []
    
    for script in test_scripts:
        if not script.exists():
            print(f"Skipping (not found): {script.name}")
            continue
            
        print(f"\nRunning: {script.relative_to(tests_dir.parent)}")
        print("-" * 50)
        
        # Run test script as a subprocess using the current interpreter
        proc = subprocess.run([sys.executable, str(script)], cwd=str(tests_dir.parent))
        
        if proc.returncode == 0:
            print("-" * 50)
            print(f"PASS: {script.name}")
            passed_tests.append(script.name)
        else:
            print("-" * 50)
            print(f"FAIL: {script.name} (exit code: {proc.returncode})")
            failed_tests.append(script.name)
            
    print("\n==================================================")
    print("Test Suite Summary:")
    print("==================================================")
    print(f"Passed: {len(passed_tests)}")
    for t in passed_tests:
        print(f"  [PASS] {t}")
        
    print(f"Failed: {len(failed_tests)}")
    for t in failed_tests:
        print(f"  [FAIL] {t}")
        
    print("==================================================")
    
    if failed_tests:
        print("FAIL: One or more tests failed.")
        sys.exit(1)
    else:
        print("SUCCESS: All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    run_all_tests()
