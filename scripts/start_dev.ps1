# Script de Inicializacao dos Servidores de Desenvolvimento
# Execucao: .\scripts\start_dev.ps1 [-Service <all|backend|frontend>]

param (
    [ValidateSet("all", "backend", "frontend")]
    [string]$Service = "all"
)

$root = (Get-Item "$PSScriptRoot\..").FullName
$pythonExe = "$root\.venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Instagram Analytics Pro - Servidores de Desenvolvimento " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if ($Service -eq "backend" -or $Service -eq "all") {
    Write-Host "`nIniciando Backend FastAPI na porta 8000..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; & '$pythonExe' -m uvicorn main:app --reload --port 8000"
    Write-Host "✔ Backend aberto em nova janela: http://localhost:8000/docs" -ForegroundColor Yellow
}

if ($Service -eq "frontend" -or $Service -eq "all") {
    Write-Host "`nIniciando Frontend Angular na porta 4200..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm start"
    Write-Host "✔ Frontend aberto em nova janela: http://localhost:4200" -ForegroundColor Yellow
}

Write-Host "`nAmbiente de desenvolvimento disparado com sucesso!" -ForegroundColor Cyan
