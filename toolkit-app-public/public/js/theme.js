// ============================================================
// Dark/Light theme toggle.
// FOUC-prevention sudah dilakukan lewat inline script kecil di <head>
// tiap halaman (set data-theme sebelum CSS render). File ini menangani
// interaksi tombolnya: render ikon, klik, dan sinkronisasi antar tab.
// ============================================================
(function () {
  const KEY = 'toolkitapp_theme';

  const ICON_SUN =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/>' +
    '<line x1="4.2" y1="4.2" x2="5.9" y2="5.9"/><line x1="18.1" y1="18.1" x2="19.8" y2="19.8"/>' +
    '<line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/>' +
    '<line x1="4.2" y1="19.8" x2="5.9" y2="18.1"/><line x1="18.1" y1="5.9" x2="19.8" y2="4.2"/>' +
    '</svg>';

  const ICON_MOON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
    '<path d="M20.6 15.1a8.9 8.9 0 0 1-10.7-13 9.1 9.1 0 1 0 12.4 11.5c-.55.1-1.13.15-1.7.15a8.9 8.9 0 0 1 0-.65z" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>';

  function getTheme() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = theme === 'light' ? ICON_MOON : ICON_SUN;
      btn.title = theme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode terang';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
  }

  function setTheme(theme) {
    applyTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
  }

  function makeToggleButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'themeToggleBtn';
    btn.className = 'theme-toggle';
    btn.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(current === 'light' ? 'dark' : 'light');
    });
    return btn;
  }

  function injectToggle() {
    const rail = document.querySelector('.top-rail');
    if (!rail || document.getElementById('themeToggleBtn')) return;

    const children = Array.from(rail.children);
    const btn = makeToggleButton();

    if (children.length < 2) {
      rail.appendChild(btn);
    } else {
      // Bungkus elemen paling kanan yang sudah ada bersama tombol baru,
      // supaya keduanya tetap sejajar di ujung kanan top-rail tanpa
      // perlu ubah markup tiap halaman satu-satu.
      const rightEl = children[children.length - 1];
      const wrapper = document.createElement('div');
      wrapper.className = 'top-rail-right';
      rail.insertBefore(wrapper, rightEl);
      wrapper.appendChild(rightEl);
      wrapper.appendChild(btn);
    }
    applyTheme(getTheme());
  }

  // Sinkron kalau tema diubah dari tab/halaman lain
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) applyTheme(getTheme());
  });

  document.addEventListener('DOMContentLoaded', injectToggle);
})();
