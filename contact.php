<?php
/**
 * contact.php – Buchungsanfrage Form-Handler für Sardinientraum
 * Sendet Owner-Notification + Gast-Bestätigung per PHP mail()
 */

// ─── CORS-Header ─────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'msg' => 'Nur POST erlaubt.']);
    exit;
}

// ─── Konfiguration laden ──────────────────────────────────────────────────────
$configFile = __DIR__ . '/site-config.json';
$config = [];
if (file_exists($configFile)) {
    $raw = file_get_contents($configFile);
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $config = $decoded;
    }
}

// Fallback-Defaults
$OWNER_EMAIL  = !empty($config['contact_email']) ? $config['contact_email'] : 'info@sardinientraum.de';
$PROP_NAME    = !empty($config['prop_name'])     ? $config['prop_name']     : 'Sardinientraum';
$PROP_LOCATION= !empty($config['prop_location']) ? $config['prop_location'] : 'La Caletta, Siniscola, Sardinien';
$PROP_PHONE   = !empty($config['phone'])         ? $config['phone']         : '';
$PROP_WHATSAPP= !empty($config['whatsapp'])      ? $config['whatsapp']      : '';

// ─── POST-Daten einlesen & bereinigen ────────────────────────────────────────
function clean(string $val): string {
    return htmlspecialchars(trim($val), ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

$vorname  = clean($_POST['vorname']  ?? '');
$nachname = clean($_POST['nachname'] ?? '');
$email    = trim($_POST['email']     ?? '');
$telefon  = clean($_POST['telefon']  ?? '');
$anreise  = clean($_POST['anreise']  ?? '');
$abreise  = clean($_POST['abreise']  ?? '');
$wohnung  = clean($_POST['wohnung']  ?? '');
$personen = clean($_POST['personen'] ?? '');
$nachricht= clean($_POST['nachricht']?? '');

$fullName = $vorname . ' ' . $nachname;

// ─── Validierung ─────────────────────────────────────────────────────────────
$errors = [];

if ($vorname === '') {
    $errors[] = 'Vorname ist erforderlich.';
}
if ($nachname === '') {
    $errors[] = 'Nachname ist erforderlich.';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Eine gültige E-Mail-Adresse ist erforderlich.';
}
if ($anreise === '') {
    $errors[] = 'Anreisedatum ist erforderlich.';
}
if ($abreise === '') {
    $errors[] = 'Abreisedatum ist erforderlich.';
}

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'msg' => implode(' ', $errors)]);
    exit;
}

$emailSafe = htmlspecialchars($email, ENT_QUOTES | ENT_HTML5, 'UTF-8');

// ─── Hilfsfunktion: Tabellenzeile ────────────────────────────────────────────
function tr(string $label, string $value): string {
    if ($value === '') return '';
    return '
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ede8e0;font-weight:600;color:#555;width:38%;white-space:nowrap;">'
        . $label .
      '</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ede8e0;color:#222;">'
        . $value .
      '</td>
    </tr>';
}

// ─── Datum formatieren (YYYY-MM-DD → DD.MM.YYYY) ────────────────────────────
function formatDate(string $d): string {
    if ($d === '') return '–';
    $ts = strtotime($d);
    if ($ts === false) return htmlspecialchars($d, ENT_QUOTES, 'UTF-8');
    return date('d.m.Y', $ts);
}

$anreiseFormatiert = formatDate($anreise);
$abreiseFormatiert = formatDate($abreise);

// ─── Gemeinsames E-Mail-Layout (Header + Footer-Funktion) ───────────────────
function emailOpen(string $title, string $subtitle, string $goldBandText): string {
    return '<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>' . $title . '</title>
</head>
<body style="margin:0;padding:0;background:#f0ebe3;font-family:Georgia,\'Times New Roman\',serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ebe3;">
  <tr><td align="center" style="padding:30px 15px;">
    <table width="620" cellpadding="0" cellspacing="0" border="0"
           style="max-width:620px;width:100%;background:#ffffff;border-radius:8px;
                  overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.12);">

      <!-- HEADER -->
      <tr>
        <td style="background:#1e4d6b;padding:32px 36px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:1px;">
            🌊 ' . $title . '
          </div>
          <div style="font-size:13px;color:#a8cde0;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">
            ' . $subtitle . '
          </div>
        </td>
      </tr>

      <!-- GOLD BAND -->
      <tr>
        <td style="background:#c8975a;padding:14px 36px;text-align:center;">
          <div style="font-size:15px;color:#ffffff;font-weight:600;">' . $goldBandText . '</div>
        </td>
      </tr>

      <!-- BODY START -->
      <tr><td style="padding:32px 36px;">';
}

function emailClose(string $propName, string $propLocation): string {
    return '
      </td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#1e4d6b;padding:20px 36px;text-align:center;">
          <div style="font-size:13px;color:#a8cde0;">
            ' . htmlspecialchars($propName, ENT_QUOTES, 'UTF-8') . ' &nbsp;·&nbsp;
            ' . htmlspecialchars($propLocation, ENT_QUOTES, 'UTF-8') . '
          </div>
          <div style="font-size:11px;color:#6a99b8;margin-top:4px;">
            Diese E-Mail wurde automatisch generiert.
          </div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>';
}

