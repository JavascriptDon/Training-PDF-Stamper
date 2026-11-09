@echo off
REM Run stamp.tsx from the folder this .bat file lives in.
cd /d "%~dp0"

REM Needs Node.js installed, and the packages installed once with: npm install pdf-lib pdf-parse tsx
call npx tsx stamp.tsx

echo.
pause