@echo off
title Smart Order Taker - Silent Printing Mode
echo Starting App in Silent Printing Mode...
echo (Make sure all other Chrome windows are closed for this to work perfectly)
start chrome "http://localhost:5173" --kiosk-printing
exit
