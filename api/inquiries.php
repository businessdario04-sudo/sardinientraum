<?php
/**
 * GET  /api/inquiries.php          → Liste aller Anfragen
 * POST /api/inquiries.php          → Status/Notizen einer Anfrage updaten
 *      Body: { id, status?, notes?, delete? }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_mailer.php';

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

    // ─── Manuelle Anfrage anlegen ────────────────────────────
    if (($body['action'] ?? '') === 'create') {
        $g = $body['guest']   ?? [];
        $r = $body['request'] ?? [];
        $email = sanitizeString((string)($g['email'] ?? ''), 150);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondJson(['ok' => false, 'error' => 'invalid_email'], 422);
        }
        $id = 'inq-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '-manual';
        $newItem = [
            'id'      => $id,
            'created' => date('c'),
            'status'  => 'neu',
            'manual'  => true,
            'guest'   => [
                'vorname'  => sanitizeString((string)($g['vorname']  ?? ''), 80),
                'nachname' => sanitizeString((string)($g['nachname'] ?? ''), 80),
                'email'    => $email,
                'telefon'  => sanitizeString((string)($g['telefon']  ?? ''), 50),
            ],
            'request' => [
                'anreise'   => sanitizeString((string)($r['anreise']   ?? ''), 20),
                'abreise'   => sanitizeString((string)($r['abreise']   ?? ''), 20),
                'wohnung'   => sanitizeString((string)($r['wohnung']   ?? ''), 100),
                'personen'  => sanitizeString((string)($r['personen']  ?? ''), 20),
                'nachricht' => sanitizeString((string)($r['nachricht'] ?? ''), 5000),
            ],
            'notes'   => sanitizeString((string)($body['notes'] ?? ''), 5000),
            'meta'    => ['source' => 'manual', 'ip' => clientIp()],
        ];
        $data  = readJson($file);
        if (empty($data['items'])) $data = ['_schema_version' => 1, 'items' => []];
        array_unshift($data['items'], $newItem);
        if (count($data['items']) > 1000) $data['items'] = array_slice($data['items'], 0, 1000);
        $data['_updated'] = date('c');
        writeJson($file, $data);
        logEvent('inquiry_manual', ['id' => $id]);
        respondJson(['ok' => true, 'id' => $id]);
    }

    // ─── Buchungsbestätigung manuell versenden ────────────────
    if (($body['action'] ?? '') === 'send_confirmation') {
        $id   = (string)($body['id'] ?? '');
        $data = readJson($file);
        $item = null;
        foreach ($data['items'] ?? [] as $i) {
            if (($i['id'] ?? '') === $id) { $item = $i; break; }
        }
        if (!$item) respondJson(['ok' => false, 'error' => 'not_found'], 404);
        $sent = mailSendBookingConfirmation($item);
        respondJson(['ok' => true, 'sent' => $sent]);
    }

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
        $bookingConfirmationNeeded = false;
        $confirmedItem = null;

        foreach ($items as &$item) {
            if (($item['id'] ?? '') === $id) {
                $prevStatus = $item['status'] ?? 'neu';
                if (isset($body['status']) && in_array($body['status'], $validStatus, true)) {
                    $item['status'] = $body['status'];
                    // Buchungsbestätigung auslösen wenn Status auf "gebucht" wechselt
                    if ($body['status'] === 'gebucht' && $prevStatus !== 'gebucht') {
                        $bookingConfirmationNeeded = true;
                        $confirmedItem = $item;
                    }
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

    // Buchungsbestätigung automatisch versenden
    $mailSent = false;
    if ($bookingConfirmationNeeded && $confirmedItem) {
        $mailSent = mailSendBookingConfirmation($confirmedItem);
    }

    respondJson(['ok' => true, 'confirmation_sent' => $mailSent]);
}

respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
