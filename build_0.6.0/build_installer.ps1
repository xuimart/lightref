$ErrorActionPreference = "Stop"
$csc      = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$buildDir = "E:\3D Light Ref\build_0.6.0"
$outFile  = "$buildDir\LightRef_Setup.exe"
$zip      = "$buildDir\lightref.zip"
$cs       = "$buildDir\LightRefInstaller.cs"
$ico      = "$buildDir\installer_icon.ico"
if (Test-Path $outFile) { Remove-Item $outFile -Force }
$cmdArgs = "/target:winexe /platform:anycpu /optimize+ " +
    "/win32icon:`"$ico`" " +
    "/out:`"$outFile`" " +
    "/resource:`"$zip`",lightref.zip " +
    "/r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll " +
    "/r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll " +
    "/r:Microsoft.CSharp.dll " +
    "`"$cs`""
Start-Process -FilePath $csc -ArgumentList $cmdArgs -Wait -NoNewWindow
if (Test-Path $outFile) { $f = Get-Item $outFile; Write-Output ("BUILT: {0} ({1:N2} MB)" -f $f.Name, ($f.Length/1MB)) } else { Write-Output "FALHA" }
