@echo off
echo Starting Internship Tracker services...
echo.

echo Installing backend dependencies...
call npm ci
if %errorlevel% neq 0 (
    echo Backend dependency installation failed!
    pause
    exit /b 1
)

echo Installing frontend dependencies...
cd internship-frontend
call npm ci
if %errorlevel% neq 0 (
    echo Frontend dependency installation failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo Starting backend server...
start "Backend Server" cmd /c "npm run dev"

timeout /t 3 /nobreak > nul

echo Starting frontend server...
cd internship-frontend
start "Frontend Server" cmd /c "npm start"
cd ..

echo.
echo Services started successfully!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to close this window...
pause > nul