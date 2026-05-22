<?php
/**
 * GET /api/media-list.php
 * Listet alle Dateien in /uploads.
 * Antwort: { ok, items: [{ name, url, size, modified, type }] }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

requireLogin();

if (!is_dir(UPLOADS_DIR)) {
    respondJson(['ok' => true, 'items' => []]);
}

$items = [];
$files = scandir(UPLOADS_DIR) ?: [];
foreach ($files as $f) {
    if ($f === '.' || $f === '..' || str_starts_with($f, '.')) continue;
    $path = UPLOADS_DIR . '/' . $f;
    if (!is_file($path)) continue;

    $size  = filesize($path) ?: 0;
    $mtime = filemtime($path) ?: 0;
    $ext   = strtolower(pathinfo($f, PATHINFO_EXTENSION));

    $typeMap = [
        'jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png',
        'webp'=>'image/webp','gif'=>'image/gif','svg'=>'image/svg+xml',
        'mp4'=>'video/mp4','webm'=>'video/webm','mov'=>'video/quicktime'
    ];
    $type = $typeMap[$ext] ?? 'application/octet-stream';

    $items[] = [
        'name'     => $f,
        'url'      => 'uploads/' . $f,
        'size'     => $size,
        'modified' => date('c', $mtime),
        'type'     => $type
    ];
}

// Nach Datum sortiert, neuste zuerst
usort($items, fn($a, $b) => strcmp($b['modified'], $a['modified']));

respondJson(['ok' => true, 'items' => $items, 'total' => count($items)]);
