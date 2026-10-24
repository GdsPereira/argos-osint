# Script de Validacao Completa de Qualidade (Backend + Frontend)
# Execucao: .\scripts\run_tests.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Argos OSINT - Suite de Verificacao e QA                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$root = (Get-Item "$PSScriptRoot\..").FullName
$pythonExe = "$root\.venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "`n[1/2] Executando testes automatizados do Backend (pytest)..." -ForegroundColor Yellow
& $pythonExe -m pytest "$root\backend\tests" -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERRO] Falha nos testes do Backend!" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "[OK] Todos os testes do Backend passaram com sucesso!" -ForegroundColor Green

Write-Host "`n[2/2] Validando compilacao do Frontend Angular (npm run build)..." -ForegroundColor Yellow
$frontendDir = "$root\frontend"
Push-Location $frontendDir
npm run build
$buildExitCode = $LASTEXITCODE
Pop-Location

if ($buildExitCode -ne 0) {
    Write-Host "`n[ERRO] Falha no build do Frontend!" -ForegroundColor Red
    exit $buildExitCode
}
Write-Host "[OK] Build do Frontend concluido com sucesso sem erros!" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  PROJETO 100% VALIDADO E PRONTO PARA PRODUCAO!           " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
