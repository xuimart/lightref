$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $root 'tools/build-installer.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }
Copy-Item -LiteralPath (Join-Path $root 'dist/LightRef_Setup.exe') -Destination (Join-Path $PSScriptRoot 'LightRef_Setup.exe') -Force
