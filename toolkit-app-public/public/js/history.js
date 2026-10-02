const listEl = document.getElementById('historyList');
const statusLine = document.getElementById('statusLine');
const btnRefresh = document.getElementById('btnRefresh');
const btnClearAll = document.getElementById('btnClearAll');

const MODULE_LABELS = {
  pdfTools: 'PDF',
  bgRemoveBatch: 'Background',
  fileConvert: 'Konversi',
  coverLetterAI: 'Surat Lamaran',
  cvBuilderAI: 'CV',
  resumeAI: 'Resume ATS',
  portfolioAI: 'Portofolio',
  mediaDownloader: 'Downloader',
  aiChat: 'Chat',
  
  ocrTool: 'OCR',
  imageBatch: 'Kompres Gambar',
  qrTool: 'QR',
  aiSolver: 'Soal',
  pdfSummarizer: 'Rangkum PDF',
  quizGen: 'Kuis',
  aiDetect: 'Deteksi AI',
  pdfToJpg: 'PDF→JPG',
  officeToPdf: 'Office→PDF',
  officeAI: 'Office AI',

};

function setStatus(text, type = '') {
  statusLine.textContent = text || '';
  statusLine.className = `status-line ${type}`;
}

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

function remainingMin(expiresAt) {
  const left = Math.max(0, expiresAt - Date.now());
  return Math.ceil(left / 60000);
}

async function loadHistory() {
  listEl.innerHTML = '<div class="history-empty">Memuat…</div>';
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'Gagal memuat riwayat.');

    const items = data.items || [];
    if (items.length === 0) {
      listEl.innerHTML = '<div class="history-empty">Belum ada riwayat operasi.<br>Lakukan sesuatu di modul mana pun, lalu kembali ke sini.</div>';
      setStatus('Kosong.');
      return;
    }

    listEl.innerHTML = items.map((item) => {
      const mod = MODULE_LABELS[item.module] || item.module;
      const left = remainingMin(item.expiresAt);
      return `
        <div class="history-item" data-id="${item.id}">
          <div class="history-item-main">
            <p class="history-item-label">
              <span class="module-badge">${mod}</span>
              ${escapeHtml(item.label)}
            </p>
            <div class="history-item-sub">${escapeHtml(item.action)}</div>
            <div class="history-item-time">${formatTime(item.timestamp)} · hapus otomatis ~${left} mnt</div>
          </div>
          <button type="button" class="btn-danger-ghost btn-del" data-id="${item.id}">Hapus</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteOne(btn.dataset.id));
    });

    setStatus(`${items.length} entri · auto-hapus setelah 30 menit`, 'success');
  } catch (err) {
    listEl.innerHTML = `<div class="history-empty">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    setStatus(err.message, 'error');
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function deleteOne(id) {
  try {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.message || 'Gagal menghapus.');
    setStatus('Entri dihapus.', 'success');
    loadHistory();
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

btnRefresh.addEventListener('click', loadHistory);

btnClearAll.addEventListener('click', async () => {
  if (!confirm('Hapus SELURUH riwayat operasi?')) return;
  try {
    const res = await fetch('/api/history', { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.message || 'Gagal menghapus semua.');
    setStatus('Semua riwayat dihapus.', 'success');
    loadHistory();
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

document.addEventListener('DOMContentLoaded', loadHistory);
// Auto-refresh tiap 60 detik supaya sisa waktu tetap akurat
setInterval(loadHistory, 60000);
