# make_zip.ps1 - monta lightref.zip com prefixo cep/ (sem generator).
# Exclui arquivos de desenvolvimento (node_modules, tests, .kiro, backups, temporarios).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root    = "E:\3D Light Ref"
$cepSrc  = Join-Path $root "com.lightref.cep"
$zipPath = Join-Path $root "build_0.5.0\lightref.zip"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Pastas/arquivos que NAO entram no pacote distribuido.
$excludeDirs  = @("node_modules", "tests", ".kiro", ".git")
$excludeNames = @(".bak", "_thumbgen.html", "package-lock.json")

$fs  = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

$base = (Resolve-Path $cepSrc).Path.TrimEnd("\")
$count = 0
Get-ChildItem -Path $base -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($base.Length + 1)
    $relFwd = $rel -replace "\\", "/"
    $skip = $false
    foreach ($d in $excludeDirs) { if ($relFwd -like "$d/*" -or $relFwd -like "*/$d/*") { $skip = $true; break } }
    if (-not $skip) { foreach ($n in $excludeNames) { if ($_.Name -like "*$n" -or $_.Name -eq $n) { $skip = $true; break } } }
    # exclui os proprios arquivos de teste soltos
    if ($_.Name -like "*.test.js") { $skip = $true }
    if ($skip) { return }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $_.FullName, "cep/$relFwd",
        [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $count++
}

$zip.Dispose(); $fs.Dispose()
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Output "cep entries : $count"
Write-Output "zip size    : $sizeMB MB"
Write-Output "zip path    : $zipPath"
