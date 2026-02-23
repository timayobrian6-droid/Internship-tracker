Write-Host "Starting Internship Tracker services..." -ForegroundColor Green
Write-Host ""

Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend dependency installation failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location internship-frontend
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend dependency installation failed!" -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}
Set-Location ..

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WindowStyle Normal

Write-Host "Waiting 3 seconds for backend to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "Starting frontend server..." -ForegroundColor Yellow
Set-Location internship-frontend
Start-Process -FilePath "cmd" -ArgumentList "/c npm start" -WindowStyle Normal
Set-Location ..

Write-Host ""
Write-Host "Services started successfully!" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close this window"