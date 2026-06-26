# -*- mode: python ; coding: utf-8 -*-
import os
import sys

# Determine the artifact name dynamically if specified via environment variable.
# This allows building cross-platform (e.g. WABS-Linux on Ubuntu, WABS-RaspberryPi on ARM)
# using the same spec file configuration.
artifact_name = os.environ.get('WABS_ARTIFACT_NAME', 'WABS-Windows.exe' if sys.platform.startswith('win') else 'WABS-Linux')

# Locate rapidocr_onnxruntime config.yaml dynamically
rapidocr_datas = []
try:
    import rapidocr_onnxruntime
    rapidocr_dir = os.path.dirname(rapidocr_onnxruntime.__file__)
    config_path = os.path.join(rapidocr_dir, 'config.yaml')
    if os.path.exists(config_path):
        rapidocr_datas = [(config_path, 'rapidocr_onnxruntime')]
except ImportError:
    pass

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=[('frontend/dist', 'frontend/dist'), ('backend/*.onnx', 'backend'), ('backend/*.txt', 'backend')] + rapidocr_datas,
    hiddenimports=[
        'rapidocr_onnxruntime',
        'rapidocr_onnxruntime.utils',
        'rapidocr_onnxruntime.rapid_ocr_api',
        'rapidocr_onnxruntime.ch_ppocr_v3_det',
        'rapidocr_onnxruntime.ch_ppocr_v3_rec',
        'rapidocr_onnxruntime.ch_ppocr_v2_cls',
        'multipart'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # We exclude pyarrow and tzdata to save substantial package space:
    # 1. pyarrow: Not used in WABS, but transitively detected and bundled (5.4MB).
    # 2. tzdata: Python's zoneinfo timezone database, unused by WABS's local/naive time (2.5MB).
    excludes=['pyarrow', 'tzdata'],
    noarchive=False,
    optimize=0,
)

# Post-processing filters to strip out dependencies that PyInstaller hooks still try to inject:
# 1. Tcl/Tk's internal tzdata: Pulled in by the tkinter hook, unused by WABS (3.0MB).
# 2. Python's tzdata: Any leftover data files/folders.
# 3. pyarrow: Any lingering pyarrow binaries or data.
a.datas = [d for d in a.datas if 'tzdata' not in str(d[0]).lower() and 'tzdata' not in str(d[1]).lower() and 'pyarrow' not in str(d[0]).lower() and 'pyarrow' not in str(d[1]).lower()]
a.binaries = [b for b in a.binaries if 'pyarrow' not in str(b[0]).lower() and 'pyarrow' not in str(b[1]).lower()]

pyz = PYZ(a.pure)

# On Windows, set the application icon if present.
icon_file = 'icon.ico' if (sys.platform.startswith('win') and os.path.exists('icon.ico')) else None

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name=artifact_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file,
)
