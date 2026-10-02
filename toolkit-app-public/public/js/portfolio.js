const statusLine = document.getElementById('statusLine');
function setStatus(text, type = '') {
  statusLine.textContent = text;
  statusLine.className = `status-line ${type}`;
}

const generateBtn = document.getElementById('pfGenerateBtn');
const downloadBtn = document.getElementById('pfDownloadBtn');
const previewFrame = document.getElementById('pfPreviewFrame');
const accentPicker = document.getElementById('pfAccentPicker');

initOnlineGuard('offlineBanner', [generateBtn]);

let currentNama = null;
let currentData = null;
let currentKontak = null;
let currentAccent = { a1: '#6d5efc', a2: '#22d3c5' };

accentPicker.addEventListener('click', (e) => {
  const swatch = e.target.closest('.pf-accent-swatch');
  if (!swatch) return;
  accentPicker.querySelectorAll('.pf-accent-swatch').forEach((s) => s.classList.remove('active'));
  swatch.classList.add('active');
  currentAccent = { a1: swatch.dataset.a1, a2: swatch.dataset.a2 };
  if (currentData) renderLivePreview();
});

async function renderLivePreview() {
  try {
    const res = await fetch('/api/ai/portfolio/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: currentNama, data: currentData, kontak: currentKontak, accent: currentAccent }),
    });
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.message || 'Gagal merender preview.');
    previewFrame.srcdoc = result.html;
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

function skeletonIframeDoc() {
  return `<!DOCTYPE html><html><head><style>
    body{margin:0;background:#0b0c10;padding:28px;font-family:sans-serif}
    .s{border-radius:6px;background:linear-gradient(90deg,#1a1d24 25%,#262a33 50%,#1a1d24 75%);
       background-size:200% 100%;animation:sh 1.4s ease-in-out infinite;margin-bottom:12px}
    @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
  </style></head><body>
    <div class="s" style="height:34px;width:55%"></div>
    <div class="s" style="height:14px;width:75%;margin-top:20px"></div>
    <div class="s" style="height:80px;width:100%;margin-top:24px"></div>
    <div class="s" style="height:80px;width:100%"></div>
  </body></html>`;
}

document.getElementById('pfForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  generateBtn.disabled = true;
  generateBtn.textContent = 'Menyusun Portofolio…';
  setStatus('Menghubungi Gemini…');
  previewFrame.srcdoc = skeletonIframeDoc();

  try {
    currentNama = document.getElementById('pfNama').value.trim();
    currentKontak = {
      email: document.getElementById('pfEmail').value.trim(),
      website: document.getElementById('pfWebsite').value.trim(),
      linkedin: document.getElementById('pfLinkedin').value.trim(),
      github: document.getElementById('pfGithub').value.trim(),
    };
    const payload = {
      nama: currentNama,
      profesiKasar: document.getElementById('pfProfesi').value.trim(),
      tentangKasar: document.getElementById('pfTentang').value.trim(),
      proyekKasar: document.getElementById('pfProyek').value.trim(),
      keahlianKasar: document.getElementById('pfKeahlian').value.trim(),
    };

    const res = await fetch('/api/ai/portfolio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.message || 'Gagal menyusun portofolio.');

    currentData = result.data;
    await renderLivePreview();
    downloadBtn.disabled = false;
    setStatus('Selesai. Cek dulu preview-nya sebelum diunduh.', 'success');
  } catch (err) {
    previewFrame.srcdoc = '';
    setStatus(err.message, 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Susun Portofolio dengan AI';
  }
});

downloadBtn.addEventListener('click', async () => {
  if (!currentData) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Menyiapkan file…';
  try {
    const res = await fetch('/api/ai/portfolio/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: currentNama, data: currentData, kontak: currentKontak, accent: currentAccent, download: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Gagal membuat file.' }));
      throw new Error(err.message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'portofolio.html';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setStatus('Website portofolio berhasil diunduh.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Unduh Website (.html)';
  }
});
