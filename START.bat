@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 from https://nodejs.org and run START.bat again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First start installs libraries. Wait.
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
start "" http://127.0.0.1:8080
call npm run dev
pause