// ─── 1) Owner-Notification ───────────────────────────────────────────────────
$ownerSubject = '=?UTF-8?B?' . base64_encode('🌊 Neue Anfrage von ' . strip_tags($fullName)) . '?=';

$nachrichtBlock = '';
if ($nachricht !== '') {
    $nachrichtBlock = '
    <div style="margin-top:24px;">
      <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;
                  letter-spacing:1px;margin-bottom:8px;">Nachricht des Gastes</div>
      <div style="border-left:4px solid #c8975a;padding:14px 18px;background:#fdfaf6;
                  color:#333;font-size:15px;line-height:1.7;border-radius:0 4px 4px 0;">
        ' . nl2br($nachricht) . '
      </div>
    </div>';
}

$replyButton = '
<div style="text-align:center;margin-top:28px;">
  <a href="mailto:' . $emailSafe . '?subject=' . rawurlencode('Re: Ihre Anfrage beim ' . strip_tags($PROP_NAME)) . '"
     style="display:inline-block;background:#c8975a;color:#ffffff;text-decoration:none;
            padding:13px 32px;border-radius:5px;font-size:15px;font-weight:700;
            letter-spacing:0.5px;">
    ✉️ Jetzt antworten
  </a>
</div>';

$ownerBody  = emailOpen(
    htmlspecialchars($PROP_NAME, ENT_QUOTES, 'UTF-8'),
    htmlspecialchars($PROP_LOCATION, ENT_QUOTES, 'UTF-8'),
    'Neue Buchungsanfrage eingegangen'
);
$ownerBody .= '
  <div style="font-size:16px;color:#1e4d6b;font-weight:700;margin-bottom:16px;">
    Gast-Details
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:1px solid #ede8e0;border-radius:6px;overflow:hidden;
                margin-bottom:24px;font-size:14px;">
    ' . tr('Vorname', $vorname) . '
    ' . tr('Nachname', $nachname) . '
    ' . tr('E-Mail', '<a href="mailto:' . $emailSafe . '" style="color:#c8975a;">' . $emailSafe . '</a>') . '
    ' . tr('Telefon', $telefon) . '
  </table>

  <div style="font-size:16px;color:#1e4d6b;font-weight:700;margin-bottom:16px;">
    Anfrage-Details
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:1px solid #ede8e0;border-radius:6px;overflow:hidden;
                margin-bottom:24px;font-size:14px;">
    ' . tr('Anreise', $anreiseFormatiert) . '
    ' . tr('Abreise', $abreiseFormatiert) . '
    ' . tr('Wohnung / Objekt', $wohnung) . '
    ' . tr('Personenanzahl', $personen) . '
  </table>
  ' . $nachrichtBlock . '
  ' . $replyButton;
$ownerBody .= emailClose($PROP_NAME, $PROP_LOCATION);

$ownerHeaders  = 'MIME-Version: 1.0' . "\r\n";
$ownerHeaders .= 'Content-Type: text/html; charset=UTF-8' . "\r\n";
$ownerHeaders .= 'From: =?UTF-8?B?' . base64_encode($PROP_NAME . ' Website') . '?= <noreply@' . ($_SERVER['HTTP_HOST'] ?? 'sardinientraum.de') . '>' . "\r\n";
$ownerHeaders .= 'Reply-To: ' . strip_tags($fullName) . ' <' . $email . '>' . "\r\n";
$ownerHeaders .= 'X-Mailer: PHP/' . phpversion();

$ownerSent = mail($OWNER_EMAIL, $ownerSubject, $ownerBody, $ownerHeaders);

// ─── 2) Gast-Bestätigung ────────────────────────────────────────────────────
$guestSubject = '=?UTF-8?B?' . base64_encode('Ihre Anfrage beim Sardinientraum – wir melden uns bald!') . '?=';

// Nächste Schritte
$steps = [
    ['num' => '1', 'text' => 'Wir prüfen Ihre Anfrage und die Verfügbarkeit für den gewünschten Zeitraum.'],
    ['num' => '2', 'text' => 'Innerhalb von 24–48 Stunden erhalten Sie eine persönliche Antwort von uns mit allen Details.'],
    ['num' => '3', 'text' => 'Bei Interesse senden wir Ihnen ein verbindliches Angebot und alle Informationen zur Buchung.'],
];

$stepsHtml = '';
foreach ($steps as $step) {
    $stepsHtml .= '
    <tr>
      <td valign="top" style="width:44px;padding-bottom:18px;">
        <div style="width:36px;height:36px;border-radius:50%;background:#c8975a;
                    color:#fff;text-align:center;line-height:36px;font-size:16px;
                    font-weight:700;flex-shrink:0;">
          ' . $step['num'] . '
        </div>
      </td>
      <td valign="top" style="padding-bottom:18px;padding-left:12px;font-size:14px;
                               color:#444;line-height:1.65;">
        ' . $step['text'] . '
      </td>
    </tr>';
}

