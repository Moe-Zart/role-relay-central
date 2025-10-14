@echo off
echo Starting JobNavigator Backend Server...
echo.
cd /d "C:\Users\moham\Role relay central\role-relay-central\server"
echo Current directory: %CD%
echo.
echo Installing dependencies (if needed)...
call npm install
echo.
echo Starting server...
call npm run dev
pause
