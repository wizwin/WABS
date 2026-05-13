@echo off
pushd "%~dp0"
py -m pip install -r backend\requirements.txt
py -m uvicorn backend.app.main:app --reload
popd