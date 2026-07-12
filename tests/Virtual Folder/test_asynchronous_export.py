import sys
from pathlib import Path
import time
import os
import shutil

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.database import SessionLocal, VirtualFolder, FileIndex, VirtualFolderFile
from backend.app.routes.virtual_folders import export_virtual_folder, ExportFolderRequest
from backend.app.state import STATE

def test_async_export():
    with SessionLocal() as s:
        # Get or create a folder
        folder = s.query(VirtualFolder).filter(VirtualFolder.name == "TestExport").first()
        if not folder:
            folder = VirtualFolder(name="TestExport", is_dynamic=0, created_at="2026-07-05")
            s.add(folder)
            s.commit()
            s.refresh(folder)
            
        file_item = s.query(FileIndex).first()
        if file_item:
            # Let's write a dummy file to file_item.path just in case it doesn't exist
            os.makedirs(os.path.dirname(file_item.path), exist_ok=True)
            with open(file_item.path, "w") as f:
                f.write("dummy content")
                
            link = s.query(VirtualFolderFile).filter(
                VirtualFolderFile.virtual_folder_id == folder.id,
                VirtualFolderFile.file_id == file_item.id
            ).first()
            if not link:
                link = VirtualFolderFile(virtual_folder_id=folder.id, file_id=file_item.id)
                s.add(link)
                s.commit()

        # Target export path (relative to this test file)
        target_dir = str(Path(__file__).resolve().parent / "export_out")
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
            
        print("Starting Async Export...")
        req = ExportFolderRequest(target_path=target_dir)
        res = export_virtual_folder(folder.id, req)
        print("Response:", res)
        assert res["status"] == "success"
        
        # Check that state variables are set
        print("Waiting for thread to start and update STATE...")
        seen_running = False
        for _ in range(100):
            if STATE.get("export_running"):
                seen_running = True
                print(f"STATE updated: running={STATE.get('export_running')}, total={STATE.get('export_total')}, current={STATE.get('export_current')}, file={STATE.get('export_current_file')}")
            time.sleep(0.005)
            
        print("Final State after polling:", STATE)
        # Even if it finishes too fast, we can see if it processed files
        if not seen_running:
            print("Completed too fast for polling, verifying files processed...")
            assert STATE.get("export_total") > 0, "No files were queued for export!"
            
        print("Waiting for export to complete...")
        for _ in range(50):
            if not STATE.get("export_running"):
                break
            time.sleep(0.05)
            
        assert STATE.get("export_running") is False, "Export did not finish in time!"
        
        # Verify exported file exists
        if file_item:
            exported_file_path = os.path.join(target_dir, "TestExport", os.path.basename(file_item.path))
            print("Exported file path:", exported_file_path)
            assert os.path.exists(exported_file_path), f"Exported file {exported_file_path} does not exist!"
            
        print("ALL ASYNC EXPORT TESTS PASSED!")

        # Clean up temp DB items and directories
        if file_item:
            s.query(VirtualFolderFile).filter(VirtualFolderFile.virtual_folder_id == folder.id).delete()
        s.delete(folder)
        s.commit()
        
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)

if __name__ == "__main__":
    test_async_export()
