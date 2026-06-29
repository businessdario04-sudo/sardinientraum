# CLAUDE.md — Projektregeln & Sicherheitsrichtlinien

Dieses Dokument ist verbindlich für alle Änderungen an diesem Projekt. Lies es vollständig bevor du irgendeine Datei anfasst.

## Projektübersicht

PHP-basiertes Web-App-Framework für lokale Kleinbetriebe. Stack: PHP 8+, Apache, JSON-Datastore, Vanilla JS Frontend. Kein Framework, keine externe Datenbank, kein Composer.

Struktur:

```
/               → Öffentliches Webroot (index.html, admin.html)
/api/           → PHP API-Endpunkte (nur POST/GET, kein direkter Zugriff auf Daten)
/data/          → JSON-Datenspeicher (NICHT webzugänglich)
/uploads/       → Medien-Uploads (nur Bilder/Videos)
/assets/        → CSS, JS, Bilder
```

---

## 🔴 ABSOLUTE VERBOTE — niemals umgehen

### Code-Sicherheit

- Niemals Passwörter, Secrets oder API-Keys im Code hardcoden
- Niemals `$_GET`, `$_POST`, `$_SERVER` oder `php://input` ungefiltert verwenden
- Niemals Benutzereingaben direkt in Dateinamen, Pfade oder E-Mail-Header einbauen
- Niemals `eval()`, `exec()`, `shell_exec()`, `system()` oder ähnliche Funktionen verwenden
- Niemals `display_errors = On` in Produktionscode
- Niemals Fehlerdetails oder Stack-Traces an den User zurückgeben
- Niemals `var_dump()` oder `print_r()` in Produktionscode

### Dateizugriff

- Niemals Dateipfade aus Benutzereingaben konstruieren ohne `realpath()` + Whitelist-Prüfung
- Niemals Dateien außerhalb von `UPLOADS_DIR` schreiben
- Niemals PHP-Dateien im `uploads/` Ordner zulassen
- Niemals den `data/` Ordner webzugänglich lassen

### Authentifizierung

- Niemals Auth-Checks überspringen oder auskommentieren
- Niemals `requireLogin()` oder `checkCSRF()` entfernen
- Niemals Session-IDs in URLs weitergeben
- Niemals Klartext-Passwörter speichern — immer `password_hash()` mit `PASSWORD_BCRYPT, ['cost' => 12]`

---

## ✅ PFLICHTREGELN — bei jeder Änderung einhalten

### Jeder neue API-Endpunkt MUSS:

```php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

// 1. Methode prüfen
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

// 2. Auth prüfen (wenn nicht öffentlich)
requireLogin();

// 3. CSRF prüfen (bei schreibenden Operationen)
checkCSRF();

// 4. Rate-Limit prüfen
if (!rateLimit('endpunkt-name', 30, 60)) {
    respondJson(['ok' => false, 'error' => 'too_many_requests'], 429);
}

// 5. Input über readJsonBody() + sanitizeString() lesen
// 6. respondJson() für ALLE Antworten verwenden
```

### Input-Validierung

Jedes Eingabefeld MUSS durch `sanitizeString()` laufen:

```php
$name = sanitizeString((string)($body['name'] ?? ''), 100);
```

E-Mail-Adressen MÜSSEN mit `filter_var($email, FILTER_VALIDATE_EMAIL)` geprüft werden.
Datumswerte MÜSSEN gegen `'/^\d{4}-\d{2}-\d{2}$/'` geprüft werden.

### E-Mail-Header — Pflicht-Sanitisierung

Vor jedem E-Mail-Header-Einsatz:

```php
$safeName = str_replace(["\r", "\n", ":", "<", ">"], ' ', $fullName);
```

Nie `sanitizeString()` alleine für Header verwenden — CR/LF werden dort erlaubt.

### Dateipfade — Pflicht-Prüfung

```php
// Immer so — nie direkt:
$real = realpath($path);
$base = realpath(UPLOADS_DIR);
if (!$real || !$base || !str_starts_with($real, $base)) {
    respondJson(['ok' => false, 'error' => 'invalid_path'], 400);
}
```

### JSON schreiben

Immer `writeJson()` aus `_bootstrap.php` verwenden — niemals direkt `file_put_contents()` auf JSON-Dateien.

### Fehlerbehandlung

