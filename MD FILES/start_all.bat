@echo off
REM ============================================================
REM  AI Smart Agriculture Platform — Full Stack Startup
REM  Starts: Backend (4000) + Frontend (3000) + Voice Guide Bridge (8002)
REM
REM  Usage: Double-click or run from project root
REM ============================================================

setlocal
set "ROOT=%~dp0"

echo.
echo ============================================================
echo  Starting AI Smart Agriculture Platform
echo ============================================================
echo.

REM ── 1. Voice Guide AI Bridge (port 8002) ─────────────────────
echo [1/3] Starting Voice Guide AI Bridge on port 8002...
start "Voice Guide Bridge" cmd /k "cd /d "%ROOT%Ai" && python -m voice_guide_ai.api_bridge"

REM Give the bridge a moment to bind the port
timeout /t 3 /nobreak >nul

REM ── 2. Backend (port 4000) ────────────────────────────────────
echo [2/3] Starting Node.js Backend on port 4000...
start "Backend" cmd /k "cd /d "%ROOT%backend" && npm run dev"

REM ── 3. Frontend (port 3000) ───────────────────────────────────
echo [3/3] Starting Next.js Frontend on port 3000...
start "Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo ============================================================
echo  All services started in separate windows.
echo  Voice Guide Bridge : http://localhost:8002/health
echo  Backend            : http://localhost:4000/api/health
echo  Frontend           : http://localhost:3000
echo ============================================================
echo.

endlocal
