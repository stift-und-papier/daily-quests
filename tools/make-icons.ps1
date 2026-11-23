# Erzeugt die App-Icons (PNG) mit Windows-Bordmitteln – keine Installation nötig.
# Aufruf im Projektordner:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\make-icons.ps1
# Motiv: der Stern mit Gesicht (wie icons/icon.svg) auf rosa Grund.

Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
$ink    = C '#4A3B36'
$rosa   = C '#F8D7DF'
$rosaD  = C '#EFA3B6'
$butter = C '#F5D77A'
$creme  = C '#FFF8F0'

# Quadratische Bezierkurve (SVG "Q") als kubische Kurve hinzufügen
function Add-Quad($path, $p0, $q, $p2) {
  $c1 = New-Object System.Drawing.PointF(($p0.X + 2/3 * ($q.X - $p0.X)), ($p0.Y + 2/3 * ($q.Y - $p0.Y)))
  $c2 = New-Object System.Drawing.PointF(($p2.X + 2/3 * ($q.X - $p2.X)), ($p2.Y + 2/3 * ($q.Y - $p2.Y)))
  $path.AddBezier($p0, $c1, $c2, $p2)
}

function Draw-Icon([int]$size, [double]$starScale, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($rosa)

  # zartes Punktraster wie Journal-Papier
  $dot = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
  $step = $size / 12
  for ($x = $step / 2; $x -lt $size; $x += $step) { for ($y = $step / 2; $y -lt $size; $y += $step) {
    $g.FillEllipse($dot, [single]($x - $size / 160), [single]($y - $size / 160), [single]($size / 80), [single]($size / 80)) } }

  # Koordinaten im 64er-Raster → Pixel, Stern zentriert
  $u = $size * $starScale / 64
  $off = ($size - 64 * $u) / 2
  $dy = $size * 0.02   # optisch etwas tiefer
  function P([double]$x, [double]$y) { New-Object System.Drawing.PointF([single]($off + $x * $u), [single]($off + $y * $u + $dy)) }

  $pts = @((P 32 5),(P 40 22),(P 58 24.5),(P 44.8 37),(P 48.4 55),(P 32 46),(P 15.6 55),(P 19.2 37),(P 6 24.5),(P 24 22))
  $star = New-Object System.Drawing.Drawing2D.GraphicsPath
  $star.AddPolygon([System.Drawing.PointF[]]$pts)

  # weicher Schatten
  $shadow = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shadow.AddPolygon([System.Drawing.PointF[]]($pts | ForEach-Object { New-Object System.Drawing.PointF($_.X, ($_.Y + 2.2 * $u)) }))
  $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, 74, 59, 54))), $shadow)

  $g.FillPath((New-Object System.Drawing.SolidBrush($butter)), $star)
  $pen = New-Object System.Drawing.Pen($ink, [single](2.5 * $u))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawPath($pen, $star)

  # Bäckchen
  $blush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, $rosaD))
  foreach ($cx in 24, 40) { $c = P ($cx - 2.4) 33.8; $g.FillEllipse($blush, $c.X, $c.Y, [single](4.8 * $u), [single](3.2 * $u)) }
  # Augen
  $inkBrush = New-Object System.Drawing.SolidBrush($ink)
  foreach ($cx in 27.2, 36.8) { $c = P ($cx - 1.7) 29.7; $g.FillEllipse($inkBrush, $c.X, $c.Y, [single](3.4 * $u), [single](3.4 * $u)) }
  # Lächeln
  $mouth = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-Quad $mouth (P 28.4 35) (P 32 39) (P 35.6 35)
  $mp = New-Object System.Drawing.Pen($ink, [single](1.8 * $u))
  $mp.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $mp.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawPath($mp, $mouth)

  # kleiner Glitzerstern oben rechts
  $sp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $sx = 55; $sy = 8; $r = 4.5; $k = 1.3
  $sp.AddPolygon([System.Drawing.PointF[]]@((P $sx ($sy - $r)),(P ($sx + $k) ($sy - $k)),(P ($sx + $r) $sy),(P ($sx + $k) ($sy + $k)),(P $sx ($sy + $r)),(P ($sx - $k) ($sy + $k)),(P ($sx - $r) $sy),(P ($sx - $k) ($sy - $k))))
  $g.FillPath((New-Object System.Drawing.SolidBrush($creme)), $sp)
  $g.DrawPath((New-Object System.Drawing.Pen($ink, [single](1.2 * $u))), $sp)

  $g.Dispose()
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "erstellt: icons\$file"
}

Draw-Icon 192 0.80 'icon-192.png'
Draw-Icon 512 0.80 'icon-512.png'
Draw-Icon 180 0.78 'apple-touch-icon.png'
# "maskable": Android schneidet das Icon rund oder eckig zu → Motiv kleiner, damit nichts abgeschnitten wird
Draw-Icon 512 0.62 'icon-maskable-512.png'
Draw-Icon 32 0.95 'favicon-32.png'
