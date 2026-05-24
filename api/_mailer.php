<?php
/**
 * _mailer.php — E-Mail-Versand für Sardinientraum
 *
 * Sendet HTML-E-Mails via PHP mail() — kompatibel mit Hostinger Shared Hosting.
 * Für lokale Entwicklung ohne SMTP: Mail-Versand wird übersprungen,
 * nur ein Log-Eintrag wird geschrieben.
 *
 * Konfiguration in data/config.json → "mail":
 *   from                 : Absender-E-Mail  (z.B. buchung@deine-domain.de)
 *   from_name            : Absender-Name    (z.B. Sardinientraum)
 *   bcc                  : optionale BCC-Adresse (eigene Archiv-Adresse)
 *   confirmation_enabled : true/false
 */
declare(strict_types=1);

// ─────────────────────────────────────────────────────────────
// Buchungsbestätigung senden
// ─────────────────────────────────────────────────────────────
function mailSendBookingConfirmation(array $inquiry): bool {
    $config   = readJson(DATA_DIR . '/config.json');
    $mailConf = $config['mail'] ?? [];

    // Feature-Flag prüfen
    if (!($mailConf['confirmation_enabled'] ?? true)) {
        logEvent('mail_skipped', ['reason' => 'disabled']);
        return false;
    }

    $g = $inquiry['guest']   ?? [];
    $r = $inquiry['request'] ?? [];

    $toEmail  = trim((string)($g['email'] ?? ''));
    $vorname  = trim((string)($g['vorname']  ?? ''));
    $nachname = trim((string)($g['nachname'] ?? ''));
    $fullName = trim("$vorname $nachname") ?: 'Gast';

    if (!$toEmail || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        logEvent('mail_skipped', ['reason' => 'invalid_guest_email', 'id' => $inquiry['id'] ?? '']);
        return false;
    }

    $anreise  = (string)($r['anreise']  ?? '');
    $abreise  = (string)($r['abreise']  ?? '');
    $wohnungId = (string)($r['wohnung'] ?? '');
    $personen = (string)($r['personen'] ?? '—');

    // Nächte berechnen
    $nights = '—';
    try {
        if ($anreise && $abreise) {
            $d1     = new DateTime($anreise);
            $d2     = new DateTime($abreise);
            $diff   = (int)$d1->diff($d2)->days;
            $nights = $diff . ' Nacht' . ($diff !== 1 ? 'e' : '');
        }
    } catch (\Exception $e) {}

    // Datum auf Deutsch formatieren
    $MONTHS = ['','Januar','Februar','März','April','Mai','Juni',
               'Juli','August','September','Oktober','November','Dezember'];
    $fmtDate = static function(string $iso) use ($MONTHS): string {
        if (!$iso) return '—';
        try {
            $dt = new DateTime($iso);
            return $dt->format('d') . '. ' . $MONTHS[(int)$dt->format('n')] . ' ' . $dt->format('Y');
        } catch (\Exception $e) { return $iso; }
    };

    $anreiseFmt = $fmtDate($anreise);
    $abreiseFmt = $fmtDate($abreise);

    // Unterkunft-Name + Preis aus pages.json
    $pages    = readJson(DATA_DIR . '/pages.json');
    $aptItems = $pages['wohnungen']['items'] ?? [];
    $aptData  = null;
    foreach ($aptItems as $apt) {
        if (($apt['id'] ?? '') === $wohnungId) { $aptData = $apt; break; }
    }
    $aptName   = $aptData ? ($aptData['name'] ?? $wohnungId) : $wohnungId;
    $priceInfo = $aptData ? ($aptData['price'] ?? '') : '';

    // Absender-Konfig
    $company      = $config['company']['name'] ?? 'Sardinientraum';
    $fromEmail    = $mailConf['from']      ?? '';
    $fromName     = $mailConf['from_name'] ?? $company;
    $bcc          = $mailConf['bcc']       ?? '';
    $contactEmail = $config['contact']['email'] ?? $fromEmail;

    if (!$fromEmail || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        logEvent('mail_skipped', [
            'reason' => 'no_from_address_configured',
            'hint'   => 'Bitte mail.from in data/config.json setzen',
        ]);
        return false;
    }

    $subject = "Buchungsbestätigung – {$company}";
    $inqId   = $inquiry['id'] ?? '';

    $html = _mailerBuildConfirmationHtml(
        company:      $company,
        fullName:     $fullName,
        vorname:      $vorname ?: $fullName,
        anreiseFmt:   $anreiseFmt,
        abreiseFmt:   $abreiseFmt,
        nights:       $nights,
        aptName:      $aptName,
        personen:     $personen,
        priceInfo:    $priceInfo,
        contactEmail: $contactEmail,
        inqId:        $inqId,
    );

    return _mailerSend(
        to:       $toEmail,
        toName:   $fullName,
        subject:  $subject,
        html:     $html,
        from:     $fromEmail,
        fromName: $fromName,
        bcc:      $bcc,
    );
}

