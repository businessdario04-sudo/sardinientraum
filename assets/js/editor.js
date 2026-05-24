/**
 * editor.js — Sardinientraum Inline-Editor (v2)
 *
 * Geladen von site.js wenn ?edit=1 und Admin-Session aktiv.
 * Schreibt NIEMALS index.html — nur JSON-Patches via /api/save-content.php.
 *
 * Save-Modi:
 *   "Als Draft"  → speichert in data/pages.draft.json (Vorschau im Admin)
 *   "Live"       → speichert direkt in data/pages.json (sofort sichtbar)
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
  let selectedEl     = null;
  let pendingPatches = { pages: {}, config: {} };
  let dirty          = false;

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
        <button class="et-tb-btn et-tb-draft" id="et-draft-btn" title="Änderungen als Entwurf speichern — im Admin-Panel ansehen bevor Live">💾 Als Draft</button>
        <button class="et-tb-btn et-tb-save"  id="et-save-btn"  title="Änderungen sofort Live schalten">🚀 Live speichern</button>
        <button class="et-tb-btn" id="et-exit-btn">✕ Beenden</button>
      </div>
    `;
    document.body.appendChild(tb);
    document.body.classList.add('et-mode');

    document.getElementById('et-draft-btn').addEventListener('click', () => saveAll('draft'));
    document.getElementById('et-save-btn').addEventListener('click',  () => saveAll('live'));
    document.getElementById('et-exit-btn').addEventListener('click',  exitEditor);
    document.getElementById('et-settings-btn').addEventListener('click', toggleSettings);
  }

  function setDirty(flag) {
    dirty = flag;
    const lbl = document.getElementById('et-tb-dirty');
    if (lbl) lbl.textContent = flag ? '● Ungespeichert' : '';
    ['et-draft-btn', 'et-save-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('has-changes', flag);
    });
  }

  // ════════════════ BILD-BAR ════════════════
  function showImageBar(el) {
    hideImageBar();

    const bar = document.createElement('div');
    bar.id = 'et-img-bar';

    const rawPath = el.dataset.bind || '';
    const label   = rawPath ? rawPath.split('.').pop() : 'Bild';

    bar.innerHTML = `
      <div class="et-img-bar-left">
        <span class="et-img-bar-icon">🖼</span>
        <span class="et-img-bar-label">${label}</span>
        <span id="et-img-bar-status" class="et-img-bar-status">Keine Datei gewählt</span>
      </div>
      <div class="et-img-bar-right">
        <button class="et-tb-btn" id="et-img-choose-btn">📁 Datei wählen</button>
        <button class="et-tb-btn et-img-apply-btn" id="et-img-apply-btn" disabled>✓ Übernehmen</button>
        <button class="et-tb-btn et-img-close-btn"  id="et-img-close-btn">✕</button>
      </div>
    `;

    // Direkt unter dem Haupt-Toolbar einfügen
    const toolbar = document.getElementById('et-toolbar');
    if (toolbar?.parentNode) {
      toolbar.parentNode.insertBefore(bar, toolbar.nextSibling);
    } else {
      document.body.prepend(bar);
    }
    document.body.classList.add('et-has-imgbar');

    let pendingUrl = null;

    // Verstecktes File-Input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = el.tagName === 'VIDEO' ? 'video/*' : 'image/*';
    input.style.cssText = 'position:absolute;left:-9999px;width:1px;';
    document.body.appendChild(input);

    const status  = () => document.getElementById('et-img-bar-status');
    const applyEl = () => document.getElementById('et-img-apply-btn');

    document.getElementById('et-img-choose-btn').addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      setStatus('⏳ Lädt hoch…', '#fbbf24');
      if (applyEl()) applyEl().disabled = true;

      const url = await uploadFile(f);
      if (!url) { setStatus('✗ Upload fehlgeschlagen', '#ef4444'); return; }

      pendingUrl = url;
      setStatus('✓ ' + f.name, '#22c55e');
      if (applyEl()) applyEl().disabled = false;
    });

    document.getElementById('et-img-apply-btn').addEventListener('click', () => {
      if (!pendingUrl) return;
      applyMedia(el, pendingUrl);
      const path = el.dataset.bind;
      if (path) { setPatchValue('pages', path, pendingUrl); setDirty(true); }
      input.remove();
      hideImageBar();
    });

    document.getElementById('et-img-close-btn').addEventListener('click', () => {
      input.remove();
      hideImageBar();
    });

    function setStatus(text, color) {
      const el = status();
      if (el) { el.textContent = text; el.style.color = color || ''; }
    }
  }

  function hideImageBar() {
    document.getElementById('et-img-bar')?.remove();
    document.body.classList.remove('et-has-imgbar');
  }

  function applyMedia(el, url) {
    if (el.tagName === 'IMG') {
      el.src = url;
    } else if (el.tagName === 'VIDEO') {
      const s = el.querySelector('source');
      if (s) s.src = url; else el.src = url;
      try { el.load(); el.play(); } catch (_) {}
    }
  }

  // ════════════════ FELDER MARKIEREN ════════════════
  function markEditableFields() {
    document.querySelectorAll('[data-bind]').forEach(el => {
      if (el.closest('#et-toolbar,#et-img-bar,#et-settings-panel')) return;
      const path = el.dataset.bind;
      if (!path) return;
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
      el.removeAttribute('contenteditable');
    });
  }

  // ════════════════ TEXT EDITING ════════════════
  function onTextClick(e) {
    e.preventDefault(); e.stopPropagation();
    hideImageBar();
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
    let val = el.innerHTML.includes('<br>')
      ? el.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
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
    showImageBar(el);
  }

  // ════════════════ UPLOAD ════════════════
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
      alert('Upload fehlgeschlagen:\n' + (j.msg || j.error || 'Unbekannt') + (j.code ? ' (Code ' + j.code + ')' : ''));
      return null;
    } catch (e) {
      alert('Upload-Fehler (Verbindung):\n' + e.message);
      return null;
    }
  }

  // ════════════════ SELECTION ════════════════
  function selectElement(el) {
    if (selectedEl && selectedEl !== el) selectedEl.classList.remove('et-selected');
    selectedEl = el;
    el.classList.add('et-selected');
  }

  // ════════════════ PATCH-SAMMLUNG ════════════════
  function setPatchValue(target, path, value) {
    const obj  = pendingPatches[target] || (pendingPatches[target] = {});
    const keys = path.split('.');
    let cur = obj;
    keys.forEach((k, i) => {
      if (i === keys.length - 1) cur[k] = value;
      else { cur[k] = cur[k] || {}; cur = cur[k]; }
    });
  }

  // ════════════════ SETTINGS PANEL ════════════════
  const SECTIONS = [
    { id: 'hero',        label: 'Hero (Startbild)' },
    { id: 'ueber',       label: 'Über uns' },
    { id: 'wohnungen',   label: 'Wohnungen' },
    { id: 'region',      label: 'Region' },
    { id: 'bewertungen', label: 'Bewertungen' },
    { id: 'faq',         label: 'FAQ' },
    { id: 'anfrage',     label: 'Kontakt / Anfrage' },
  ];

  function toggleSettings() {
    let panel = document.getElementById('et-settings-panel');
    if (panel) { panel.remove(); return; }
    panel = document.createElement('div');
    panel.id = 'et-settings-panel';

    const currentRadius = getCssVar('--radius', '16px');
    const radiusOptions = ['0px','8px','16px','24px'].map(v =>
      `<option value="${v}"${v === currentRadius ? ' selected' : ''}>${
        {  '0px':'Eckig', '8px':'Leicht rund', '16px':'Rund', '24px':'Sehr rund' }[v]
      }</option>`
    ).join('');

    const sectionRows = SECTIONS.map(s => `
      <div class="et-sp-row">
        <label>${s.label}</label>
        <div class="et-sp-color-wrap">
          <input type="color" id="sp-bg-${s.id}" value="${getSectionBg(s.id)}">
          <button class="et-sp-reset" data-section="${s.id}" title="Zurücksetzen">✕</button>
        </div>
      </div>`).join('');

    panel.innerHTML = `
      <div class="et-sp-head">
        <span>🎨 Design</span>
        <button id="et-sp-close" title="Panel schließen">✕</button>
      </div>
      <div class="et-sp-body">
        <div class="et-sp-section">
          <h4>🎨 Globale Farben</h4>
          <div class="et-sp-row"><label>Primärfarbe</label><input type="color" id="sp-primary" value="${getCssVar('--ocean','#1e4d6b')}"></div>
          <div class="et-sp-row"><label>Akzentfarbe</label><input type="color" id="sp-accent"  value="${getCssVar('--gold','#c8975a')}"></div>
          <div class="et-sp-row"><label>Hintergrund (Sand)</label><input type="color" id="sp-sand" value="${getCssVar('--sand','#f0e6d3')}"></div>
          <div class="et-sp-row"><label>Textfarbe</label><input type="color" id="sp-text" value="${getCssVar('--text','#2a2a2a')}"></div>
        </div>
        <div class="et-sp-section">
          <h4>📐 Eckenradius</h4>
          <select id="sp-radius">${radiusOptions}</select>
        </div>
        <div class="et-sp-section">
          <h4>🏠 Abschnitt-Hintergründe</h4>
          <p class="et-sp-hint">Klicke auf ✕ um den Original-Hintergrund wiederherzustellen.</p>
          ${sectionRows}
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('et-sp-close').addEventListener('click', toggleSettings);

    // Globale Farben binden
    const bind = (id, varName, cfgPath) => {
      document.getElementById(id)?.addEventListener('input', e => {
        document.documentElement.style.setProperty(varName, e.target.value);
        setPatchValue('config', cfgPath, e.target.value);
        setDirty(true);
      });
    };
    bind('sp-primary', '--ocean', 'theme.colors.primary');
    bind('sp-accent',  '--gold',  'theme.colors.accent');
    bind('sp-sand',    '--sand',  'theme.colors.sand');
    bind('sp-text',    '--text',  'theme.colors.text');

    document.getElementById('sp-radius')?.addEventListener('change', e => {
      document.documentElement.style.setProperty('--radius', e.target.value);
      setPatchValue('config', 'theme.radius', e.target.value);
      setDirty(true);
    });

    // Abschnitt-Hintergründe binden
    SECTIONS.forEach(s => {
      document.getElementById(`sp-bg-${s.id}`)?.addEventListener('input', e => {
        const el = document.getElementById(s.id);
        if (el) el.style.backgroundColor = e.target.value;
        // Config lokal mitschreiben (für spätere getSectionBg-Lesungen)
        if (!window.__SARDINIA_CONFIG__) window.__SARDINIA_CONFIG__ = {};
        if (!window.__SARDINIA_CONFIG__.theme) window.__SARDINIA_CONFIG__.theme = {};
        if (!window.__SARDINIA_CONFIG__.theme.section_bgs) window.__SARDINIA_CONFIG__.theme.section_bgs = {};
        window.__SARDINIA_CONFIG__.theme.section_bgs[s.id] = e.target.value;
        setPatchValue('config', `theme.section_bgs.${s.id}`, e.target.value);
        setDirty(true);
      });
    });

    // Reset-Buttons
    panel.querySelectorAll('.et-sp-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.section;
        const el  = document.getElementById(sid);
        if (el) el.style.backgroundColor = '';
        // Lokal löschen
        if (window.__SARDINIA_CONFIG__?.theme?.section_bgs) {
          window.__SARDINIA_CONFIG__.theme.section_bgs[sid] = null;
        }
        setPatchValue('config', `theme.section_bgs.${sid}`, null);
        setDirty(true);
        // Input auf Weiß zurücksetzen
        const inp = document.getElementById(`sp-bg-${sid}`);
        if (inp) inp.value = '#ffffff';
      });
    });
  }

  function getCssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
  }

  function getSectionBg(sectionId) {
    // Gespeicherten Wert aus config bevorzugen
    const saved = window.__SARDINIA_CONFIG__?.theme?.section_bgs?.[sectionId];
    if (saved) return saved;
    // Fallback: inline-Style lesen (z.B. gesetzt durch applyConfig)
    const el = document.getElementById(sectionId);
    if (!el) return '#ffffff';
    const inline = el.style.backgroundColor;
    if (inline) return rgbToHex(inline) || '#ffffff';
    return '#ffffff';
  }

  // ════════════════ SAVE ════════════════
  async function saveAll(mode) {
    const isDraft = mode === 'draft';

    if (!dirty) {
      alert(isDraft ? 'Keine Änderungen zum Als-Draft-Speichern.' : 'Keine Änderungen zum Speichern.');
      return;
    }

    const btnId = isDraft ? 'et-draft-btn' : 'et-save-btn';
    const btn   = document.getElementById(btnId);
    const orig  = btn?.textContent || '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Speichern…'; }

    try {
      const targets = Object.keys(pendingPatches).filter(t => Object.keys(pendingPatches[t]).length > 0);
      for (const target of targets) {
        const body = { target, patch: pendingPatches[target] };
        if (isDraft) body.draft = true;
        const r = await fetch('/api/save-content.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
          body: JSON.stringify(body),
          credentials: 'same-origin'
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'save_failed');
      }

      pendingPatches = { pages: {}, config: {} };
      setDirty(false);

      if (btn) {
        btn.textContent    = isDraft ? '✅ Draft gespeichert' : '✅ Live gespeichert!';
        btn.style.background = isDraft ? '#c8975a' : '#22c55e';
      }
      setTimeout(() => {
        if (btn) { btn.textContent = orig; btn.style.background = ''; btn.disabled = false; }
      }, 2500);

      if (isDraft) {
        const dirty = document.getElementById('et-tb-dirty');
        if (dirty) { dirty.textContent = '✓ Als Draft gespeichert — im Admin-Panel prüfen'; }
        setTimeout(() => { if (dirty) dirty.textContent = ''; }, 4000);
      }
    } catch (e) {
      alert('Speichern fehlgeschlagen: ' + e.message);
      if (btn) { btn.textContent = orig; btn.disabled = false; }
    }
  }

  // ════════════════ EXIT ════════════════
  function exitEditor() {
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    location.replace(location.pathname);
  }

  // ════════════════ BOOT ════════════════
  function boot() {
    buildToolbar();
    markEditableFields();
    // Design-Panel automatisch öffnen
    toggleSettings();
    document.addEventListener('sardinia:data-loaded', () => {
      unmarkEditableFields();
      markEditableFields();
    });
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
