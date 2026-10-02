const statusLine = document.getElementById('statusLine');
function setStatus(text, type = '') {
  statusLine.textContent = text;
  statusLine.className = `status-line ${type}`;
}

const generateBtn = document.getElementById('resGenerateBtn');
const downloadBtn = document.getElementById('resDownloadBtn');
const previewEl = document.getElementById('resPreview');

initOnlineGuard('offlineBanner', [generateBtn]);

let currentPersonal = null;
let currentData = null;

function scoreColor(score) {
  if (score >= 75) return 'var(--teal)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--danger)';
}

function renderPreview(personal, data) {
  const expHtml = (data.pengalaman || []).map((e) => {
    const bullets = Array.isArray(e.bullet) ? e.bullet : (e.bullet ? [e.bullet] : []);
    return `
    <div class="cv-item">
      <div class="cv-item-head"><strong>${e.posisi || ''}${e.perusahaan ? ' — ' + e.perusahaan : ''}</strong><span>${e.periode || ''}</span></div>
      ${bullets.length ? `<ul class="bullet-list">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('');

  const eduHtml = (data.pendidikan || []).map((ed) => `
    <div class="cv-item">
      <div class="cv-item-head"><strong>${ed.gelar || ''}${ed.institusi ? ' — ' + ed.institusi : ''}</strong><span>${ed.periode || ''}</span></div>
    </div>
  `).join('');

  const score = Number.isFinite(data.skorKecocokan) ? Math.max(0, Math.min(100, Math.round(data.skorKecocokan))) : null;
  const scoreHtml = score !== null ? `
    <div class="ats-score-row" style="--score-color:${scoreColor(score)}">
      <div class="ats-score-ring" style="--pct:${score}; --score-color:${scoreColor(score)}"><span>${score}</span></div>
      <div class="ats-score-text"><strong>Skor kecocokan ATS: ${score}/100</strong><br>${data.catatanKecocokan || ''}</div>
    </div>` : '';

  const keywordsHtml = data.kataKunciATS?.length
    ? `<div class="ats-keywords">${data.kataKunciATS.map((k) => `<span>${k}</span>`).join('')}</div>` : '';

  previewEl.innerHTML = `
    <h3 class="cv-name">${personal.nama || ''}</h3>
    ${data.posisiTarget ? `<p class="cv-contact" style="color:var(--amber);font-weight:600;margin-top:-8px">${data.posisiTarget}</p>` : ''}
    <p class="cv-contact">${[personal.email, personal.telepon].filter(Boolean).join(' · ')}</p>
    ${scoreHtml}
    ${data.ringkasan ? `<section><h4>Ringkasan Profil</h4><p>${data.ringkasan}</p></section>` : ''}
    ${keywordsHtml ? `<section><h4>Kata Kunci ATS</h4>${keywordsHtml}</section>` : ''}
    ${expHtml ? `<section><h4>Pengalaman Kerja</h4>${expHtml}</section>` : ''}
    ${eduHtml ? `<section><h4>Pendidikan</h4>${eduHtml}</section>` : ''}
    ${data.keahlian?.length ? `<section><h4>Keahlian</h4><p>${data.keahlian.join(' · ')}</p></section>` : ''}
  `;
}

document.getElementById('resumeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  generateBtn.disabled = true;
  generateBtn.textContent = 'Menyusun Resume…';
  setStatus('Menghubungi Gemini…');
  previewEl.innerHTML = skeletonPreviewHtml();

  try {
    const personal = {
      nama: document.getElementById('resNama').value.trim(),
      email: document.getElementById('resEmail').value.trim(),
      telepon: document.getElementById('resTelepon').value.trim(),
    };
    const payload = {
      nama: personal.nama,
      posisiTarget: document.getElementById('resPosisi').value.trim(),
      deskripsiLowongan: document.getElementById('resLowongan').value.trim(),
      ringkasanKasar: document.getElementById('resRingkasan').value.trim(),
      pendidikanKasar: document.getElementById('resPendidikan').value.trim(),
      pengalamanKasar: document.getElementById('resPengalaman').value.trim(),
      keahlianKasar: document.getElementById('resKeahlian').value.trim(),
    };

    const res = await fetch('/api/ai/resume/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.message || 'Gagal menyusun resume.');

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
    generateBtn.textContent = 'Susun Resume dengan AI';
  }
});

downloadBtn.addEventListener('click', async () => {
  if (!currentPersonal || !currentData) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Menyiapkan PDF…';
  try {
    const res = await fetch('/api/ai/resume/pdf', {
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
    a.href = url; a.download = 'resume.pdf';
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
