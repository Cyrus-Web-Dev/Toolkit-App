// Dipakai bareng oleh semua halaman fitur "online" (surat lamaran, CV, chat, downloader)
// supaya tidak menulis ulang logika cek internet di tiap file.

async function checkInternetOnce(timeoutMs = 4000) {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch('https://www.gstatic.com/generate_204', { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch (err) {
    clearTimeout(timer);
    return false;
  }
}

/**
 * @param {string} bannerId - id elemen banner peringatan (ditampilkan kalau offline)
 * @param {HTMLElement[]} disableEls - elemen (biasanya tombol submit) yang dinonaktifkan saat offline
 */
function initOnlineGuard(bannerId, disableEls = []) {
  const banner = document.getElementById(bannerId);

  async function update() {
    const online = await checkInternetOnce();
    if (banner) banner.style.display = online ? 'none' : 'flex';
    disableEls.forEach((el) => { if (el) el.disabled = !online; });
  }

  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  setInterval(update, 20000);
}
