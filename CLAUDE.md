# CLAUDE.md — Verbindliche Workflow-Regeln

> **Diese Datei wird beim Start jeder Session gelesen.**
> Alle Regeln hier sind verbindlich und müssen vor jeder Änderung beachtet werden.

---

## 🛡️ Goldene Regel: Erst Sandbox, dann Live

**NIEMALS direkt eine produktive Datei bearbeiten.**

Der Ablauf ist IMMER:

1. **Kopie anlegen** in `sandbox/` Ordner
2. **Kopie bearbeiten**
3. **Kopie testen** (mit dem lokalen Server, im Browser)
4. Wenn der Test andere Dateien braucht → **diese auch kopieren** in die Sandbox
5. **Erst nach erfolgreichem Test:** Sandbox-Version in Produktion übernehmen
6. **Nach jedem Erfolg:** Sofort auf GitHub pushen

---

## 📋 Konkreter Ablauf bei jeder Bearbeitung

### Schritt 1 — Sandbox vorbereiten

```bash
# Falls sandbox/ noch nicht existiert
mkdir -p sandbox/

# Datei kopieren die geändert werden soll
cp index.html sandbox/index.html

# Falls Tests die Originaldaten brauchen, mit kopieren:
cp site-config.json sandbox/site-config.json
```

### Schritt 2 — In der Sandbox arbeiten

- ALLE Edit-Tool-Aufrufe gehen auf `sandbox/<datei>`, NIE auf das Original
- Bei Tests: Server zeigt auf den Sandbox-Ordner oder lädt aus sandbox/

### Schritt 3 — Testen

- Im Browser: Sandbox-Version öffnen
- Funktionalität verifizieren
- Konsolen-Errors prüfen

### Schritt 4 — Übernahme nach Erfolg

```bash
# Original mit getesteter Sandbox-Version überschreiben
cp sandbox/index.html index.html

# Sandbox wieder aufräumen
rm -rf sandbox/*
```

### Schritt 5 — GitHub-Backup

```bash
git add -A
git commit -m "<klare Beschreibung der Änderung>"
git push origin main
```

---

## ⚠️ Was NIE passieren darf

- ❌ Test-Daten via `curl` oder `fetch` direkt an `/save` schicken → überschreibt index.html
- ❌ HTML, das den Server testen soll, ohne Größenprüfung senden
- ❌ Edits direkt an `index.html`, `admin.html`, `contact.php`, `save.php`, `save-config.php`, `site-config.json` ohne vorherige Sandbox-Kopie
- ❌ Commits ohne vorherigen Test
- ❌ Force-Push ohne Backup

---

## ✅ Hauptdateien (Schutz-Liste)

Diese Dateien NUR über den Sandbox-Workflow ändern:

| Datei | Was sie enthält |
|---|---|
| `index.html` | Live-Webseite + Editor |
| `admin.html` | Admin-Panel |
| `contact.php` | Form-Handler mit E-Mail-Templates |
| `save.php` | Server-seitiges Speichern |
| `save-config.php` | Config-Schreiber |
| `server-starten.ps1` | Lokaler Entwicklungs-Server |
| `site-config.json` | Site-Konfiguration |
| `README.md` | Projekt-Dokumentation |

---

## 🔄 Backup-Disziplin

**Nach jedem erfolgreichen Test wird gepusht.** Kein "ich pushe später".

- Commit-Message: kurz, präzise, deutsch — z.B. "Editor: Save-Button-Bug fix"
- Bei mehreren Änderungen: ein Commit pro logische Einheit
- Nie `git push -f` außer auf Anweisung

---

## 🧪 Server-Save-Endpoints — Test-Sicherheit

Der lokale Server hat eingebaute Schutzmaßnahmen:

- `POST /save` lehnt HTML unter 10 KB ab (Statuscode 422)
- `POST /save` verlangt `<!DOCTYPE html>` und `</html>` im Body
- Im `$SAFE_SAVE_MODE` schreibt `/save` in `index.draft.html`, nicht `index.html`

**Trotzdem:** Beim Debuggen NICHT direkt mit `curl -d "test"` o.ä. die Endpoints testen, sondern den Sandbox-Workflow nutzen.

---

## 📜 Bei Verstoß: Recovery-Pfad

Falls trotz Regeln eine Hauptdatei beschädigt wurde:

```bash
# Aus Git wiederherstellen
git checkout HEAD -- <datei>

# Oder aus Timestamp-Backup im Hauptordner
cp index.html.backup-<timestamp>.html index.html
```

**Diese Datei (CLAUDE.md) zu Beginn jeder Session lesen — sie ist die einzige Quelle der Workflow-Wahrheit.**
