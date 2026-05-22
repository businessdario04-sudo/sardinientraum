<?php
/**
 * GET /api/auth-status.php
 * Liefert aktuellen Auth-Status (für Frontend-Bootstrap).
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

$loggedIn = isLoggedIn();
$setupComplete = (bool)($AUTH['setup_complete'] ?? false);

respondJson([
    'ok'             => true,
    'logged_in'      => $loggedIn,
    'user'           => $loggedIn ? ($_SESSION['user'] ?? null) : null,
    'csrf'           => $loggedIn ? csrfToken() : null,
    'setup_complete' => $setupComplete,
    'totp_enabled'   => (bool)($AUTH['totp']['enabled'] ?? false)
]);
