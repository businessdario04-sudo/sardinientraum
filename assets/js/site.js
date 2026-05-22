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
  }

  // ─── Anfrageformular ───
  function bindForm() {
    const form = document.getElementById('anfrage-form');
    if (!form) return;
    let trap = form.querySelector('[name="website_url"]');
    if (!trap) {
      trap = document.createElement('input');
      trap.type = 'text'; trap.name = 'website_url'; trap.tabIndex = -1; trap.autocomplete = 'off';
      trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
      form.appendChild(trap);
    }
    form.dataset.openedAt = String(Date.now());

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn  = form.querySelector('.form-submit');
      const orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Wird gesendet…'; }
      try {
        const data = new FormData(form);
        data.append('elapsed_ms', String(Date.now() - Number(form.dataset.openedAt || 0)));
        const r = await fetch('/api/submit-contact.php', { method: 'POST', body: data, credentials: 'same-origin' });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          form.style.display = 'none';
          const success = document.getElementById('form-success');
          if (success) success.style.display = 'block';
        } else {
          alert(j.msg || j.error || 'Fehler beim Senden. Bitte erneut versuchen.');
          if (btn) { btn.disabled = false; btn.textContent = orig; }
        }
      } catch (_) {
        alert('Verbindungsfehler. Bitte Internet prüfen.');
        if (btn) { btn.disabled = false; btn.textContent = orig; }
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
    const setSrc  = (sel, val) => { const el = overlay.querySelector(sel); if (el) el.src = val ?? ''; };
    setText('.apt-modal-title', apt.name);
    setText('.apt-modal-description', apt.description);
    setText('.apt-modal-details', apt.details || '');
    setText('.apt-modal-price', apt.price || '');
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
    if (galleryEl) {
      galleryEl.innerHTML = '';
      const imgs = (apt.gallery && apt.gallery.length) ? apt.gallery : [apt.image].filter(Boolean);
      imgs.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = src; img.alt = apt.name + ' Bild ' + (i+1); img.loading = 'lazy';
        if (i === 0) img.classList.add('active');
        galleryEl.appendChild(img);
      });
      // Pre/Next-Buttons
      const prev = overlay.querySelector('[data-gallery-prev]');
      const next = overlay.querySelector('[data-gallery-next]');
      let idx = 0;
      const show = i => {
        const imgs = galleryEl.querySelectorAll('img');
        if (!imgs.length) return;
        idx = (i + imgs.length) % imgs.length;
        imgs.forEach((m, j) => m.classList.toggle('active', j === idx));
      };
      if (prev) prev.onclick = () => show(idx - 1);
      if (next) next.onclick = () => show(idx + 1);
    }
    // Anfrage-Link mit vorausgewählter Wohnung
    const cta = overlay.querySelector('[data-modal-cta]');
    if (cta) cta.href = '#anfrage';
  }

  // ─── Editor laden wenn ?edit=1 ───
  async function maybeLoadEditor() {
    if (!new URLSearchParams(location.search).has('edit')) return;
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

  // ─── Boot ───
  async function boot() {
    bindNav();
    bindForm();
    bindDates();
    bindAptModal();
    const [pages, config] = await Promise.all([apiGet('pages'), apiGet('config')]);
    window.__SARDINIA_PAGES__  = pages;
    window.__SARDINIA_CONFIG__ = config;
    applyConfig(config);
    applyData(pages);
    document.dispatchEvent(new CustomEvent('sardinia:data-loaded', { detail: { pages, config } }));
    await maybeLoadEditor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
