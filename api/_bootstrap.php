<?php
/**
 * ════════════════════════════════════════════════════════════
 *  Sardinientraum API — Bootstrap
 *  Wird von jedem API-Endpoint per require_once geladen.
 *  Stellt bereit:
 *    - sichere Session
 *    - Config + Auth-Daten geladen
 *    - CORS auf eigene Domain begrenzt
 *    - Security-Header
 *    - Helper: requireLogin(), checkCSRF(), rateLimit(), respondJson()
 * ════════════════════════════════════════════════════════════
 */
declare(strict_types=1);

// ─── Pfade ───────────────────────────────────────────────────
define('APP_ROOT',  dirname(__DIR__));
define('DATA_DIR',  APP_ROOT . '/data');
define('UPLOADS_DIR', APP_ROOT . '/uploads');
define('LOG_DIR',   DATA_DIR . '/logs');

// ─── Error-Display: NUR in Logs, niemals an User ────────────
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors',     '1');
ini_set('error_log',      LOG_DIR . '/php-errors.log');

// ─── Security-Header (auch wenn .htaccess sie schon setzt) ──
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');

// ─── CORS: nur eigene Domain erlauben ───────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST']   ?? '';
$isLocal = in_array($host, ['localhost:8080', '127.0.0.1:8080', 'localhost', '127.0.0.1'], true);

$allowedOrigins = $isLocal
    ? ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost', 'http://127.0.0.1']
    : ['https://' . $host, 'http://' . $host];   // Production: gleiche Domain

if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Session sicher konfigurieren ───────────────────────────
ini_set('session.use_only_cookies', '1');
ini_set('session.use_strict_mode',  '1');
ini_set('session.cookie_httponly',  '1');
ini_set('session.cookie_samesite',  'Strict');
if (!$isLocal) {
    ini_set('session.cookie_secure', '1');    // HTTPS-only in Production
}
session_name('SARDINIA_SESS');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ─── JSON-Datenstore-Helper ─────────────────────────────────

/**
 * JSON-Datei lesen, gegen leere/kaputte Dateien geschützt.
 * @return array Decoded JSON oder leeres Array bei Fehler.
 */
function readJson(string $file): array {
    if (!file_exists($file)) return [];
    $raw = @file_get_contents($file);
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * JSON-Datei atomar schreiben (temp + rename), mit Lock.
 * @return bool Erfolg.
 */
function writeJson(string $file, array $data): bool {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;

    $dir = dirname($file);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) return false;

    $tmp = $file . '.tmp.' . bin2hex(random_bytes(4));
    $fp  = @fopen($tmp, 'w');
    if (!$fp) return false;

    if (!flock($fp, LOCK_EX)) { fclose($fp); @unlink($tmp); return false; }
    $written = fwrite($fp, $json);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if ($written === false) { @unlink($tmp); return false; }

    if (!rename($tmp, $file)) { @unlink($tmp); return false; }
    return true;
}

// ─── Config laden ───────────────────────────────────────────
$CONFIG = readJson(DATA_DIR . '/config.json');
$AUTH   = readJson(DATA_DIR . '/auth.json');

// ─── Rate-Limiting (Flat-File pro IP) ───────────────────────

function clientIp(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Rate-Limit-Check.
 * @param string $key      Endpoint-Kennung, z.B. 'login' oder 'save'.
 * @param int    $maxHits  Max. Versuche pro $windowSec.
 * @param int    $windowSec Zeitfenster in Sekunden.
 * @return bool true wenn erlaubt, false wenn blockiert.
 */
function rateLimit(string $key, int $maxHits = 30, int $windowSec = 60): bool {
    $ip   = preg_replace('/[^0-9a-fA-F:.]/', '', clientIp());
    $hash = substr(hash('sha256', $ip), 0, 16);
    $file = LOG_DIR . "/ratelimit-{$key}-{$hash}.json";
    $now  = time();

    if (!is_dir(LOG_DIR)) @mkdir(LOG_DIR, 0755, true);

    $log = readJson($file);
    $hits = $log['hits'] ?? [];
    // Alte Einträge wegfiltern
    $hits = array_values(array_filter($hits, fn($t) => $t > ($now - $windowSec)));

    if (count($hits) >= $maxHits) {
        return false;
    }
    $hits[] = $now;
    writeJson($file, ['hits' => $hits]);
    return true;
}

// ─── CSRF-Schutz ────────────────────────────────────────────

function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function checkCSRF(): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'], true)) return;

    $expected = $_SESSION['csrf_token'] ?? '';
    $sent     = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (!$expected || !hash_equals($expected, (string)$sent)) {
        respondJson(['ok' => false, 'error' => 'csrf_mismatch'], 403);
    }
}

// ─── Auth-Prüfung ───────────────────────────────────────────

function isLoggedIn(): bool {
    if (empty($_SESSION['user'])) return false;
    if (empty($_SESSION['login_time'])) return false;

    // Session-Timeout
    global $AUTH;
    $timeoutMin = (int)($AUTH['session']['timeout_minutes'] ?? 30);
    $maxAge = $timeoutMin * 60;
    if (time() - $_SESSION['login_time'] > $maxAge) {
        session_destroy();
        return false;
    }
    return true;
}

function requireLogin(): void {
    if (!isLoggedIn()) {
        respondJson(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    // Activity touch
    $_SESSION['login_time'] = time();
}

// ─── Response-Helper ────────────────────────────────────────

function respondJson(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function respondText(string $text, int $status = 200, string $mime = 'text/plain'): void {
    http_response_code($status);
    header('Content-Type: ' . $mime . '; charset=utf-8');
    echo $text;
    exit;
}

// ─── Logging-Helper (kompakt) ───────────────────────────────

function logEvent(string $type, array $context = []): void {
    if (!is_dir(LOG_DIR)) @mkdir(LOG_DIR, 0755, true);
    $line = json_encode([
        'time' => date('c'),
        'ip'   => clientIp(),
        'type' => $type,
        'ctx'  => $context
    ], JSON_UNESCAPED_UNICODE);
    @file_put_contents(LOG_DIR . '/events.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// ─── Input-Helper ───────────────────────────────────────────

function readJsonBody(): array {
    $raw = @file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function sanitizeString(string $s, int $maxLen = 1000): string {
    $s = trim($s);
    if (mb_strlen($s) > $maxLen) $s = mb_substr($s, 0, $maxLen);
    // Steuerzeichen raus (außer Tab/CR/LF)
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
}