```php
// Richtig:
respondJson(['ok' => false, 'error' => 'write_failed'], 500);

// Falsch — niemals:
echo $e->getMessage();
die($errorDetails);
```

---

## 🔒 Sicherheits-Architektur (nicht verändern)

### CORS

CORS wird zentral in `_bootstrap.php` geregelt. In keiner anderen Datei `Access-Control-Allow-Origin` setzen.

### Session

Session-Konfiguration nur in `_bootstrap.php`. Niemals `session_start()` außerhalb davon aufrufen.

### Rate-Limiting

`rateLimit('key', maxHits, windowSec)` — Limits nach Endpunkt:

- Login: 5 / 60s
- Kontaktformular: 5 / 60s
- Upload: 20 / 60s
- Content-Save: 60 / 60s
- Öffentliche Reads: 120 / 60s

### Datei-Uploads

Nur via `upload.php`. MIME-Type immer per `finfo` prüfen — nie per Dateiendung allein. Erlaubte MIME-Types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`, `video/mp4`, `video/webm`. SVGs müssen sanitisiert werden (script-Tags, on*-Handler, javascript:-URIs entfernen).

---

## 📁 Datei-Struktur — Regeln

### data/ Ordner

- Webzugriff MUSS gesperrt sein (`.htaccess` mit `Require all denied`)
- Dateien: `auth.json`, `config.json`, `pages.json`, `inquiries.json`, `availability.json`, `faq.json`
- Snapshots unter `data/snapshots/` (max. 50 pro Target, älteste automatisch löschen)
- Logs unter `data/logs/`

### uploads/ Ordner

- Nur Medien-Dateien (Bilder/Videos)
- PHP-Dateien sind via `.htaccess` zu sperren:

```apache
<FilesMatch "\.php$">
    Require all denied
</FilesMatch>
```

- SVGs mit korrektem Content-Type ausliefern

### Veraltete Dateien im Root

- `contact.php` und `save-config.php` im Root sind veraltet
- Diese Dateien NICHT mehr verwenden — alle neuen Anfragen gehen über `/api/`
- Bei Gelegenheit: aus dem Webroot entfernen oder via `.htaccess` sperren

---

## 🧩 Template-System (Ziel-Architektur)

Jede Kundeninstanz bekommt eine eigene Konfiguration. Keine Kundendaten dürfen im Code stehen.

Kunden-spezifische Werte IMMER aus `data/config.json` laden:

```php
$CONFIG = readJson(DATA_DIR . '/config.json');
$companyName = $CONFIG['company']['name'] ?? 'Mein Betrieb';
```

Niemals hardcoden:

```php
// FALSCH:
$PROP_NAME = 'Sardinientraum';
$SAVE_PASSWORD = 'sardinien2025';

// RICHTIG:
$companyName = $CONFIG['company']['name'] ?? '';
```

---

## 🛠️ Code-Qualität

- `declare(strict_types=1)` in jeder PHP-Datei
- Keine verwaisten `var_dump`, `echo`, `print_r` Debug-Ausgaben
- Jede Funktion hat einen definierten Rückgabe-Typ oder Kommentar
- Keine doppelten Funktionen — `_bootstrap.php` Helpers verwenden
- Keine externen Dependencies ohne explizite Freigabe

---

## 🚫 Was du NICHT tun sollst ohne Rückfrage

- Die Datei-Struktur von `data/` ändern
- `_bootstrap.php` grundlegend umbauen
- Neue externe Libraries einbinden
- `.htaccess` Sicherheitsregeln entfernen oder abschwächen
- Auth-Flow oder Session-Logik verändern
- Bestehende API-Endpunkte umbenennen oder löschen

Bei Unsicherheit: kurz fragen bevor du änderst.

---

## Deployment-Checkliste (vor jedem Live-Gang)

- `data/` Ordner nicht webzugänglich (`.htaccess` prüfen)
- Keine Hardcode-Passwörter im Code
- `display_errors = Off` auf dem Server
- HTTPS aktiv und erzwungen
- `uploads/` sperrt PHP-Ausführung
- Alte Root-Dateien (`contact.php`, `save-config.php`) entfernt oder gesperrt
- Rate-Limits auf allen öffentlichen Endpunkten aktiv
- 2FA Setup abgeschlossen (`setup_complete: true` in `auth.json`)
