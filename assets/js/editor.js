(function () {
  'use strict';

  const TEXT_SEL = "h1,h2,h3,h4,.hero-tag,.section-label,.apt-badge,.region-card-label,.reviewer-name,.reviewer-date,.review-text,.apt-body>p,.ueber-text .section-sub,.footer-brand>p,.nav-logo,.apt-price strong,.footer-brand h2";
  const BTN_SEL  = '.btn-primary,.btn-outline,.btn-sm,.nav-cta,.form-submit,.scroll-hint';
  const CARD_SEL = '.apt-card,.review-card,.region-card,.feature';
  const SEC_SEL  = 'section,footer';

  let mode = false, selEl = null, selType = null, dragSrc = null;

  const $ = id => document.getElementById(id);
  const toggleBtn   = $('edit-toggle');
  const saveBtn     = $('et-save-btn');
  const saveLiveBtn = $('et-save-live-btn');
  const exitBtn     = $('et-exit-btn');
  const settingsBtn = $('et-settings-btn');
  const settingsPanel = $('et-settings-panel');
  const spClose     = $('et-sp-close');
  const hint        = $('et-hint');
  const textTools   = $('et-text-tools');
  const btnTools    = $('et-btn-tools');
  const mediaTools  = $('et-media-tools');
  const cardTools   = $('et-card-tools');
  const secTools    = $('et-sec-tools');
  const heroBg      = document.querySelector('.hero-bg');

  /* Text controls */
  const selFont = $('et-sel-font'), selSize = $('et-sel-size'), selLH = $('et-sel-lh');
  const boldBtn = $('et-bold'), italBtn = $('et-italic'), undlBtn = $('et-underline');
  const alignBtns = document.querySelectorAll('[data-align]');
  const txtColor = $('et-text-color'), txtBg = $('et-text-bg');
  /* Button controls */
  const btnBg = $('et-btn-bg'), btnFg = $('et-btn-fg'), btnBorder = $('et-btn-border');
  const btnRadius = $('et-btn-radius-sel'), btnSize = $('et-btn-size-sel'), btnLink = $('et-btn-link');
  /* Card */
  const moveUpBtn = $('et-move-up'), moveDnBtn = $('et-move-dn'), cardBgInp = $('et-card-bg');
  /* Section */
  const secBgInp = $('et-sec-bg'), secPad = $('et-sec-pad');
  /* File */
  const imgInput = $('et-img-input'), vidInput = $('et-vid-input'), bgInput = $('et-bg-input');

  /* ═══ ENTER / EXIT ═══ */
  function enter() {
    mode = true;
    document.body.classList.add('edit-active');
    document.querySelectorAll(TEXT_SEL).forEach(el => {
      if (el.closest('#et-topbar,#et-propsbar,#et-settings-panel')) return;
      el.classList.add('et-hoverable','et-text-el');
    });
    document.querySelectorAll(BTN_SEL).forEach(el => {
      if (el.closest('#et-topbar,#et-propsbar,#et-settings-panel')) return;
      el.classList.add('et-hoverable','et-btn-el');
    });
    document.querySelectorAll('img').forEach(img => {
      if (img.closest('#et-topbar,#et-propsbar,#edit-toggle,#et-settings-panel')) return;
      const wrap = img.closest('.apt-img,.ueber-image,.region-card') || img.parentElement;
      if (!wrap.classList.contains('et-media-el')) {
        wrap.classList.add('et-hoverable','et-media-el');
        wrap.setAttribute('data-et-label','📷 / 🎬 Bild oder Video ersetzen');
        wrap._etImg = img;
      }
    });
    if (heroBg) {
      heroBg.classList.add('et-hoverable','et-media-el');
      heroBg.setAttribute('data-et-label','📷 / 🎬 Hintergrund ersetzen');
    }
    document.querySelectorAll(CARD_SEL).forEach(el => {
      el.classList.add('et-hoverable','et-card-el');
      el.setAttribute('draggable','true');
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragover',  onDragOver);
      el.addEventListener('dragleave', onDragLeave);
      el.addEventListener('drop',      onDrop);
      el.addEventListener('dragend',   onDragEnd);
    });
    document.querySelectorAll(SEC_SEL).forEach(el => el.classList.add('et-hoverable','et-sec-el'));
    document.addEventListener('click', globalClick, true);
    showHint();
  }

  function exit() {
    mode = false;
    document.body.classList.remove('edit-active','settings-open');
    settingsPanel.classList.remove('open');
    settingsBtn.classList.remove('open');
    deselect();
    document.removeEventListener('click', globalClick, true);
    const cleanup = [
      ['.et-text-el',  ['et-hoverable','et-text-el','et-selected']],
      ['.et-btn-el',   ['et-hoverable','et-btn-el','et-selected']],
      ['.et-media-el', ['et-hoverable','et-media-el','et-selected']],
      ['.et-card-el',  ['et-hoverable','et-card-el','et-selected','et-dragging','et-drop-over']],
      ['.et-sec-el',   ['et-hoverable','et-sec-el','et-selected']],
    ];
    cleanup.forEach(([sel, classes]) => {
      document.querySelectorAll(sel).forEach(el => {
        el.classList.remove(...classes);
        if (sel === '.et-card-el') {
          el.removeAttribute('draggable');
          el.removeEventListener('dragstart', onDragStart);
          el.removeEventListener('dragover',  onDragOver);
          el.removeEventListener('dragleave', onDragLeave);
          el.removeEventListener('drop',      onDrop);
          el.removeEventListener('dragend',   onDragEnd);
        }
      });
    });
    if (heroBg) heroBg.classList.remove('et-hoverable','et-media-el','et-selected');
    document.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    document.querySelectorAll('[data-et-label]').forEach(el => el.removeAttribute('data-et-label'));
  }

  /* ═══ CLICK INTERCEPTOR ═══ */
  function globalClick(e) {
    if (!mode) return;
    const et = e.target;
    if (et.closest('#et-topbar,#et-propsbar,#edit-toggle,#et-settings-panel,#et-img-input,#et-vid-input,#et-bg-input')) return;
    e.preventDefault();
    e.stopPropagation();
    const btnEl  = et.closest(BTN_SEL);
    const textEl = et.closest(TEXT_SEL);
    const mediaEl= et.closest('.et-media-el');
    const cardEl = et.closest(CARD_SEL);
    const secEl  = et.closest(SEC_SEL);
    if (btnEl)  { select(btnEl, 'button'); return; }
    if (textEl) { selectText(textEl); return; }
    if (mediaEl) {
      if (mediaEl === heroBg) select(heroBg, 'hero');
      else select(mediaEl, 'media');
      return;
    }
    /* Hero-Special: Klick irgendwo im #hero (Video, Overlay) → Hero-Background selektieren */
    if (et.closest('#hero') && heroBg) {
      select(heroBg, 'hero');
      return;
    }
    if (cardEl) { select(cardEl, 'card'); return; }
    if (secEl)  { select(secEl,  'section'); return; }
    deselect();
  }

  /* ═══ SELECTION ═══ */
  function select(el, type) {
    deselect();
    selEl = el; selType = type;
    el.classList.add('et-selected');
    hint.style.display = 'none';
    textTools.style.display  = type === 'text' ? 'flex' : 'none';
    btnTools.style.display   = type === 'button' ? 'flex' : 'none';
    mediaTools.style.display = (type === 'media' || type === 'hero') ? 'flex' : 'none';
    cardTools.style.display  = type === 'card' ? 'flex' : 'none';
    secTools.style.display   = type === 'section' ? 'flex' : 'none';
    if (type === 'text')    syncTextBar(el);
    if (type === 'button')  syncBtnBar(el);
    if (type === 'card')    syncCardBar(el);
    if (type === 'section') syncSecBar(el);
    if (type === 'media' || type === 'hero') syncMediaBar(el, type);
  }
  function selectText(el) {
    select(el, 'text');
    el.setAttribute('contenteditable', 'true');
    el.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(el); r.collapse(false);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch(_) {}
    el.addEventListener('keydown', onTextKey);
    el.addEventListener('blur', () => {
      el.removeAttribute('contenteditable');
      el.removeEventListener('keydown', onTextKey);
    }, { once: true });
  }
  function deselect() {
    if (selEl) {
      selEl.classList.remove('et-selected');
      if (selEl.hasAttribute('contenteditable')) {
        selEl.removeAttribute('contenteditable');
        selEl.removeEventListener('keydown', onTextKey);
      }
    }
    selEl = null; selType = null;
    showHint();
  }
  function showHint() {
    hint.style.display = '';
    textTools.style.display = btnTools.style.display = mediaTools.style.display = cardTools.style.display = secTools.style.display = 'none';
  }
  function onTextKey(e) { if (e.key === 'Escape') this.blur(); }

  /* ═══ TEXT props ═══ */
  function syncTextBar(el) {
    const cs = getComputedStyle(el);
    const ff = (el.style.fontFamily || cs.fontFamily || '').toLowerCase();
    if      (ff.includes('playfair')) selFont.value = "'Playfair Display', serif";
    else if (ff.includes('georgia'))  selFont.value = 'Georgia, serif';
    else if (ff.includes('times'))    selFont.value = "'Times New Roman', serif";
    else if (ff.includes('arial'))    selFont.value = 'Arial, sans-serif';
    else if (ff.includes('verdana'))  selFont.value = 'Verdana, sans-serif';
    else if (ff.includes('courier'))  selFont.value = "'Courier New', monospace";
    else                              selFont.value = "'Inter', sans-serif";
    selSize.value = closestVal(selSize, Math.round(parseFloat(el.style.fontSize || cs.fontSize)));
    const lhPx = parseFloat(el.style.lineHeight || cs.lineHeight);
    const lhRel = isNaN(lhPx) ? 1.5 : lhPx / parseFloat(cs.fontSize);
    selLH.value = closestVal(selLH, lhRel);
    boldBtn.classList.toggle('on', parseInt(cs.fontWeight) >= 600);
    italBtn.classList.toggle('on', cs.fontStyle === 'italic');
    undlBtn.classList.toggle('on', cs.textDecoration.includes('underline'));
    alignBtns.forEach(b => b.classList.toggle('on', b.dataset.align === cs.textAlign));
    txtColor.value = rgb2hex(cs.color) || '#2a2a2a';
    txtBg.value = rgb2hex(cs.backgroundColor) || '#ffffff';
  }
  selFont.addEventListener('change', () => applyTxt('fontFamily', selFont.value));
  selSize.addEventListener('change', () => applyTxt('fontSize', selSize.value + 'px'));
  selLH.addEventListener('change',   () => applyTxt('lineHeight', selLH.value));
  txtColor.addEventListener('input', () => applyTxt('color', txtColor.value));
  txtBg.addEventListener('input',    () => applyTxt('backgroundColor', txtBg.value));
  boldBtn.addEventListener('mousedown', e => { e.preventDefault(); if(!selEl) return; const on = parseInt(getComputedStyle(selEl).fontWeight) >= 600; applyTxt('fontWeight', on ? '400' : '700'); boldBtn.classList.toggle('on', !on); });
  italBtn.addEventListener('mousedown', e => { e.preventDefault(); if(!selEl) return; const on = getComputedStyle(selEl).fontStyle === 'italic'; applyTxt('fontStyle', on ? 'normal' : 'italic'); italBtn.classList.toggle('on', !on); });
  undlBtn.addEventListener('mousedown', e => { e.preventDefault(); if(!selEl) return; const on = getComputedStyle(selEl).textDecoration.includes('underline'); applyTxt('textDecoration', on ? 'none' : 'underline'); undlBtn.classList.toggle('on', !on); });
  alignBtns.forEach(btn => btn.addEventListener('mousedown', e => {
    e.preventDefault();
    if (!selEl) return;
    applyTxt('textAlign', btn.dataset.align);
    alignBtns.forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }));
  function applyTxt(prop, val) { if (!selEl || selType !== 'text') return; selEl.style[prop] = val; }

  /* ═══ BUTTON props ═══ */
  function syncBtnBar(el) {
    const cs = getComputedStyle(el);
    btnBg.value = rgb2hex(cs.backgroundColor) || '#c8975a';
    btnFg.value = rgb2hex(cs.color) || '#ffffff';
    btnBorder.value = rgb2hex(cs.borderColor) || '#c8975a';
    btnSize.value = closestVal(btnSize, Math.round(parseFloat(cs.fontSize)));
    const br = parseFloat(cs.borderRadius);
    btnRadius.value = br <= 0 ? '0px' : br <= 6 ? '6px' : br <= 14 ? '14px' : '50px';
    btnLink.value = el.getAttribute('href') || el.dataset.href || '';
    el.setAttribute('contenteditable', 'true');
    el.focus();
  }
  btnBg.addEventListener('input', () => applyBtn('backgroundColor', btnBg.value));
  btnFg.addEventListener('input', () => applyBtn('color', btnFg.value));
  btnBorder.addEventListener('input', () => applyBtn('borderColor', btnBorder.value));
  btnRadius.addEventListener('change', () => applyBtn('borderRadius', btnRadius.value));
  btnSize.addEventListener('change', () => applyBtn('fontSize', btnSize.value + 'px'));
  btnLink.addEventListener('input', () => {
    if (!selEl) return;
    if (selEl.tagName === 'A') selEl.setAttribute('href', btnLink.value);
    else selEl.dataset.href = btnLink.value;
  });
  function applyBtn(prop, val) { if (!selEl || selType !== 'button') return; selEl.style[prop] = val; }

  /* ═══ MEDIA props ═══ */
  function syncMediaBar(el, type) {
    const thumb = $('et-media-thumb'), noThumb = $('et-media-no-thumb');
    const tLabel = $('et-media-type-label'), sizeRec = $('et-media-size-rec');
    let recSize = 'Empfohlen: 1200 × 800 px';
    if (type === 'hero') recSize = 'Empfohlen: 1920 × 1080 px';
    else if (el.classList.contains('apt-img') || el.closest('.apt-card')) recSize = 'Empfohlen: 800 × 500 px';
    else if (el.classList.contains('region-card') || el.closest('.region-card')) recSize = 'Empfohlen: 600 × 800 px';
    else if (el.classList.contains('ueber-image') || el.closest('.ueber-image')) recSize = 'Empfohlen: 800 × 1000 px';
    sizeRec.textContent = recSize;
    let src = null, isVideo = false;
    if (type === 'hero') {
      const heroVid = document.querySelector('#hero video');
      if (heroVid) { src = heroVid.src || heroVid.querySelector('source')?.src; isVideo = true; }
    } else {
      const vidEl = el.querySelector('video.et-video-el'), imgEl = el._etImg || el.querySelector('img');
      if (vidEl) { src = vidEl.src; isVideo = true; }
      else if (imgEl) src = imgEl.src;
    }
    tLabel.textContent = isVideo ? 'Video' : 'Bild';
    if (src && !isVideo) { thumb.src = src; thumb.style.display = ''; noThumb.style.display = 'none'; }
    else { thumb.style.display = 'none'; noThumb.style.display = ''; noThumb.textContent = isVideo ? '🎬' : '🖼'; }
  }
  $('et-replace-img').addEventListener('click', () => imgInput.click());
  $('et-replace-vid').addEventListener('click', () => vidInput.click());
  imgInput.addEventListener('change', function() { if (!this.files[0]) return; loadMedia(this.files[0], 'image'); this.value = ''; });
  vidInput.addEventListener('change', function() { if (!this.files[0]) return; loadMedia(this.files[0], 'video'); this.value = ''; });
  bgInput.addEventListener('change', function() { if (!this.files[0]) return; loadMedia(this.files[0], this.files[0].type.startsWith('video') ? 'video' : 'image'); this.value = ''; });
  $('et-sec-img').addEventListener('click', () => bgInput.click());
  $('et-sec-vid').addEventListener('click', () => bgInput.click());

  /* Upload zum Server: gibt Datei-URL zurück (oder null bei Fehler) */
  async function uploadToServer(file) {
    const isLocal  = ['localhost','127.0.0.1'].includes(location.hostname);
    const endpoint = isLocal ? 'http://localhost:8080/upload' : './upload.php';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(endpoint, { method: 'POST', body: fd });
      if (!r.ok) return null;
      const json = await r.json().catch(() => null);
      return (json && json.ok && json.url) ? json.url : null;
    } catch(_) { return null; }
  }

  function applyMediaSrc(src, kind) {
    if (selType === 'hero') {
      if (kind === 'video') {
        let vid = document.querySelector('#hero video');
        if (!vid) { vid = document.createElement('video'); vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true; document.getElementById('hero').prepend(vid); }
        vid.innerHTML = ''; vid.src = src;
      } else {
        const vid = document.querySelector('#hero video'); if (vid) vid.remove();
        heroBg.style.backgroundImage = `url('${src}')`;
        heroBg.style.backgroundSize = 'cover';
        heroBg.style.backgroundPosition = 'center';
      }
    } else if (selType === 'media' && selEl) {
      const img = selEl._etImg || selEl.querySelector('img');
      if (!img) return;
      if (kind === 'video') {
        const vid = document.createElement('video');
        vid.src = src; vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.className = 'et-video-el';
        img.style.display = 'none';
        img.insertAdjacentElement('afterend', vid);
      } else {
        const existVid = selEl.querySelector('video.et-video-el');
        if (existVid) { existVid.remove(); img.style.display = ''; }
        img.src = src;
      }
    } else if (selType === 'section' && selEl) {
      if (kind === 'video') {
        const old = selEl.querySelector('video.et-bg-vid'); if (old) old.remove();
        const vid = document.createElement('video');
        vid.src = src; vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.className = 'et-bg-vid';
        vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
        selEl.style.position = 'relative'; selEl.style.overflow = 'hidden';
        selEl.prepend(vid);
      } else {
        selEl.style.backgroundImage = `url('${src}')`;
        selEl.style.backgroundSize = 'cover';
        selEl.style.backgroundPosition = 'center';
      }
    }
    if (selType === 'media' || selType === 'hero') {
      const thumb = $('et-media-thumb'), noThumb = $('et-media-no-thumb'), tLabel = $('et-media-type-label');
      if (kind === 'image') { thumb.src = src; thumb.style.display = ''; noThumb.style.display = 'none'; tLabel.textContent = 'Bild'; }
      else { thumb.style.display = 'none'; noThumb.style.display = ''; noThumb.textContent = '🎬'; tLabel.textContent = 'Video'; }
    }
  }

  async function loadMedia(file, kind) {
    /* Erst Upload zum Server versuchen (Datei statt base64) */
    const uploadedUrl = await uploadToServer(file);
    if (uploadedUrl) {
      applyMediaSrc(uploadedUrl, kind);
      return;
    }
    /* Fallback: base64 inline (wenn kein Server-Upload möglich) */
    console.warn('[Editor] Upload fehlgeschlagen — Fallback auf base64 inline');
    const reader = new FileReader();
    reader.onload = ev => applyMediaSrc(ev.target.result, kind);
    reader.readAsDataURL(file);
  }

  /* ═══ CARD props ═══ */
  function syncCardBar(el) { cardBgInp.value = rgb2hex(getComputedStyle(el).backgroundColor) || '#ffffff'; }
  moveUpBtn.addEventListener('click', () => { if (!selEl) return; const p = selEl.previousElementSibling; if (p) selEl.parentNode.insertBefore(selEl, p); });
  moveDnBtn.addEventListener('click', () => { if (!selEl) return; const n = selEl.nextElementSibling; if (n) n.insertAdjacentElement('afterend', selEl); });
  cardBgInp.addEventListener('input', () => { if (selEl && selType === 'card') selEl.style.backgroundColor = cardBgInp.value; });

  /* ═══ SECTION props ═══ */
  function syncSecBar(el) {
    const cs = getComputedStyle(el);
    secBgInp.value = rgb2hex(cs.backgroundColor) || '#f0e6d3';
    secPad.value = closestPad(el.style.padding || cs.padding);
  }
  secBgInp.addEventListener('input', () => { if (selEl && selType === 'section') selEl.style.backgroundColor = secBgInp.value; });
  secPad.addEventListener('change', () => { if (selEl && selType === 'section') selEl.style.padding = secPad.value; });
  function closestPad(pad) { const opts = [...secPad.options].map(o => o.value); return opts.includes(pad) ? pad : '90px 5%'; }

  /* ═══ DRAG & DROP ═══ */
  function onDragStart(e) { dragSrc = this; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => this.classList.add('et-dragging'), 0); }
  function onDragOver(e)  { e.preventDefault(); if (this !== dragSrc && same(this, dragSrc)) this.classList.add('et-drop-over'); }
  function onDragLeave()  { this.classList.remove('et-drop-over'); }
  function onDrop(e) {
    e.preventDefault(); this.classList.remove('et-drop-over');
    if (this === dragSrc || !same(this, dragSrc)) return;
    const p = this.parentNode, kids = [...p.children];
    p.insertBefore(dragSrc, kids.indexOf(dragSrc) < kids.indexOf(this) ? this.nextSibling : this);
  }
  function onDragEnd() {
    this.classList.remove('et-dragging');
    document.querySelectorAll('.et-drop-over').forEach(el => el.classList.remove('et-drop-over'));
    dragSrc = null;
  }
  function same(a, b) { return a && b && a.parentNode === b.parentNode; }

  /* ═══ SETTINGS PANEL ═══ */
  function openSettings() {
    settingsPanel.classList.add('open');
    settingsBtn.classList.add('open');
    document.body.classList.add('settings-open');
    const root = document.documentElement;
    const iv = name => root.style.getPropertyValue(name) || null;
    $('sp-primary').value     = iv('--ocean') || '#1e4d6b';
    $('sp-primary-hex').value = $('sp-primary').value;
    $('sp-gold').value        = iv('--gold')  || '#c8975a';
    $('sp-gold-hex').value    = $('sp-gold').value;
    $('sp-sand').value        = iv('--sand')  || '#f0e6d3';
    $('sp-sand-hex').value    = $('sp-sand').value;
    $('sp-white').value       = iv('--white') || '#fdfaf6';
    $('sp-white-hex').value   = $('sp-white').value;
    $('sp-text').value        = iv('--text')  || '#2a2a2a';
    $('sp-text-hex').value    = $('sp-text').value;
    $('sp-radius').value      = iv('--radius') || '16px';
  }
  function closeSettings() {
    settingsPanel.classList.remove('open');
    settingsBtn.classList.remove('open');
    document.body.classList.remove('settings-open');
  }
  settingsBtn.addEventListener('click', () => settingsPanel.classList.contains('open') ? closeSettings() : openSettings());
  spClose.addEventListener('click', closeSettings);

  function setCSSVar(name, val) { document.documentElement.style.setProperty(name, val); }
  function bindColorPair(pickerId, hexId, cssProp, extra) {
    const picker = $(pickerId), hex = $(hexId);
    picker.addEventListener('input', function() {
      hex.value = this.value; hex.classList.remove('invalid');
      setCSSVar(cssProp, this.value);
      if (extra) extra(this.value);
    });
    hex.addEventListener('input', function() {
      const v = this.value.trim();
      const valid = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);
      this.classList.toggle('invalid', !valid);
      if (valid) { picker.value = v; setCSSVar(cssProp, v); if (extra) extra(v); }
    });
  }
  function lighten(hex, p) { const [r,g,b] = hex2rgb(hex); return '#' + [r,g,b].map(c => Math.min(255, Math.round(c + (255-c)*p/100))).map(c => c.toString(16).padStart(2,'0')).join(''); }
  function darken(hex, p)  { const [r,g,b] = hex2rgb(hex); return '#' + [r,g,b].map(c => Math.max(0, Math.round(c * (100-p)/100))).map(c => c.toString(16).padStart(2,'0')).join(''); }
  bindColorPair('sp-primary', 'sp-primary-hex', '--ocean', v => setCSSVar('--ocean-light', lighten(v, 20)));
  bindColorPair('sp-gold',    'sp-gold-hex',    '--gold');
  bindColorPair('sp-sand',    'sp-sand-hex',    '--sand',  v => setCSSVar('--sand-dark', darken(v, 10)));
  bindColorPair('sp-white',   'sp-white-hex',   '--white');
  bindColorPair('sp-text',    'sp-text-hex',    '--text');
  $('sp-radius').addEventListener('change', e => setCSSVar('--radius', e.target.value));

  /* ═══ SAVE ═══ */
  function buildCleanHTML() {
    const root = document.documentElement;
    const varNames = ['--ocean','--ocean-light','--gold','--sand','--sand-dark','--white','--text','--radius'];
    const vars = {};
    varNames.forEach(n => { const v = root.style.getPropertyValue(n); if (v) vars[n] = v.trim(); });

    const clone = document.documentElement.cloneNode(true);
    /* CSS-Variablen ins :root schreiben */
    const styles = clone.querySelectorAll('style');
    if (styles.length) {
      let css = styles[0].textContent;
      Object.entries(vars).forEach(([prop, val]) => {
        const rx = new RegExp('(' + prop.replace('-','\\-') + '\\s*:\\s*)[^;]+', 'g');
        css = css.replace(rx, '$1' + val);
      });
      styles[0].textContent = css;
    }
    clone.removeAttribute('style');

    /* Editor BLEIBT in der HTML drin (für späteres Editieren).
       Er ist für Besucher unsichtbar — alle Editor-UI-Elemente sind
       nur via body.edit-active sichtbar, was per et_autoopen Flag aktiviert wird.
       Bereinigt werden nur die Edit-Mode-Zustände. */
    clone.querySelector('body')?.classList.remove('edit-active','settings-open');
    const edClasses = ['et-hoverable','et-text-el','et-btn-el','et-media-el','et-card-el','et-sec-el','et-selected','et-dragging','et-drop-over'];
    clone.querySelectorAll('.' + edClasses.join(',.')).forEach(el => el.classList.remove(...edClasses));
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    clone.querySelectorAll('[data-et-label]').forEach(el => el.removeAttribute('data-et-label'));
    clone.querySelectorAll('[draggable]').forEach(el => el.removeAttribute('draggable'));
    clone.querySelectorAll('input[type="file"]').forEach(el => el.value = '');

    /* ── Save-Button & Save-Live-Button Zustand zurücksetzen ──
       Sonst landet "⏳ Speichern…" + disabled in der gespeicherten HTML! */
    const cSave = clone.querySelector('#et-save-btn');
    if (cSave) { cSave.textContent = '💾 Als Draft'; cSave.disabled = false; cSave.removeAttribute('disabled'); cSave.style.background = ''; }
    const cSaveLive = clone.querySelector('#et-save-live-btn');
    if (cSaveLive) { cSaveLive.textContent = '🚀 Direkt Live'; cSaveLive.disabled = false; cSaveLive.removeAttribute('disabled'); cSaveLive.style.background = ''; }

    /* Settings-Panel im Clone schließen falls offen */
    clone.querySelector('#et-settings-panel')?.classList.remove('open');
    clone.querySelector('#et-settings-btn')?.classList.remove('open');

    /* Apartment-Modal schließen falls offen */
    clone.querySelector('#apt-modal-overlay')?.classList.remove('open');

    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  async function doSave(mode) {
    /* mode: 'draft' → /save (Safe-Mode-respecting)  |  'live' → /save-live (immer direkt) */
    const btn        = mode === 'live' ? saveLiveBtn : saveBtn;
    const origText   = btn.textContent;
    const origBg     = btn.style.background;
    const otherBtn   = mode === 'live' ? saveBtn : saveLiveBtn;

    /* "Direkt live" → Bestätigung */
    if (mode === 'live') {
      if (!confirm('⚠️ Direkt auf die LIVE-Webseite schreiben?\n\nDie aktuelle index.html wird sofort überschrieben (Backup wird angelegt). Besucher sehen die Änderung sofort.')) return;
    }

    btn.disabled = true;
    otherBtn.disabled = true;
    btn.textContent = '⏳ Speichern…';
    /* WICHTIG: exit() NICHT mehr aufrufen — der Editor soll während des
       Speicherns drinbleiben. buildCleanHTML() macht alle Cleanups
       NUR auf dem Clone, der Live-DOM bleibt unverändert. */
    /* Aktuelle Selektion temporär deselektieren (ohne deselect()) damit
       der Clone keine Hover/Selected-Klassen mehr trägt — wird im Clone
       sowieso entfernt. */
    const html  = buildCleanHTML();
    const token = sessionStorage.getItem('et_save_token') || '';

    async function trySave(url, headers = {}) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
          body: html
        });
        if (!r.ok) return r.status;
        const txt = (await r.text()).trim();
        if (txt === 'OK' || txt.startsWith('OK:')) return txt;
        return false;
      } catch(_) { return false; }
    }

    const isLocal  = ['localhost','127.0.0.1'].includes(location.hostname);
    const endpoint = mode === 'live' ? '/save-live' : '/save';
    let result = false;

    if (isLocal) {
      result = await trySave('http://localhost:8080' + endpoint);
    } else {
      let res = await trySave('./save.php', { 'X-Save-Token': token, 'X-Save-Mode': mode });
      if (res === 401 || res === 403) {
        const pw = prompt('Admin-Passwort eingeben:');
        if (pw) {
          sessionStorage.setItem('et_save_token', pw);
          res = await trySave('./save.php', { 'X-Save-Token': pw, 'X-Save-Mode': mode });
        }
      }
      result = res;
    }

    const savedOK = result === 'OK' || (typeof result === 'string' && result.startsWith('OK'));

    if (savedOK) {
      btn.textContent = mode === 'live' ? '✅ Live!' : '✅ Draft gespeichert';
      btn.style.background = mode === 'live' ? '#22c55e' : '#22c55e';
      localStorage.setItem('last_edit', new Date().toISOString());
      setTimeout(() => {
        btn.textContent = origText;
        btn.style.background = origBg;
        btn.disabled = false;
        otherBtn.disabled = false;
      }, 2500);
    } else {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'index.html' });
      a.click(); URL.revokeObjectURL(a.href);
      alert('Server-Speichern fehlgeschlagen. Datei wurde als Download bereitgestellt.');
      btn.textContent = origText;
      btn.disabled = false;
      otherBtn.disabled = false;
    }
    /* enter() entfernt — der Editor war nie aus, kein Re-Enter nötig */
  }

  /* ═══ HELPERS ═══ */
  function rgb2hex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb.includes('rgba(0, 0, 0, 0)')) return null;
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return null;
    return '#' + m.slice(0,3).map(n => (+n).toString(16).padStart(2,'0')).join('');
  }
  function hex2rgb(hex) {
    const h = hex.replace('#',''); const s = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
  }
  function closestVal(sel, val) {
    const opts = [...sel.options].map(o => +o.value);
    return opts.reduce((a,b) => Math.abs(b-val) < Math.abs(a-val) ? b : a).toString();
  }

  /* ═══ BOOT: Edit-Modus nur per Admin-Panel ═══ */
  saveBtn.addEventListener('click',     () => doSave('draft'));
  saveLiveBtn.addEventListener('click', () => doSave('live'));
  exitBtn.addEventListener('click', exit);

  /* DEFENSIVER RESET beim Page-Load:
     Falls die geladene HTML (z.B. aus dem Cache) einen kaputten Button-State
     enthält (disabled, "⏳ Speichern…", Settings-Panel offen, Edit-Modus-Klassen),
     hier sauber zurücksetzen damit der Editor verlässlich startet. */
  function defensiveReset() {
    if (saveBtn)     { saveBtn.disabled = false;     saveBtn.textContent     = '💾 Als Draft';   saveBtn.style.background = ''; }
    if (saveLiveBtn) { saveLiveBtn.disabled = false; saveLiveBtn.textContent = '🚀 Direkt Live'; saveLiveBtn.style.background = ''; }
    if (settingsBtn) settingsBtn.classList.remove('open');
    if (settingsPanel) settingsPanel.classList.remove('open');
    document.body.classList.remove('edit-active','settings-open');
    document.querySelectorAll('.et-selected,.et-hoverable,.et-text-el,.et-btn-el,.et-media-el,.et-card-el,.et-sec-el,.et-dragging,.et-drop-over')
      .forEach(el => el.classList.remove('et-selected','et-hoverable','et-text-el','et-btn-el','et-media-el','et-card-el','et-sec-el','et-dragging','et-drop-over'));
    document.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    document.querySelectorAll('[data-et-label]').forEach(el => el.removeAttribute('data-et-label'));
    document.querySelectorAll('[draggable]').forEach(el => el.removeAttribute('draggable'));
    /* Apartment-Modal: zu */
    document.getElementById('apt-modal-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }
  defensiveReset();

  (function checkAdminAccess() {
    /* Sowohl localStorage-Flag als auch URL-Parameter ?edit=... lösen den
       Editor aus. URL-Param ist robust gegen Cache + funktioniert auch wenn
       localStorage durch private-Mode/Sicherheitseinstellungen gesperrt ist. */
    const hasUrlEdit = new URLSearchParams(location.search).has('edit');
    const hasFlag    = localStorage.getItem('et_autoopen') === '1';
    if (hasFlag || hasUrlEdit) {
      try { localStorage.removeItem('et_autoopen'); } catch(_) {}
      enter();
    }
  })();

})();
