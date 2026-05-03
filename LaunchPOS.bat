@echo off
echo ==========================================
echo    SMART POS - LAUNCHER (Normal Print)
echo ==========================================
echo.
echo Closing existing Chrome instances...
taskkill /F /IM chrome.exe >nul 2>&1

echo.
echo Launching POS...
echo URL: http://localhost:3000
echo.

:: Launch Chrome without silent printing
start chrome "http://localhost:3000"

echo POS is running. Keep this window open or close it.
pause
