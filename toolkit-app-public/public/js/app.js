// ============================================================
// Daftar modul. "route" akan dipakai untuk navigasi setelah
// tiap modul dibangun.
// ============================================================
const MODULES = [
  { id: 'pdfTools',        name: 'PDF Tools',                tier: 'offline', route: 'pdf.html',
    desc: 'Gabung, pisah, ekstrak, nomor halaman, crop, watermark, kompres PDF.' },
  { id: 'bgRemoveBatch',   name: 'Hapus Background Massal',  tier: 'offline', route: 'bg-remove.html',
    desc: 'Hapus background banyak foto sekaligus — transparan atau ganti warna.' },
  { id: 'fileConvert',     name: 'Konversi File',            tier: 'offline', route: 'convert.html',
    desc: 'Ubah format gambar, audio, video, dan CSV/JSON.' },
  { id: 'ocrTool',         name: 'OCR Teks dari Gambar',     tier: 'offline', route: 'ocr.html',
    desc: 'Ubah foto dokumen / screenshot menjadi teks yang bisa disalin.' },
  { id: 'imageBatch',      name: 'Kompres & Resize Gambar',  tier: 'offline', route: 'image-batch.html',
    desc: 'Kecilkan ukuran dan resolusi banyak gambar sekaligus.' },
  { id: 'qrTool',          name: 'Generator & Pemindai QR',  tier: 'offline', route: 'qr.html',
    desc: 'Buat kode QR dari teks/link dan pindai dengan kamera.' },
  { id: 'coverLetterAI',   name: 'Surat Lamaran AI',         tier: 'online',  route: 'cover-letter.html',
    desc: 'Buat surat lamaran kerja otomatis dengan Gemini.' },
  { id: 'cvBuilderAI',     name: 'CV Builder AI',            tier: 'online',  route: 'cv.html',
    desc: 'Susun CV rapi dengan bantuan AI.' },
  { id: 'resumeAI',        name: 'Resume ATS AI',            tier: 'online',  route: 'resume.html',
    desc: 'Resume ditarget 1 posisi lamaran + skor kecocokan ATS.' },
  { id: 'portfolioAI',     name: 'Portofolio AI',            tier: 'online',  route: 'portfolio.html',
    desc: 'Bangun website portofolio pribadi siap publish dengan AI.' },
  { id: 'officeAI',        name: 'AI Word / Excel / PPT',    tier: 'online',  route: 'office.html',
    desc: 'Buat dokumen Office lewat perintah AI.' },
  { id: 'aiSolver',        name: 'Penyelesai Soal',          tier: 'online',  route: 'solver.html',
    desc: 'Selesaikan soal matematika, sains, akuntansi — teks atau foto.' },
  { id: 'pdfSummarizer',   name: 'Perangkum PDF AI',         tier: 'online',  route: 'summarize.html',
    desc: 'Rangkum jurnal / skripsi jadi poin penting.' },
  { id: 'quizGen',         name: 'Kuis & Flashcard',         tier: 'online',  route: 'quiz.html',
    desc: 'Ubah catatan menjadi soal pilihan ganda dan flashcard.' },
  { id: 'aiDetect',        name: 'Deteksi AI / Plagiarisme', tier: 'online',  route: 'detect.html',
    desc: 'Estimasi kemungkinan teks dihasilkan AI (bukan alat plagiarisme resmi).' },
  { id: 'aiChat',          name: 'AI Chat / Tanya',          tier: 'online',  route: 'chat.html',
    desc: 'Tanya jawab umum dengan Gemini.' },
  { id: 'pdfToJpg',        name: 'PDF ke JPG',               tier: 'online',  route: 'pdf-to-jpg.html',
    desc: 'Ubah halaman PDF menjadi gambar JPG (butuh Poppler).' },
  { id: 'officeToPdf',     name: 'Office ke PDF',            tier: 'online',  route: 'office-to-pdf.html',
    desc: 'Konversi Word/Excel/PPT ke PDF (butuh LibreOffice).' },
];


const els = {
  body: document.body,
  powerLed: document.getElementById('powerLed'),
  powerText: document.getElementById('powerText'),
  socketRail: document.getElementById('socketRail'),
  gridOffline: document.getElementById('gridOffline'),
  gridOnline: document.getElementById('gridOnline'),
  search: document.getElementById('moduleSearch'),
  emptyState: document.getElementById('moduleEmptyState'),
  emptyQuery: document.getElementById('moduleEmptyQuery'),
  sectionOffline: document.getElementById('sectionOffline'),
  sectionOnline: document.getElementById('sectionOnline'),
  sectionRecent: document.getElementById('sectionRecent'),
  gridRecent: document.getElementById('gridRecent'),
};

let isOnline = false;

