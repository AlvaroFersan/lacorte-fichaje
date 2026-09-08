# Prepara .env y la carpeta data/ para copiar el proyecto al NAS.
# Uso (PowerShell, en la carpeta del proyecto):
#   .\scripts\preparar-nas.ps1

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

New-Item -ItemType Directory -Force -Path (Join-Path $raiz 'data') | Out-Null

$envPath = Join-Path $raiz '.env'
$example = Join-Path $raiz '.env.example'
if (-not (Test-Path $envPath)) {
  Copy-Item $example $envPath
  Write-Host 'Creado .env a partir de .env.example'
}

$texto = Get-Content $envPath -Raw
if ($texto -match 'cambia-esta-frase-por-una-aleatoria-larga') {
  $secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  if (-not $secret) { throw 'No pude generar el secreto. ¿Está Node instalado?' }
  $nuevo = [regex]::Replace($texto, '(?m)^SESSION_SECRET=.*$', "SESSION_SECRET=$secret")
  if ($nuevo -eq $texto) { $nuevo = $texto.TrimEnd() + "`nSESSION_SECRET=$secret`n" }
  Set-Content -Path $envPath -Value $nuevo -NoNewline
  Write-Host 'SESSION_SECRET generado.'
} else {
  Write-Host 'SESSION_SECRET ya estaba puesto. No lo toco.'
}

Write-Host 'Listo para probar en este PC.'
Write-Host 'El NAS entra por GitHub + docker-compose.yml (docs/NAS.md).'
Write-Host 'Navegador local: http://localhost:3000  (alvaro / 1234)'
