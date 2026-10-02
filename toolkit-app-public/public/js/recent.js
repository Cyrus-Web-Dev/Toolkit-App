// ============================================================
// Catat halaman tool yang baru dikunjungi (bukan dashboard/riwayat/
// splash sendiri) supaya dashboard bisa menampilkan quick-access
// "Terakhir Dipakai". Disimpan di localStorage, murni sisi klien.
// ============================================================
(function () {
  const KEY = 'toolkitapp_recent_v1';
  const MAX_ENTRIES = 8;
  const SKIP = ['app.html', 'index.html', 'history.html', ''];

  const route = location.pathname.split('/').pop();
  if (SKIP.includes(route)) return;

  try {
    const raw = localStorage.getItem(KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    list = list.filter((entry) => entry.route !== route);
    list.unshift({ route, ts: Date.now() });
    list = list.slice(0, MAX_ENTRIES);

    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) { /* localStorage penuh/diblokir — abaikan diam-diam */ }
})();
