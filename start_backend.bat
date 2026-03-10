@echo off
echo 🎓 Universite Local Backend Setup
echo =====================================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Install dependencies if needed
echo 📦 Checking and installing dependencies...
pip install -r requirements.txt

REM Start the backend server
echo 🚀 Starting local backend server...
echo =====================================
python run_local_backend.py

pause