// --------------------------------------------------------------
// Cek internet SUNGGUHAN, bukan cuma navigator.onLine.
// --------------------------------------------------------------
async function checkInternet(timeoutMs = 4000) {
  if (!navigator.onLine) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch('https://www.gstatic.com/generate_204', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch (err) {
    clearTimeout(timer);
    return false;
  }
}

function applyConnectivity(online) {
  isOnline = online;
  els.body.classList.toggle('mode-online', online);
  els.body.classList.toggle('mode-offline', !online);
  els.powerText.textContent = online ? 'DAYA TERSAMBUNG' : 'MODE OFFLINE';

  document.querySelectorAll('.socket.tier-online').forEach(el => {
    el.classList.toggle('powered', online);
  });
  document.querySelectorAll('.module-card[data-tier="online"]').forEach(el => {
    el.classList.toggle('locked', !online);
  });
}

async function refreshConnectivity() {
  const online = await checkInternet();
  applyConnectivity(online);
}

// ================= RENDER =================

function renderSocketRail() {
  els.socketRail.innerHTML = MODULES.map(m => `
    <span class="socket tier-${m.tier}">
      <span class="led"></span>${m.name}
    </span>
  `).join('');
}

function moduleCard(m, i) {
  const active = m.status === 'active';
  const statusClass = active ? 'active' : 'planned';
  const statusLabel = active ? 'aktif — klik untuk buka' : 'segera dibangun';
  const tag = active ? 'a' : 'div';
  const hrefAttr = active ? `href="${m.route}"` : '';
  const lockedClass = !active && m.tier === 'online' ? 'locked' : '';
  const searchKey = `${m.name} ${m.desc}`.toLowerCase();

  return `
    <${tag} class="module-card ${lockedClass}" data-tier="${m.tier}" data-search="${searchKey}"
      style="--i:${i}" ${hrefAttr}>
      <div class="module-card-top">
        <h3>${m.name}</h3>
      </div>
      <p class="module-desc">${m.desc}</p>
      <span class="module-status ${statusClass}">${statusLabel}</span>
    </${tag}>
  `;
}

// --------------------------------------------------------------
// "Terakhir Dipakai": baca jejak kunjungan dari localStorage
// (ditulis oleh js/recent.js di tiap halaman tool), cocokkan
// dengan MODULES, tampilkan sebagai akses cepat di atas.
// --------------------------------------------------------------
function renderRecent() {
  if (!els.sectionRecent || !els.gridRecent) return;
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem('toolkitapp_recent_v1') || '[]');
  } catch (e) { entries = []; }
  if (!Array.isArray(entries) || entries.length === 0) return;

  const cards = entries
    .map((entry) => MODULES.find((m) => m.route === entry.route))
    .filter((m) => m && m.status === 'active')
    .slice(0, 4);

  if (cards.length === 0) return;

  els.gridRecent.innerHTML = cards.map((m, i) => `
    <a href="${m.route}" class="module-card module-card-recent" data-tier="${m.tier}" style="--i:${i}">
      <div class="module-card-top"><h3>${m.name}</h3></div>
      <p class="module-desc">${m.desc}</p>
      <span class="module-status active">aktif — klik untuk buka</span>
    </a>
  `).join('');
  els.sectionRecent.hidden = false;
}

function renderGrids() {
  const offline = MODULES.filter(m => m.tier === 'offline');
  const online = MODULES.filter(m => m.tier === 'online');
  els.gridOffline.innerHTML = offline.map((m, i) => moduleCard(m, i)).join('');
  els.gridOnline.innerHTML = online.map((m, i) => moduleCard(m, offline.length + i)).join('');
  applyModuleFilter();
}

// --------------------------------------------------------------
// Pencarian modul: filter kartu secara langsung tanpa reload,
// sembunyikan section kalau semua kartunya tidak cocok.
// --------------------------------------------------------------
function applyModuleFilter() {
  const q = (els.search?.value || '').trim().toLowerCase();
  let visibleCount = 0;

  if (els.sectionRecent) {
    const hasRecent = els.gridRecent && els.gridRecent.children.length > 0;
    els.sectionRecent.hidden = q ? true : !hasRecent;
  }

  [els.sectionOffline, els.sectionOnline].forEach((section) => {
    if (!section) return;
    const cards = section.querySelectorAll('.module-card');
    let sectionVisible = 0;
    cards.forEach((card) => {
      const match = !q || card.dataset.search.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) { sectionVisible++; visibleCount++; }
    });
    section.hidden = q ? sectionVisible === 0 : false;
  });

  if (els.emptyState) {
    els.emptyState.hidden = visibleCount > 0 || !q;
    if (els.emptyQuery) els.emptyQuery.textContent = els.search.value.trim();
  }
}

// Ambil status real tiap modul dari server (config.json)
async function loadFeatureStatus() {
  try {
    const res = await fetch('/api/features');
    const features = await res.json();
    MODULES.forEach((m) => {
      if (features[m.id]) m.status = features[m.id].status;
    });
  } catch (err) {
    console.warn('Gagal ambil status fitur dari server, pakai default.', err);
  }
  renderGrids();
  renderRecent();
}

// ================= INIT =================

function init() {
  renderSocketRail();
  loadFeatureStatus();
  refreshConnectivity();

  window.addEventListener('online', refreshConnectivity);
  window.addEventListener('offline', () => applyConnectivity(false));

  setInterval(refreshConnectivity, 20000);

  if (els.search) {
    els.search.addEventListener('input', applyModuleFilter);
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        els.search.focus();
      } else if (e.key === 'Escape' && document.activeElement === els.search) {
        els.search.value = '';
        applyModuleFilter();
        els.search.blur();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
