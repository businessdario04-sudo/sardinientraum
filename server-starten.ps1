$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

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

    # ── POST /save  →  index.html auf Festplatte schreiben ──────
    if ($method -eq 'POST' -and $urlPath -eq '/save') {
        try {
            $reader  = [System.IO.StreamReader]::new($req.InputStream, [System.Text.Encoding]::UTF8)
            $html    = $reader.ReadToEnd()
            $reader.Close()

            $target  = Join-Path $root 'index.html'
            $utf8nob = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($target, $html, $utf8nob)

            Write-Host "  --> index.html gespeichert ($([Math]::Round($html.Length/1024,1)) KB)" -ForegroundColor Green
            Send-Response $res 200 "OK"
        } catch {
            Write-Host "  --> FEHLER beim Speichern: $_" -ForegroundColor Red
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
