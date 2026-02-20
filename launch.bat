@echo off
echo 🚀 Launching Internship Tracker Ecosystem...

cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
	echo Node.js/npm is not installed.
	echo Opening Node.js LTS download page...
	start "" "https://nodejs.org/en/download"
	echo.
	echo Optional auto-install on Windows (if available):
	where winget >nul 2>nul
	if not errorlevel 1 (
		choice /M "Try automatic install now with winget"
		if errorlevel 2 goto :WAIT_NODE_MANUAL
		echo Installing Node.js LTS via winget...
		winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
	)

	:WAIT_NODE_MANUAL
	echo.
	echo Complete Node.js installation, then press any key to continue.
	pause >nul
	where npm.cmd >nul 2>nul
	if errorlevel 1 (
		echo Node.js/npm still not detected. Please install from https://nodejs.org/en/download and run launch.bat again.
		pause
		exit /b 1
	)
)

if not exist "node_modules" (
	echo Installing backend dependencies...
	npm.cmd install
	if errorlevel 1 (
		echo Backend dependency installation failed.
		pause
		exit /b 1
	)
)

echo Starting Internship Tracker in single-port mode...
echo (npm start will build frontend, then serve app + API from backend)
start "Internship Tracker" cmd /k "cd /d \"%~dp0\" && npm.cmd start"

echo.
echo Open in browser: http://localhost:3001
echo To open from another device on same network: http://YOUR-PC-IP:3001