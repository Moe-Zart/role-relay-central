Write-Host "Starting JobNavigator Backend Server..." -ForegroundColor Green
Write-Host ""

# Change to server directory
Set-Location "C:\Users\moham\Role relay central\role-relay-central\server"
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""

# Install dependencies if needed
Write-Host "Installing dependencies (if needed)..." -ForegroundColor Yellow
npm install
Write-Host ""

# Start the server
Write-Host "Starting server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
npm run dev
