@echo off
cd /d "%~dp0"
echo [1/2] Installing packages from the public npm registry...
call npm.cmd install --registry=https://registry.npmjs.org/
if errorlevel 1 (
  echo Installation failed. Check the terminal message above.
  pause
  exit /b 1
)
echo [2/2] Starting the development server...
call npm.cmd run dev
pause
