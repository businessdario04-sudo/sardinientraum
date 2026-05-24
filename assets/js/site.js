/**
 * site.js — Sardinientraum Frontend
 *
 * Aufgaben:
 *  - Daten aus pages.json + config.json laden (via /api/load-content.php)
 *  - data-bind-Attribute im HTML füllen (Texte, Bilder, Links)
 *  - Listen via <template> + [data-bind-list] rendern
 *  - CSS-Variablen aus config.theme setzen
 *  - Nav-Scroll, Mobile-Menü, Datums-Validierung
 *  - Anfrageformular zu /api/submit-contact.php
 *  - Optional Editor laden wenn ?edit=1 und Admin eingeloggt
 */
(function () {
  'use strict';

  const API_BASE = '/api';

  async function apiGet(target) {
    try {
      const r = await fetch(`${API_BASE}/load-content.php?target=${encodeURIComponent(target)}`, {
        credentials: 'same-origin'
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j.ok ? j.data : null;
    } catch (_) { return null; }
  }

  // ─── Daten anwenden via data-bind ───
  function resolve(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function applyValue(el, val) {
    if (val == null) return;
    const attr = el.dataset.bindAttr;
    if (attr) { el.setAttribute(attr, String(val)); return; }
    if (el.tagName === 'IMG')   { el.src = String(val); return; }
    if (el.tagName === 'VIDEO') {
      const s = el.querySelector('source');
      if (s) s.src = String(val); else el.src = String(val);
      try { el.load(); } catch (_) {}
      return;
    }
    if (el.tagName === 'A' && el.dataset.bindHref === '1') { el.href = String(val); return; }
    if (el.tagName === 'META') { el.content = String(val); return; }
    if (el.dataset.bindHtml === '1') { el.innerHTML = String(val); return; }
    if (typeof val === 'string' && val.includes('\n')) {
      el.innerHTML = val.split('\n').map(escapeHtml).join('<br>');
    } else {
      el.textContent = String(val);
    }
  }

  function applyData(pages) {
    if (!pages) return;
    document.querySelectorAll('[data-bind]').forEach(el => applyValue(el, resolve(pages, el.dataset.bind)));
    document.querySelectorAll('[data-bind-list]').forEach(container => {
      const path  = container.dataset.bindList;
      const tplId = container.dataset.bindTemplate;
      const items = resolve(pages, path);
      if (!Array.isArray(items)) return;
      const tpl = document.getElementById(tplId);
      if (!tpl || !tpl.content) return;
      container.innerHTML = '';
      items.forEach((item, idx) => {
        const node = tpl.content.cloneNode(true);
        node.querySelectorAll('[data-bind-item]').forEach(b => applyValue(b, resolve(item, b.dataset.bindItem)));
        const rootEl = node.firstElementChild;
        if (rootEl) rootEl.dataset.bindIndex = String(idx);
        container.appendChild(node);
      });
    });
  }

  function applyConfig(config) {
    if (!config) return;
    const root = document.documentElement;
    const theme = config.theme || {};
    const c = theme.colors || {};
    const map = {
      '--ocean':       c.primary,
      '--ocean-light': c.primary_light,
      '--gold':        c.accent,
      '--sand':        c.sand,
      '--sand-dark':   c.sand_dark,
      '--white':       c.white,
      '--text':        c.text,
      '--text-light':  c.text_light,
      '--radius':      theme.radius
    };
    Object.entries(map).forEach(([k, v]) => { if (v) root.style.setProperty(k, v); });

    if (config.seo) {
      if (config.seo.title) document.title = config.seo.title;
      if (config.seo.description) {
        let md = document.querySelector('meta[name="description"]');
        if (!md) { md = document.createElement('meta'); md.name = 'description'; document.head.appendChild(md); }
        md.content = config.seo.description;
      }
    }

    if (theme.name) {
      [...document.body.classList].filter(c => c.startsWith('theme-')).forEach(c => document.body.classList.remove(c));
      document.body.classList.add('theme-' + theme.name);
    }

    // Abschnitt-Hintergründe anwenden (Farbe)
    const sectionBgs = theme.section_bgs || {};
    Object.entries(sectionBgs).forEach(([id, color]) => {
      if (!color) return;
      const el = document.getElementById(id);
      if (el) el.style.background = color;
    });

    // Abschnitt-Hintergründe anwenden (Bild — überschreibt Farbe)
    const sectionBgImages = theme.section_bg_images || {};
    Object.entries(sectionBgImages).forEach(([id, url]) => {
      if (!url) return;
      const el = document.getElementById(id);
      if (el) {
        el.style.backgroundImage    = `url(${url})`;
        el.style.backgroundSize     = 'cover';
        el.style.backgroundPosition = 'center';
      }
    });

    // Hero-Hintergrund: Video oder Bild
    const heroMedia = theme.hero_media || {};
    if (heroMedia.mode === 'image' && heroMedia.image_url) {
      const heroBg = document.querySelector('#hero .hero-bg');
      const video  = document.querySelector('#hero video');
      if (video)  video.style.display = 'none';
      if (heroBg) {
        heroBg.style.backgroundImage    = `url(${heroMedia.image_url})`;
        heroBg.style.backgroundSize     = 'cover';
        heroBg.style.backgroundPosition = 'center';
      }
    } else if (heroMedia.video_url) {
      const video = document.querySelector('#hero video');
      if (video) {
        const source = video.querySelector('source');
        if (source) source.src = heroMedia.video_url;
        try { video.load(); } catch(_) {}
      }
    }
  }

  // ─── Anfrageformular + Verfügbarkeitskalender ───

  // ── Kalender-State ──
  const CAL = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    bookings: [],
    selStart: null,
    selEnd:   null,
  };
  const CAL_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const CAL_DAYS   = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  function calFmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function calFmtDisplay(ds) {
    if (!ds) return '—';
    const [y,m,d] = ds.split('-');
    return `${d}.${m}.${y}`;
  }
  function calIsBooked(ds) {
    return CAL.bookings.some(b => ds >= b.from && ds < b.to);
  }

  function calRenderMonth(year, month) {
    const today    = calFmtDate(new Date());
    const firstDay = new Date(year, month, 1).getDay();
    const numDays  = new Date(year, month + 1, 0).getDate();
    const offset   = (firstDay + 6) % 7; // Monday = 0

    let html = `<div><div class="cal-month-name">${CAL_MONTHS[month]} ${year}</div><div class="cal-grid">`;
    CAL_DAYS.forEach(d => { html += `<div class="cal-dh">${d}</div>`; });
    for (let i = 0; i < offset; i++) html += '<div class="cal-empty"></div>';

    for (let d = 1; d <= numDays; d++) {
      const ds      = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      const isPast  = ds < today;
      const isBook  = calIsBooked(ds);
      const isToday = ds === today;
      const disabled = isPast || isBook;

      let cls = 'cal-d';
      if (isPast)  cls += ' past';
      else if (isBook) cls += ' booked';
      else         cls += ' avail';
      if (isToday) cls += ' today';

      if (CAL.selStart && CAL.selEnd) {
        if (ds === CAL.selStart) cls += ' sel-s';
        else if (ds === CAL.selEnd) cls += ' sel-e';
        else if (ds > CAL.selStart && ds < CAL.selEnd) cls += ' in-range';
      } else if (CAL.selStart && ds === CAL.selStart) {
        cls += ' sel-s sel-e';
      }

      const dayInner = isBook
        ? `<span class="cal-day-num">${d}</span><span class="cal-belegt">Belegt</span>`
        : `${d}`;
      html += `<button type="button" class="${cls}" data-date="${ds}"${disabled ? ' disabled' : ''}${isBook ? ' title="Nicht verfügbar"' : ''}>${dayInner}</button>`;
    }
    html += '</div></div>';
    return html;
  }

  function calRender() {
    const container = document.getElementById('cal-months-container');
    const navLabel  = document.getElementById('cal-nav-label');
    if (!container) return;

    let y2 = CAL.year, m2 = CAL.month + 1;
    if (m2 > 11) { m2 = 0; y2++; }

    container.innerHTML = calRenderMonth(CAL.year, CAL.month) + calRenderMonth(y2, m2);
    if (navLabel) navLabel.textContent = `${CAL_MONTHS[CAL.month]} / ${CAL_MONTHS[m2]} ${y2}`;

    container.querySelectorAll('.cal-d.avail').forEach(btn => {
      btn.addEventListener('click', calDayClick);
    });
  }

  function calDayClick(e) {
    const ds = e.currentTarget.dataset.date;
    if (!ds) return;

    if (!CAL.selStart || (CAL.selStart && CAL.selEnd)) {
      CAL.selStart = ds; CAL.selEnd = null;
    } else {
      if (ds <= CAL.selStart) {
        CAL.selStart = ds; CAL.selEnd = null;
      } else {
        // Prüfen ob im Range eine Buchung liegt
        const blocked = CAL.bookings.some(b => b.from < ds && b.to > CAL.selStart);
        if (blocked) { CAL.selStart = ds; CAL.selEnd = null; }
        else          { CAL.selEnd   = ds; }
      }
    }
    calUpdateSummary();
    calRender();
  }

  function calUpdateSummary() {
    const sumEl  = document.getElementById('cal-summary');
    const subBtn = document.getElementById('form-submit-btn');
    const anrH   = document.getElementById('anreise-hidden');
    const abrH   = document.getElementById('abreise-hidden');

    if (CAL.selStart && CAL.selEnd) {
      const el = id => document.getElementById(id);
      if (el('cal-sum-from'))   el('cal-sum-from').textContent   = calFmtDisplay(CAL.selStart);
      if (el('cal-sum-to'))     el('cal-sum-to').textContent     = calFmtDisplay(CAL.selEnd);
      const nights = Math.round((new Date(CAL.selEnd) - new Date(CAL.selStart)) / 86400000);
      if (el('cal-sum-nights')) el('cal-sum-nights').textContent = nights + (nights === 1 ? ' Nacht' : ' Nächte');
      if (anrH) anrH.value = CAL.selStart;
      if (abrH) abrH.value = CAL.selEnd;
      if (sumEl)  sumEl.style.display  = 'flex';
      if (subBtn) subBtn.disabled      = false;
    } else {
      if (sumEl)  sumEl.style.display  = 'none';
      if (subBtn) subBtn.disabled      = true;
      if (anrH)   anrH.value          = '';
      if (abrH)   abrH.value          = '';
    }
  }

  async function calLoad(property) {
    CAL.selStart = null; CAL.selEnd = null; CAL.bookings = [];
    calUpdateSummary();
    const mc = document.getElementById('cal-months-container');
    if (mc) mc.innerHTML = '<div class="cal-loading">Verfügbarkeit wird geladen…</div>';

    if (property && property !== 'alle') {
      try {
        const r = await fetch(`/api/availability.php?property=${encodeURIComponent(property)}`, { credentials: 'same-origin' });
        const j = await r.json();
        CAL.bookings = j.ok ? (j.bookings || []) : [];
      } catch (_) { CAL.bookings = []; }
    }
    calRender();
  }

  function bindForm() {
    const form  = document.getElementById('anfrage-form');
    if (!form) return;

    // Honeypot
    let trap = form.querySelector('[name="website_url"]');
    if (!trap) {
      trap = document.createElement('input');
      trap.type = 'text'; trap.name = 'website_url'; trap.tabIndex = -1; trap.autocomplete = 'off';
      trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
      form.appendChild(trap);
    }
    form.dataset.openedAt = String(Date.now());

    // ── Multi-Step-Logik ──────────────────────────────────────
    const step1 = document.getElementById('form-step1');
    const step2 = document.getElementById('form-step2');
    const dot1  = document.getElementById('step-dot-1');
    const dot2  = document.getElementById('step-dot-2');
    const conn  = document.getElementById('step-connector');

    document.getElementById('step1-next-btn')?.addEventListener('click', async () => {
      // Step 1 validieren
      let valid = true;
      step1?.querySelectorAll('[required]').forEach(f => {
        const ok = f.value.trim() !== '';
        f.style.borderColor = ok ? '' : 'var(--red, #ef4444)';
        if (!ok) valid = false;
      });
      if (!valid) return;

      // Schritt-Indikator
      dot1?.classList.replace('step-active', 'step-done');
      dot1?.querySelector('.step-num') && (dot1.querySelector('.step-num').textContent = '✓');
      dot2?.classList.add('step-active');
      conn?.classList.add('step-active');

      // Property-Label aktualisieren
      const sel = document.getElementById('wohnung');
      const map = { 'casa-tramonto': 'Casa Tramonto', 'casa-mare': 'Casa Mare', 'alle': 'alle Wohnungen', '': 'alle Wohnungen' };
      const disp = document.getElementById('cal-property-display');
      if (disp) disp.textContent = map[sel?.value ?? ''] ?? 'alle Wohnungen';

      // Kalender zeigen + laden
      step1.style.display = 'none';
      step2.style.display = 'block';
      CAL.year  = new Date().getFullYear();
      CAL.month = new Date().getMonth();
      await calLoad(sel?.value ?? '');
      step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('step2-back-btn')?.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      dot1?.classList.replace('step-done', 'step-active');
      const sn = dot1?.querySelector('.step-num');
      if (sn) sn.textContent = '1';
      dot2?.classList.remove('step-active');
      conn?.classList.remove('step-active');
    });

    // Kalender-Navigation
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      CAL.month--;
      if (CAL.month < 0) { CAL.month = 11; CAL.year--; }
      calRender();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      CAL.month++;
      if (CAL.month > 11) { CAL.month = 0; CAL.year++; }
      calRender();
    });

    // ── Form-Submit ───────────────────────────────────────────
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submitBtn = document.getElementById('form-submit-btn');
      const orig = submitBtn?.textContent || 'Anfrage absenden →';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Wird gesendet…'; }
      try {
        const data = new FormData(form);
        // _ts als Unix-Sekunden senden (submit-contact.php erwartet Sekunden, nicht ms)
        data.append('_ts', Math.floor(Number(form.dataset.openedAt || 0) / 1000).toString());
        const r = await fetch('/api/submit-contact.php', { method: 'POST', body: data, credentials: 'same-origin' });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          form.style.display = 'none';
          const success = document.getElementById('form-success');
          if (success) success.style.display = 'block';
        } else {
          alert(j.msg || j.error || 'Fehler beim Senden. Bitte erneut versuchen.');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = orig; }
        }
      } catch (_) {
        alert('Verbindungsfehler. Bitte Internet prüfen.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = orig; }
      }
    });
  }

  // ─── Nav + Mobile-Menü + Datum ───
  function bindNav() {
    const nav = document.getElementById('mainNav');
    if (nav) {
      const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    const btn  = document.getElementById('menuBtn');
    const list = document.getElementById('navLinks');
    if (btn && list) {
      btn.addEventListener('click', () => list.classList.toggle('open'));
      list.querySelectorAll('a').forEach(a => a.addEventListener('click', () => list.classList.remove('open')));
    }
  }

  function bindDates() {
    const a = document.getElementById('anreise');
    const b = document.getElementById('abreise');
    if (a && b) a.addEventListener('change', e => { b.min = e.target.value; });
  }

  // ─── Apartment-Modal (für "Mehr Infos") ───
  function bindAptModal() {
    const overlay = document.getElementById('apt-modal-overlay');
    if (!overlay) return;
    const closeBtns = overlay.querySelectorAll('[data-modal-close]');
    closeBtns.forEach(b => b.addEventListener('click', () => overlay.classList.remove('open')));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.classList.remove('open'); });

    // Delegated click auf Apartments-Mehr-Infos-Buttons
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-apt-info]');
      if (!btn) return;
      const aptId = btn.dataset.aptInfo;
      // pages-Daten aus dem letzten Load holen
      const pages = window.__SARDINIA_PAGES__;
      if (!pages || !Array.isArray(pages.wohnungen?.items)) return;
      const apt = pages.wohnungen.items.find(a => a.id === aptId);
      if (!apt) return;
      renderModal(overlay, apt);
      overlay.classList.add('open');
    });
  }

  function renderModal(overlay, apt) {
    const setText = (sel, val) => { const el = overlay.querySelector(sel); if (el) el.textContent = val ?? ''; };
    setText('.apt-modal-title',       apt.name);
    setText('.apt-modal-description', apt.description);
    setText('.apt-modal-details',     apt.details || '');
    setText('.apt-modal-price',       apt.price || '');
    setText('.apt-modal-badge',       apt.badge || 'Unterkunft');

    const metaEl = overlay.querySelector('.apt-modal-meta');
    if (metaEl) {
      metaEl.innerHTML = '';
      (apt.meta || []).forEach(m => {
        const span = document.createElement('span');
        span.textContent = (m.icon || '') + ' ' + (m.text || '');
        metaEl.appendChild(span);
      });
    }

    const galleryEl = overlay.querySelector('.apt-modal-gallery');
    const dotsEl    = overlay.querySelector('[data-gallery-dots]');
    const counterEl = overlay.querySelector('[data-gallery-counter]');
    const prev      = overlay.querySelector('[data-gallery-prev]');
    const next      = overlay.querySelector('[data-gallery-next]');

    // Bestehende img-Elemente entfernen (Nav/Dots/Counter bleiben)
    if (galleryEl) galleryEl.querySelectorAll('img').forEach(img => img.remove());
    if (dotsEl) dotsEl.innerHTML = '';

    const imgs = (apt.gallery && apt.gallery.length) ? apt.gallery : [apt.image].filter(Boolean);
    if (!imgs.length || !galleryEl) {
      if (prev) prev.style.display = 'none';
      if (next) next.style.display = 'none';
      if (counterEl) counterEl.style.display = 'none';
      return;
    }

    imgs.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = apt.name + ' Bild ' + (i + 1);
      img.loading = 'lazy';
      if (i === 0) img.classList.add('active');
      galleryEl.insertBefore(img, galleryEl.firstChild);
    });

    // Dots erstellen
    if (dotsEl && imgs.length > 1) {
      imgs.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'apt-modal-dot';
        dot.setAttribute('aria-label', 'Bild ' + (i + 1));
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => show(i));
        dotsEl.appendChild(dot);
      });
    }

    let idx = 0;
    const single = imgs.length === 1;
    if (prev) prev.style.display = single ? 'none' : '';
    if (next) next.style.display = single ? 'none' : '';
    if (counterEl) counterEl.style.display = single ? 'none' : '';

    function show(i) {
      const all = galleryEl.querySelectorAll('img');
      if (!all.length) return;
      idx = (i + all.length) % all.length;
      all.forEach((m, j) => m.classList.toggle('active', j === idx));
      if (dotsEl) dotsEl.querySelectorAll('.apt-modal-dot').forEach((d, j) => d.classList.toggle('active', j === idx));
      if (counterEl) counterEl.textContent = (idx + 1) + ' / ' + all.length;
    }
    show(0);

    if (prev) prev.onclick = () => show(idx - 1);
    if (next) next.onclick = () => show(idx + 1);
    // Tastatur-Navigation
    overlay._galleryHandler = e => {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'ArrowLeft')  show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    };
    document.removeEventListener('keydown', overlay._galleryHandler);
    document.addEventListener('keydown', overlay._galleryHandler);

    // CTA
    const cta = overlay.querySelector('[data-modal-cta]');
    if (cta) {
      cta.href = '#anfrage';
      cta.addEventListener('click', () => {
        overlay.classList.remove('open');
        // Vorauswahl im Formular
        setTimeout(() => {
          const sel = document.getElementById('wohnung');
          if (sel) {
            const opt = [...sel.options].find(o => o.text.includes(apt.name));
            if (opt) sel.value = opt.value || opt.text;
          }
        }, 300);
      }, { once: true });
    }
  }

  // ─── FAQ-Accordion ───
  async function loadFAQ() {
    const list = document.getElementById('faqList');
    if (!list) return;
    const data = await apiGet('faq');
    const items = (data && Array.isArray(data.items)) ? data.items.filter(i => i.active) : [];
    items.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!items.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-light);">Noch keine FAQ-Einträge.</p>';
      return;
    }
    list.innerHTML = '';
    items.forEach((it, idx) => {
      const item = document.createElement('details');
      item.className = 'faq-item';
      if (idx === 0) item.open = true;
      const q = document.createElement('summary');
      q.className = 'faq-question';
      q.textContent = it.question || '';
      const a = document.createElement('div');
      a.className = 'faq-answer';
      a.textContent = it.answer || '';
      item.append(q, a);
      list.appendChild(item);
    });
  }

  // ─── Cookie-Banner ───
  function bindCookieBanner(config) {
    const banner = document.getElementById('cookieBanner');
    const btn    = document.getElementById('cookieDismiss');
    if (!banner || !btn) return;
    const enabled = config?.legal?.cookie_hint_enabled !== false;
    if (!enabled) { banner.hidden = true; return; }
    if (localStorage.getItem('cookie_dismissed') === '1') { banner.hidden = true; return; }
    banner.hidden = false;
    btn.addEventListener('click', () => {
      localStorage.setItem('cookie_dismissed', '1');
      banner.hidden = true;
    });
  }

  // ─── Editor laden wenn ?edit=1 ───
  async function maybeLoadEditor() {
    const params = new URLSearchParams(location.search);
    if (!params.has('edit')) return;
    try {
      const r = await fetch('/api/auth-status.php', { credentials: 'same-origin' });
      const j = await r.json();
      if (!j.ok || !j.logged_in) {
        location.replace('/admin.html?next=' + encodeURIComponent(location.pathname + '?edit=1'));
        return;
      }
      window.__SARDINIA_CSRF__ = j.csrf || '';
    } catch (_) {
      console.warn('[site] auth-status failed');
      return;
    }
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/assets/css/editor.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = '/assets/js/editor.js'; js.defer = true;
    document.body.appendChild(js);
  }

  // ─── Draft-Vorschau wenn ?preview_draft=1 ───
  async function maybeShowDraftPreview() {
    if (!new URLSearchParams(location.search).has('preview_draft')) return;
    let csrf = '';
    try {
      const r = await fetch('/api/auth-status.php', { credentials: 'same-origin' });
      const j = await r.json();
      if (!j.ok || !j.logged_in) return;
      csrf = j.csrf || '';
    } catch (_) { return; }

    // Draft-Inhalt laden und anwenden
    try {
      const r = await fetch('/api/load-content.php?target=pages&draft=1', { credentials: 'same-origin' });
      const j = await r.json();
      if (j.ok && j.data) {
        applyData(j.data);
        window.__SARDINIA_PAGES__ = j.data;
      }
    } catch (_) {}

    // Draft-Leiste einblenden
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/assets/css/editor.css';
    document.head.appendChild(css);

    const bar = document.createElement('div');
    bar.id = 'et-draft-bar';
    bar.innerHTML = `
      <div class="et-draft-bar-info">
        <span style="font-size:1.4rem;">👁</span>
        <div>
          <div class="et-draft-bar-label">DRAFT-Vorschau — nicht Live</div>
          <div class="et-draft-bar-sub">Besucher sehen diese Version noch nicht.</div>
        </div>
      </div>
      <div class="et-draft-bar-actions">
        <button class="et-draft-publish-btn" id="et-draft-publish-btn">🚀 Jetzt veröffentlichen</button>
        <button class="et-draft-close-btn"   id="et-draft-close-btn">✕ Schließen</button>
      </div>
    `;
    document.body.prepend(bar);
    document.body.classList.add('et-draft-preview');

    document.getElementById('et-draft-publish-btn').addEventListener('click', async () => {
      const btn = document.getElementById('et-draft-publish-btn');
      btn.disabled = true; btn.textContent = '⏳ Veröffentliche…';
      try {
        const r = await fetch('/api/draft-promote.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'same-origin',
          body: JSON.stringify({})
        });
        const j = await r.json();
        if (j.ok) {
          btn.textContent = '✅ Veröffentlicht!';
          btn.style.background = '#22c55e';
          setTimeout(() => location.replace('/'), 1500);
        } else {
          alert('Fehler: ' + (j.error || 'unbekannt'));
          btn.disabled = false; btn.textContent = '🚀 Jetzt veröffentlichen';
        }
      } catch (e) {
        alert('Verbindungsfehler: ' + e.message);
        btn.disabled = false; btn.textContent = '🚀 Jetzt veröffentlichen';
      }
    });

    document.getElementById('et-draft-close-btn').addEventListener('click', () => {
      location.replace('/');
    });
  }

  // ─── Boot ───
  async function boot() {
    bindNav();
    bindForm();
    bindAptModal();
    const [pages, config] = await Promise.all([apiGet('pages'), apiGet('config')]);
    window.__SARDINIA_PAGES__  = pages;
    window.__SARDINIA_CONFIG__ = config;
    applyConfig(config);
    applyData(pages);
    bindCookieBanner(config);
    loadFAQ();   // parallel laden, blockt boot nicht
    document.dispatchEvent(new CustomEvent('sardinia:data-loaded', { detail: { pages, config } }));
    await maybeLoadEditor();
    await maybeShowDraftPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
