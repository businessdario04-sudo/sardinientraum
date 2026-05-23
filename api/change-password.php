<?php
/**
 * POST /api/change-password.php
 * Ändert das Admin-Passwort.
 * Body: { current_password, new_password, confirm_password }
 * Auth: Login + CSRF erforderlich.
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

requireLogin();
checkCSRF();

if (!rateLimit('change-password', 5, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

$body    = readJsonBody();
$current = (string)($body['current_password']  ?? '');
$newPass = (string)($body['new_password']       ?? '');
$confirm = (string)($body['confirm_password']   ?? '');

if (strlen($newPass) < 8) {
    respondJson(['ok' => false, 'msg' => 'Mindestens 8 Zeichen erforderlich.'], 422);
}
if ($newPass !== $confirm) {
    respondJson(['ok' => false, 'msg' => 'Passwörter stimmen nicht überein.'], 422);
}

$auth = readJson(DATA_DIR . '/auth.json');
if (empty($auth['user']['password_hash'])) {
    respondJson(['ok' => false, 'msg' => 'Kein Passwort-Hash gefunden.'], 500);
}

if (!password_verify($current, $auth['user']['password_hash'])) {
    logEvent('password_change_failed');
    respondJson(['ok' => false, 'msg' => 'Aktuelles Passwort ist falsch.'], 403);
}

$auth['user']['password_hash']       = password_hash($newPass, PASSWORD_BCRYPT, ['cost' => 12]);
$auth['user']['password_changed_at'] = date('c');

if (!writeJson(DATA_DIR . '/auth.json', $auth)) {
    respondJson(['ok' => false, 'msg' => 'Speichern fehlgeschlagen.'], 500);
}

logEvent('password_changed');
respondJson(['ok' => true]);