// ─────────────────────────────────────────────────────────────
// Low-level Sendefunktion
// ─────────────────────────────────────────────────────────────
function _mailerSend(
    string $to, string $toName, string $subject, string $html,
    string $from, string $fromName, string $bcc = ''
): bool {
    $encFrom    = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
    $encSubject = '=?UTF-8?B?' . base64_encode($subject)  . '?=';

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: {$encFrom} <{$from}>\r\n";
    $headers .= "Reply-To: {$from}\r\n";
    if ($bcc && filter_var($bcc, FILTER_VALIDATE_EMAIL)) {
        $headers .= "Bcc: {$bcc}\r\n";
    }
    $headers .= "X-Mailer: PHP/" . phpversion();

    $result = @mail($to, $encSubject, $html, $headers);
    logEvent($result ? 'mail_sent' : 'mail_failed', [
        'to'      => $to,
        'subject' => $subject,
    ]);
    return $result;
}

// ─────────────────────────────────────────────────────────────
// HTML-Template
// ─────────────────────────────────────────────────────────────
function _mailerBuildConfirmationHtml(
    string $company, string $fullName, string $vorname,
    string $anreiseFmt, string $abreiseFmt, string $nights,
    string $aptName, string $personen, string $priceInfo,
    string $contactEmail, string $inqId
): string {
    $e = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

    // Preis-Zeile optional
    $priceRow = $priceInfo
        ? '<tr style="background:rgba(200,151,90,.1);"><td style="padding:10px 20px 16px;font-size:14px;color:#6b6b6b;width:40%;">Preis</td>'
          . '<td style="padding:10px 20px 16px;font-size:15px;font-weight:700;color:#c8975a;">' . $e($priceInfo) . '</td></tr>'
        : '';

    // Kontakt-Link optional
    $contactLink = $contactEmail
        ? '<a href="mailto:' . $e($contactEmail) . '" style="color:#c8975a;text-decoration:none;font-size:13px;font-weight:600;">' . $e($contactEmail) . '</a>'
        : '';

    $refLine = $inqId ? '<p style="color:#6b6b6b;font-size:13px;margin:4px 0 28px;">Referenz: <strong>' . $e($inqId) . '</strong></p>' : '';

    return <<<HTML
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Buchungsbestätigung</title>
</head>
<body style="margin:0;padding:0;background:#f0e6d3;font-family:'Helvetica Neue',Arial,sans-serif;color:#2a2a2a;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0e6d3;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fdfaf6;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">

  <!-- ── HEADER ── -->
  <tr><td style="background:linear-gradient(135deg,#1e4d6b 0%,#2e6d96 100%);padding:44px 40px 36px;text-align:center;">
    <div style="font-size:36px;margin-bottom:10px;">🌊</div>
    <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:.5px;">{$e($company)}</div>
    <div style="color:rgba(255,255,255,.65);font-size:13px;margin-top:6px;">Ferienwohnungen · La Caletta · Sardinien</div>
  </td></tr>
  <tr><td style="background:#c8975a;height:4px;"></td></tr>

  <!-- ── BODY ── -->
  <tr><td style="padding:40px 40px 32px;">

    <p style="font-size:22px;font-weight:700;color:#1e4d6b;margin:0 0 6px;">✅ Buchungsbestätigung</p>
    {$refLine}

    <p style="font-size:15px;line-height:1.5;margin:0 0 10px;">Liebe/r <strong>{$e($vorname)}</strong>,</p>
    <p style="font-size:15px;line-height:1.7;color:#2a2a2a;margin:0 0 28px;">
      wir freuen uns sehr, deine Buchung zu bestätigen! Dein Aufenthalt bei uns in Sardinien ist vorgemerkt.
      Wir werden uns in Kürze persönlich bei dir melden, um alle Details zu Zahlungsmodalitäten und
      Schlüsselübergabe zu besprechen.
    </p>

    <!-- Buchungs-Tabelle -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f0e6d3;border-radius:12px;margin-bottom:28px;overflow:hidden;">
      <tr><td colspan="2" style="padding:16px 20px 10px;font-size:11px;font-weight:700;
              letter-spacing:1.5px;text-transform:uppercase;color:#c8975a;">Deine Buchungs-Details</td></tr>
      <tr style="background:rgba(200,151,90,.08);">
        <td style="padding:10px 20px;font-size:14px;color:#6b6b6b;width:40%;">Unterkunft</td>
        <td style="padding:10px 20px;font-size:14px;font-weight:700;color:#1e4d6b;">{$e($aptName)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:14px;color:#6b6b6b;">Anreise (Check-in)</td>
        <td style="padding:10px 20px;font-size:14px;font-weight:600;">{$e($anreiseFmt)}</td>
      </tr>
      <tr style="background:rgba(200,151,90,.08);">
        <td style="padding:10px 20px;font-size:14px;color:#6b6b6b;">Abreise (Check-out)</td>
        <td style="padding:10px 20px;font-size:14px;font-weight:600;">{$e($abreiseFmt)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:14px;color:#6b6b6b;">Aufenthaltsdauer</td>
        <td style="padding:10px 20px;font-size:14px;font-weight:600;">{$e($nights)}</td>
      </tr>
      <tr style="background:rgba(200,151,90,.08);">
        <td style="padding:10px 20px;font-size:14px;color:#6b6b6b;">Personen</td>
        <td style="padding:10px 20px;font-size:14px;font-weight:600;">{$e($personen)}</td>
      </tr>
      {$priceRow}
    </table>

    <!-- Nächste Schritte -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:2px solid #c8975a;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:20px 24px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
                  color:#c8975a;margin:0 0 14px;">Wie geht's weiter?</p>
        <p style="font-size:14px;line-height:1.9;margin:0;color:#2a2a2a;">
          ✅&nbsp; Buchung bestätigt &amp; vorgemerkt<br>
          📞&nbsp; Wir kontaktieren dich für Zahlungsdetails<br>
          🔑&nbsp; Schlüsselübergabe-Info folgt per E-Mail<br>
          ❓&nbsp; Fragen? Einfach auf diese Mail antworten
        </p>
      </td></tr>
    </table>

    <p style="font-size:15px;line-height:1.7;margin:0 0 6px;">
      Wir freuen uns darauf, dich in La Caletta willkommen zu heißen! 🌊☀️
    </p>
    <p style="font-size:15px;margin:0;">
      Herzliche Grüße,<br>
      <strong>Das Team von {$e($company)}</strong>
    </p>

  </td></tr>

  <!-- ── FOOTER ── -->
  <tr><td style="background:#1e4d6b;padding:24px 40px;text-align:center;">
    {$contactLink}
    <p style="color:rgba(255,255,255,.45);font-size:11px;margin:10px 0 0;line-height:1.6;">
      La Caletta · Siniscola · Sardinien, Italien<br>
      Diese Buchungsbestätigung wurde automatisch generiert.
    </p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>
HTML;
}
