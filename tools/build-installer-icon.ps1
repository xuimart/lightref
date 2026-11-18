$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$frames = @()
foreach ($size in @(16,24,32,48,64,256)) {
 $bitmap = New-Object Drawing.Bitmap($size,$size)
 $graphics = [Drawing.Graphics]::FromImage($bitmap)
 try {
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size/64.0,$size/64.0)
  $shape = New-Object Drawing.Drawing2D.GraphicsPath
  $shape.AddArc(2,2,18,18,180,90); $shape.AddArc(44,2,18,18,270,90)
  $shape.AddArc(44,44,18,18,0,90); $shape.AddArc(2,44,18,18,90,90); $shape.CloseFigure()
  $background = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#181822'))
  $accent = New-Object Drawing.Pen([Drawing.ColorTranslator]::FromHtml('#de2246'),3)
  $white = New-Object Drawing.Pen([Drawing.ColorTranslator]::FromHtml('#f0f0ff'),3)
  $accent.StartCap = $accent.EndCap = $white.StartCap = $white.EndCap = [Drawing.Drawing2D.LineCap]::Round
  try {
   $graphics.FillPath($background,$shape)
   $graphics.DrawArc($white,20,20,24,25,140,260)
   $graphics.DrawLine($white,23,41,26,47); $graphics.DrawLine($white,41,41,38,47)
   $graphics.DrawLine($white,26,47,38,47); $graphics.DrawLine($white,28,53,36,53)
   $graphics.DrawLine($accent,32,9,32,13); $graphics.DrawLine($accent,11,31,15,31)
   $graphics.DrawLine($accent,49,31,53,31); $graphics.DrawLine($accent,16,15,19,18)
   $graphics.DrawLine($accent,45,18,48,15)
  } finally { $background.Dispose(); $accent.Dispose(); $white.Dispose(); $shape.Dispose() }
  $stream = New-Object IO.MemoryStream
  try { $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png); $frames += ,$stream.ToArray() }
  finally { $stream.Dispose() }
 } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
$path = Join-Path $root 'installer/installer_icon.ico'
$writer = New-Object IO.BinaryWriter([IO.File]::Create($path))
try {
 $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
 $offset = 6 + 16 * $frames.Count
 $sizes = @(16,24,32,48,64,256)
 for ($i=0; $i -lt $frames.Count; $i++) {
  $dimension = [byte]($sizes[$i] % 256)
  $writer.Write($dimension); $writer.Write($dimension); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
  $offset += $frames[$i].Length
 }
 foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
} finally { $writer.Dispose() }
