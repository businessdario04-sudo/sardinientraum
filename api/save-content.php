<?php
/**
 * POST /api/save-content.php
 * Schreibt Content in data/pages.json oder data/config.json.
 *
 * WICHTIG: Diese Datei überschreibt NIEMALS die index.html.
 * Sie speichert strukturierte Daten, das Frontend rendert daraus.
 *
 * Body:
 *   {
 *     "target": "pages" | "config",
 *     "patch":  { "hero": { "title": "Neuer Titel" } }   ← deep-merge
 *   }
 *
 * Auth: erfordert Login + CSRF.
 * Snapshot wird vor jedem Schreiben angelegt (data/snapshots/).
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

requireLogin();
checkCSRF();

if (!rateLimit('save-content', 60, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

$body   = readJsonBody();
$target = (string)($body['target'] ?? '');
$patch  = $body['patch'] ?? null;

// ─── Validierung: nur erlaubte Targets ──────────────────────
$allowedTargets = ['pages', 'config'];
if (!in_array($target, $allowedTargets, true)) {
    respondJson(['ok' => false, 'error' => 'invalid_target'], 400);
}

if (!is_array($patch) || empty($patch)) {
    respondJson(['ok' => false, 'error' => 'invalid_patch'], 400);
}

$file = DATA_DIR . '/' . $target . '.json';

// ─── Whitelist der Top-Level-Keys (Patch darf nicht alles ändern) ─
$allowedKeys = [
    'pages'  => ['nav','hero','ueber','wohnungen','region','bewertungen','anfrage','footer'],
    'config' => ['company','contact','social','seo','theme','form','legal','features']
];

$protected = ['_schema_version','_updated','_note','_pending_setup'];

foreach (array_keys($patch) as $key) {
    if (in_array($key, $protected, true)) {
        respondJson(['ok' => false, 'error' => 'key_protected', 'key' => $key], 400);
    }
    if (!in_array($key, $allowedKeys[$target], true)) {
        respondJson(['ok' => false, 'error' => 'key_not_allowed', 'key' => $key], 400);
    }
}

// ─── Size-Limit: kein unendlich grosser Patch ───────────────
$patchSize = strlen(json_encode($patch));
if ($patchSize > 2 * 1024 * 1024) {   // 2 MB
    respondJson(['ok' => false, 'error' => 'patch_too_large'], 413);
}

// ─── Bestehende Daten laden ─────────────────────────────────
$current = readJson($file);
if (empty($current)) {
    respondJson(['ok' => false, 'error' => 'target_missing'], 500);
}

// ─── Snapshot vor Schreiben ─────────────────────────────────
$snapshotDir = DATA_DIR . '/snapshots';
if (!is_dir($snapshotDir)) @mkdir($snapshotDir, 0755, true);
$snapshotFile = $snapshotDir . '/' . $target . '-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2)) . '.json';
@copy($file, $snapshotFile);

// ─── Alte Snapshots aufräumen (max. 50 pro Target) ──────────
$existing = glob($snapshotDir . '/' . $target . '-*.json') ?: [];
if (count($existing) > 50) {
    usort($existing, fn($a, $b) => filemtime($a) - filemtime($b));
    foreach (array_slice($existing, 0, count($existing) - 50) as $old) {
        @unlink($old);
    }
}

// ─── Deep-Merge Patch in Current ────────────────────────────
function deepMerge(array $base, array $patch, int $depth = 0): array {
    if ($depth > 10) return $patch;   // Schutz vor Rekursion
    foreach ($patch as $k => $v) {
        if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && !isAssocList($v)) {
            $base[$k] = deepMerge($base[$k], $v, $depth + 1);
        } else {
            $base[$k] = $v;
        }
    }
    return $base;
}

function isAssocList(array $a): bool {
    // True wenn $a wie eine "Liste" aussieht (numerische Keys, also überschrieben statt gemergt)
    return array_keys($a) === range(0, count($a) - 1);
}

$merged = deepMerge($current, $patch);
$merged['_updated'] = date('c');

// ─── Schreiben (atomar) ─────────────────────────────────────
if (!writeJson($file, $merged)) {
    respondJson(['ok' => false, 'error' => 'write_failed'], 500);
}

logEvent('content_saved', [
    'target' => $target,
    'keys'   => array_keys($patch),
    'size'   => $patchSize
]);

respondJson([
    'ok'        => true,
    'updated'   => $merged['_updated'],
    'snapshot'  => basename($snapshotFile)
]);
