const statusLine = document.getElementById('statusLine');
function setStatus(text, type = '') {
  statusLine.textContent = text;
  statusLine.className = `status-line ${type}`;
}

const generateBtn = document.getElementById('clGenerateBtn');
const downloadBtn = document.getElementById('clDownloadBtn');
const resultEl = document.getElementById('clResult');

initOnlineGuard('offlineBanner', [generateBtn]);

document.getElementById('clForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  generateBtn.disabled = true;
  generateBtn.textContent = 'Meminta AI menulis…';
  setStatus('Menghubungi Gemini…');
  const _prog = window.toast ? toast.progress('Sedang diproses', 'Permintaan Anda sedang dijalankan…') : null;

  try {
    const payload = {
      nama: document.getElementById('clNama').value.trim(),
      email: document.getElementById('clEmail').value.trim(),
      telepon: document.getElementById('clTelepon').value.trim(),
      posisi: document.getElementById('clPosisi').value.trim(),
      perusahaan: document.getElementById('clPerusahaan').value.trim(),
      pengalaman: document.getElementById('clPengalaman').value.trim(),
      keahlian: document.getElementById('clKeahlian').value.trim(),
      tone: document.getElementById('clTone').value,
    };

    const res = await fetch('/api/ai/cover-letter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'Gagal membuat surat.');

    resultEl.value = data.text;
    downloadBtn.disabled = false;
    if (_prog) _prog.close();
    setStatus('Selesai. Cek dan edit dulu hasilnya sebelum diunduh.', 'success');
    if (window.toast) toast.success('Berhasil', 'Permintaan Anda berhasil.');
  } catch (err) {
    if (typeof _prog !== 'undefined' && _prog) _prog.close();
    setStatus(err.message, 'error');
    if (window.toast) toast.error('Gagal', err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Buatkan Surat dengan AI';
  }
});

downloadBtn.addEventListener('click', async () => {
  const text = resultEl.value.trim();
  if (!text) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Menyiapkan PDF…';
  try {
    const res = await fetch('/api/ai/cover-letter/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Gagal membuat PDF.' }));
      throw new Error(err.message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'surat-lamaran.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setStatus('PDF berhasil diunduh.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Unduh sebagai PDF';
  }
});
