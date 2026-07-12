import subprocess
import time
import urllib.request
import urllib.error
import json
import sys
from pathlib import Path

def run_diagnostic():
    print("==================================================")
    # Resolve the project root directory
    root_dir = Path(__file__).resolve().parent.parent
    venv_python = root_dir / "venv" / "Scripts" / "python.exe"
    
    print(f"Starting WABS python server on diagnostic port 8012...")
    cmd = [str(venv_python), "run.py", "--no-browser", "--port", "8012"]
    
    proc = subprocess.Popen(
        cmd,
        cwd=str(root_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for startup
    print("Waiting 5 seconds for server to start...")
    time.sleep(5)
    
    # Check if process is still running
    if proc.poll() is not None:
        print("FAIL: Server failed to start or exited immediately.")
        stdout, stderr = proc.communicate()
        print(f"STDOUT:\n{stdout}")
        print(f"STDERR:\n{stderr}")
        sys.exit(1)
        
    print("Server started successfully.")
    
    # Run tests against port 8012
    base_url = "http://127.0.0.1:8012"
    
    def api_request(path, method="GET", data=None):
        url = f"{base_url}{path}"
        req_data = json.dumps(data).encode("utf-8") if data is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                body = response.read().decode("utf-8")
                return response.getcode(), json.loads(body) if body else None
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            try:
                err_data = json.loads(body)
            except Exception:
                err_data = body
            return e.code, err_data
        except Exception as e:
            return 500, str(e)

    try:
        # Test 1: Get Directories
        code, dirs = api_request("/directories")
        print(f"Test 1: GET /directories -> Response Code: {code}")
        if code == 200:
            print(f"SUCCESS: Directories count = {len(dirs)}")
            # Check for empty string in directories
            if "" in dirs:
                print("WARNING: Empty string found in directories list!")
        else:
            print(f"FAIL: GET /directories failed: {dirs}")

        # Test 2: Create Parent Virtual Folder
        folder_data = {"name": "DiagParent", "is_dynamic": False}
        code, parent_folder = api_request("/virtual-folders", "POST", folder_data)
        print(f"Test 2: POST /virtual-folders (Parent) -> Response Code: {code}")
        if code == 200:
            print(f"SUCCESS: Created folder '{parent_folder['name']}' with ID {parent_folder['id']}")
            parent_id = parent_folder['id']
        else:
            print(f"FAIL: Create parent folder failed: {parent_folder}")
            parent_id = None

        # Test 3: Create Subfolder
        if parent_id:
            subfolder_data = {"name": "DiagChild", "parent_id": parent_id, "is_dynamic": False}
            code, child_folder = api_request("/virtual-folders", "POST", subfolder_data)
            print(f"Test 3: POST /virtual-folders (Child) -> Response Code: {code}")
            if code == 200:
                print(f"SUCCESS: Created child folder '{child_folder['name']}' with ID {child_folder['id']}")
                child_id = child_folder['id']
            else:
                print(f"FAIL: Create child folder failed: {child_folder}")
                child_id = None
        else:
            child_id = None

        # Test 4: Get folder list and subfolder counts
        code, folders = api_request("/virtual-folders")
        print(f"Test 4: GET /virtual-folders -> Response Code: {code}")
        if code == 200:
            parent_info = next((f for f in folders if f['id'] == parent_id), None)
            if parent_info:
                print(f"SUCCESS: Parent folder subfolder_count = {parent_info['subfolder_count']}")
                if parent_info['subfolder_count'] != 1:
                    print(f"FAIL: Expected subfolder_count = 1, got {parent_info['subfolder_count']}")
            else:
                print("FAIL: Created parent folder not returned in list.")
        else:
            print(f"FAIL: GET /virtual-folders failed: {folders}")

        # Test 5: Verify Cycle Vulnerability
        if parent_id and child_id:
            # Try to set parent_id of parent_folder to child_id
            update_data = {"parent_id": child_id}
            code, update_res = api_request(f"/virtual-folders/{parent_id}", "PUT", update_data)
            print(f"Test 5: PUT /virtual-folders/{parent_id} parent_id={child_id} (Cycle Test) -> Response Code: {code}")
            if code == 200:
                print("WARNING: Cycle vulnerability confirmed! The API allowed setting a child folder as its parent folder's parent.")
                # Restore original parent_id = None to prevent breaking recursive deletion
                api_request(f"/virtual-folders/{parent_id}", "PUT", {"parent_id": None})
            else:
                print(f"SUCCESS: The API blocked or failed cycle creation: {update_res}")

        # Test 6: Delete Folders Recursively
        if parent_id:
            code, del_res = api_request(f"/virtual-folders/{parent_id}", "DELETE")
            print(f"Test 6: DELETE /virtual-folders/{parent_id} -> Response Code: {code}")
            if code == 200:
                print("SUCCESS: Deleted folders recursively.")
            else:
                print(f"FAIL: Deletion failed: {del_res}")

    finally:
        # Test 7: Shutdown
        print("Sending /shutdown POST request...")
        code, shut_res = api_request("/shutdown", "POST", {})
        print(f"Test 7: POST /shutdown -> Response Code: {code}")
        print(f"Response Body: {shut_res}")
        
        print("Waiting for server process to terminate (up to 15 seconds)...")
        try:
            stdout, stderr = proc.communicate(timeout=15)
            print("SUCCESS: Server process exited cleanly after shutdown request!")
        except subprocess.TimeoutExpired:
            print("FAIL: Server process HUNG! It did not exit after 15 seconds.")
            proc.kill()
            stdout, stderr = proc.communicate()
            sys.exit(1)

    print("==================================================")
    print("DIAGNOSTIC RUN COMPLETED.")
    print("==================================================")

if __name__ == "__main__":
    run_diagnostic()
