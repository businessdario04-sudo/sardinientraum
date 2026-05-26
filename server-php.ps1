# ═══════════════════════════════════════════════════════════════════
#  Sardinientraum — PHP-Entwicklungsserver (v2)
#  Ersetzt den alten server-starten.ps1
#
#  Starten: Rechtsklick → "Mit PowerShell ausführen"
#  Beenden:  Fenster schließen oder STRG+C
# ═══════════════════════════════════════════════════════════════════

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─── PHP prüfen ────────────────────────────────────────────────────
$phpPath = (Get-Command php -ErrorAction SilentlyContinue)?.Source
if (-not $phpPath) {
    Write-Host ""
    Write-Host "  ✗ PHP nicht gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  PHP installieren: https://windows.php.net/download/" -ForegroundColor Yellow
    Write-Host "  Empfohlen: PHP 8.2+ x64 Thread Safe, zip entpacken," -ForegroundColor Yellow
    Write-Host "  Ordner zu PATH hinzufügen." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# ─── Port wählen: 8080 bevorzugt, sonst 8082 ──────────────────────
$port = 8080
$taken = $false
try {
    $test = New-Object System.Net.Sockets.TcpClient
    $test.Connect('localhost', $port)
    $test.Close()
    $taken = $true
} catch { }

if ($taken) {
    $port = 8082
    Write-Host "  ⚠ Port 8080 belegt (alter PS-Server läuft?) → benutze Port $port" -ForegroundColor Yellow
}

# ─── Netzwerk-IP ermitteln ─────────────────────────────────────────
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch 'Loopback' -and
    $_.IPAddress -notmatch '^169\.'
} | Select-Object -First 1).IPAddress

# ─── Info ausgeben ─────────────────────────────────────────────────
Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🌊 Sardinientraum — PHP-Server (v2)"          -ForegroundColor White
Write-Host ""
Write-Host "  Am PC:      http://localhost:$port"           -ForegroundColor Green
Write-Host "  Am Handy:   http://$($ip):$port"              -ForegroundColor Yellow
Write-Host ""
Write-Host "  Admin-Panel:  http://localhost:$port/admin.html"  -ForegroundColor White
Write-Host ""
Write-Host "  PHP: $phpPath"                                -ForegroundColor Gray
Write-Host "  Root: $root"                                  -ForegroundColor Gray
Write-Host ""
Write-Host "  Handy muss im selben WLAN sein!"              -ForegroundColor Gray
Write-Host "  Fenster schließen oder STRG+C = Server stoppen" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── PHP-Server starten ────────────────────────────────────────────
Set-Location $root
& php -S "0.0.0.0:$port" -t $root
