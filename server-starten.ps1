$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ══════════════════════════════════════════════════════════════
#  SAFE-SAVE-MODE  —  schützt index.html vor versehentlichem Überschreiben
#  $true  → /save schreibt in index.draft.html (Default, sicher)
#  $false → /save schreibt direkt in index.html (gefährlich)
#  Wechsel auf Live: POST /promote-draft (validiert + sichert Backup)
# ══════════════════════════════════════════════════════════════
$SAFE_SAVE_MODE = $true

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Fehler: Eventuell Administratorrechte benoetigt. Starte als Admin neu." -ForegroundColor Red
    pause
    exit
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169'
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Server laeuft!" -ForegroundColor Green
Write-Host ""
Write-Host "  Am PC:     http://localhost:$port" -ForegroundColor White
Write-Host "  Am Handy:  http://$($ip):$port" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Handy muss im selben WLAN sein!" -ForegroundColor Gray
Write-Host "  Fenster schliessen = Server stoppen" -ForegroundColor Gray
Write-Host ""
if ($SAFE_SAVE_MODE) {
    Write-Host "  [SAFE MODE AKTIV]  Saves -> index.draft.html" -ForegroundColor Green
    Write-Host "  Live setzen via POST /promote-draft im Admin-Panel" -ForegroundColor Gray
} else {
    Write-Host "  !! SAFE MODE AUS !! /save ueberschreibt index.html direkt !!" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

function Send-Response {
    param($res, $status, $body, $mime = "text/plain; charset=utf-8")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.StatusCode      = $status
    $res.ContentType     = $mime
    $res.ContentLength64 = [long]$bytes.LongLength
    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
}

while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $res  = $ctx.Response
    $method = $req.HttpMethod
    $urlPath = $req.Url.LocalPath

    Write-Host "$(Get-Date -Format 'HH:mm:ss')  $method $urlPath"

    # ── CORS preflight ──────────────────────────────────────────
    if ($method -eq 'OPTIONS') {
        Send-Response $res 204 ""
        continue
    }

    # ── POST /save  →  HTML auf Festplatte schreiben ────────────
    # Safe-Mode: schreibt in index.draft.html
    # Unsafe-Mode: schreibt direkt in index.html
    if ($method -eq 'POST' -and $urlPath -eq '/save') {
        try {
            $reader  = [System.IO.StreamReader]::new($req.InputStream, [System.Text.Encoding]::UTF8)
            $html    = $reader.ReadToEnd()
            $reader.Close()

            # ── Validierung: muss eine echte HTML-Datei sein ──
            $isHtml  = $html -match '(?i)<!DOCTYPE html>' -and $html -match '(?i)</html>'
            $minSize = 10000
            if (-not $isHtml -or $html.Length -lt $minSize) {
                Write-Host "  --> ABGELEHNT: zu klein ($($html.Length) Bytes) oder kein HTML" -ForegroundColor Yellow
                Send-Response $res 422 "Inhalt zu klein oder kein gueltiges HTML (min $minSize Bytes, mit DOCTYPE und </html>)"
                continue
            }

            if ($SAFE_SAVE_MODE) {
                $target = Join-Path $root 'index.draft.html'
                $label  = 'index.draft.html'
            } else {
                $target = Join-Path $root 'index.html'
                $label  = 'index.html (DIREKT - Safe Mode aus!)'
                # Backup wenn direkt geschrieben wird
                if (Test-Path $target) {
                    Copy-Item $target (Join-Path $root 'index.html.bak') -Force
                }
            }

            $utf8nob = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($target, $html, $utf8nob)

            Write-Host "  --> $label gespeichert ($([Math]::Round($html.Length/1024,1)) KB)" -ForegroundColor Green
            $mode = if ($SAFE_SAVE_MODE) { 'draft' } else { 'live' }
            Send-Response $res 200 "OK:$mode"
        } catch {
            Write-Host "  --> FEHLER beim Speichern: $_" -ForegroundColor Red
            Send-Response $res 500 "Fehler: $_"
        }
        continue
    }

    # ── POST /save-live  →  Direkt in index.html schreiben ──────
    # Override des Safe-Modes (für Editor-Button "Direkt live")
    # Mit Validierung + Backup
    if ($method -eq 'POST' -and $urlPath -eq '/save-live') {
        try {
            $reader = [System.IO.StreamReader]::new($req.InputStream, [System.Text.Encoding]::UTF8)
            $html   = $reader.ReadToEnd()
            $reader.Close()

            $isHtml = $html -match '(?i)<!DOCTYPE html>' -and $html -match '(?i)</html>'
            if (-not $isHtml -or $html.Length -lt 10000) {
                Send-Response $res 422 "Inhalt zu klein oder kein gueltiges HTML (min 10000 Bytes, mit DOCTYPE und </html>)"
                continue
            }

            $live = Join-Path $root 'index.html'

            # Backup mit Timestamp
            if (Test-Path $live) {
                $ts = Get-Date -Format 'yyyy-MM-dd_HHmmss'
                $backup = Join-Path $root "index.html.backup-$ts.html"
                Copy-Item $live $backup -Force
                Write-Host "  --> Backup: index.html.backup-$ts.html" -ForegroundColor Cyan
            }

            $utf8nob = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($live, $html, $utf8nob)
            Write-Host "  --> DIREKT LIVE: index.html gespeichert ($([Math]::Round($html.Length/1024,1)) KB)" -ForegroundColor Yellow
            Send-Response $res 200 "OK"
        } catch {
            Send-Response $res 500 "Fehler: $_"
        }
        continue
    }

    # ── POST /promote-draft  →  index.draft.html → index.html ───
    # Validiert + sichert Backup + nur dann Promote
    if ($method -eq 'POST' -and $urlPath -eq '/promote-draft') {
        try {
            $draft = Join-Path $root 'index.draft.html'
            $live  = Join-Path $root 'index.html'

            if (-not (Test-Path $draft)) {
                Send-Response $res 404 "Keine Draft-Datei vorhanden. Erst im Editor speichern."
                continue
            }

            $draftHtml = [System.IO.File]::ReadAllText($draft, [System.Text.Encoding]::UTF8)
            $isHtml    = $draftHtml -match '(?i)<!DOCTYPE html>' -and $draftHtml -match '(?i)</html>'
            if (-not $isHtml -or $draftHtml.Length -lt 10000) {
                Send-Response $res 422 "Draft ungueltig - kann nicht promoted werden."
                continue
            }

            # Backup von Live mit Timestamp
            if (Test-Path $live) {
                $ts = Get-Date -Format 'yyyy-MM-dd_HHmmss'
                $backup = Join-Path $root "index.html.backup-$ts.html"
                Copy-Item $live $backup -Force
                Write-Host "  --> Backup: index.html.backup-$ts.html" -ForegroundColor Cyan
            }

            # Promote
            Copy-Item $draft $live -Force
            Write-Host "  --> PROMOTED: index.draft.html -> index.html (LIVE!)" -ForegroundColor Green
            Send-Response $res 200 "OK"
        } catch {
            Write-Host "  --> FEHLER bei Promote: $_" -ForegroundColor Red
            Send-Response $res 500 "Fehler: $_"
        }
        continue
    }

    # ── GET /save-status  →  Safe-Mode-Status + Draft-Info ──────
    if ($method -eq 'GET' -and $urlPath -eq '/save-status') {
        $draft = Join-Path $root 'index.draft.html'
        $draftExists = Test-Path $draft
        $draftTime   = if ($draftExists) { (Get-Item $draft).LastWriteTime.ToString('s') } else { '' }
        $draftSize   = if ($draftExists) { (Get-Item $draft).Length } else { 0 }
        $body = "{`"safeMode`":$($SAFE_SAVE_MODE.ToString().ToLower()),`"draftExists`":$($draftExists.ToString().ToLower()),`"draftTime`":`"$draftTime`",`"draftSize`":$draftSize}"
        Send-Response $res 200 $body 'application/json; charset=utf-8'
        continue
    }

    # ── POST /save-config  →  site-config.json schreiben ────────
    if ($method -eq 'POST' -and $urlPath -eq '/save-config') {
        try {
            $reader = [System.IO.StreamReader]::new($req.InputStream, [System.Text.Encoding]::UTF8)
            $json   = $reader.ReadToEnd()
            $reader.Close()

            # JSON validieren
            try { $null = $json | ConvertFrom-Json } catch {
                Send-Response $res 422 "Ungueltiges JSON: $_"
                continue
            }

            $target  = Join-Path $root 'site-config.json'
            $utf8nob = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($target, $json, $utf8nob)

            Write-Host "  --> site-config.json gespeichert" -ForegroundColor Green
            Send-Response $res 200 "OK"
        } catch {
            Write-Host "  --> FEHLER beim Config-Speichern: $_" -ForegroundColor Red
            Send-Response $res 500 "Fehler: $_"
        }
        continue
    }

    # ── GET  →  statische Datei ausliefern ───────────────────────
    $local = $urlPath.Replace('/', '\')
    $path  = Join-Path $root $local
    if ($path -match '\\$' -or (Test-Path $path -PathType Container)) {
        $path = Join-Path $path 'index.html'
    }

    if (Test-Path $path -PathType Leaf) {
        $ext   = [System.IO.Path]::GetExtension($path).ToLower()
        $mime  = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $res.ContentType     = $mime
        $res.ContentLength64 = [long]$bytes.LongLength
        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        if ($method -ne 'HEAD') {
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $res.Close()
    } else {
        $res.StatusCode = 404
        if ($method -ne 'HEAD') {
            $body  = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $res.ContentLength64 = $body.Length
            $res.OutputStream.Write($body, 0, $body.Length)
        }
        $res.Close()
    }
}
