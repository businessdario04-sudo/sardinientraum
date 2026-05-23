<?php
/**
 * POST /api/draft-promote.php
 * Kopiert *.draft.json auf den Live-Stand (*.json).
 * Erstellt vorher einen Snapshot des aktuellen Live-Inhalts.
 * Auth: Login + CSRF erforderlich.
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

requireLogin();
checkCSRF();

$targets   = ['pages', 'config'];
$promoted  = [];
$notFound  = [];

$snapshotDir = DATA_DIR . '/snapshots';
if (!is_dir($snapshotDir)) @mkdir($snapshotDir, 0755, true);

foreach ($targets as $target) {
    $draftFile = DATA_DIR . '/' . $target . '.draft.json';
    $liveFile  = DATA_DIR . '/' . $target . '.json';

    if (!file_exists($draftFile)) {
        $notFound[] = $target;
        continue;
    }

    // Snapshot des aktuellen Live-Standes anlegen
    @copy($liveFile, $snapshotDir . '/' . $target . '-pre-promote-' . date('Ymd-His') . '.json');

    // Draft → Live
    if (rename($draftFile, $liveFile)) {
        $promoted[] = $target;
    }
}

if (empty($promoted)) {
    respondJson(['ok' => false, 'error' => 'no_draft_found', 'missing' => $notFound]);
}

logEvent('draft_promoted', ['targets' => $promoted]);
respondJson(['ok' => true, 'promoted' => $promoted]);
