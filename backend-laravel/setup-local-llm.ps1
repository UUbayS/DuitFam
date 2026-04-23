Write-Host "🤖 DuitFam Local LLM Setup (Gemma 4 E4B - Windows Version)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is installed
if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Ollama is not installed." -ForegroundColor Red
    Write-Host "📥 Downloading and installing Ollama for Windows..." -ForegroundColor Yellow
    Start-Process "https://ollama.com/download/OllamaSetup.exe"
    Write-Host "💡 Please install Ollama from the browser and run this script again." -ForegroundColor Blue
    exit
} else {
    Write-Host "✅ Ollama is already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Checking Ollama service..." -ForegroundColor Yellow

# Note: On Windows, Ollama usually runs as a tray app. 
# We just need to make sure the process exists or start it.
$ollamaProc = Get-Process ollama -ErrorAction SilentlyContinue
if (!$ollamaProc) {
    Write-Host "🔄 Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "✅ Ollama service is already running" -ForegroundColor Green
}

$model = "llama3.1:8b"
Write-Host ""
Write-Host "📥 Pulling model: $model (Premium Model - 4.7GB)..." -ForegroundColor Cyan
ollama pull $model

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Llama 3.1 8B downloaded and ready!" -ForegroundColor Green
    Write-Host "🎯 You can now use the AI Chat in DuitFam." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to download model." -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Cyan
pause
