# Kowell AI Startup Script

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   🎓 Kowell AI Project Auto-Launcher    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Node.js is not installed or not in PATH! Please install Node.js (v20+ recommended)."
    Exit
}

# 2. Check and choose package manager
$PackageManager = "npm"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $PackageManager = "pnpm"
}

Write-Host "📦 Detected Package Manager: $PackageManager" -ForegroundColor Green

# 3. Synchronize/Install dependencies
Write-Host "🔄 Synchronizing dependencies..." -ForegroundColor Yellow
if ($PackageManager -eq "pnpm") {
    pnpm install
} else {
    npm install
}

# 4. Start the development server
Write-Host "⚡ Starting development server..." -ForegroundColor Green
if ($PackageManager -eq "pnpm") {
    pnpm run dev
} else {
    npm run dev
}
