$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot

function New-Brush([int]$r, [int]$g, [int]$b) {
  New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, $r, $g, $b))
}

function Get-Font([string]$name, [single]$size) {
  try { return New-Object System.Drawing.Font($name, $size, [System.Drawing.FontStyle]::Bold) }
  catch { return New-Object System.Drawing.Font('Arial', $size, [System.Drawing.FontStyle]::Bold) }
}

# Final app icon: cream "d" + green "!" on dark background (variant B)
function New-DontBunkIcon([string]$outPath, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  try {
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 17, 17, 17))
    $g.FillRectangle($bg, 0, 0, $size, $size)

    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $yOff = [single](-$size * 0.051)

    $fontB = New-Object System.Drawing.Font('Arial Black', [single]($size * 0.55), [System.Drawing.FontStyle]::Bold)
    $cream = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 242, 233))
    $greenB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 70, 227, 77))

    $rectD = New-Object System.Drawing.RectangleF([single]0, $yOff, [single]$size, [single]$size)
    $g.DrawString('d', $fontB, $cream, $rectD, $fmt)
    $rectE = New-Object System.Drawing.RectangleF([single]($size * 0.18), $yOff, [single]$size, [single]$size)
    $g.DrawString('!', $fontB, $greenB, $rectE, $fmt)

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $g.Dispose()
    $bmp.Dispose()
  }
}

# Social preview card, 1200x630, branded "dontbunk"
function New-OgCard([string]$outPath) {
  $w = 1200; $h = 630
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  try {
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 17, 17, 17))
    $g.FillRectangle($bg, 0, 0, $w, $h)

    $border = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 44, 44, 44), 4)
    $g.DrawRectangle($border, 24, 24, $w - 48, $h - 48)

    foreach ($dot in @(@(72, 242, 29, 47), @(116, 255, 75, 0), @(160, 183, 241, 74))) {
      $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, $dot[1], $dot[2], $dot[3]))
      $g.FillEllipse($b, [single]($dot[0] - 14), [single]62, 28, 28)
      $b.Dispose()
    }

    # Two-tone headline: "dont" cream + "bunk" lime (matches site header)
    $headline = New-Object System.Drawing.Font('Arial Black', 104, [System.Drawing.FontStyle]::Bold)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 242, 233))
    $lime = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 183, 241, 74))
    $headRect = New-Object System.Drawing.RectangleF([single]64, [single]160, [single]1120, [single]150)
    $dontW = $g.MeasureString('dont', $headline).Width
    $g.DrawString('dont', $headline, $white, $headRect)
    $bunkRect = New-Object System.Drawing.RectangleF([single](64 + $dontW), [single]160, [single]1120, [single]150)
    $g.DrawString('bunk', $headline, $lime, $bunkRect)

    $greenC = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 70, 227, 77))
    $gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 154, 154, 160))
    $courier52 = New-Object System.Drawing.Font('Courier New', 52, [System.Drawing.FontStyle]::Bold)
    $courier34 = New-Object System.Drawing.Font('Courier New', 34, [System.Drawing.FontStyle]::Bold)
    $g.DrawString('> can i bunk today?', $courier52, $greenC, (New-Object System.Drawing.RectangleF([single]70, [single]340, [single]1100, [single]80)))
    $g.DrawString('Check your safe bunk count in seconds.', $courier34, $gray, (New-Object System.Drawing.RectangleF([single]74, [single]430, [single]1100, [single]60)))

    # Lime diamond accent
    $cx = 1050; $cy = 520; $r = 42
    $pts = [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF([single]$cx, [single]($cy - $r))),
      (New-Object System.Drawing.PointF([single]($cx + $r), [single]$cy)),
      (New-Object System.Drawing.PointF([single]$cx, [single]($cy + $r))),
      (New-Object System.Drawing.PointF([single]($cx - $r), [single]$cy))
    )
    $g.FillPolygon($lime, $pts)

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $g.Dispose()
    $bmp.Dispose()
  }
}

New-DontBunkIcon (Join-Path $root 'public\icon-512.png') 512
Write-Output 'icon-512 done'
New-DontBunkIcon (Join-Path $root 'src\app\apple-icon.png') 180
Write-Output 'apple-icon done'
New-OgCard (Join-Path $root 'public\og-card.png')
Write-Output 'og-card done'
Write-Output 'ALL DONE'