$contactInfo = '';
if ($PROP_PHONE !== '') {
    $contactInfo .= '<div style="margin-top:6px;">📞 <a href="tel:' . htmlspecialchars($PROP_PHONE, ENT_QUOTES, 'UTF-8') . '" style="color:#c8975a;text-decoration:none;">' . htmlspecialchars($PROP_PHONE, ENT_QUOTES, 'UTF-8') . '</a></div>';
}
if ($PROP_WHATSAPP !== '') {
    $contactInfo .= '<div style="margin-top:6px;">💬 WhatsApp: <a href="https://wa.me/' . preg_replace('/[^0-9]/', '', $PROP_WHATSAPP) . '" style="color:#c8975a;text-decoration:none;">' . htmlspecialchars($PROP_WHATSAPP, ENT_QUOTES, 'UTF-8') . '</a></div>';
}
if ($OWNER_EMAIL !== '') {
    $ownerEmailSafe = htmlspecialchars($OWNER_EMAIL, ENT_QUOTES, 'UTF-8');
    $contactInfo .= '<div style="margin-top:6px;">✉️ <a href="mailto:' . $ownerEmailSafe . '" style="color:#c8975a;text-decoration:none;">' . $ownerEmailSafe . '</a></div>';
}

$guestBody  = emailOpen(
    htmlspecialchars($PROP_NAME, ENT_QUOTES, 'UTF-8'),
    htmlspecialchars($PROP_LOCATION, ENT_QUOTES, 'UTF-8'),
    'Vielen Dank für Ihre Anfrage, ' . $vorname . '!'
);
$guestBody .= '
  <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px 0;">
    Herzlichen Dank für Ihr Interesse an unserem ' . htmlspecialchars($PROP_NAME, ENT_QUOTES, 'UTF-8') . '
    in ' . htmlspecialchars($PROP_LOCATION, ENT_QUOTES, 'UTF-8') . '. Wir haben Ihre Anfrage erhalten
    und werden uns so schnell wie möglich bei Ihnen melden.
  </p>

  <!-- ZUSAMMENFASSUNG -->
  <div style="background:#f8f4ee;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;
                letter-spacing:1px;margin-bottom:12px;">Ihre Anfrage – Zusammenfassung</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#444;">
      ' . tr('Name', $vorname . ' ' . $nachname) . '
      ' . tr('E-Mail', $emailSafe) . '
      ' . tr('Telefon', $telefon) . '
      ' . tr('Anreise', $anreiseFormatiert) . '
      ' . tr('Abreise', $abreiseFormatiert) . '
      ' . tr('Wohnung / Objekt', $wohnung) . '
      ' . tr('Personenanzahl', $personen) . '
    </table>
  </div>

  <!-- NÄCHSTE SCHRITTE -->
  <div style="font-size:16px;color:#1e4d6b;font-weight:700;margin-bottom:16px;">
    Was passiert als Nächstes?
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    ' . $stepsHtml . '
  </table>';

if ($contactInfo !== '') {
    $guestBody .= '
  <!-- KONTAKTINFO -->
  <div style="border-top:1px solid #ede8e0;margin-top:8px;padding-top:20px;
              font-size:14px;color:#555;line-height:1.8;">
    <strong>Sie erreichen uns auch direkt:</strong>
    ' . $contactInfo . '
  </div>';
}

$guestBody .= '
  <p style="font-size:13px;color:#888;margin-top:28px;line-height:1.6;">
    Wir freuen uns darauf, Ihnen einen unvergesslichen Sardinienurlaub zu ermöglichen. 🌊☀️
  </p>';

$guestBody .= emailClose($PROP_NAME, $PROP_LOCATION);

$guestHeaders  = 'MIME-Version: 1.0' . "\r\n";
$guestHeaders .= 'Content-Type: text/html; charset=UTF-8' . "\r\n";
$guestHeaders .= 'From: =?UTF-8?B?' . base64_encode($PROP_NAME) . '?= <' . $OWNER_EMAIL . '>' . "\r\n";
$guestHeaders .= 'Reply-To: ' . htmlspecialchars($PROP_NAME, ENT_QUOTES, 'UTF-8') . ' <' . $OWNER_EMAIL . '>' . "\r\n";
$guestHeaders .= 'X-Mailer: PHP/' . phpversion();

$guestSent = mail($email, $guestSubject, $guestBody, $guestHeaders);

// ─── Antwort ─────────────────────────────────────────────────────────────────
if ($ownerSent && $guestSent) {
    echo json_encode([
        'ok'  => true,
        'msg' => 'Vielen Dank! Ihre Anfrage wurde erfolgreich gesendet. Wir melden uns bald bei Ihnen.'
    ]);
} elseif ($ownerSent) {
    // Owner-Mail kam an, Gast-Mail schlug fehl – trotzdem Erfolg melden
    echo json_encode([
        'ok'  => true,
        'msg' => 'Ihre Anfrage wurde gesendet. (Bestätigungsmail konnte nicht zugestellt werden.)'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'ok'  => false,
        'msg' => 'Die Anfrage konnte leider nicht gesendet werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt.'
    ]);
}
