# build.ps1 - empacota o LightRef e compila o instalador (padrao Xuimart).
# Uso: powershell -ExecutionPolicy Bypass -File installer\build.ps1
# Gera: installer\LightRef_Setup.exe (nome fixo, sem versao).
$ErrorActionPreference = "Stop"
$root      = Split-Path -Parent $PSScriptRoot
$plugin    = Join-Path $root "com.lightref.cep"
$installer = Join-Path $root "installer"
$staging   = Join-Path $installer "_staging"
$zipPath   = Join-Path $installer "plugin.zip"
$exeOut    = Join-Path $installer "LightRef_Setup.exe"

# 1) Monta o staging com prefixo cep/com.lightref.cep/...
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
$cepDir = Join-Path $staging "cep\com.lightref.cep"
New-Item -ItemType Directory -Path $cepDir -Force | Out-Null

# Copia o plugin, ignorando lixo de build e pastas de trabalho.
$exclude = @("redimensionados", "_staging", "__pycache__")
robocopy $plugin $cepDir /E /XD (Join-Path $plugin "models\redimensionados") /NFL /NDL /NJH /NJS /NP | Out-Null

# 2) Zip
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $zipPath)
Write-Host ("plugin.zip: {0:N2} MB" -f ((Get-Item $zipPath).Length/1MB))

# 3) Compila o instalador com csc.exe (embute o zip como recurso)
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "csc.exe nao encontrado em $csc" }
$src = Join-Path $installer "LightRefInstaller.cs"
$args = @(
  "/target:winexe", "/platform:anycpu", "/optimize+",
  "/out:`"$exeOut`"",
  "/resource:`"$zipPath`",plugin.zip",
  "/r:System.dll", "/r:System.Drawing.dll", "/r:System.Windows.Forms.dll",
  "/r:System.IO.Compression.dll", "/r:System.IO.Compression.FileSystem.dll",
  "`"$src`""
)
& $csc @args
if ($LASTEXITCODE -ne 0) { throw "csc falhou" }
Write-Host ("OK -> {0} ({1:N2} MB)" -f $exeOut, ((Get-Item $exeOut).Length/1MB))

# limpa staging (mantem o zip e o exe)
Remove-Item -Recurse -Force $staging
