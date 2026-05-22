<?php
/**
 * POST /api/media-delete.php
 * Body: { "name": "20260516-abc-foto.jpg" }
 * Löscht eine Datei aus /uploads.
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

requireLogin();
checkCSRF();

if (!rateLimit('media-delete', 30, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

$body = readJsonBody();
$name = (string)($body['name'] ?? '');

// Sicherheits-Check: kein Path-Traversal
if ($name === '' || str_contains($name, '/') || str_contains($name, '\\') || str_contains($name, '..')) {
    respondJson(['ok' => false, 'error' => 'invalid_name'], 400);
}

$path = UPLOADS_DIR . '/' . $name;
if (!file_exists($path) || !is_file($path)) {
    respondJson(['ok' => false, 'error' => 'not_found'], 404);
}

// Doppel-Check: realpath muss innerhalb UPLOADS_DIR liegen
$real = realpath($path);
$uploadsReal = realpath(UPLOADS_DIR);
if (!$real || !$uploadsReal || !str_starts_with($real, $uploadsReal)) {
    respondJson(['ok' => false, 'error' => 'invalid_path'], 400);
}

if (!@unlink($path)) {
    respondJson(['ok' => false, 'error' => 'delete_failed'], 500);
}

logEvent('media_delete', ['name' => $name]);

respondJson(['ok' => true]);
