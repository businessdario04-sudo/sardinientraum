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
    // Normale data-bind Felder
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

    // Listen-Elemente (data-bind-item) editierbar machen
    document.querySelectorAll('[data-bind-list]').forEach(container => {
      const listPath = container.dataset.bindList; // z.B. "region.items"
      container.querySelectorAll('[data-bind-item]').forEach(el => {
        if (el.closest('#et-toolbar,#et-img-bar,#et-settings-panel')) return;
        if (el.classList.contains('et-editable')) return; // bereits markiert
        const itemKey = el.dataset.bindItem;
        const cardEl  = el.closest('[data-bind-index]');
        if (!cardEl) return;
        const idx      = cardEl.dataset.bindIndex;
        const fullPath = `${listPath}.${idx}.${itemKey}`; // z.B. "region.items.0.label"
        el.dataset.bind = fullPath; // reuse bestehenden Mechanismus

        if (el.tagName === 'IMG') {
          el.classList.add('et-editable', 'et-media');
          el.addEventListener('click', onMediaClick);
        } else {
          el.classList.add('et-editable', 'et-text');
          el.addEventListener('click', onListItemTextClick);
        }
      });
    });
  }

  function unmarkEditableFields() {
    document.querySelectorAll('.et-editable').forEach(el => {
      el.classList.remove('et-editable','et-text','et-media','et-selected');
      el.removeEventListener('click', onTextClick);
      el.removeEventListener('click', onListItemTextClick);
      el.removeEventListener('click', onMediaClick);
      el.removeAttribute('contenteditable');
      delete el.dataset.bind; // nur wenn wir es gesetzt haben? Nein, das wäre zu invasiv
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

  // ════════════════ LIST-ITEM TEXT EDITING ════════════════
  // Für data-bind-item Texte (z.B. region-Karten-Labels)
  function onListItemTextClick(e) {
    e.preventDefault(); e.stopPropagation();
    hideImageBar();
    const el = e.currentTarget;
    selectElement(el);
    el.setAttribute('contenteditable', 'true');
    el.focus();
    el.addEventListener('blur', onListItemTextBlur, { once: true });
  }

  function onListItemTextBlur(e) {
    const el = e.target;
    el.removeAttribute('contenteditable');
    const path = el.dataset.bind; // z.B. "region.items.0.label"
    if (!path) return;
    let val = el.innerHTML.includes('<br>')
      ? el.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
      : el.textContent;
    val = val.trim();

    // Direkt in __SARDINIA_PAGES__ schreiben (damit Modal etc. aktuell bleibt)
    const pages = window.__SARDINIA_PAGES__;
    if (pages) setDeepValue(pages, path, val);

    // Gesamtes Array in den Patch schreiben (einfachste zuverlässige Methode)
    const parts   = path.split('.');
    const numIdx  = parts.findIndex(p => /^\d+$/.test(p));
    if (numIdx > 0 && pages) {
      const arrayPath = parts.slice(0, numIdx).join('.');
      const fullArr   = resolveDeep(pages, arrayPath);
      if (Array.isArray(fullArr)) setPatchValue('pages', arrayPath, JSON.parse(JSON.stringify(fullArr)));
    } else {
      setPatchValue('pages', path, val);
    }
    setDirty(true);
  }

  function setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (cur[k] === undefined || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function resolveDeep(obj, path) {
    return path.split('.').reduce((cur, k) => (cur && cur[k] !== undefined ? cur[k] : undefined), obj);
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
    { id: 'ueber',       label: 'Über uns' },
    { id: 'wohnungen',   label: 'Wohnungen' },
    { id: 'region',      label: 'Region' },
    { id: 'bewertungen', label: 'Bewertungen' },
    { id: 'faq',         label: 'FAQ' },
    { id: 'anfrage',     label: 'Kontakt / Anfrage' },
  ];

  function getHeroMediaMode() {
    return window.__SARDINIA_CONFIG__?.theme?.hero_media?.mode || 'video';
  }

  function toggleSettings() {
    let panel = document.getElementById('et-settings-panel');
    if (panel) { panel.remove(); return; }
    panel = document.createElement('div');
    panel.id = 'et-settings-panel';

    const currentRadius = getCssVar('--radius', '16px');
    const radiusOptions = ['0px','8px','16px','24px'].map(v =>
      `<option value="${v}"${v === currentRadius ? ' selected' : ''}>${
        { '0px':'Eckig', '8px':'Leicht rund', '16px':'Rund', '24px':'Sehr rund' }[v]
      }</option>`
    ).join('');

    const heroMode = getHeroMediaMode();

    const sectionRows = SECTIONS.map(s => {
      const hasImg = !!(window.__SARDINIA_CONFIG__?.theme?.section_bg_images?.[s.id]);
      return `
      <div class="et-sp-row" id="sp-row-${s.id}">
        <label>${s.label}</label>
        <div class="et-sp-color-wrap">
          <input type="color" id="sp-bg-${s.id}" value="${getSectionBg(s.id)}" title="Hintergrundfarbe">
          <button class="et-bg-img-btn ${hasImg ? 'has-image' : ''}" data-section="${s.id}" title="Hintergrundbild hochladen">🖼${hasImg ? ' ✓' : ''}</button>
          <button class="et-sp-reset" data-section="${s.id}" title="Alles zurücksetzen">✕</button>
        </div>
      </div>`;
    }).join('');

    const currentLogoDark  = window.__SARDINIA_PAGES__?.site?.logo       || '/uploads/logo.svg';
    const currentLogoLight = window.__SARDINIA_PAGES__?.site?.logo_light || currentLogoDark;

    panel.innerHTML = `
      <div class="et-sp-head">
        <span>🎨 Design</span>
        <button id="et-sp-close" title="Panel schließen">✕</button>
      </div>
      <div class="et-sp-body">

        <div class="et-sp-section">
          <h4>🖼 Logo</h4>

          <!-- Dunkle Version -->
          <div style="margin-bottom:6px;">
            <div style="font-size:.72rem;font-weight:600;color:var(--muted,#888);margin-bottom:4px;letter-spacing:.04em;">AUF HELLEM HINTERGRUND (gescrollte Nav)</div>
            <div style="display:flex;gap:10px;align-items:center;background:#f5f5f5;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
              <img id="sp-logo-preview-dark" src="${currentLogoDark}" style="height:34px;width:auto;max-width:90px;object-fit:contain;" alt="Logo dunkel">
              <span style="font-size:.68rem;color:#555;line-height:1.3;">Deine dunkle/farbige Version</span>
            </div>
            <button class="et-bg-img-btn" id="logo-dark-upload-btn" style="width:100%;text-align:center;padding:7px;font-size:.8rem;">
              📤 Logo (dunkel/farbig) hochladen
            </button>
            <div class="et-drag-hint" id="logo-dark-msg"></div>
          </div>

          <!-- Helle Version -->
          <div>
            <div style="font-size:.72rem;font-weight:600;color:var(--muted,#888);margin-bottom:4px;letter-spacing:.04em;">AUF DUNKLEM HINTERGRUND (Hero + Footer)</div>
            <div style="display:flex;gap:10px;align-items:center;background:#1e4d6b;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
              <img id="sp-logo-preview-light" src="${currentLogoLight}" style="height:34px;width:auto;max-width:90px;object-fit:contain;" alt="Logo hell">
              <span style="font-size:.68rem;color:rgba(255,255,255,.6);line-height:1.3;">Deine helle/weiße Version</span>
            </div>
            <button class="et-bg-img-btn" id="logo-light-upload-btn" style="width:100%;text-align:center;padding:7px;font-size:.8rem;">
              📤 Logo (hell/weiß) hochladen
            </button>
            <div class="et-drag-hint" id="logo-light-msg"></div>
          </div>
        </div>

        <div class="et-sp-section">
          <h4>🎬 Hero-Hintergrund</h4>
          <div class="et-hero-toggle">
            <button class="et-hero-toggle-btn ${heroMode === 'video' ? 'active' : ''}" id="hero-mode-video">📹 Video</button>
            <button class="et-hero-toggle-btn ${heroMode === 'image' ? 'active' : ''}" id="hero-mode-image">🖼 Bild</button>
          </div>
          <button class="et-bg-img-btn" id="hero-upload-btn" style="width:100%;text-align:center;padding:8px;">
            📁 ${heroMode === 'video' ? 'Video' : 'Bild'} hochladen
          </button>
          <div class="et-drag-hint">oder Datei direkt auf den Hero-Bereich ziehen</div>
        </div>

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
          <p class="et-sp-hint">🎨 Farbe · 🖼 Bild hochladen · ✕ Zurücksetzen</p>
          <p class="et-sp-hint" style="margin-top:-6px;">Tipp: Bild direkt auf den Abschnitt ziehen!</p>
          ${sectionRows}
        </div>

      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('et-sp-close').addEventListener('click', toggleSettings);

    // ── Logo Upload Helper ──
    function makeLogoUploader(btnId, msgId, bindKey, previewId) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/svg+xml,image/png,image/webp,image/jpeg';
        inp.style.cssText = 'position:absolute;left:-9999px;';
        document.body.appendChild(inp);
        inp.addEventListener('change', async () => {
          const f = inp.files?.[0];
          inp.remove();
          if (!f) return;
          const btn = document.getElementById(btnId);
          const msg = document.getElementById(msgId);
          const origLabel = btn?.textContent || '';
          if (btn) { btn.textContent = '⏳ Lädt hoch…'; btn.disabled = true; }
          const url = await uploadFile(f);
          if (btn) { btn.textContent = origLabel; btn.disabled = false; }
          if (!url) { if (msg) msg.textContent = '❌ Upload fehlgeschlagen.'; return; }

          // Alle passenden Logo-Imgs auf der Seite sofort aktualisieren
          document.querySelectorAll(`[data-bind="${bindKey}"]`).forEach(img => { img.src = url; });
          // Vorschau im Panel
          const preview = document.getElementById(previewId);
          if (preview) preview.src = url;

          // In den Patch-Sammler schreiben
          setPatchValue('pages', bindKey, url);
          const pages = window.__SARDINIA_PAGES__;
          if (pages) { if (!pages.site) pages.site = {}; pages.site[bindKey.split('.').pop()] = url; }
          setDirty(true);

          if (msg) msg.textContent = '✅ Gespeichert — Speichern nicht vergessen!';
        });
        inp.click();
      });
    }

    makeLogoUploader('logo-dark-upload-btn',  'logo-dark-msg',  'site.logo',       'sp-logo-preview-dark');
    makeLogoUploader('logo-light-upload-btn', 'logo-light-msg', 'site.logo_light', 'sp-logo-preview-light');

    // ── Hero-Modus Toggle ──
    document.getElementById('hero-mode-video')?.addEventListener('click', () => {
      setHeroMedia('video', null);
      document.getElementById('hero-mode-video').classList.add('active');
      document.getElementById('hero-mode-image').classList.remove('active');
      const btn = document.getElementById('hero-upload-btn');
      if (btn) btn.textContent = '📁 Video hochladen';
    });
    document.getElementById('hero-mode-image')?.addEventListener('click', () => {
      setHeroMedia('image', window.__SARDINIA_CONFIG__?.theme?.hero_media?.image_url || null);
      document.getElementById('hero-mode-image').classList.add('active');
      document.getElementById('hero-mode-video').classList.remove('active');
      const btn = document.getElementById('hero-upload-btn');
      if (btn) btn.textContent = '📁 Bild hochladen';
    });

    // ── Hero Upload Button ──
    document.getElementById('hero-upload-btn')?.addEventListener('click', () => {
      const mode = getHeroMediaMode();
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = mode === 'video' ? 'video/*' : 'image/*';
      inp.style.cssText = 'position:absolute;left:-9999px;';
      document.body.appendChild(inp);
      inp.addEventListener('change', async () => {
        const f = inp.files?.[0];
        if (!f) { inp.remove(); return; }
        const btn = document.getElementById('hero-upload-btn');
        if (btn) { btn.textContent = '⏳ Lädt hoch…'; btn.disabled = true; }
        const url = await uploadFile(f);
        inp.remove();
        if (!url) { if (btn) { btn.textContent = '✗ Fehlgeschlagen'; btn.disabled = false; } return; }
        if (mode === 'video') {
          setHeroMedia('video', url);
          setPatchValue('config', 'theme.hero_media.mode',      'video');
          setPatchValue('config', 'theme.hero_media.video_url', url);
        } else {
          setHeroMedia('image', url);
          setPatchValue('config', 'theme.hero_media.mode',      'image');
          setPatchValue('config', 'theme.hero_media.image_url', url);
        }
        setDirty(true);
        if (btn) { btn.textContent = '✅ Übernommen!'; btn.disabled = false; setTimeout(() => { if (btn) btn.textContent = '📁 ' + (mode==='video'?'Video':'Bild') + ' hochladen'; }, 2000); }
      });
      inp.click();
    });

    // ── Globale Farben binden ──
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

    // ── Abschnitt-Farben binden ──
    SECTIONS.forEach(s => {
      document.getElementById(`sp-bg-${s.id}`)?.addEventListener('input', e => {
        const el = document.getElementById(s.id);
        if (el) el.style.background = e.target.value;
        if (!window.__SARDINIA_CONFIG__) window.__SARDINIA_CONFIG__ = {};
        if (!window.__SARDINIA_CONFIG__.theme) window.__SARDINIA_CONFIG__.theme = {};
        if (!window.__SARDINIA_CONFIG__.theme.section_bgs) window.__SARDINIA_CONFIG__.theme.section_bgs = {};
        window.__SARDINIA_CONFIG__.theme.section_bgs[s.id] = e.target.value;
        setPatchValue('config', `theme.section_bgs.${s.id}`, e.target.value);
        setDirty(true);
      });
    });

    // ── Abschnitt Bild-Upload Buttons ──
    panel.querySelectorAll('.et-bg-img-btn[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.section;
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.style.cssText = 'position:absolute;left:-9999px;';
        document.body.appendChild(inp);
        inp.addEventListener('change', async () => {
          const f = inp.files?.[0];
          if (!f) { inp.remove(); return; }
          btn.textContent = '⏳';
          const url = await uploadFile(f);
          inp.remove();
          if (!url) { btn.textContent = '✗'; return; }
          applySectionBgImage(sid, url);
          btn.textContent = '🖼 ✓';
          btn.classList.add('has-image');
          setDirty(true);
        });
        inp.click();
      });
    });

    // ── Reset-Buttons (löscht Farbe UND Bild) ──
    panel.querySelectorAll('.et-sp-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.section;
        const el  = document.getElementById(sid);
        if (el) { el.style.background = ''; el.style.backgroundImage = ''; }
        if (window.__SARDINIA_CONFIG__?.theme?.section_bgs)       window.__SARDINIA_CONFIG__.theme.section_bgs[sid]       = null;
        if (window.__SARDINIA_CONFIG__?.theme?.section_bg_images) window.__SARDINIA_CONFIG__.theme.section_bg_images[sid] = null;
        setPatchValue('config', `theme.section_bgs.${sid}`,       null);
        setPatchValue('config', `theme.section_bg_images.${sid}`, null);
        setDirty(true);
        const inp = document.getElementById(`sp-bg-${sid}`);
        if (inp) inp.value = '#ffffff';
        const imgBtn = panel.querySelector(`.et-bg-img-btn[data-section="${sid}"]`);
        if (imgBtn) { imgBtn.textContent = '🖼'; imgBtn.classList.remove('has-image'); }
      });
    });
  }

  // ── Hero-Hintergrund umschalten ──
  function setHeroMedia(mode, url) {
    const video  = document.querySelector('#hero video');
    const heroBg = document.querySelector('#hero .hero-bg');

    // Config lokal merken
    if (!window.__SARDINIA_CONFIG__) window.__SARDINIA_CONFIG__ = {};
    if (!window.__SARDINIA_CONFIG__.theme) window.__SARDINIA_CONFIG__.theme = {};
    if (!window.__SARDINIA_CONFIG__.theme.hero_media) window.__SARDINIA_CONFIG__.theme.hero_media = {};
    window.__SARDINIA_CONFIG__.theme.hero_media.mode = mode;

    if (mode === 'image') {
      if (video) video.style.display = 'none';
      if (url) {
        window.__SARDINIA_CONFIG__.theme.hero_media.image_url = url;
        if (heroBg) {
          heroBg.style.backgroundImage    = `url(${url})`;
          heroBg.style.backgroundSize     = 'cover';
          heroBg.style.backgroundPosition = 'center';
        }
      }
    } else {
      // Video-Modus
      if (video) video.style.display = '';
      if (heroBg) heroBg.style.backgroundImage = '';
      if (url) {
        window.__SARDINIA_CONFIG__.theme.hero_media.video_url = url;
        const source = video?.querySelector('source');
        if (source) source.src = url;
        try { video?.load(); video?.play(); } catch(_) {}
      }
    }
  }

  // ── Sektion Hintergrundbild setzen ──
  function applySectionBgImage(sectionId, url) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.style.backgroundImage    = `url(${url})`;
    el.style.backgroundSize     = 'cover';
    el.style.backgroundPosition = 'center';
    // Config lokal merken
    if (!window.__SARDINIA_CONFIG__) window.__SARDINIA_CONFIG__ = {};
    if (!window.__SARDINIA_CONFIG__.theme) window.__SARDINIA_CONFIG__.theme = {};
    if (!window.__SARDINIA_CONFIG__.theme.section_bg_images) window.__SARDINIA_CONFIG__.theme.section_bg_images = {};
    window.__SARDINIA_CONFIG__.theme.section_bg_images[sectionId] = url;
    setPatchValue('config', `theme.section_bg_images.${sectionId}`, url);
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
    // Gespeicherten Wert aus config bevorzugen (zuverlässigste Quelle)
    const saved = window.__SARDINIA_CONFIG__?.theme?.section_bgs?.[sectionId];
    if (saved) return saved;
    // Fallback: inline background-Shorthand lesen
    const el = document.getElementById(sectionId);
    if (!el) return '#ffffff';
    const inline = el.style.background || el.style.backgroundColor;
    if (inline) return rgbToHex(inline) || inline;
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

  // ════════════════ DRAG & DROP ════════════════
  function showDropOk(el) {
    // Verhindert mehrfache Overlays
    el.querySelectorAll('.et-drop-ok').forEach(x => x.remove());
    const msg = document.createElement('div');
    msg.className = 'et-drop-ok';
    msg.textContent = '✓ Übernommen!';
    const parent = el.style.position ? el : el;
    const savedPos = parent.style.position;
    if (!savedPos || savedPos === 'static') parent.style.position = 'relative';
    parent.appendChild(msg);
    setTimeout(() => { msg.remove(); if (!savedPos || savedPos === 'static') parent.style.position = savedPos; }, 1900);
  }

  function setupDragDrop() {
    // ── Drag auf IMG-Elemente ──
    document.querySelectorAll('img.et-media').forEach(img => {
      img.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); img.classList.add('et-drag-over'); });
      img.addEventListener('dragleave', () => img.classList.remove('et-drag-over'));
      img.addEventListener('drop', async e => {
        e.preventDefault(); e.stopPropagation();
        img.classList.remove('et-drag-over');
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const url = await uploadFile(file);
        if (!url) return;
        applyMedia(img, url);
        const path = img.dataset.bind;
        if (path) { setPatchValue('pages', path, url); setDirty(true); }
        showDropOk(img);
      });
    });

    // ── Drag auf Sections (Hintergrundbild) ──
    document.querySelectorAll('section').forEach(section => {
      section.addEventListener('dragover', e => {
        // Nur reagieren wenn direkt auf der Section (nicht auf Kind-Elemente mit eigener Drag-Logik)
        e.preventDefault();
        section.classList.add('et-drag-over');
      });
      section.addEventListener('dragleave', e => {
        if (!section.contains(e.relatedTarget)) section.classList.remove('et-drag-over');
      });
      section.addEventListener('drop', async e => {
        e.preventDefault();
        section.classList.remove('et-drag-over');
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) return;

        const url = await uploadFile(file);
        if (!url) return;

        if (section.id === 'hero') {
          if (isImage) {
            setHeroMedia('image', url);
            setPatchValue('config', 'theme.hero_media.mode',      'image');
            setPatchValue('config', 'theme.hero_media.image_url', url);
            // Panel updaten wenn offen
            const mvBtn = document.getElementById('hero-mode-video');
            const miBtn = document.getElementById('hero-mode-image');
            if (mvBtn) mvBtn.classList.remove('active');
            if (miBtn) miBtn.classList.add('active');
          } else {
            setHeroMedia('video', url);
            setPatchValue('config', 'theme.hero_media.mode',      'video');
            setPatchValue('config', 'theme.hero_media.video_url', url);
            const mvBtn = document.getElementById('hero-mode-video');
            const miBtn = document.getElementById('hero-mode-image');
            if (mvBtn) mvBtn.classList.add('active');
            if (miBtn) miBtn.classList.remove('active');
          }
        } else if (isImage) {
          applySectionBgImage(section.id, url);
          // Panel-Button updaten wenn offen
          const imgBtn = document.querySelector(`#et-settings-panel .et-bg-img-btn[data-section="${section.id}"]`);
          if (imgBtn) { imgBtn.textContent = '🖼 ✓'; imgBtn.classList.add('has-image'); }
        }
        setDirty(true);
        showDropOk(section);
      });
    });
  }

  // ════════════════ CLICK-TO-SELECT SECTIONS ════════════════
  function setupSectionClick() {
    document.querySelectorAll('section').forEach(section => {
      section.classList.add('et-section-editable');

      section.addEventListener('click', e => {
        // Nur auf den Hintergrund reagieren — nicht auf Text, Bilder, Buttons etc.
        const tag = e.target.tagName;
        const isBackground = (
          e.target === section ||
          e.target.classList.contains('hero-bg') ||
          e.target.classList.contains('hero-overlay')
        );
        if (!isBackground) return;

        e.preventDefault(); e.stopPropagation();

        // Selektion setzen
        document.querySelectorAll('section.et-section-selected').forEach(s => s.classList.remove('et-section-selected'));
        section.classList.add('et-section-selected');

        // Panel öffnen falls geschlossen
        if (!document.getElementById('et-settings-panel')) toggleSettings();

        // Zum passenden Row scrollen
        const targetId = section.id === 'hero' ? 'hero-mode-video' : `sp-bg-${section.id}`;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Kurz aufleuchten
          const row = targetEl.closest('.et-sp-row') || targetEl.closest('.et-sp-section');
          if (row) {
            row.style.transition = 'background .15s';
            row.style.background = 'rgba(200,151,90,.18)';
            setTimeout(() => { row.style.background = ''; }, 1000);
          }
        }
      });
    });
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
    setupSectionClick();
    setupDragDrop();
    // Design-Panel automatisch öffnen
    toggleSettings();
    document.addEventListener('sardinia:data-loaded', () => {
      unmarkEditableFields();
      markEditableFields();
      // Drag & Drop nach Reload neu aufsetzen
      setupDragDrop();
      setupSectionClick();
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
