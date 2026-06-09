/**
 * notify.js — Sardinientraum In-App Notifications
 *
 * Stellt window.showToast() und window.showConfirm() bereit.
 * Wird in index.html geladen — sowohl site.js als auch editor.js
 * können die Funktionen ohne weitere Abhängigkeiten nutzen.
 *
 * Typen: 'success' | 'error' | 'warning' | 'info'
 */
(function () {
  'use strict';

  // ── CSS einmalig injizieren ──────────────────────────────────
  if (!document.getElementById('sardinia-notify-css')) {
    const style = document.createElement('style');
    style.id = 'sardinia-notify-css';
    style.textContent = `
      /* ── Toast ── */
      #sn-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .sn-toast {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: rgba(20, 30, 50, 0.96);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        padding: 14px 18px;
        min-width: 260px;
        max-width: 380px;
        box-shadow: 0 8px 32px rgba(0,0,0,.45);
        pointer-events: all;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        animation: snToastIn .28s cubic-bezier(.34,1.56,.64,1) both;
      }
      .sn-toast.sn-removing {
        animation: snToastOut .2s ease-in both;
      }
      @keyframes snToastIn {
        from { opacity:0; transform:translateY(18px) scale(.94); }
        to   { opacity:1; transform:none; }
      }
      @keyframes snToastOut {
        from { opacity:1; transform:none; }
        to   { opacity:0; transform:translateY(8px) scale(.96); }
      }
      .sn-toast-icon { font-size: 1.15rem; flex-shrink: 0; margin-top: 1px; }
      .sn-toast-body { flex: 1; }
      .sn-toast-title {
        font-size: .83rem;
        font-weight: 700;
        margin-bottom: 2px;
        font-family: inherit;
      }
      .sn-toast-msg {
        font-size: .78rem;
        color: rgba(255,255,255,.6);
        line-height: 1.5;
        font-family: inherit;
      }
      .sn-toast.sn-success { border-left: 3px solid #22c55e; }
      .sn-toast.sn-success .sn-toast-title { color: #22c55e; }
      .sn-toast.sn-error   { border-left: 3px solid #ef4444; }
      .sn-toast.sn-error   .sn-toast-title { color: #ef4444; }
      .sn-toast.sn-warning { border-left: 3px solid #f59e0b; }
      .sn-toast.sn-warning .sn-toast-title { color: #f59e0b; }
      .sn-toast.sn-info    { border-left: 3px solid #c8975a; }
      .sn-toast.sn-info    .sn-toast-title { color: #c8975a; }

      /* ── Confirm-Dialog ── */
      #sn-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.65);
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        animation: snFadeIn .18s ease both;
      }
      @keyframes snFadeIn  { from { opacity:0; } to { opacity:1; } }
      #sn-confirm-box {
        background: #1a2540;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 18px;
        padding: 30px 32px;
        max-width: 420px;
        width: 92%;
        box-shadow: 0 24px 60px rgba(0,0,0,.55);
        animation: snSlideUp .22s cubic-bezier(.34,1.56,.64,1) both;
        font-family: inherit;
      }
      @keyframes snSlideUp {
        from { opacity:0; transform:translateY(22px) scale(.97); }
        to   { opacity:1; transform:none; }
      }
      #sn-confirm-icon  { font-size: 2rem; margin-bottom: 10px; }
      #sn-confirm-title {
        font-size: 1rem;
        font-weight: 700;
        color: #eef2ff;
        margin-bottom: 8px;
        font-family: inherit;
      }
      #sn-confirm-msg {
        font-size: .85rem;
        color: rgba(255,255,255,.55);
        line-height: 1.65;
        white-space: pre-line;
        margin-bottom: 24px;
        font-family: inherit;
      }
      .sn-confirm-btns {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      .sn-confirm-btns button {
        padding: 10px 24px;
        border-radius: 9px;
        border: none;
        font-size: .85rem;
        font-weight: 600;
        cursor: pointer;
        transition: filter .15s, transform .1s;
        font-family: inherit;
      }
      .sn-confirm-btns button:hover  { filter: brightness(1.12); }
      .sn-confirm-btns button:active { transform: scale(.97); }
      #sn-confirm-cancel {
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.55);
        border: 1px solid rgba(255,255,255,.1);
      }
      #sn-confirm-cancel:hover { color: #fff; }
      #sn-confirm-ok      { background: #1e4d6b; color: #fff; }
      #sn-confirm-ok.sn-danger { background: #ef4444; }
    `;
    document.head.appendChild(style);
  }

  // ── Toast-Container einmalig anlegen ────────────────────────
  function getContainer() {
    let c = document.getElementById('sn-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'sn-toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  // ── Toast entfernen (mit Animations-Warten) ─────────────────
  function removeToast(t) {
    if (!t || t.classList.contains('sn-removing')) return;
    t.classList.add('sn-removing');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }

  /**
   * Zeigt eine Toast-Benachrichtigung.
   * @param {string} msg     Nachricht (Zeilenumbrüche erlaubt)
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number}  duration  ms bis Auto-Close (0 = manuell)
   */
  function showToast(msg, type = 'info', duration = 4500) {
    const icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titles = { success: 'Erfolgreich', error: 'Fehler', warning: 'Hinweis', info: 'Info' };

    const t = document.createElement('div');
    t.className = `sn-toast sn-${type}`;
    t.innerHTML = `
      <div class="sn-toast-icon">${icons[type] || 'ℹ️'}</div>
      <div class="sn-toast-body">
        <div class="sn-toast-title">${titles[type] || 'Info'}</div>
        <div class="sn-toast-msg">${String(msg).replace(/\n/g, '<br>')}</div>
      </div>`;

    getContainer().appendChild(t);
    t.addEventListener('click', () => removeToast(t));
    if (duration > 0) setTimeout(() => removeToast(t), duration);
  }

  /**
   * Zeigt einen In-App Bestätigungs-Dialog.
   * @param {string}   msg    Nachrichtentext (Zeilenumbrüche erlaubt)
   * @param {Function} onOk   Callback wenn bestätigt
   * @param {object}   opts   { danger, icon, title, okLabel, cancelLabel }
   */
  function showConfirm(msg, onOk, opts = {}) {
    document.getElementById('sn-confirm-overlay')?.remove();

    const isDanger    = opts.danger     ?? false;
    const icon        = opts.icon       ?? (isDanger ? '🗑️' : '❓');
    const title       = opts.title      ?? (isDanger ? 'Bestätigung erforderlich' : 'Bist du sicher?');
    const okLabel     = opts.okLabel    ?? (isDanger ? 'Löschen' : 'OK');
    const cancelLabel = opts.cancelLabel ?? 'Abbrechen';

    const overlay = document.createElement('div');
    overlay.id = 'sn-confirm-overlay';
    overlay.innerHTML = `
      <div id="sn-confirm-box">
        <div id="sn-confirm-icon">${icon}</div>
        <div id="sn-confirm-title">${title}</div>
        <div id="sn-confirm-msg">${String(msg).replace(/\n/g, '<br>')}</div>
        <div class="sn-confirm-btns">
          <button id="sn-confirm-cancel">${cancelLabel}</button>
          <button id="sn-confirm-ok" class="${isDanger ? 'sn-danger' : ''}">${okLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.style.animation = 'snFadeIn .18s ease reverse both';
      setTimeout(() => overlay.remove(), 180);
    };
    document.getElementById('sn-confirm-cancel').addEventListener('click', close);
    document.getElementById('sn-confirm-ok').addEventListener('click', () => { close(); onOk(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    const onKey = e => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
      if (e.key === 'Enter')  { close(); onOk(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  }

  // Global verfügbar machen
  window.showToast   = showToast;
  window.showConfirm = showConfirm;

})();
