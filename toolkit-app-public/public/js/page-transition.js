// ============================================================
// Transisi halaman halus: fade-out singkat sebelum pindah ke
// halaman internal lain, supaya perpindahan antar tool terasa
// seperti aplikasi native, bukan reload situs web biasa.
// ============================================================
(function () {
  const EXIT_MS = 140;

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target.closest('a[href]');
    if (!a) return;

    const href = a.getAttribute('href') || '';
    const isInternalHtml = /^[a-z0-9_-]+\.html(\?.*)?$/i.test(href);
    if (!isInternalHtml) return; // biarkan link luar/anchor/mailto jalan normal
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.classList.contains('locked')) return;

    e.preventDefault();
    document.documentElement.classList.add('page-leaving');
    setTimeout(function () {
      window.location.href = href;
    }, EXIT_MS);
  });
})();
