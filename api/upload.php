<?php
/**
 * POST /api/upload.php
 * multipart/form-data mit Field "file".
 * Speichert Bilder/Videos in /uploads als echte Dateien (kein base64!).
 *
 * Bilder werden via GD auf max. 2000px Breite verkleinert + komprimiert.
 * Videos werden ohne Verarbeitung gespeichert (PHP kann das nicht).
 *
 * Auth: erfordert Login + CSRF.
 *
 * Antwort: { ok, url: "uploads/...", size: N, width: W, height: H, type: "image/jpeg" }
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

requireLogin();
checkCSRF();

if (!rateLimit('upload', 20, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

// ─── Datei aus FormData empfangen ───────────────────────────
$phpErrMap = [
    0 => 'OK', 1 => 'Datei zu groß (Server-Limit)', 2 => 'Datei zu groß (Formular-Limit)',
    3 => 'Nur teilweise hochgeladen', 4 => 'Keine Datei empfangen',
    6 => 'Kein Temp-Verzeichnis', 7 => 'Schreiben fehlgeschlagen', 8 => 'Extension blockiert'
];
if (!isset($_FILES['file'])) {
    respondJson(['ok' => false, 'error' => 'no_file', 'msg' => 'Keine Datei empfangen — FormData leer'], 400);
}
if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $code = (int)$_FILES['file']['error'];
    $msg  = $phpErrMap[$code] ?? 'Unbekannter Fehler';
    respondJson(['ok' => false, 'error' => 'upload_failed', 'msg' => $msg, 'code' => $code], 400);
}

$file = $_FILES['file'];
$tmp  = $file['tmp_name'];
$origName = $file['name'];
$size = (int)$file['size'];

// ─── Größenlimit: 10 MB ─────────────────────────────────────
$maxSize = 10 * 1024 * 1024;
if ($size > $maxSize) {
    respondJson(['ok' => false, 'error' => 'file_too_large', 'max_mb' => 10], 413);
}

// ─── MIME-Type prüfen (echter Inhalt, nicht client-Header!) ─
if (!extension_loaded('fileinfo')) {
    respondJson(['ok' => false, 'error' => 'server_config', 'msg' => 'PHP fileinfo-Extension fehlt. php.ini prüfen.'], 500);
}
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($tmp);

$allowedMime = [
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/webp'      => 'webp',
    'image/gif'       => 'gif',
    'image/svg+xml'   => 'svg',
    'video/mp4'       => 'mp4',
    'video/webm'      => 'webm',
    'video/quicktime' => 'mov',
];

if (!isset($allowedMime[$mime])) {
    respondJson(['ok' => false, 'error' => 'mime_not_allowed', 'detail' => $mime], 415);
}

$ext = $allowedMime[$mime];

// ─── Sicheren Dateinamen bauen ──────────────────────────────
$base = pathinfo($origName, PATHINFO_FILENAME);
$base = preg_replace('/[^a-zA-Z0-9_-]/', '-', $base);
$base = trim(preg_replace('/-+/', '-', $base), '-');
if ($base === '' || strlen($base) > 60) {
    $base = substr($base, 0, 60) ?: 'upload';
}
$base = strtolower($base);
$timestamp = date('YmdHis');
$rand      = bin2hex(random_bytes(3));
$finalName = "{$timestamp}-{$rand}-{$base}.{$ext}";
$targetPath = UPLOADS_DIR . '/' . $finalName;

// ─── Uploads-Dir sicherstellen ──────────────────────────────
if (!is_dir(UPLOADS_DIR)) {
    if (!mkdir(UPLOADS_DIR, 0755, true)) {
        respondJson(['ok' => false, 'error' => 'uploads_dir_failed'], 500);
    }
}

// ─── Bilder: GD-Komprimierung ───────────────────────────────
$isImage = str_starts_with($mime, 'image/');
$width = null; $height = null;
$savedSize = $size;

// ─── SVG: kein GD möglich → Sanitisierung + direkt speichern ─
if ($mime === 'image/svg+xml') {
    $svgRaw = @file_get_contents($tmp);
    if ($svgRaw === false) {
        respondJson(['ok' => false, 'error' => 'read_failed'], 500);
    }
    // Basis-Sanitisierung: script-Tags, on*-Event-Handler, javascript:-URIs entfernen
    $svgRaw = preg_replace('/<script\b[^>]*>.*?<\/script>/si', '', $svgRaw);
    $svgRaw = preg_replace('/\s+on\w+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]*)/i', '', $svgRaw);
    $svgRaw = preg_replace('/\bjavascript\s*:/i', '', $svgRaw);
    if (@file_put_contents($targetPath, $svgRaw) === false) {
        respondJson(['ok' => false, 'error' => 'write_failed'], 500);
    }
    $savedSize = strlen($svgRaw);
} elseif ($isImage && extension_loaded('gd') && $mime !== 'image/gif') {
    $info = @getimagesize($tmp);
    if ($info) {
        [$ow, $oh] = $info;
        $maxW = 2000;
        if ($ow > $maxW) {
            $scale = $maxW / $ow;
            $nw = $maxW;
            $nh = (int)round($oh * $scale);
        } else {
            $nw = $ow;
            $nh = $oh;
        }

        // Quellbild laden
        $src = null;
        switch ($mime) {
            case 'image/jpeg': $src = @imagecreatefromjpeg($tmp); break;
            case 'image/png':  $src = @imagecreatefrompng($tmp); break;
            case 'image/webp': $src = @imagecreatefromwebp($tmp); break;
        }

        if ($src) {
            $dst = imagecreatetruecolor($nw, $nh);

            // PNG: Transparenz behalten
            if ($mime === 'image/png' || $mime === 'image/webp') {
                imagealphablending($dst, false);
                imagesavealpha($dst, true);
                $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
                imagefilledrectangle($dst, 0, 0, $nw, $nh, $transparent);
            }

            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $ow, $oh);

            // Speichern
            switch ($mime) {
                case 'image/jpeg': imagejpeg($dst, $targetPath, 85); break;
                case 'image/png':  imagepng($dst, $targetPath, 6); break;
                case 'image/webp': imagewebp($dst, $targetPath, 85); break;
            }

            imagedestroy($src);
            imagedestroy($dst);

            $width  = $nw;
            $height = $nh;
            $savedSize = filesize($targetPath) ?: $size;
        } else {
            // GD-Laden fehlgeschlagen → direkt verschieben
            move_uploaded_file($tmp, $targetPath);
            $width = $ow; $height = $oh;
        }
    } else {
        move_uploaded_file($tmp, $targetPath);
    }
} else {
    // GIF, Video oder GD nicht verfügbar → direkt verschieben
    if (!move_uploaded_file($tmp, $targetPath)) {
        respondJson(['ok' => false, 'error' => 'move_failed'], 500);
    }
    if ($isImage) {
        $info = @getimagesize($targetPath);
        if ($info) { $width = $info[0]; $height = $info[1]; }
    }
}

// ─── Endgültige Berechtigungen ─────────────────────────────
@chmod($targetPath, 0644);

logEvent('upload', [
    'name' => $finalName,
    'mime' => $mime,
    'size' => $savedSize,
    'width'=> $width,
    'height'=> $height
]);

respondJson([
    'ok'      => true,
    'url'     => 'uploads/' . $finalName,
    'name'    => $finalName,
    'size'    => $savedSize,
    'type'    => $mime,
    'width'   => $width,
    'height'  => $height
]);
