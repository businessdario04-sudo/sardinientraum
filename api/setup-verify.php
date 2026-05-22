<?php
/**
 * POST /api/setup-verify.php
 * Bestätigt das 2FA-Setup: User scannte QR mit Authenticator-App
 * und gibt jetzt einen Code ein. Wenn der stimmt → setup_complete = true.
 *
 * Body: { "totp": "123456" }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_totp.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if (!rateLimit('setup-verify', 5, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

$auth = readJson(DATA_DIR . '/auth.json');

// Nur wenn setup-init ausgeführt wurde aber noch nicht fertig
if (empty($auth['_pending_setup']) || !empty($auth['setup_complete'])) {
    respondJson(['ok' => false, 'error' => 'no_pending_setup'], 400);
}

$body = readJsonBody();
$code = preg_replace('/\D/', '', (string)($body['totp'] ?? ''));
$secret = (string)($auth['totp']['secret'] ?? '');

if (strlen($code) !== 6 || $secret === '') {
    respondJson(['ok' => false, 'error' => 'invalid_input'], 400);
}

if (!totpVerify($secret, $code)) {
    logEvent('setup_verify_fail', []);
    respondJson(['ok' => false, 'error' => 'totp_invalid'], 401);
}

// Setup als abgeschlossen markieren
$auth['totp']['enabled'] = true;
$auth['setup_complete']  = true;
unset($auth['_pending_setup']);

if (!writeJson(DATA_DIR . '/auth.json', $auth)) {
    respondJson(['ok' => false, 'error' => 'write_failed'], 500);
}

logEvent('setup_complete', ['user' => $auth['user']['name'] ?? '']);

respondJson([
    'ok'      => true,
    'message' => 'Setup abgeschlossen! Du kannst dich jetzt einloggen.'
]);
