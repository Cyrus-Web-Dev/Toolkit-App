// ============================================================
// Panduan penggunaan: muncul otomatis di kunjungan pertama,
// bisa dibuka lagi kapan saja lewat tombol "Panduan".
// ============================================================
(function () {
  const STORAGE_KEY = 'toolkitapp_guide_dismissed_v1';

  const overlay = document.getElementById('guideOverlay');
  if (!overlay) return; // halaman ini tidak punya modal panduan

  const btnGuideHeader = document.getElementById('btnGuide');
  const btnGuideFooter = document.getElementById('btnGuideFooter');
  const btnClose = document.getElementById('guideClose');
  const btnStart = document.getElementById('guideStart');
  const checkboxDontShow = document.getElementById('guideDontShow');

  function openGuide() {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeGuide() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (checkboxDontShow && checkboxDontShow.checked) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (err) { /* ignore */ }
    }
  }

  btnGuideHeader?.addEventListener('click', openGuide);
  btnGuideFooter?.addEventListener('click', openGuide);
  btnClose?.addEventListener('click', closeGuide);
  btnStart?.addEventListener('click', closeGuide);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGuide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeGuide();
  });

  // Tampilkan otomatis kalau belum pernah ditutup permanen
  let alreadyDismissed = false;
  try { alreadyDismissed = localStorage.getItem(STORAGE_KEY) === '1'; } catch (err) { /* ignore */ }

  if (!alreadyDismissed) {
    // Sedikit delay biar tidak "meloncat" bersamaan render halaman
    setTimeout(openGuide, 350);
  }
})();
