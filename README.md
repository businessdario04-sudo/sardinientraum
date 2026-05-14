# 🌊 Sardinientraum

Webseite mit eingebautem Wix-style Editor für eine Ferienwohnung in La Caletta, Sardinien.
Der Kunde kann seine Inhalte selbst per Browser bearbeiten — ohne technische Kenntnisse.

---

## 📁 Was ist drin?

| Datei | Zweck |
|---|---|
| **`index.html`** | Die eigentliche Webseite + eingebauter Editor |
| **`admin.html`** | Admin-Panel mit Login, Einstellungen, E-Mail-Vorlagen |
| **`contact.php`** | Verarbeitet Anfrage-Formular, sendet 2 gebrandete E-Mails |
| **`save.php`** | Schreibt `index.html` auf den Server (passwortgeschützt) |
| **`save-config.php`** | Schreibt `site-config.json` (passwortgeschützt) |
| **`site-config.json`** | Globale Konfiguration (E-Mail, Telefon, Adresse, usw.) |
| **`server-starten.ps1`** | Lokaler Entwicklungs-Server (Windows PowerShell) |

> **Scene-2.mp4** (Hero-Video) ist NICHT im Git — zu groß. Direkt auf den Hoster hochladen.

---

## 🚀 Lokal testen (Windows)

```powershell
# 1. Klonen
git clone https://github.com/businessdario04-sudo/sardinientraum.git
cd sardinientraum

# 2. Hero-Video bereitstellen
# Lege eine Datei "Scene-2.mp4" in den Projektordner

# 3. Server starten
powershell -ExecutionPolicy Bypass -File server-starten.ps1

# 4. Im Browser öffnen:
#    http://localhost:8080/admin.html
#    Login: admin / sardinien2025
```

---

## 🌐 Auf echtem Hoster deployen (Empfohlen: PHP-Hosting)

Empfohlen werden günstige Anbieter mit PHP 7.4+ und `mail()`-Funktion:
**All-Inkl, Hostinger, Strato, IONOS, NetCup** (ab ~3 €/Monat).

### Schritte:

1. **FTP / SFTP** in dein Hosting-Verzeichnis (meist `public_html/` oder `htdocs/`)
2. Folgende Dateien hochladen:
   - `index.html`
   - `admin.html`
   - `contact.php`
   - `save.php`
   - `save-config.php`
   - `site-config.json`
   - `Scene-2.mp4` (oder eigenes Hero-Video)
3. **Passwort ändern** in `save.php` und `save-config.php` (Zeile mit `$SAVE_PASSWORD`)
4. Domain aufrufen — Webseite läuft sofort
5. `domain.de/admin.html` aufrufen → einloggen → Einstellungen anpassen

### E-Mail einrichten

In `admin.html` → ⚙️ Einstellungen → Anfragen & E-Mail:
- **Empfänger-E-Mail** eintragen (z.B. `info@deine-domain.de`)
- „Auf Website anwenden" klicken

Die PHP `mail()`-Funktion verwendet die im Hosting konfigurierte SMTP.

---

## 📱 Von Handy/Tablet aus weiterarbeiten

### Option 1: GitHub.dev (kostenlos)
- Auf GitHub: `https://github.com/businessdario04-sudo/sardinientraum`
- Drücke `.` (Punkt) oder ändere `github.com` zu `github.dev`
- Vollständiger VS Code im Browser, läuft auf jedem Handy
- Direkt committen + pushen, Live auf Hoster via Git-Deploy

### Option 2: GitHub Mobile App
- App installieren, Repo öffnen
- Dateien direkt im Browser editieren
- Commits + Pull Requests von unterwegs

### Option 3: Codespaces (für Live-Vorschau)
- Im Repo: „Code" → „Codespaces" → „Create codespace"
- Cloud-VM mit PHP, kann Live-Preview anzeigen

---

## 🔐 Standard-Zugangsdaten (UNBEDINGT ÄNDERN!)

| Wo | User | Passwort |
|---|---|---|
| Admin-Panel | `admin` | `sardinien2025` |
| save.php | — | `sardinien2025` |
| save-config.php | — | `sardinien2025` |

In Produktion: alle drei auf gleiches starkes Passwort ändern.

---

## 🛠 Editor-Features (im Admin-Panel)

- **Texte ändern**: Klick auf Element → tippen
- **Farben**: Per Klick, mit Live-Hex-Eingabe
- **Bilder/Videos**: Klick + Datei hochladen
- **Karten verschieben**: Drag & Drop
- **Globale Einstellungen**: Zahnrad-Icon (Farben, Eckenradius, Schriften)
- **Speichern**: Schreibt direkt auf den Server (kein Download)

---

## 📧 E-Mail-Vorlagen

Im Admin-Panel → ✉️ E-Mail Vorlagen:
- **Angebots-E-Mail**: Felder ausfüllen → kopieren → in Gmail/Outlook einfügen
- **Buchungsbestätigung**: Detail mit Check-in/out, Preis, Hausregeln

Automatisch versendet werden:
- **Owner-Notification** bei jeder Formular-Anfrage
- **Gast-Bestätigung** als Auto-Reply

---

## 📜 Lizenz

Privat — alle Rechte vorbehalten.
