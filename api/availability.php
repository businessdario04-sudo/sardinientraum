<?php
/**
 * GET  /api/availability.php?property=casa-tramonto
 *      Öffentlich — gibt gebuchte Zeiträume zurück (ohne Gast-Daten)
 *      Wenn eingeloggt: gibt vollständige Daten mit Label/ID zurück
 *
 * POST /api/availability.php
 *      Admin only + CSRF
 *      Actions: create, delete
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$avFile = DATA_DIR . '/availability.json';

// ─── GET: Verfügbarkeitsabfrage ──────────────────────────────
if ($method === 'GET') {
    $property = trim($_GET['property'] ?? '');
    if (!preg_match('/^[a-z0-9-]{1,50}$/', $property)) {
        respondJson(['ok' => false, 'error' => 'invalid_property'], 400);
    }

    $data     = readJson($avFile);
    $bookings = $data['properties'][$property]['bookings'] ?? [];
    $today    = date('Y-m-d');

    if (isLoggedIn()) {
        // Admin: alle Daten zurück (inkl. Label, ID, Note)
        $all = array_values(array_filter($bookings, fn($b) => ($b['to'] ?? '') > $today));
        respondJson(['ok' => true, 'property' => $property, 'bookings' => $all, 'admin' => true]);
    }

    // Öffentlich: nur from/to — keine Gast-Daten nach außen
    $safe = array_values(array_filter(
        array_map(fn($b) => ['from' => $b['from'], 'to' => $b['to']], $bookings),
        fn($b) => ($b['to'] ?? '') > $today
    ));
    respondJson(['ok' => true, 'property' => $property, 'bookings' => $safe]);
}

// ─── POST: Admin-Verwaltung ──────────────────────────────────
if ($method === 'POST') {
    requireLogin();
    checkCSRF();

    if (!rateLimit('availability', 60, 60)) {
        respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
    }

    $body     = readJsonBody();
    $action   = trim($body['action'] ?? '');
    $property = trim($body['property'] ?? '');

    if (!preg_match('/^[a-z0-9-]{1,50}$/', $property)) {
        respondJson(['ok' => false, 'error' => 'invalid_property'], 400);
    }

    $data = readJson($avFile);
    if (empty($data)) {
        $data = ['_schema_version' => 1, '_updated' => date('c'), 'properties' => []];
    }
    if (!isset($data['properties'][$property])) {
        $data['properties'][$property] = ['bookings' => []];
    }

    // ── Buchung anlegen ──────────────────────────────────────
    if ($action === 'create') {
        $from = trim($body['from'] ?? '');
        $to   = trim($body['to']   ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            respondJson(['ok' => false, 'error' => 'invalid_date_format'], 400);
        }
        if ($from >= $to) {
            respondJson(['ok' => false, 'error' => 'from_must_be_before_to'], 400);
        }

        $id = 'bk-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2));
        $data['properties'][$property]['bookings'][] = [
            'id'         => $id,
            'from'       => $from,
            'to'         => $to,
            'label'      => sanitizeString($body['label'] ?? 'Blockiert', 100),
            'status'     => 'confirmed',
            'inquiry_id' => $body['inquiry_id'] ?? null,
            'note'       => sanitizeString($body['note'] ?? '', 300),
        ];
        $data['_updated'] = date('c');

        if (!writeJson($avFile, $data)) {
            respondJson(['ok' => false, 'error' => 'write_failed'], 500);
        }
        logEvent('availability_create', ['property' => $property, 'from' => $from, 'to' => $to]);
        respondJson(['ok' => true, 'id' => $id]);
    }

    // ── Buchung löschen ──────────────────────────────────────
    if ($action === 'delete') {
        $id = trim($body['id'] ?? '');
        if (!$id) {
            respondJson(['ok' => false, 'error' => 'missing_id'], 400);
        }
        $data['properties'][$property]['bookings'] = array_values(
            array_filter($data['properties'][$property]['bookings'], fn($b) => $b['id'] !== $id)
        );
        $data['_updated'] = date('c');

        if (!writeJson($avFile, $data)) {
            respondJson(['ok' => false, 'error' => 'write_failed'], 500);
        }
        logEvent('availability_delete', ['property' => $property, 'id' => $id]);
        respondJson(['ok' => true]);
    }

    respondJson(['ok' => false, 'error' => 'unknown_action'], 400);
}

respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
