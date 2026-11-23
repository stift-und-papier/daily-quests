# Kleiner lokaler Webserver für Daily Quests (nur zum Testen auf diesem PC).
# Start:  powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
# Oder einfach Doppelklick auf "start-server.cmd".
# Beenden: Fenster schließen oder Strg+C.
param([int]$Port = 8080)

$root = (Resolve-Path $PSScriptRoot).Path.TrimEnd('\') + '\'
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.woff' = 'font/woff'
  '.ttf'  = 'font/ttf'
  '.md'   = 'text/plain; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
# Nur "localhost": Der Server ist von anderen Geräten im Netz aus NICHT erreichbar.
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host ""
Write-Host "  Daily Quests laeuft auf  http://localhost:$Port/" -ForegroundColor Green
Write-Host "  Beenden: dieses Fenster schliessen oder Strg+C" -ForegroundColor DarkGray
Write-Host ""

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(500)) { }   # kurz warten, damit Strg+C funktioniert
    $ctx = $task.Result
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $res.StatusCode = 404
        $res.ContentType = 'text/plain; charset=utf-8'
        $bytes = [Text.Encoding]::UTF8.GetBytes('404 - nicht gefunden')
      } else {
        $bytes = [IO.File]::ReadAllBytes($full)
        $ext = [IO.Path]::GetExtension($full).ToLower()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
      }
      $res.Headers['Cache-Control'] = 'no-cache'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("{0}  {1}" -f $res.StatusCode, $req.Url.AbsolutePath) -ForegroundColor DarkGray
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
