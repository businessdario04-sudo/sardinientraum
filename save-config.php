<?php
/**
 * save-config.php – Schreibt site-config.json für Sardinientraum
 * Authentifizierung via X-Save-Token Header
 *
 * Passwort hier ändern:
 */
$SAVE_PASSWORD = 'sardinien2025';

// ─── CORS-Header ─────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Save-Token');
header('Content-Type: text/plain; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Nur POST erlaubt.';
    exit;
}

// ─── Token-Prüfung ───────────────────────────────────────────────────────────
$token = $_SERVER['HTTP_X_SAVE_TOKEN'] ?? '';

if ($token === '') {
    http_response_code(401);
    echo 'Kein X-Save-Token Header vorhanden.';
    exit;
}

if (!hash_equals($SAVE_PASSWORD, $token)) {
    http_response_code(403);
    echo 'Ungültiger Token.';
    exit;
}

// ─── Request-Body lesen ──────────────────────────────────────────────────────
$rawBody = file_get_contents('php://input');

if ($rawBody === false || trim($rawBody) === '') {
    http_response_code(400);
    echo 'Kein JSON-Body empfangen.';
    exit;
}

// ─── JSON validieren ─────────────────────────────────────────────────────────
$decoded = json_decode($rawBody, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(422);
    echo 'Ungültiges JSON: ' . json_last_error_msg();
    exit;
}

if (!is_array($decoded)) {
    http_response_code(422);
    echo 'JSON muss ein Objekt sein.';
    exit;
}

// ─── Erlaubte Felder (Whitelist) ─────────────────────────────────────────────
$allowedKeys = [
    'contact_email',
    'prop_name',
    'prop_location',
    'phone',
    'whatsapp',
    'address',
    'maps_url',
    'formspree_id',
    'form_subject',
    'prop_persons',
    'prop_rooms',
    'prop_price',
    'checkin',
    'checkout',
    'min_nights',
    'cancel_policy',
    'site_title',
    'meta_desc',
    'instagram',
    'facebook',
    'booking',
];

// Bestehende Konfiguration laden und mergen
$configFile = __DIR__ . '/site-config.json';
$existing = [];

if (file_exists($configFile)) {
    $existingRaw = file_get_contents($configFile);
    if ($existingRaw !== false) {
        $existingDecoded = json_decode($existingRaw, true);
        if (is_array($existingDecoded)) {
            $existing = $existingDecoded;
        }
    }
}

// Nur erlaubte Felder übernehmen und mit existierender Config mergen
$sanitized = $existing;
foreach ($allowedKeys as $key) {
    if (array_key_exists($key, $decoded)) {
        $val = $decoded[$key];
        // Nur Strings und Zahlen akzeptieren (keine Arrays/Objekte in Config-Feldern)
        if (is_string($val) || is_numeric($val) || is_null($val)) {
            $sanitized[$key] = is_null($val) ? '' : (string)$val;
        }
    }
}

// ─── Datei schreiben ─────────────────────────────────────────────────────────
$json = json_encode(
    $sanitized,
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);

if ($json === false) {
    http_response_code(500);
    echo 'Fehler beim Serialisieren des JSON: ' . json_last_error_msg();
    exit;
}

// Schreiben mit exklusivem Lock
$fp = fopen($configFile, 'c');
if ($fp === false) {
    http_response_code(500);
    echo 'Datei konnte nicht geöffnet werden. Bitte Schreibrechte prüfen.';
    exit;
}

if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    http_response_code(500);
    echo 'Datei ist gesperrt. Bitte erneut versuchen.';
    exit;
}

ftruncate($fp, 0);
rewind($fp);
$written = fwrite($fp, $json);
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

if ($written === false) {
    http_response_code(500);
    echo 'Fehler beim Schreiben der Datei.';
    exit;
}

// ─── Erfolg ──────────────────────────────────────────────────────────────────
http_response_code(200);
echo 'OK';
