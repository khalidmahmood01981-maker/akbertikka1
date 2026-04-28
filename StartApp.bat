@echo off
title Flavor Dash POS Server
echo -------------------------------------------
echo 🔥 FLAVOR DASH - POS ^& CRM SYSTEM 🔥
echo -------------------------------------------
echo.
echo [1/2] Opening browser with Silent Printing...
start chrome --kiosk-printing http://localhost:3000
echo.
echo [2/2] Starting local server...
echo (Is window ko band mat kijiyega varna app stop ho jayegi)
echo.
npm run dev
pause
