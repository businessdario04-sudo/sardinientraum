<?php
// ══════════════════════════════════════════════════════════════
//  Sardinientraum – Save-Endpoint
//  Schreibt index.html wenn das richtige Passwort übermittelt wird.
//
//  ➜ Passwort hier ändern (muss mit Admin-Panel übereinstimmen):
$SAVE_PASSWORD = 'sardinien2025';
// ══════════════════════════════════════════════════════════════

$file = __DIR__ . '/index.html';

// CORS-Header damit der Browser aus index.html heraus POSTen darf
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Save-Token');
header('Content-Type: text/plain; charset=utf-8');

// Preflight-Request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Nur POST erlaubt
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

// Passwort-Prüfung
$token = $_SERVER['HTTP_X_SAVE_TOKEN'] ?? '';
if ($token !== $SAVE_PASSWORD) {
    http_response_code(401);
    echo 'Unauthorized';
    exit;
}

// HTML-Body lesen
$html = file_get_contents('php://input');
if (empty(trim($html))) {
    http_response_code(400);
    echo 'Empty content';
    exit;
}

// Sicherheits-Check: muss wie eine HTML-Datei aussehen
if (stripos($html, '<!DOCTYPE html>') === false && stripos($html, '<html') === false) {
    http_response_code(400);
    echo 'Invalid content';
    exit;
}

// Schreiben
if (file_put_contents($file, $html) === false) {
    http_response_code(500);
    echo 'Write failed – Schreibrechte prüfen';
    exit;
}

http_response_code(200);
echo 'OK';
