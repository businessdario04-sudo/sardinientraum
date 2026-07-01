<?php
/**
 * POST /api/submit-contact.php
 * Empfängt Form-Daten vom Anfrageformular.
 * - Honeypot- und Time-Trap-Spam-Schutz
 * - Speichert in data/inquiries.json
 * - Sendet 2 E-Mails (Owner-Notification, Gast-Bestätigung)
 *
 * Body (FormData oder JSON):
 *   vorname, nachname, email, telefon, anreise, abreise,
 *   wohnung, personen, nachricht
 *   PLUS Spam-Schutz: website_url (honeypot), _ts (page-load time)
 */
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

// Strenges Rate-Limit für Form-Submissions (Spam-Schutz)
if (!rateLimit('contact', 5, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

// ─── Input lesen (FormData ODER JSON) ───────────────────────
$src = !empty($_POST) ? $_POST : readJsonBody();

$field = fn(string $k, int $maxLen = 500) => sanitizeString((string)($src[$k] ?? ''), $maxLen);

$vorname   = $field('vorname',   80);
$nachname  = $field('nachname',  80);
$email     = $field('email',     150);
$telefon   = $field('telefon',   50);
$anreise   = $field('anreise',   20);
$abreise   = $field('abreise',   20);
$wohnung   = $field('wohnung',   100);
$personen  = $field('personen',  20);
$nachricht = $field('nachricht', 5000);

// Spam-Schutz: Honeypot (versteckt im HTML, Bots füllen ihn aus)
$honeypotField = (string)($CONFIG['form']['honeypot_field'] ?? 'website_url');
$honeypotVal   = (string)($src[$honeypotField] ?? '');
if ($honeypotVal !== '') {
    logEvent('contact_spam_honeypot', ['from' => $email]);
    // Bot vortäuschen dass alles OK ist (kein 4xx, damit er nicht weiß dass er erwischt wurde)
    respondJson(['ok' => true, 'msg' => 'Vielen Dank.']);
}

// Spam-Schutz: Time-Trap (Form muss min. N Sekunden offen sein)
$pageLoadTs = (int)($src['_ts'] ?? 0);
$minSec     = (int)($CONFIG['form']['min_submit_time_sec'] ?? 3);
if ($pageLoadTs > 0 && (time() - $pageLoadTs) < $minSec) {
    logEvent('contact_spam_timetrap', ['from' => $email]);
    respondJson(['ok' => true, 'msg' => 'Vielen Dank.']);
}

// ─── Validierung ────────────────────────────────────────────
$errors = [];
if ($vorname === '')  $errors[] = 'Vorname fehlt.';
if ($nachname === '') $errors[] = 'Nachname fehlt.';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'E-Mail ungültig.';

if (!empty($errors)) {
    respondJson(['ok' => false, 'error' => 'validation', 'msg' => implode(' ', $errors)], 422);
}

// ─── In inquiries.json speichern ────────────────────────────
$inquiriesFile = DATA_DIR . '/inquiries.json';
$inquiries = readJson($inquiriesFile);
if (empty($inquiries['items'])) $inquiries = ['_schema_version' => 1, 'items' => []];

$id = 'inq-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3));
$newItem = [
    'id'        => $id,
    'created'   => date('c'),
    'status'    => 'neu',           // neu | beantwortet | gebucht | abgelehnt
    'guest'     => [
        'vorname'  => $vorname,
        'nachname' => $nachname,
        'email'    => $email,
        'telefon'  => $telefon,
    ],
    'request'   => [
        'anreise'  => $anreise,
        'abreise'  => $abreise,
        'wohnung'  => $wohnung,
        'personen' => $personen,
        'nachricht'=> $nachricht,
    ],
    'notes'     => '',
    'meta'      => [
        'ip'      => clientIp(),
        'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
    ]
];

array_unshift($inquiries['items'], $newItem);   // neueste zuerst
// Begrenzung: max 1000 Einträge
if (count($inquiries['items']) > 1000) {
    $inquiries['items'] = array_slice($inquiries['items'], 0, 1000);
}
$inquiries['_updated'] = date('c');

writeJson($inquiriesFile, $inquiries);

logEvent('contact_received', ['id' => $id, 'email' => $email]);

// ─── E-Mails versenden ──────────────────────────────────────
$companyName     = $CONFIG['company']['name']     ?? '';
$companyLocation = $CONFIG['company']['location'] ?? '';
$ownerEmail      = $CONFIG['contact']['email']    ?? '';
$ownerPhone      = $CONFIG['contact']['phone']    ?? '';
$formSubject     = $CONFIG['form']['subject']     ?? 'Neue Anfrage';

// Header-Injection Schutz
$fullName = str_replace(["\r", "\n", ":", "<", ">"], ' ', $vorname . ' ' . $nachname);

// Datum-Formatierung
$fmtDate = function(string $d): string {
    if ($d === '') return '–';
    $ts = strtotime($d);
    return $ts ? date('d.m.Y', $ts) : htmlspecialchars($d);
};

// Owner-Notification
if ($ownerEmail !== '') {
    $subjectOwner = '=?UTF-8?B?' . base64_encode('🌊 Neue Anfrage von ' . $fullName) . '?=';
    $bodyOwner = buildOwnerEmail($newItem, $companyName, $companyLocation, $fmtDate);
    $headersOwner  = "MIME-Version: 1.0\r\n";
    $headersOwner .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headersOwner .= "From: =?UTF-8?B?" . base64_encode($companyName . ' Website') . "?= <noreply@" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ">\r\n";
    $headersOwner .= "Reply-To: " . $fullName . " <" . $email . ">\r\n";
    @mail($ownerEmail, $subjectOwner, $bodyOwner, $headersOwner);
}

// Gast-Bestätigung
$subjectGuest = '=?UTF-8?B?' . base64_encode('Ihre Anfrage beim ' . $companyName) . '?=';
$bodyGuest = buildGuestEmail($newItem, $companyName, $companyLocation, $ownerEmail, $ownerPhone, $fmtDate);
$headersGuest  = "MIME-Version: 1.0\r\n";
$headersGuest .= "Content-Type: text/html; charset=UTF-8\r\n";
$headersGuest .= "From: =?UTF-8?B?" . base64_encode($companyName) . "?= <" . ($ownerEmail ?: 'noreply@localhost') . ">\r\n";
if ($ownerEmail) $headersGuest .= "Reply-To: " . $ownerEmail . "\r\n";
@mail($email, $subjectGuest, $bodyGuest, $headersGuest);

respondJson([
    'ok'  => true,
    'id'  => $id,
    'msg' => 'Vielen Dank! Ihre Anfrage ist bei uns eingegangen.'
]);

// ════════════════════════════════════════════════════════════
//  E-Mail-Builder (HTML, gebrandet)
// ════════════════════════════════════════════════════════════

function buildOwnerEmail(array $item, string $name, string $loc, callable $fmt): string {
    $g = $item['guest']; $r = $item['request'];
    $safe = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');

    $msgBlock = '';
    if (($r['nachricht'] ?? '') !== '') {
        $msgBlock = '<div style="background:#f8f4ee;border-left:4px solid #c8975a;padding:14px 18px;border-radius:0 8px 8px 0;margin:18px 0;"><p style="margin:0;font-size:14px;color:#2a2a2a;line-height:1.7;">' . nl2br($safe($r['nachricht'])) . '</p></div>';
    }

    return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0e6d3;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0e6d3;padding:30px 15px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;">
    <tr><td style="background:#1e4d6b;padding:30px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;">🌊 ' . $safe($name) . '</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.7);font-size:13px;">' . $safe($loc) . '</p>
    </td></tr>
    <tr><td style="background:#c8975a;padding:14px;text-align:center;">
      <p style="margin:0;color:#fff;font-weight:700;">📬 Neue Anfrage von ' . $safe($g['vorname'].' '.$g['nachname']) . '</p>
    </td></tr>
    <tr><td style="padding:30px;">
      <h3 style="margin:0 0 12px;color:#1e4d6b;font-size:15px;">👤 Gast-Details</h3>
      <p style="margin:4px 0;">Name: <strong>' . $safe($g['vorname'].' '.$g['nachname']) . '</strong></p>
      <p style="margin:4px 0;">E-Mail: <a href="mailto:' . $safe($g['email']) . '" style="color:#1e4d6b;">' . $safe($g['email']) . '</a></p>
      <p style="margin:4px 0;">Telefon: ' . $safe($g['telefon'] ?: '—') . '</p>
      <h3 style="margin:20px 0 12px;color:#1e4d6b;font-size:15px;">📅 Anfrage-Details</h3>
      <p style="margin:4px 0;">Anreise: <strong>' . $safe($fmt($r['anreise'])) . '</strong></p>
      <p style="margin:4px 0;">Abreise: <strong>' . $safe($fmt($r['abreise'])) . '</strong></p>
      <p style="margin:4px 0;">Wohnung: ' . $safe($r['wohnung'] ?: '—') . '</p>
      <p style="margin:4px 0;">Personen: ' . $safe($r['personen'] ?: '—') . '</p>
      ' . $msgBlock . '
      <p style="text-align:center;margin:24px 0 0;"><a href="mailto:' . $safe($g['email']) . '?subject=Re%3A%20Ihre%20Anfrage" style="display:inline-block;background:#c8975a;color:#fff;padding:12px 30px;border-radius:50px;text-decoration:none;font-weight:700;">✉ Jetzt antworten</a></p>
    </td></tr>
    <tr><td style="background:#1e4d6b;padding:20px;text-align:center;color:rgba(255,255,255,.6);font-size:12px;">
      Automatisch generiert · ' . $safe($name) . '
    </td></tr>
  </table>
</td></tr></table></body></html>';
}

function buildGuestEmail(array $item, string $name, string $loc, string $email, string $phone, callable $fmt): string {
    $g = $item['guest']; $r = $item['request'];
    $safe = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');

    $contact = '';
    if ($email) $contact .= '<p style="margin:4px 0;">✉️ <a href="mailto:'.$safe($email).'" style="color:#c8975a;">'.$safe($email).'</a></p>';
    if ($phone) $contact .= '<p style="margin:4px 0;">📞 <a href="tel:'.$safe($phone).'" style="color:#c8975a;">'.$safe($phone).'</a></p>';

    return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0e6d3;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0e6d3;padding:30px 15px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;">
    <tr><td style="background:#1e4d6b;padding:30px;text-align:center;">
      <p style="margin:0;font-size:28px;">🌊</p>
      <h1 style="margin:6px 0 0;color:#fff;">' . $safe($name) . '</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.7);">' . $safe($loc) . '</p>
    </td></tr>
    <tr><td style="background:#c8975a;padding:14px;text-align:center;">
      <p style="margin:0;color:#fff;font-weight:700;">Vielen Dank für Ihre Anfrage, ' . $safe($g['vorname']) . '!</p>
    </td></tr>
    <tr><td style="padding:30px;">
      <p style="font-size:15px;color:#2a2a2a;line-height:1.7;">wir haben Ihre Anfrage erhalten und freuen uns über Ihr Interesse. Wir melden uns <strong>innerhalb von 24 Stunden</strong> mit einer persönlichen Antwort.</p>
      <div style="background:#f8f4ee;border-radius:10px;padding:20px;margin:20px 0;">
        <h4 style="margin:0 0 12px;color:#1e4d6b;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Ihre Anfrage im Überblick</h4>
        <p style="margin:4px 0;">Anreise: <strong>' . $safe($fmt($r['anreise'])) . '</strong></p>
        <p style="margin:4px 0;">Abreise: <strong>' . $safe($fmt($r['abreise'])) . '</strong></p>
        <p style="margin:4px 0;">Wohnung: ' . $safe($r['wohnung'] ?: '—') . '</p>
        <p style="margin:4px 0;">Personen: ' . $safe($r['personen'] ?: '—') . '</p>
      </div>
      ' . ($contact ? '<p style="font-size:14px;color:#6b6b6b;">Direkt erreichbar:</p>' . $contact : '') . '
    </td></tr>
    <tr><td style="background:#1e4d6b;padding:20px;text-align:center;color:rgba(255,255,255,.6);font-size:12px;">
      ' . $safe($name) . ' · ' . $safe($loc) . '
    </td></tr>
  </table>
</td></tr></table></body></html>';
}
