@echo off
echo Starting Internship Tracker...
echo.

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
	echo ERROR: Node.js/npm is not installed.
	echo Opening Node.js download page...
	start https://nodejs.org/en/download
	echo.
	echo Please install Node.js and run this script again.
	pause
	exit /b 1
)

if not exist "node_modules" (
	echo Installing backend dependencies...
	call npm install
	if errorlevel 1 (
		echo ERROR: Backend installation failed.
		pause
		exit /b 1
	)
)

if not exist "internship-frontend\node_modules" (
	echo Installing frontend dependencies...
	call npm --prefix internship-frontend install
	if errorlevel 1 (
		echo ERROR: Frontend installation failed.
		pause
		exit /b 1
	)
)

echo Starting backend server...
start "Backend" cmd /k "npm run dev"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting frontend server...
start "Frontend" cmd /k "cd internship-frontend && npm start"

echo.
echo SUCCESS: Services started!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
echo.
pause