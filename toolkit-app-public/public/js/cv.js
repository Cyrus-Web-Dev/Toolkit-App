const statusLine = document.getElementById('statusLine');
function setStatus(text, type = '') {
  statusLine.textContent = text;
  statusLine.className = `status-line ${type}`;
}

const generateBtn = document.getElementById('cvGenerateBtn');
const downloadBtn = document.getElementById('cvDownloadBtn');
const previewEl = document.getElementById('cvPreview');

initOnlineGuard('offlineBanner', [generateBtn]);

let currentPersonal = null;
let currentData = null;

function renderPreview(personal, data) {
  const expHtml = (data.pengalaman || []).map((e) => `
    <div class="cv-item">
      <div class="cv-item-head"><strong>${e.posisi || ''}${e.perusahaan ? ' — ' + e.perusahaan : ''}</strong><span>${e.periode || ''}</span></div>
      <p>${e.deskripsi || ''}</p>
    </div>
  `).join('');

  const eduHtml = (data.pendidikan || []).map((ed) => `
    <div class="cv-item">
      <div class="cv-item-head"><strong>${ed.gelar || ''}${ed.institusi ? ' — ' + ed.institusi : ''}</strong><span>${ed.periode || ''}</span></div>
    </div>
  `).join('');

  previewEl.innerHTML = `
    <h3 class="cv-name">${personal.nama || ''}</h3>
    <p class="cv-contact">${[personal.email, personal.telepon, personal.alamat].filter(Boolean).join(' · ')}</p>
    ${data.ringkasan ? `<section><h4>Ringkasan</h4><p>${data.ringkasan}</p></section>` : ''}
    ${expHtml ? `<section><h4>Pengalaman Kerja</h4>${expHtml}</section>` : ''}
    ${eduHtml ? `<section><h4>Pendidikan</h4>${eduHtml}</section>` : ''}
    ${data.keahlian?.length ? `<section><h4>Keahlian</h4><p>${data.keahlian.join(' · ')}</p></section>` : ''}
    ${data.lainnya ? `<section><h4>Lainnya</h4><p>${data.lainnya}</p></section>` : ''}
  `;
}

document.getElementById('cvForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  generateBtn.disabled = true;
  generateBtn.textContent = 'Menyusun CV…';
  setStatus('Menghubungi Gemini…');
  previewEl.innerHTML = skeletonPreviewHtml();

  try {
    const personal = {
      nama: document.getElementById('cvNama').value.trim(),
      email: document.getElementById('cvEmail').value.trim(),
      telepon: document.getElementById('cvTelepon').value.trim(),
      alamat: document.getElementById('cvAlamat').value.trim(),
    };
    const payload = {
      nama: personal.nama,
      ringkasanKasar: document.getElementById('cvRingkasan').value.trim(),
      pendidikanKasar: document.getElementById('cvPendidikan').value.trim(),
      pengalamanKasar: document.getElementById('cvPengalaman').value.trim(),
      keahlianKasar: document.getElementById('cvKeahlian').value.trim(),
      sertifikasiKasar: document.getElementById('cvSertifikasi').value.trim(),
    };

    const res = await fetch('/api/ai/cv/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.message || 'Gagal menyusun CV.');

    currentPersonal = personal;
    currentData = result.data;
    renderPreview(currentPersonal, currentData);
    downloadBtn.disabled = false;
    setStatus('Selesai. Cek dulu hasilnya sebelum diunduh.', 'success');
  } catch (err) {
    previewEl.innerHTML = '<p class="tool-hint">Hasil dari AI akan muncul di sini…</p>';
    setStatus(err.message, 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Susun CV dengan AI';
  }
});

downloadBtn.addEventListener('click', async () => {
  if (!currentPersonal || !currentData) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Menyiapkan PDF…';
  try {
    const res = await fetch('/api/ai/cv/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personal: currentPersonal, data: currentData }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Gagal membuat PDF.' }));
      throw new Error(err.message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cv.pdf';
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
