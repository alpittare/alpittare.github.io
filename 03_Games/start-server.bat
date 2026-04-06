@echo off
title Game Test Server - Port 8080
echo ============================================
echo   Survival Arena - Local Game Server
echo ============================================
echo.

:: Check for Python first
where python >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Python found - starting server...
    echo.
    echo Server running at: http://localhost:8080
    echo Open game-tester.html in your browser to generate QR codes.
    echo Press Ctrl+C to stop.
    echo.
    python -m http.server 8080
    goto :end
)

:: Check for Node.js
where npx >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Node.js found - starting server...
    echo.
    echo Server running at: http://localhost:8080
    echo Open game-tester.html in your browser to generate QR codes.
    echo Press Ctrl+C to stop.
    echo.
    npx http-server -p 8080 --cors
    goto :end
)

:: Fallback: PowerShell HTTP server
echo [!] Neither Python nor Node.js found.
echo [*] Starting PowerShell HTTP server...
echo.
echo Server running at: http://localhost:8080
echo Open game-tester.html in your browser to generate QR codes.
echo Press Ctrl+C to stop.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0ps-server.ps1"

:end
pause
