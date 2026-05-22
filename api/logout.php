<?php
/**
 * POST /api/logout.php
 * Beendet die Session sicher.
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

$_SESSION = [];

// Session-Cookie clearen
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 42000,
        'path'     => $params['path'],
        'domain'   => $params['domain'],
        'secure'   => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => $params['samesite'] ?? 'Strict',
    ]);
}

session_destroy();

logEvent('logout', []);

respondJson(['ok' => true]);
