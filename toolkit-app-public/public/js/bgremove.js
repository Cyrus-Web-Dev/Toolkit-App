const CONCURRENCY = 2; // batasi proses paralel — model AI berat di CPU/RAM

let items = []; // {id, file, status, resultBlob, resultBytes, error}
let nextId = 1;

const els = {
  dropzone: document.getElementById('bgDropzone'),
  input: document.getElementById('bgFiles'),
  grid: document.getElementById('bgGrid'),
  processBtn: document.getElementById('bgProcessBtn'),
  downloadAllBtn: document.getElementById('bgDownloadAllBtn'),
  summary: document.getElementById('bgSummary'),
  statusLine: document.getElementById('statusLine'),
};

function setStatus(text, type = '') {
  els.statusLine.textContent = text;
  els.statusLine.className = `status-line ${type}`;
}

// ================= FILE SELECT =================

els.dropzone.addEventListener('click', () => els.input.click());
els.input.addEventListener('change', () => {
  addFiles(Array.from(els.input.files));
  els.input.value = '';
});
['dragover', 'dragleave', 'drop'].forEach((evt) => {
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    els.dropzone.classList.toggle('dragover', evt === 'dragover');
  });
});
els.dropzone.addEventListener('drop', (e) => addFiles(Array.from(e.dataTransfer.files)));

function addFiles(files) {
  const valid = files.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
  if (valid.length < files.length) {
    setStatus(`${files.length - valid.length} file dilewati karena bukan JPG/PNG/WEBP.`, 'error');
  }
  valid.forEach((file) => {
    items.push({ id: nextId++, file, status: 'pending', resultBlob: null, resultBytes: null, error: null });
  });
  renderGrid();
  updateActionState();
}

// ================= RENDER =================

function renderGrid() {
  // pastikan setiap item punya URL preview sebelum di-render
  items.forEach((it) => {
    if (!it.previewUrl) it.previewUrl = URL.createObjectURL(it.file);
  });

  els.grid.innerHTML = items.map((it) => `
    <div class="bg-card" data-id="${it.id}">
      <div class="bg-thumb-wrap">
        <img src="${it.resultUrl || it.previewUrl}" alt="${it.file.name}">
      </div>
      <div class="bg-card-info">
        <span class="bg-filename">${it.file.name}</span>
        <span class="bg-status ${it.status}">${statusLabel(it)}</span>
        ${it.resultUrl ? `<a class="bg-download-link" href="${it.resultUrl}" download="${outputName(it.file.name)}">Unduh PNG</a>` : ''}
      </div>
    </div>
  `).join('');
}

function statusLabel(it) {
  switch (it.status) {
    case 'pending': return 'menunggu';
    case 'processing': return 'memproses…';
    case 'done': return 'selesai';
    case 'error': return `gagal — ${it.error}`;
    default: return '';
  }
}

function outputName(originalName) {
  return originalName.replace(/\.[^.]+$/, '') + '-nobg.png';
}

function updateActionState() {
  els.processBtn.disabled = items.length === 0 || items.every((it) => it.status !== 'pending');
  const doneCount = items.filter((it) => it.status === 'done').length;
  els.downloadAllBtn.disabled = doneCount === 0;
  const errCount = items.filter((it) => it.status === 'error').length;
  els.summary.textContent = items.length
    ? `${items.length} foto · ${doneCount} selesai${errCount ? ` · ${errCount} gagal` : ''}`
    : '';
}

// ================= PROSES =================

async function processOne(it) {
  it.status = 'processing';
  updateCardStatus(it);
  try {
    const fd = new FormData();
    fd.append('file', it.file);
    const modeEl = document.getElementById('bgMode');
    const colorEl = document.getElementById('bgColor');
    const mode = modeEl ? modeEl.value : 'transparent';
    fd.append('mode', mode);
    if (mode === 'color' && colorEl) fd.append('color', colorEl.value);
    const res = await fetch('/api/bg-remove/single', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Gagal memproses.' }));
      throw new Error(err.message || 'Gagal memproses.');
    }
    const blob = await res.blob();
    it.resultBytes = new Uint8Array(await blob.arrayBuffer());
    it.resultUrl = URL.createObjectURL(blob);
    it.status = 'done';
  } catch (err) {
    it.status = 'error';
    it.error = err.message;
  }
  updateCardStatus(it);
  updateActionState();
}

function updateCardStatus(it) {
  const card = els.grid.querySelector(`.bg-card[data-id="${it.id}"]`);
  if (!card) return;
  const statusEl = card.querySelector('.bg-status');
  statusEl.className = `bg-status ${it.status}`;
  statusEl.textContent = statusLabel(it);
  if (it.resultUrl) {
    card.querySelector('img').src = it.resultUrl;
    let link = card.querySelector('.bg-download-link');
    if (!link) {
      link = document.createElement('a');
      link.className = 'bg-download-link';
      card.querySelector('.bg-card-info').appendChild(link);
    }
    link.href = it.resultUrl;
    link.download = outputName(it.file.name);
    link.textContent = 'Unduh PNG';
  }
}

async function processAll() {
  const queue = items.filter((it) => it.status === 'pending');
  if (!queue.length) return;

  els.processBtn.disabled = true;
  setStatus(`Memproses ${queue.length} foto…`);

  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const it = queue[idx++];
      await processOne(it);
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker);
  await Promise.all(workers);

  const errCount = items.filter((it) => it.status === 'error').length;
  setStatus(errCount ? `Selesai dengan ${errCount} foto gagal.` : 'Semua foto selesai diproses.', errCount ? 'error' : 'success');
  updateActionState();
}

els.processBtn.addEventListener('click', async () => {
  let progressToast = null;
  if (window.toast) {
    progressToast = toast.progress('Sedang diproses', 'Permintaan hapus background sedang dijalankan…');
  }
  await processAll();
  if (progressToast) progressToast.close();
  const done = items.filter((i) => i.status === 'done').length;
  const err = items.filter((i) => i.status === 'error').length;
  if (window.toast) {
    if (done && !err) toast.success('Berhasil', 'Permintaan Anda berhasil — ' + done + ' foto diproses.');
    else if (done && err) toast.info('Selesai sebagian', done + ' berhasil, ' + err + ' gagal. Lihat status per foto.');
    else if (err) toast.error('Gagal', 'Permintaan Anda gagal. Cek: internet (model pertama kali), format JPG/PNG/WEBP, dan npm install @imgly/background-removal-node.');
  }
});

// ================= UNDUH SEMUA =================

els.downloadAllBtn.addEventListener('click', () => {
  const done = items.filter((it) => it.status === 'done' && it.resultBytes);
  if (!done.length) return;
  const zipFiles = done.map((it) => ({ name: outputName(it.file.name), data: it.resultBytes }));
  const zipBlob = createZip(zipFiles);
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hasil-hapus-background.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Toggle color picker
const bgModeEl = document.getElementById("bgMode");
const bgColorLabel = document.getElementById("bgColorLabel");
if (bgModeEl && bgColorLabel) {
  bgModeEl.addEventListener("change", () => {
    bgColorLabel.style.display = bgModeEl.value === "color" ? "" : "none";
  });
}

