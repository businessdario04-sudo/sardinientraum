<?php
/**
 * GET  /api/inquiries.php          → Liste aller Anfragen
 * POST /api/inquiries.php          → Status/Notizen einer Anfrage updaten
 *      Body: { id, status?, notes?, delete? }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$file = DATA_DIR . '/inquiries.json';

if ($method === 'GET') {
    $data = readJson($file);
    $items = $data['items'] ?? [];

    // Optionale Filter
    $statusFilter = $_GET['status'] ?? '';
    $search       = strtolower($_GET['q'] ?? '');

    $filtered = array_filter($items, function($item) use ($statusFilter, $search) {
        if ($statusFilter && ($item['status'] ?? '') !== $statusFilter) return false;
        if ($search) {
            $hay = strtolower(json_encode($item, JSON_UNESCAPED_UNICODE));
            if (!str_contains($hay, $search)) return false;
        }
        return true;
    });

    // Counters für Tabs
    $counts = ['neu' => 0, 'beantwortet' => 0, 'gebucht' => 0, 'abgelehnt' => 0];
    foreach ($items as $i) {
        $s = $i['status'] ?? 'neu';
        if (isset($counts[$s])) $counts[$s]++;
    }

    respondJson([
        'ok'     => true,
        'items'  => array_values($filtered),
        'total'  => count($items),
        'counts' => $counts
    ]);
}

if ($method === 'POST') {
    checkCSRF();
    if (!rateLimit('inquiry-update', 60, 60)) {
        respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
    }

    $body = readJsonBody();
    $id = (string)($body['id'] ?? '');
    if ($id === '') respondJson(['ok' => false, 'error' => 'no_id'], 400);

    $data = readJson($file);
    $items = $data['items'] ?? [];
    $found = false;

    if (!empty($body['delete'])) {
        $newItems = array_values(array_filter($items, fn($i) => ($i['id'] ?? '') !== $id));
        if (count($newItems) === count($items)) {
            respondJson(['ok' => false, 'error' => 'not_found'], 404);
        }
        $data['items'] = $newItems;
    } else {
        $validStatus = ['neu', 'beantwortet', 'gebucht', 'abgelehnt'];
        foreach ($items as &$item) {
            if (($item['id'] ?? '') === $id) {
                if (isset($body['status']) && in_array($body['status'], $validStatus, true)) {
                    $item['status'] = $body['status'];
                }
                if (isset($body['notes'])) {
                    $item['notes'] = sanitizeString((string)$body['notes'], 5000);
                }
                $item['updated'] = date('c');
                $found = true;
                break;
            }
        }
        unset($item);
        if (!$found) respondJson(['ok' => false, 'error' => 'not_found'], 404);
        $data['items'] = $items;
    }

    $data['_updated'] = date('c');
    writeJson($file, $data);

    logEvent('inquiry_updated', ['id' => $id]);
    respondJson(['ok' => true]);
}

respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
