<?php
/**
 * GET  /api/faq.php             → öffentliche Liste (nur aktive Einträge)
 * GET  /api/faq.php?all=1       → alle Einträge (Admin)
 * POST /api/faq.php             → Speichert komplette Liste
 *      Body: { items: [{id, question, answer, active, order}, ...] }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$file = DATA_DIR . '/faq.json';

if ($method === 'GET') {
    $showAll = !empty($_GET['all']);
    if ($showAll) requireLogin();   // Nur Admin sieht inaktive

    $data = readJson($file);
    $items = $data['items'] ?? [];

    if (!$showAll) {
        $items = array_filter($items, fn($i) => !empty($i['active']));
    }

    usort($items, fn($a, $b) => ($a['order'] ?? 999) - ($b['order'] ?? 999));

    respondJson(['ok' => true, 'items' => array_values($items)]);
}

if ($method === 'POST') {
    requireLogin();
    checkCSRF();
    if (!rateLimit('faq-save', 30, 60)) {
        respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
    }

    $body = readJsonBody();
    $items = $body['items'] ?? null;

    if (!is_array($items)) {
        respondJson(['ok' => false, 'error' => 'invalid_items'], 400);
    }
    if (count($items) > 100) {
        respondJson(['ok' => false, 'error' => 'too_many_items'], 400);
    }

    // Validieren & säubern
    $cleaned = [];
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $q = sanitizeString((string)($item['question'] ?? ''), 500);
        $a = sanitizeString((string)($item['answer'] ?? ''), 5000);
        if ($q === '' || $a === '') continue;
        $cleaned[] = [
            'id'       => sanitizeString((string)($item['id'] ?? 'faq-' . bin2hex(random_bytes(3))), 50),
            'question' => $q,
            'answer'   => $a,
            'active'   => !empty($item['active']),
            'order'    => (int)($item['order'] ?? count($cleaned)),
        ];
    }

    $data = [
        '_schema_version' => 1,
        '_updated'        => date('c'),
        'items'           => $cleaned
    ];
    writeJson($file, $data);

    logEvent('faq_saved', ['count' => count($cleaned)]);
    respondJson(['ok' => true, 'count' => count($cleaned)]);
}

respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
