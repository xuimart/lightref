param([switch]$ManifestOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$plugin = Join-Path $root 'com.lightref.cep'
New-Item -ItemType Directory -Path (Join-Path $root 'qa') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $root 'dist') -Force | Out-Null
$items = @('CSXS','env','icons','img','js','models','shaders','index.css','index.html','init.jsx','package.json','README_DEV.md')
$files = foreach ($item in $items) { Get-ChildItem -LiteralPath (Join-Path $plugin $item) -File -Recurse -Force }
$manifest = foreach ($file in $files) {
 if ($file.FullName -match '[\\/]redimensionados[\\/]') { continue }
 [ordered]@{ path=$file.FullName.Substring($plugin.Length+1).Replace('\','/'); bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower() }
}
$manifestJson = ($manifest | ConvertTo-Json -Depth 4).Replace("`r`n", "`n") + "`n"
[IO.File]::WriteAllText((Join-Path $plugin 'runtime-manifest.json'), $manifestJson, (New-Object Text.UTF8Encoding($false)))
if ($ManifestOnly) { Write-Output ('Runtime manifest: ' + $manifest.Count + ' files'); return }
& (Join-Path $PSScriptRoot 'build-installer.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }
