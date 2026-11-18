$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'com.lightref.cep'
& (Join-Path $PSScriptRoot 'package.ps1') -ManifestOnly
$installer = Join-Path $root 'installer'
$output = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $output -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload = Join-Path $output 'lightref.zip'
$runtime = Get-Content -LiteralPath (Join-Path $project 'runtime-manifest.json') -Raw | ConvertFrom-Json
$stream = [IO.File]::Open($payload, [IO.FileMode]::Create)
$zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
 foreach ($entry in $runtime) {
  $file = Join-Path $project $entry.path
  if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $entry.sha256) { throw ('Runtime manifest is stale: ' + $entry.path) }
  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, ('cep/' + $entry.path.Replace('\','/')), [IO.Compression.CompressionLevel]::Optimal)
 }
 [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $project 'runtime-manifest.json'), 'cep/runtime-manifest.json', [IO.Compression.CompressionLevel]::Optimal)
} finally { $zip.Dispose(); $stream.Dispose() }
$compiler = 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework compiler not found.' }
$exe = Join-Path $output 'LightRef_Setup.exe'
$icon = Join-Path $installer 'installer_icon.ico'
& (Join-Path $PSScriptRoot 'build-installer-icon.ps1')
$logo = Join-Path $project 'img/logo_xuimart_branca.png'
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 "/win32manifest:$(Join-Path $installer 'app.manifest')" "/win32icon:$icon" "/out:$exe" "/resource:$payload,lightref.zip" "/resource:$logo,xuimart.png" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:System.Web.Extensions.dll /r:System.Xml.dll (Join-Path $installer 'LightRefInstaller.cs') (Join-Path $installer 'InstallerDesign.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
foreach ($step in @(
 @('/verify', (Join-Path $root 'qa/installer-verify.json')),
 @('/self-test', (Join-Path $root 'qa/installer-tests.json')),
 @('/render-ui', (Join-Path $root 'qa/installer-ui.png')),
 @('/render-ui', (Join-Path $root 'qa/installer-installing.png'), 'installing'),
 @('/render-ui', (Join-Path $root 'qa/installer-success.png'), 'success'),
 @('/render-ui', (Join-Path $root 'qa/installer-error.png'), 'error'),
 @('/render-ui', (Join-Path $root 'qa/installer-details.png'), 'details')
)) {
 $arguments = $step | ForEach-Object { '"' + $_ + '"' }
 $process = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
 if ($process.ExitCode -ne 0) { throw ('Installer validation failed: ' + $step[0]) }
}
$hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLower()
($hash + '  LightRef_Setup.exe') | Set-Content -LiteralPath (Join-Path $output 'LightRef_Setup.sha256.txt') -Encoding ASCII
[ordered]@{ exe=$exe; bytes=(Get-Item -LiteralPath $exe).Length; sha256=$hash; fileVersion=[Diagnostics.FileVersionInfo]::GetVersionInfo($exe).FileVersion; verifiedRuntimeFiles=$runtime.Count } | ConvertTo-Json | Tee-Object -FilePath (Join-Path $root 'qa/installer-build.json')
