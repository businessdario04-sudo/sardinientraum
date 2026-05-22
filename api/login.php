<?php
/**
 * POST /api/login.php
 * Body: { "username": "...", "password": "...", "totp": "123456" (optional) }
 * Antwort:
 *   200 { ok: true, csrf: "..." }
 *   401 { ok: false, error: "invalid_credentials" }
 *   401 { ok: false, error: "totp_required" }    ← TOTP fehlt
 *   401 { ok: false, error: "totp_invalid" }     ← TOTP falsch
 *   429 { ok: false, error: "locked_out", retry_after_sec: N }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_totp.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

// Rate-Limit: max 5 Login-Versuche pro IP pro Minute
if (!rateLimit('login', 5, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests', 'retry_after_sec' => 60], 429);
}

$body     = readJsonBody();
$username = sanitizeString((string)($body['username'] ?? ''), 50);
$password = (string)($body['password'] ?? '');
$totpCode = preg_replace('/\D/', '', (string)($body['totp'] ?? ''));

if ($username === '' || $password === '') {
    respondJson(['ok' => false, 'error' => 'missing_fields'], 400);
}

// Auth-Daten frisch laden (auch falls inzwischen geändert)
$auth = readJson(DATA_DIR . '/auth.json');

// ─── Lockout-Check ──────────────────────────────────────────
$lockoutFile = LOG_DIR . '/login-attempts-' . substr(hash('sha256', clientIp()), 0, 16) . '.json';
$lockState   = readJson($lockoutFile);
$now         = time();
$maxAttempts = (int)($auth['lockout']['max_attempts']   ?? 5);
$lockoutMin  = (int)($auth['lockout']['lockout_minutes'] ?? 15);

$attempts = $lockState['attempts'] ?? [];
$attempts = array_values(array_filter($attempts, fn($t) => $t > ($now - $lockoutMin * 60)));

if (count($attempts) >= $maxAttempts) {
    $oldest    = min($attempts);
    $retryIn   = ($oldest + $lockoutMin * 60) - $now;
    logEvent('login_lockout', ['user' => $username]);
    respondJson([
        'ok'             => false,
        'error'          => 'locked_out',
        'retry_after_sec' => max(0, $retryIn)
    ], 429);
}

// ─── Setup noch nicht durchgeführt? ─────────────────────────
if (!($auth['setup_complete'] ?? false)) {
    respondJson(['ok' => false, 'error' => 'setup_required'], 403);
}

// ─── Username prüfen ────────────────────────────────────────
$storedUser = (string)($auth['user']['name'] ?? '');
if ($storedUser === '' || !hash_equals($storedUser, $username)) {
    $attempts[] = $now;
    writeJson($lockoutFile, ['attempts' => $attempts]);
    logEvent('login_fail', ['reason' => 'user_unknown', 'user' => $username]);
    // Generic-Error: nicht verraten ob User oder Pass falsch
    respondJson(['ok' => false, 'error' => 'invalid_credentials'], 401);
}

// ─── Passwort prüfen ────────────────────────────────────────
$hash = (string)($auth['user']['password_hash'] ?? '');
if ($hash === '' || !password_verify($password, $hash)) {
    $attempts[] = $now;
    writeJson($lockoutFile, ['attempts' => $attempts]);
    logEvent('login_fail', ['reason' => 'bad_password', 'user' => $username]);
    respondJson(['ok' => false, 'error' => 'invalid_credentials'], 401);
}

// ─── 2FA prüfen falls aktiv ─────────────────────────────────
$totpEnabled = (bool)($auth['totp']['enabled'] ?? false);
if ($totpEnabled) {
    $secret = (string)($auth['totp']['secret'] ?? '');
    if ($secret === '') {
        // Fehl-Konfiguration: 2FA an, aber kein Secret
        respondJson(['ok' => false, 'error' => 'totp_misconfigured'], 500);
    }
    if ($totpCode === '') {
        // Erster Schritt war Login-Daten OK, jetzt nach TOTP fragen
        respondJson(['ok' => false, 'error' => 'totp_required'], 401);
    }

    $codeOK = totpVerify($secret, $totpCode);

    // Backup-Code-Fallback (8 Hex-Codes, einmalig verbraucht)
    if (!$codeOK && !empty($auth['totp']['backup_codes'])) {
        foreach ($auth['totp']['backup_codes'] as $idx => $hashedCode) {
            if (password_verify(strtoupper($totpCode), $hashedCode)) {
                $codeOK = true;
                // Backup-Code verbrauchen
                unset($auth['totp']['backup_codes'][$idx]);
                $auth['totp']['backup_codes'] = array_values($auth['totp']['backup_codes']);
                writeJson(DATA_DIR . '/auth.json', $auth);
                logEvent('login_backup_used', ['user' => $username, 'remaining' => count($auth['totp']['backup_codes'])]);
                break;
            }
        }
    }

    if (!$codeOK) {
        $attempts[] = $now;
        writeJson($lockoutFile, ['attempts' => $attempts]);
        logEvent('login_fail', ['reason' => 'bad_totp', 'user' => $username]);
        respondJson(['ok' => false, 'error' => 'totp_invalid'], 401);
    }
}

// ─── Login erfolgreich ──────────────────────────────────────

// Reset failed attempts
@unlink($lockoutFile);

// Session-ID rotieren (Schutz vor Session-Fixation)
session_regenerate_id(true);

$_SESSION['user']       = $username;
$_SESSION['login_time'] = $now;
$_SESSION['ip']         = clientIp();

// Frisches CSRF-Token generieren
unset($_SESSION['csrf_token']);
$csrf = csrfToken();

logEvent('login_success', ['user' => $username]);

respondJson([
    'ok'           => true,
    'csrf'         => $csrf,
    'user'         => $username,
    'session_max_age_min' => (int)($auth['session']['timeout_minutes'] ?? 30)
]);
