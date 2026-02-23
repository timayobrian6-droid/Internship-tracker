@echo off
echo 🚀 Starting Internship Tracker...
echo.

cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
	echo ❌ Node.js/npm is not installed.
	echo 📥 Opening Node.js LTS download page...
	start "" "https://nodejs.org/en/download"
	echo.
	echo Complete Node.js installation, then press any key to continue.
	pause >nul
	where npm.cmd >nul 2>nul
	if errorlevel 1 (
		echo ❌ Node.js/npm still not detected. Please install from https://nodejs.org/en/download and run launch.bat again.
		pause
		exit /b 1
	)
)

if not exist "node_modules" (
	echo 📦 Installing backend dependencies...
	call npm.cmd install
	if errorlevel 1 (
		echo ❌ Backend dependency installation failed.
		pause
		exit /b 1
	)
)

if not exist "internship-frontend\node_modules" (
	echo 📦 Installing frontend dependencies...
	call npm.cmd --prefix internship-frontend install
	if errorlevel 1 (
		echo ❌ Frontend dependency installation failed.
		pause
		exit /b 1
	)
)

echo 🚀 Starting backend server (port 5000)...
start "Internship Backend" cmd /k "cd /d \"%~dp0\" && npm.cmd run dev"

timeout /t 3 /nobreak > nul

echo 🚀 Starting frontend server (port 3000)...
start "Internship Frontend" cmd /k "cd /d \"%~dp0internship-frontend\" && npm.cmd start"

echo.
echo ✅ Services started successfully!
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:5000
echo.
echo Press any key to close this window...
pause > nul