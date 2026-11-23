# Holt Schulferien und Feiertage aller 16 Bundeslaender von der freien OpenHolidays-Datenbank
# (https://www.openholidaysapi.org, Open Data) und speichert sie in js/data/ferien.js.
# Das sind die eingebauten Daten (funktionieren offline). Zusaetzlich aktualisiert die App
# die Daten des gewaehlten Bundeslands selbst einmal pro Woche (abschaltbar).
#
# Aufruf im Projektordner (z. B. einmal im Jahr, damit neue Jahre dazukommen):
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-ferien.ps1
# Danach in sw.js die VERSION um 1 erhoehen und die Datei hochladen.
param(
  [int]$FromYear = (Get-Date).Year - 1,
  [int]$ToYear = (Get-Date).Year + 2
)

$root = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root 'js\data'
New-Item -ItemType Directory -Force $outDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'https://openholidaysapi.org'

function Get-Json($url) {
  $r = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{ accept = 'application/json' }
  # Inhalt als UTF-8 lesen (Umlaute!)
  $text = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  return $text | ConvertFrom-Json
}
function Text-De($names) {
  $de = $names | Where-Object { $_.language -eq 'DE' } | Select-Object -First 1
  if ($de) { return $de.text } else { return ($names | Select-Object -First 1).text }
}

# Bundeslaender
$subs = Get-Json "$base/Subdivisions?countryIsoCode=DE&languageIsoCode=DE"
$regions = [ordered]@{}
foreach ($s in ($subs | Sort-Object { Text-De $_.name })) { $regions[$s.code] = (Text-De $s.name) }

# Ferien, jahrweise abfragen (die API erlaubt nur begrenzte Zeitraeume)
$items = @()
for ($y = $FromYear; $y -le $ToYear; $y++) {
  $list = Get-Json "$base/SchoolHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom=$y-01-01&validTo=$y-12-31"
  foreach ($h in $list) {
    $codes = @($h.subdivisions | ForEach-Object { $_.code })
    if (-not $codes.Count) { $codes = @($regions.Keys) }   # bundesweit
    $items += [pscustomobject]@{ id = $h.id; r = $codes; from = $h.startDate; to = $h.endDate; name = (Text-De $h.name) }
  }
}
# doppelte Eintraege entfernen (Ferien ueber den Jahreswechsel kommen in zwei Abfragen vor) - nur nach id!
$items = $items | Group-Object id | ForEach-Object { $_.Group[0] } | Sort-Object from, name

# Gesetzliche Feiertage
$feiertage = @()
for ($y = $FromYear; $y -le $ToYear; $y++) {
  $list = Get-Json "$base/PublicHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom=$y-01-01&validTo=$y-12-31"
  foreach ($h in $list) {
    $codes = @($h.subdivisions | ForEach-Object { $_.code })
    $local = $false
    if ($h.nationwide -or -not $codes.Count) { $codes = @($regions.Keys) }
    else {
      # z. B. DE-BY-AU (nur Augsburg) -> Bundesland DE-BY, als "nur oertlich" markiert
      $parents = @($codes | Where-Object { $_.Split('-').Count -gt 2 } | ForEach-Object { ($_.Split('-')[0..1]) -join '-' })
      $plain = @($codes | Where-Object { $_.Split('-').Count -eq 2 })
      if ($parents.Count -and -not $plain.Count) { $local = $true }
      $codes = @(($plain + $parents) | Sort-Object -Unique)
    }
    $o = [ordered]@{ r = $codes; date = $h.startDate; name = (Text-De $h.name) }
    if ($local) { $o.local = 1 }
    $feiertage += [pscustomobject]@{ id = $h.id; o = $o }
  }
}
$feiertage = @($feiertage | Group-Object id | ForEach-Object { $_.Group[0].o } | Sort-Object { $_.date })

$data = [ordered]@{
  source  = 'OpenHolidays API (openholidaysapi.org), Open Data'
  updated = (Get-Date -Format 'yyyy-MM-dd')
  years   = @($FromYear, $ToYear)
  regions = $regions
  holidays = @($items | ForEach-Object { [ordered]@{ r = $_.r; from = $_.from; to = $_.to; name = $_.name } })
  feiertage = $feiertage
}
$json = $data | ConvertTo-Json -Depth 6 -Compress
$js = "// Automatisch erzeugt von tools/update-ferien.ps1 - nicht von Hand bearbeiten.`n// Quelle: OpenHolidays API (openholidaysapi.org), Open Data.`nexport default $json;`n"
[IO.File]::WriteAllText((Join-Path $outDir 'ferien.js'), $js, (New-Object Text.UTF8Encoding($false)))
"Gespeichert: js\data\ferien.js  ($($items.Count) Ferienzeitraeume, $($feiertage.Count) Feiertage, $($regions.Count) Bundeslaender, $FromYear-$ToYear)"
