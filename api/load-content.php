<?php
/**
 * GET /api/load-content.php?target=pages|config|faq
 * Liefert frontend-relevante Daten als JSON.
 * Keine Auth nötig (Daten sind ohnehin im gerenderten HTML sichtbar).
 *
 * NICHT erlaubt: auth, inquiries (sensitiv).
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

$target = $_GET['target'] ?? 'pages';

$public = ['pages', 'config', 'faq'];
if (!in_array($target, $public, true)) {
    respondJson(['ok' => false, 'error' => 'invalid_target'], 400);
}

if (!rateLimit('load-content', 120, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

$file = DATA_DIR . '/' . $target . '.json';
$data = readJson($file);
if (empty($data)) {
    respondJson(['ok' => false, 'error' => 'not_found'], 404);
}

// Bei config.json sensible Felder nicht ausliefern
if ($target === 'config') {
    unset($data['_note']);
    // contact.email ist ok (steht eh im HTML), aber wir geben nichts Verstecktes raus
}

// Cache-Control: kurz cachen (1 min)
header('Cache-Control: public, max-age=60');

respondJson([
    'ok'   => true,
    'data' => $data
]);
