(function () {
  function host() {
    let el = document.getElementById('toastHost');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastHost';
      el.className = 'toast-host';
      document.body.appendChild(el);
    }
    return el;
  }

  function show(type, title, message, ms) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    const icon = type === 'success' ? '✓' : type === 'error' ? '!' : type === 'progress' ? '…' : 'i';
    t.innerHTML =
      '<div class="toast-icon">' + icon + '</div>' +
      '<div class="toast-body">' +
        '<p class="toast-title"></p>' +
        (message ? '<p class="toast-msg"></p>' : '') +
      '</div>' +
      '<button type="button" class="toast-close" aria-label="Tutup">×</button>';
    t.querySelector('.toast-title').textContent = title || '';
    if (message) t.querySelector('.toast-msg').textContent = message;
    const close = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 220);
    };
    t.querySelector('.toast-close').onclick = close;
    host().appendChild(t);
    const lifetime = ms != null ? ms : (type === 'error' ? 6500 : type === 'progress' ? 12000 : 3400);
    if (type !== 'progress') setTimeout(close, lifetime);
    return { close, el: t };
  }

  /**
   * Bungkus operasi async dengan notifikasi standar:
   * proses → berhasil / gagal
   */
  async function withNotify(promiseOrFn, labels) {
    const L = labels || {};
    const progress = show(
      'progress',
      L.progressTitle || 'Sedang diproses',
      L.progressMsg || 'Permintaan Anda sedang dijalankan…',
      60000
    );
    try {
      const result = typeof promiseOrFn === 'function' ? await promiseOrFn() : await promiseOrFn;
      progress.close();
      show('success', L.successTitle || 'Berhasil', L.successMsg || 'Permintaan Anda berhasil.');
      return result;
    } catch (err) {
      progress.close();
      show('error', L.errorTitle || 'Gagal', err.message || L.errorMsg || 'Permintaan Anda gagal.');
      throw err;
    }
  }

  window.toast = {
    success: (title, msg) => show('success', title, msg),
    error: (title, msg) => show('error', title, msg),
    info: (title, msg) => show('info', title, msg),
    progress: (title, msg) => show('progress', title, msg, 60000),
    withNotify,
  };
})();
