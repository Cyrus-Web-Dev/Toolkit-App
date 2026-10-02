const statusLine = document.getElementById('statusLine');
const form = document.getElementById('officeForm');
const btn = document.getElementById('officeBtn');
const typeEl = document.getElementById('officeType');
const promptEl = document.getElementById('officePrompt');

function setStatus(text, type = '') {
  statusLine.textContent = text || '';
  statusLine.className = `status-line ${type}`;
}

initOnlineGuard('offlineBanner', [btn]);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  const type = typeEl.value;
  btn.disabled = true;
  btn.textContent = 'AI sedang menulis…';
  setStatus('Menghubungi Gemini dan menyusun file…');

  try {
    const res = await fetch('/api/ai/office/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, prompt }),
    });

    if (!res.ok) {
      let message = 'Gagal membuat dokumen.';
      try {
        const err = await res.json();
        if (err.message) message = err.message;
      } catch { /* ignore */ }
      throw new Error(message);
    }

    const blob = await res.blob();
    let filename = type === 'word' ? 'dokumen.docx' : type === 'excel' ? 'spreadsheet.xlsx' : 'presentasi.pptx';
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="?([^"]+)"?/i);
    if (match) filename = match[1];
    else {
      const xname = res.headers.get('X-Filename');
      if (xname) filename = decodeURIComponent(xname);
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus(`Berhasil: ${filename}`, 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buatkan dengan AI & Unduh';
  }
});
