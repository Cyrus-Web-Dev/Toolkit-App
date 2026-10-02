'use strict';
/**
 * Global bottom download/process progress bar.
 * Usage:
 *   DownloadProgress.show('Mengunduh…');
 *   DownloadProgress.set(45, 'Mengunduh video…');
 *   DownloadProgress.hide();
 *   await DownloadProgress.fetchBlob(url, options, (pct, label) => {});
 */
(function (global) {
  const ID = 'toolkit-download-progress';

  function ensureEl() {
    let root = document.getElementById(ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ID;
    root.className = 'tk-dl-progress';
    root.hidden = true;
    root.innerHTML = `
      <div class="tk-dl-progress-inner">
        <div class="tk-dl-progress-top">
          <span class="tk-dl-progress-label">Memproses…</span>
          <span class="tk-dl-progress-pct">0%</span>
        </div>
        <div class="tk-dl-progress-track">
          <div class="tk-dl-progress-bar" style="width:0%"></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    if (!document.getElementById('tk-dl-progress-style')) {
      const style = document.createElement('style');
      style.id = 'tk-dl-progress-style';
      style.textContent = `
        .tk-dl-progress {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 10050;
          padding: 10px 16px 14px;
          background: linear-gradient(180deg, transparent, rgba(0,0,0,.55) 30%, rgba(0,0,0,.82));
          pointer-events: none;
        }
        .tk-dl-progress-inner {
          max-width: 720px;
          margin: 0 auto;
          background: var(--surface-2, #1a1d24);
          border: 1px solid var(--border, #2a2f3a);
          border-radius: 12px;
          padding: 10px 14px 12px;
          box-shadow: 0 -4px 24px rgba(0,0,0,.35);
          pointer-events: auto;
        }
        .tk-dl-progress-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          font-size: 0.84rem;
        }
        .tk-dl-progress-label {
          color: var(--text, #e2e8f0);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tk-dl-progress-pct {
          font-family: "IBM Plex Mono", ui-monospace, monospace;
          font-weight: 600;
          color: var(--accent, #2dd4bf);
          flex-shrink: 0;
        }
        .tk-dl-progress-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(148,163,184,.2);
          overflow: hidden;
        }
        .tk-dl-progress-bar {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #14b8a6, #2dd4bf);
          transition: width .15s ease-out;
        }
        .tk-dl-progress.indeterminate .tk-dl-progress-bar {
          width: 35% !important;
          animation: tk-dl-indeterminate 1.2s ease-in-out infinite;
        }
        @keyframes tk-dl-indeterminate {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        [data-theme="light"] .tk-dl-progress {
          background: linear-gradient(180deg, transparent, rgba(255,255,255,.5) 30%, rgba(255,255,255,.92));
        }
      `;
      document.head.appendChild(style);
    }
    return root;
  }

  const api = {
    show(label, pct) {
      const root = ensureEl();
      root.hidden = false;
      root.classList.remove('indeterminate');
      const lab = root.querySelector('.tk-dl-progress-label');
      const pctEl = root.querySelector('.tk-dl-progress-pct');
      const bar = root.querySelector('.tk-dl-progress-bar');
      if (lab && label != null) lab.textContent = label;
      const n = typeof pct === 'number' ? Math.max(0, Math.min(100, pct)) : 0;
      if (pctEl) pctEl.textContent = Math.round(n) + '%';
      if (bar) bar.style.width = n + '%';
    },

    set(pct, label) {
      const root = ensureEl();
      if (root.hidden) root.hidden = false;
      root.classList.remove('indeterminate');
      if (label != null) {
        const lab = root.querySelector('.tk-dl-progress-label');
        if (lab) lab.textContent = label;
      }
      const n = Math.max(0, Math.min(100, Number(pct) || 0));
      const pctEl = root.querySelector('.tk-dl-progress-pct');
      const bar = root.querySelector('.tk-dl-progress-bar');
      if (pctEl) pctEl.textContent = Math.round(n) + '%';
      if (bar) bar.style.width = n + '%';
    },

    indeterminate(label) {
      const root = ensureEl();
      root.hidden = false;
      root.classList.add('indeterminate');
      const lab = root.querySelector('.tk-dl-progress-label');
      const pctEl = root.querySelector('.tk-dl-progress-pct');
      const bar = root.querySelector('.tk-dl-progress-bar');
      if (lab && label != null) lab.textContent = label;
      if (pctEl) pctEl.textContent = '…';
      if (bar) bar.style.width = '35%';
    },

    hide() {
      const root = document.getElementById(ID);
      if (!root) return;
      root.hidden = true;
      root.classList.remove('indeterminate');
    },

    /**
     * fetch + read body with progress when Content-Length known.
     * @returns {Promise<Response-like with blob()>} actually returns { blob, response }
     */
    async fetchBlob(url, options = {}, onProgress) {
      const res = await fetch(url, options);
      if (!res.ok) return { response: res, blob: null };

      const total = Number(res.headers.get('Content-Length') || 0);
      if (!res.body || !total) {
        if (onProgress) onProgress(null, 'Mengunduh…');
        const blob = await res.blob();
        if (onProgress) onProgress(100, 'Selesai');
        return { response: res, blob };
      }

      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const pct = Math.min(100, (received / total) * 100);
        if (onProgress) onProgress(pct, `Mengunduh… ${Math.round(pct)}%`);
      }
      const blob = new Blob(chunks, { type: res.headers.get('Content-Type') || undefined });
      if (onProgress) onProgress(100, 'Selesai');
      return { response: res, blob };
    },
  };

  global.DownloadProgress = api;
})(window);
