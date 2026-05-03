@echo off
title Flavor Dash POS Server
echo -------------------------------------------
echo 🔥 FLAVOR DASH - POS ^& CRM SYSTEM 🔥
echo -------------------------------------------
echo.
echo [1/2] Opening browser with Silent Printing...
start chrome --kiosk-printing http://localhost:3000
echo.
echo [2/2] Starting local server with PM2...
echo.
call pm2 start ecosystem.config.cjs
echo.
echo Server background mein start ho gaya hai.
echo Current Status:
call pm2 status
echo.
pause
