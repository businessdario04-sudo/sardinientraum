/**
 * editor.js — Sardinientraum Inline-Editor (v2)
 *
 * Wird dynamisch von site.js geladen wenn ?edit=1 und Admin-Session aktiv.
 *
 * KERNPRINZIP:
 *   Der Editor schreibt NIEMALS die index.html.
 *   Er erkennt data-bind-Attribute, sammelt Änderungen als JSON-Patch,
 *   und sendet sie an /api/save-content.php.
 *
 *   Beispiel: <h1 data-bind="hero.title"> bearbeitet → Patch:
 *     { target:"pages", patch: { hero: { title: "Neuer Titel" } } }
 *
 * Editier-Optionen:
 *   - Text:  data-bind="..."  → inline editierbar (contenteditable)
 *   - Bild:  IMG mit data-bind → "Bild ersetzen" via /api/upload.php
 *   - Video: VIDEO/SOURCE mit data-bind → "Video ersetzen"
 *   - Farben: Globales Settings-Panel (CSS-Variablen → config.theme.colors)
 */
(function () {
  'use strict';

  if (window.__SARDINIA_EDITOR_LOADED__) return;
  window.__SARDINIA_EDITOR_LOADED__ = true;

  const CSRF = window.__SARDINIA_CSRF__ || '';
  if (!CSRF) {
    console.warn('[editor] kein CSRF-Token — Bearbeiten gesperrt');
    return;
  }

  // ════════════════ STATE ════════════════
  let selectedEl   = null;
  let selectedPath = null;
  let pendingPatches = { pages: {}, config: {} };  // gesammelte Änderungen
  let dirty = false;

  // ════════════════ TOOLBAR ════════════════
  function buildToolbar() {
    if (document.getElementById('et-toolbar')) return;
    const tb = document.createElement('div');
    tb.id = 'et-toolbar';
    tb.innerHTML = `
      <div class="et-tb-left">
        <button class="et-tb-btn" id="et-settings-btn" title="Globale Einstellungen">⚙</button>
        <span class="et-tb-title">✏️ Bearbeitungsmodus</span>
        <span class="et-tb-dirty" id="et-tb-dirty"></span>
      </div>
      <div class="et-tb-right">
        <button class="et-tb-btn et-tb-save" id="et-save-btn">💾 Änderungen speichern</button>
        <button class="et-tb-btn" id="et-exit-btn">✕ Beenden</button>
      </div>
    `;
    document.body.appendChild(tb);
    document.body.classList.add('et-mode');

    document.getElementById('et-save-btn').addEventListener('click', saveAll);
    document.getElementById('et-exit-btn').addEventListener('click', exitEditor);
    document.getElementById('et-settings-btn').addEventListener('click', toggleSettings);
  }

  function setDirty(flag) {
    dirty = flag;
    const el = document.getElementById('et-tb-dirty');
    if (el) el.textContent = flag ? '● Ungespeichert' : '';
    const btn = document.getElementById('et-save-btn');
    if (btn) btn.classList.toggle('has-changes', flag);
  }

  // ════════════════ FELDER MARKIEREN ════════════════
  function markEditableFields() {
    document.querySelectorAll('[data-bind]').forEach(el => {
      if (el.closest('#et-toolbar,#et-settings-panel')) return;
      const path = el.dataset.bind;
      if (!path) return;
      // Bilder/Videos: spezieller Marker
      if (el.tagName === 'IMG' || el.tagName === 'VIDEO') {
        el.classList.add('et-editable', 'et-media');
        el.addEventListener('click', onMediaClick);
      } else if (el.tagName !== 'META' && el.tagName !== 'TITLE') {
        el.classList.add('et-editable', 'et-text');
        el.addEventListener('click', onTextClick);
      }
    });
  }

  function unmarkEditableFields() {
    document.querySelectorAll('.et-editable').forEach(el => {
      el.classList.remove('et-editable','et-text','et-media','et-selected');
      el.removeEventListener('click', onTextClick);
      el.removeEventListener('click', onMediaClick);
      el.removeEventListener('blur', onTextBlur);
      el.removeAttribute('contenteditable');
    });
  }

  // ════════════════ TEXT EDITING ════════════════
  function onTextClick(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget;
    selectElement(el);
    el.setAttribute('contenteditable', 'true');
    el.focus();
    el.addEventListener('blur', onTextBlur, { once: true });
  }

  function onTextBlur(e) {
    const el = e.target;
    el.removeAttribute('contenteditable');
    const path = el.dataset.bind;
    if (!path) return;
    // Innerer Text → wenn nur Text, dann textContent; bei <br> in HTML: \n
    let val = el.innerHTML.includes('<br>')
      ? el.innerHTML.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
      : el.textContent;
    val = val.trim();
    setPatchValue('pages', path, val);
    setDirty(true);
  }

  // ════════════════ MEDIA EDITING ════════════════
  function onMediaClick(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget;
    selectElement(el);
    triggerUpload(el);
  }

  function triggerUpload(targetEl) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = targetEl.tagName === 'VIDEO' ? 'video/*' : 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      const url = await uploadFile(f);
      if (!url) return;
      // Element sofort updaten
      if (targetEl.tagName === 'IMG') {
        targetEl.src = url;
      } else if (targetEl.tagName === 'VIDEO') {
        const s = targetEl.querySelector('source');
        if (s) s.src = url; else targetEl.src = url;
        try { targetEl.load(); targetEl.play(); } catch (_) {}
      }
      // Patch sammeln
      const path = targetEl.dataset.bind;
      if (path) {
        setPatchValue('pages', path, url);
        setDirty(true);
      }
    });
    input.click();
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/upload.php', {
        method: 'POST',
        body: fd,
        headers: { 'X-CSRF-Token': CSRF },
        credentials: 'same-origin'
      });
      const j = await r.json();
      if (j.ok && j.url) return '/' + j.url;
      alert('Upload fehlgeschlagen: ' + (j.error || 'unbekannt'));
      return null;
    } catch (e) {
      alert('Upload-Fehler: ' + e.message);
      return null;
    }
  }

  // ════════════════ SELECTION ════════════════
  function selectElement(el) {
    if (selectedEl && selectedEl !== el) selectedEl.classList.remove('et-selected');
    selectedEl   = el;
    selectedPath = el.dataset.bind || null;
    el.classList.add('et-selected');
  }

  // ════════════════ PATCH-SAMMLUNG ════════════════
  function setPatchValue(target, path, value) {
    const obj = pendingPatches[target] || (pendingPatches[target] = {});
    const keys = path.split('.');
    let cur = obj;
    keys.forEach((k, i) => {
      if (i === keys.length - 1) cur[k] = value;
      else { cur[k] = cur[k] || {}; cur = cur[k]; }
    });
  }

  // ════════════════ SETTINGS PANEL ════════════════
  function toggleSettings() {
    let panel = document.getElementById('et-settings-panel');
    if (panel) { panel.remove(); return; }
    panel = document.createElement('div');
    panel.id = 'et-settings-panel';
    panel.innerHTML = `
      <div class="et-sp-head">
        <span>⚙ Globale Einstellungen</span>
        <button id="et-sp-close">✕</button>
      </div>
      <div class="et-sp-body">
        <div class="et-sp-section">
          <h4>🎨 Farben</h4>
          <div class="et-sp-row">
            <label>Primärfarbe</label>
            <input type="color" id="sp-primary" value="${getCssVar('--ocean','#1e4d6b')}">
          </div>
          <div class="et-sp-row">
            <label>Akzentfarbe</label>
            <input type="color" id="sp-accent" value="${getCssVar('--gold','#c8975a')}">
          </div>
          <div class="et-sp-row">
            <label>Hintergrund (Sand)</label>
            <input type="color" id="sp-sand" value="${getCssVar('--sand','#f0e6d3')}">
          </div>
          <div class="et-sp-row">
            <label>Textfarbe</label>
            <input type="color" id="sp-text" value="${getCssVar('--text','#2a2a2a')}">
          </div>
        </div>
        <div class="et-sp-section">
          <h4>📐 Eckenradius</h4>
          <select id="sp-radius">
            <option value="0px">Eckig</option>
            <option value="8px">Leicht rund</option>
            <option value="16px" selected>Rund</option>
            <option value="24px">Sehr rund</option>
          </select>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('et-sp-close').addEventListener('click', toggleSettings);

    const bind = (id, varName, cfgPath) => {
      document.getElementById(id).addEventListener('input', e => {
        document.documentElement.style.setProperty(varName, e.target.value);
        setPatchValue('config', cfgPath, e.target.value);
        setDirty(true);
      });
    };
    bind('sp-primary', '--ocean', 'theme.colors.primary');
    bind('sp-accent',  '--gold',  'theme.colors.accent');
    bind('sp-sand',    '--sand',  'theme.colors.sand');
    bind('sp-text',    '--text',  'theme.colors.text');
    document.getElementById('sp-radius').addEventListener('change', e => {
      document.documentElement.style.setProperty('--radius', e.target.value);
      setPatchValue('config', 'theme.radius', e.target.value);
      setDirty(true);
    });
  }

  function getCssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // ════════════════ SAVE ════════════════
  async function saveAll() {
    if (!dirty) { alert('Keine Änderungen zum Speichern.'); return; }
    const btn = document.getElementById('et-save-btn');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Speichern…';

    try {
      const targets = Object.keys(pendingPatches).filter(t => Object.keys(pendingPatches[t]).length > 0);
      for (const target of targets) {
        const r = await fetch('/api/save-content.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
          body: JSON.stringify({ target, patch: pendingPatches[target] }),
          credentials: 'same-origin'
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'save_failed');
      }
      // Erfolg
      pendingPatches = { pages: {}, config: {} };
      setDirty(false);
      btn.textContent = '✅ Gespeichert';
      btn.style.background = '#22c55e';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);
    } catch (e) {
      alert('Speichern fehlgeschlagen: ' + e.message);
      btn.textContent = orig;
      btn.disabled = false;
    }
  }

  // ════════════════ EXIT ════════════════
  function exitEditor() {
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    location.replace(location.pathname);   // ohne ?edit=1
  }

  // ════════════════ BOOT ════════════════
  function boot() {
    buildToolbar();
    markEditableFields();
    document.addEventListener('sardinia:data-loaded', () => {
      // Wenn Listen neu gerendert wurden: erneut markieren
      unmarkEditableFields();
      markEditableFields();
    });
    // Vor Verlassen warnen wenn dirty
    window.addEventListener('beforeunload', e => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
