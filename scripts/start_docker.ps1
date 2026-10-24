# Script para inicializacao dos containers do Argos OSINT via Docker Compose
# Execucao: .\scripts\start_docker.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Argos OSINT - Orquestracao de Containers Docker         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$root = (Get-Item "$PSScriptRoot\..").FullName
Push-Location $root

Write-Host "`nVerificando conectividade com o Docker..." -ForegroundColor Yellow
$dockerTest = docker-compose ps 2>&1

if ($LASTEXITCODE -ne 0 -and ($dockerTest -match "docker API" -or $dockerTest -match "daemon is running")) {
    Write-Host "`n[AVISO] O Docker Desktop nao esta em execucao na sua maquina." -ForegroundColor Yellow
    Write-Host "Abra o aplicativo 'Docker Desktop' no Windows e execute este script novamente.`n" -ForegroundColor Yellow
} else {
    Write-Host "Docker daemon ativo! Iniciando build e execucao dos containers..." -ForegroundColor Green
    docker-compose up -d --build

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n==========================================================" -ForegroundColor Green
        Write-Host "  ARGOS OSINT INICIALIZADO COM SUCESSO VIA DOCKER!        " -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "✔ Frontend Web:   http://localhost:4200" -ForegroundColor Cyan
        Write-Host "✔ Backend API:    http://localhost:8000/docs" -ForegroundColor Cyan
        Write-Host "✔ PostgreSQL:     localhost:5456 (argos_db)`n" -ForegroundColor Cyan
    } else {
        Write-Host "`n[ERRO] Ocorreu um erro ao subir os containers. Verifique os logs acima." -ForegroundColor Red
    }
}

Pop-Location
