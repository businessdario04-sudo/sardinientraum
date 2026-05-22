<?php
/**
 * POST /api/setup-init.php
 * Erst-Setup: Setzt Admin-Username + Passwort, generiert 2FA-Secret.
 * Funktioniert NUR wenn setup_complete === false (Schutz vor späterem Overwrite).
 *
 * Body: { "username": "...", "password": "..." }
 * Antwort: { ok, totp_secret, totp_uri, backup_codes }
 *   → Frontend zeigt QR-Code aus totp_uri an
 *   → User scannt, gibt Code in setup-verify.php ein
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_totp.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if (!rateLimit('setup', 3, 300)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

$auth = readJson(DATA_DIR . '/auth.json');

// Setup darf nur EINMAL passieren — wenn schon fertig, blockieren
if (!empty($auth['setup_complete'])) {
    respondJson(['ok' => false, 'error' => 'setup_already_done'], 403);
}

$body     = readJsonBody();
$username = sanitizeString((string)($body['username'] ?? ''), 50);
$password = (string)($body['password'] ?? '');

if ($username === '' || strlen($username) < 3) {
    respondJson(['ok' => false, 'error' => 'username_too_short'], 400);
}
if (strlen($password) < 10) {
    respondJson(['ok' => false, 'error' => 'password_too_short'], 400);
}

// Passwort-Stärke: muss Buchstaben + Ziffer enthalten
if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
    respondJson(['ok' => false, 'error' => 'password_too_weak'], 400);
}

// Passwort hashen
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

// TOTP-Secret + Backup-Codes generieren (noch nicht aktivieren!)
$secret      = totpGenerateSecret();
$backupCodes = totpBackupCodes(8);
$hashedBackups = array_map(
    fn($c) => password_hash($c, PASSWORD_BCRYPT, ['cost' => 10]),
    $backupCodes
);

$companyName = $CONFIG['company']['name'] ?? 'Sardinientraum';
$totpUri = totpUri($secret, $username, $companyName);

// Session-Pepper für zusätzlichen Schutz
$pepper = bin2hex(random_bytes(32));

// In auth.json schreiben — aber setup_complete NOCH FALSE (erst nach verify)
$auth['user'] = [
    'name'                 => $username,
    'password_hash'        => $hash,
    'password_changed_at'  => date('c'),
];
$auth['totp'] = [
    'enabled'      => false,      // wird in setup-verify.php auf true gesetzt
    'secret'       => $secret,
    'backup_codes' => $hashedBackups,
];
$auth['session']['pepper'] = $pepper;
$auth['_pending_setup'] = true;   // Marker: Verify ausstehend

if (!writeJson(DATA_DIR . '/auth.json', $auth)) {
    respondJson(['ok' => false, 'error' => 'write_failed'], 500);
}

logEvent('setup_init', ['user' => $username]);

respondJson([
    'ok'           => true,
    'totp_secret'  => $secret,
    'totp_uri'     => $totpUri,
    'backup_codes' => $backupCodes,   // NUR HIER im Klartext zurückgegeben!
    'next_step'    => 'verify_totp'
]);
