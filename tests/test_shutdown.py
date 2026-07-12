import subprocess
import time
import urllib.request
import urllib.error
import sys
import os
from pathlib import Path

def run_test():
    # Resolve the project root directory relative to this script (tests/test_shutdown.py)
    root_dir = Path(__file__).resolve().parent.parent
    venv_python = root_dir / "venv" / "Scripts" / "python.exe"
    
    # Check if compiled executable exists
    exe_path = root_dir / "dist" / "WABS-Windows.exe"
    
    use_exe = exe_path.exists()
    if use_exe:
        print(f"Starting WABS compiled executable in background: {exe_path}")
        cmd = [str(exe_path), "--no-browser", "--port", "8011"]
    else:
        print(f"Starting WABS python server in background using venv: {venv_python}")
        cmd = [str(venv_python), "run.py", "--no-browser", "--port", "8011"]
        
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
        print("Server failed to start or exited immediately.")
        stdout, stderr = proc.communicate()
        print(f"STDOUT:\n{stdout}")
        print(f"STDERR:\n{stderr}")
        sys.exit(1)
        
    print("Sending /shutdown POST request...")
    req = urllib.request.Request(
        "http://127.0.0.1:8011/shutdown",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Response Code: {response.getcode()}")
            print(f"Response Body: {response.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error sending request: {e}")
        
    print("Waiting for server process to terminate (up to 15 seconds)...")
    try:
        stdout, stderr = proc.communicate(timeout=15)
        print("Server process exited cleanly!")
        print(f"STDOUT:\n{stdout}")
        print(f"STDERR:\n{stderr}")
    except subprocess.TimeoutExpired:
        print("Server process HUNG! It did not exit after 15 seconds.")
        proc.kill()
        stdout, stderr = proc.communicate()
        print(f"STDOUT:\n{stdout}")
        print(f"STDERR:\n{stderr}")
        sys.exit(1)

if __name__ == "__main__":
    run_test()
