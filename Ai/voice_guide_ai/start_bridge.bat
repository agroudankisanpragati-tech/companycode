@echo off
REM Voice Guide AI Bridge — Windows Startup Script
REM Run this from the project root or double-click it.
REM It starts the FastAPI bridge on port 8002.

setlocal

REM Resolve the directory this script lives in
set "SCRIPT_DIR=%~dp0"
set "AI_DIR=%SCRIPT_DIR%.."

REM Change to the Ai/ directory so relative imports work
cd /d "%AI_DIR%"

echo ============================================================
echo  Voice Guide AI Bridge
echo  Starting on http://0.0.0.0:8002
echo  Press CTRL+C to stop
echo ============================================================

REM Prefer the venv Python if it exists, otherwise use system Python
if exist "%AI_DIR%\venv\Scripts\python.exe" (
    set "PYTHON=%AI_DIR%\venv\Scripts\python.exe"
) else if exist "%AI_DIR%\.venv\Scripts\python.exe" (
    set "PYTHON=%AI_DIR%\.venv\Scripts\python.exe"
) else (
    set "PYTHON=python"
)

echo Using Python: %PYTHON%
echo.

"%PYTHON%" -m voice_guide_ai.api_bridge

endlocal
