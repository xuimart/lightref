# Gera icones placeholder do LightRef (23x23 px, padrao CEP).
# Substitua depois pelos icones reais derivados de um logo.svg (ver PADRAO_PLUGINS_XUIMART.md secao 2).
Add-Type -AssemblyName System.Drawing

function New-Icon($path, $bgHex, $fgHex) {
    $bmp = New-Object System.Drawing.Bitmap 23, 23
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $bg = [System.Drawing.ColorTranslator]::FromHtml($bgHex)
    $fg = [System.Drawing.ColorTranslator]::FromHtml($fgHex)
    $g.Clear([System.Drawing.Color]::Transparent)
    $brushBg = New-Object System.Drawing.SolidBrush $bg
    $g.FillEllipse($brushBg, 1, 1, 21, 21)
    $font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $brushFg = New-Object System.Drawing.SolidBrush $fg
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $g.DrawString('L', $font, $brushFg, (New-Object System.Drawing.RectangleF 0,0,23,23), $fmt)
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$dir = $PSScriptRoot
New-Icon (Join-Path $dir 'icon-normal.png')        '#2f2f38' '#888888'
New-Icon (Join-Path $dir 'icon-rollover.png')      '#2f2f38' '#de2246'
New-Icon (Join-Path $dir 'icon-dark-normal.png')   '#2f2f38' '#888888'
New-Icon (Join-Path $dir 'icon-dark-rollover.png') '#2f2f38' '#de2246'
Write-Output 'Icones gerados.'
