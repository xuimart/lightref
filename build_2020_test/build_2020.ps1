$ErrorActionPreference = "Stop"
$csc="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$b="E:\3D Light Ref\build_2020_test"
$out="$b\LightRef_Setup_2020.exe"
$ico="E:\3D Light Ref\build_0.5.0\installer_icon.ico"
if (Test-Path $out) { Remove-Item $out -Force }
$a="/target:winexe /platform:anycpu /optimize+ /win32icon:`"$ico`" /out:`"$out`" /resource:`"$b\lightref_2020.zip`",lightref.zip /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll `"$b\LightRefInstaller2020.cs`""
Start-Process -FilePath $csc -ArgumentList $a -Wait -NoNewWindow
if (Test-Path $out) { $f=Get-Item $out; Write-Output ("BUILT 2020: {0:N2} MB {1}" -f ($f.Length/1MB), $f.LastWriteTime.ToString("HH:mm:ss")) } else { Write-Output "FALHA 2020" }
