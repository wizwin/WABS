import sys
import os
import platform
from pathlib import Path

def get_startup_command():
    if getattr(sys, 'frozen', False):
        # PyInstaller executable
        exe_path = Path(sys.executable).resolve()
        return [str(exe_path), "--no-browser"]
    else:
        # Development / script mode
        python_exe = Path(sys.executable).resolve()
        if platform.system() == "Windows":
            # If running under python.exe, try to use pythonw.exe to avoid console popup
            if python_exe.name.lower() == "python.exe":
                pythonw_exe = python_exe.with_name("pythonw.exe")
                if pythonw_exe.exists():
                    python_exe = pythonw_exe
        
        # run.py is located at the project root directory
        # This file is: root/backend/app/utils/startup.py
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        run_py = (root_dir / "run.py").resolve()
        return [str(python_exe), str(run_py), "--no-browser"]

def set_windows_startup(enabled: bool, cmd_args: list):
    try:
        import winreg
    except ImportError:
        print("winreg module is not available (not on Windows?).")
        return

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    # Format command line string with double quotes for arguments
    cmd_str = " ".join(f'"{arg}"' if " " in arg or '"' in arg else arg for arg in cmd_args)
    
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE)
        if enabled:
            winreg.SetValueEx(key, "WABS", 0, winreg.REG_SZ, cmd_str)
            print(f"Windows startup enabled: {cmd_str}")
        else:
            try:
                winreg.DeleteValue(key, "WABS")
                print("Windows startup disabled.")
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
    except Exception as e:
        print(f"Failed to update Windows startup: {e}")

def set_linux_startup(enabled: bool, cmd_args: list):
    autostart_dir = Path.home() / ".config" / "autostart"
    desktop_file = autostart_dir / "wabs.desktop"
    
    if enabled:
        try:
            autostart_dir.mkdir(parents=True, exist_ok=True)
            cmd_str = " ".join(f'"{arg}"' if " " in arg or '"' in arg else arg for arg in cmd_args)
            content = f"""[Desktop Entry]
Type=Application
Exec={cmd_str}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=WABS
Comment=Start WABS backend on login
Terminal=false
"""
            desktop_file.write_text(content, encoding="utf-8")
            print(f"Linux startup enabled: {desktop_file}")
        except Exception as e:
            print(f"Failed to set Linux startup: {e}")
    else:
        if desktop_file.exists():
            try:
                desktop_file.unlink()
                print("Linux startup disabled.")
            except Exception as e:
                print(f"Failed to remove Linux startup file: {e}")

def update_startup_setting(enabled: bool):
    cmd_args = get_startup_command()
    sys_plat = platform.system()
    if sys_plat == "Windows":
        set_windows_startup(enabled, cmd_args)
    elif sys_plat == "Linux":
        set_linux_startup(enabled, cmd_args)
