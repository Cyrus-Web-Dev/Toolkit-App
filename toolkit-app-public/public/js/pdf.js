// ============================================================
// State file per alat. Disimpan terpisah supaya pindah tab
// tidak menghapus file yang sudah dipilih di tab lain.
// ============================================================
const fileState = {
  merge: [], split: [], 'remove-pages': [], 'extract-pages': [], rotate: [],
  reorder: [], watermark: [], 'page-numbers': [], crop: [], 'images-to-pdf': [], compress: [],
};

const statusLine = document.getElementById('statusLine');

function setStatus(text, type = '') {
  statusLine.textContent = text;
  statusLine.className = `status-line ${type}`;
}

// ================= TAB SWITCHING =================

document.querySelectorAll('.tool-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tool-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tool-view').forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.tool-view[data-view="${tab.dataset.tool}"]`).classList.add('active');
    setStatus('');
  });
});

// ================= DROPZONE + FILE LIST (generik) =================

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFileList(listEl, key, multiple) {
  listEl.innerHTML = fileState[key].map((f, i) => `
    <li>
      <span>${f.name} <span style="color:var(--text-dim)">(${fmtSize(f.size)})</span></span>
      <button type="button" class="file-remove" data-key="${key}" data-idx="${i}">✕</button>
    </li>
  `).join('');

  listEl.querySelectorAll('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      fileState[key].splice(parseInt(btn.dataset.idx, 10), 1);
      renderFileList(listEl, key, multiple);
      if (key === 'split') renderRangeBuilder(); // rentang halaman butuh tahu ada file atau tidak
    });
  });
}

function setupDropzone(dropzoneEl, inputEl, key, listEl, multiple) {
  dropzoneEl.addEventListener('click', () => inputEl.click());

  inputEl.addEventListener('change', () => {
    addFiles(Array.from(inputEl.files), key, listEl, multiple);
    inputEl.value = '';
  });

  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropzoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzoneEl.classList.toggle('dragover', evt === 'dragover');
    });
  });

  dropzoneEl.addEventListener('drop', (e) => {
    addFiles(Array.from(e.dataTransfer.files), key, listEl, multiple);
  });
}

function addFiles(newFiles, key, listEl, multiple) {
  if (multiple) {
    fileState[key].push(...newFiles);
  } else {
    fileState[key] = newFiles.slice(0, 1);
  }
  renderFileList(listEl, key, multiple);
  if (key === 'split') renderRangeBuilder();
}

// Pasang dropzone untuk semua tab
const dropzoneConfig = [
  ['mergeFiles', 'merge', 'mergeFileList', true],
  ['splitFile', 'split', 'splitFileList', false],
  ['removeFile', 'remove-pages', 'removeFileList', false],
  ['extractFile', 'extract-pages', 'extractFileList', false],
  ['rotateFile', 'rotate', 'rotateFileList', false],
  ['reorderFile', 'reorder', 'reorderFileList', false],
  ['watermarkFile', 'watermark', 'watermarkFileList', false],
  ['pageNumFile', 'page-numbers', 'pageNumFileList', false],
  ['cropFile', 'crop', 'cropFileList', false],
  ['imgFiles', 'images-to-pdf', 'imgFileList', true],
  ['compressFile', 'compress', 'compressFileList', false],
];

dropzoneConfig.forEach(([inputId, key, listId, multiple]) => {
  const inputEl = document.getElementById(inputId);
  const listEl = document.getElementById(listId);
  const dropzoneEl = document.querySelector(`.dropzone[data-input="${inputId}"]`);
  setupDropzone(dropzoneEl, inputEl, key, listEl, multiple);
});

// ================= SPLIT: range builder =================

let splitRangeRows = [{ from: '', to: '' }];

function renderRangeBuilder() {
  const el = document.getElementById('splitRanges');
  el.innerHTML = splitRangeRows.map((r, i) => `
    <div class="range-row">
      <span>Bagian ${i + 1}:</span>
      <input type="number" min="1" placeholder="dari" value="${r.from}" data-idx="${i}" data-field="from">
      <span>sampai</span>
      <input type="number" min="1" placeholder="ke" value="${r.to}" data-idx="${i}" data-field="to">
      ${splitRangeRows.length > 1 ? `<button type="button" class="file-remove" data-remove="${i}">✕</button>` : ''}
    </div>
  `).join('');

  el.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', () => {
      splitRangeRows[parseInt(inp.dataset.idx, 10)][inp.dataset.field] = inp.value;
    });
  });
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      splitRangeRows.splice(parseInt(btn.dataset.remove, 10), 1);
      renderRangeBuilder();
    });
  });
}
document.getElementById('splitAddRange').addEventListener('click', () => {
  splitRangeRows.push({ from: '', to: '' });
  renderRangeBuilder();
});
renderRangeBuilder();

// ================= SUBMIT HELPERS =================

function parsePageList(str) {
  return str.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
}

async function downloadFromResponse(res, fallbackName) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Terjadi kesalahan.' }));
    throw new Error(err.message || 'Terjadi kesalahan.');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="(.+?)"/);
  const filename = match ? match[1] : fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function runTool(btn, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Memproses…';
  setStatus('Memproses file…');
  const progress = window.toast ? toast.progress('Sedang diproses', 'Permintaan Anda sedang dijalankan…') : null;
  try {
    await fn();
    if (progress) progress.close();
    setStatus('Selesai — file berhasil diunduh.', 'success');
    if (window.toast) toast.success('Berhasil', 'Permintaan Anda berhasil — file siap diunduh.');
  } catch (err) {
    if (progress) progress.close();
    setStatus(err.message || 'Terjadi kesalahan.', 'error');
    if (window.toast) toast.error('Gagal', err.message || 'Permintaan Anda gagal.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ================= SUBMIT HANDLERS =================

document.getElementById('mergeSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (fileState.merge.length < 2) throw new Error('Pilih minimal 2 file PDF.');
    const fd = new FormData();
    fileState.merge.forEach((f) => fd.append('files', f));
    const res = await fetch('/api/pdf/merge', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'gabungan.pdf');
  });
});

document.getElementById('splitSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.split.length) throw new Error('Pilih file PDF.');
    const ranges = splitRangeRows
      .filter((r) => r.from && r.to)
      .map((r) => ({ from: Number(r.from), to: Number(r.to) }));
    if (!ranges.length) throw new Error('Isi minimal satu rentang halaman.');
    const fd = new FormData();
    fd.append('file', fileState.split[0]);
    fd.append('ranges', JSON.stringify(ranges));
    const res = await fetch('/api/pdf/split', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'hasil-split.zip');
  });
});

document.getElementById('removeSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState['remove-pages'].length) throw new Error('Pilih file PDF.');
    const pages = parsePageList(document.getElementById('removePagesInput').value);
    if (!pages.length) throw new Error('Isi nomor halaman yang mau dihapus.');
    const fd = new FormData();
    fd.append('file', fileState['remove-pages'][0]);
    fd.append('pages', JSON.stringify(pages));
    const res = await fetch('/api/pdf/remove-pages', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'terpotong.pdf');
  });
});

document.getElementById('rotateSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.rotate.length) throw new Error('Pilih file PDF.');
    const angle = document.getElementById('rotateAngle').value;
    const pagesRaw = document.getElementById('rotatePagesInput').value;
    const fd = new FormData();
    fd.append('file', fileState.rotate[0]);
    fd.append('angle', angle);
    if (pagesRaw.trim()) fd.append('pages', JSON.stringify(parsePageList(pagesRaw)));
    const res = await fetch('/api/pdf/rotate', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'terputar.pdf');
  });
});

document.getElementById('reorderSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.reorder.length) throw new Error('Pilih file PDF.');
    const order = parsePageList(document.getElementById('reorderInput').value);
    if (!order.length) throw new Error('Isi urutan halaman baru.');
    const fd = new FormData();
    fd.append('file', fileState.reorder[0]);
    fd.append('order', JSON.stringify(order));
    const res = await fetch('/api/pdf/reorder', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'tersusun-ulang.pdf');
  });
});

document.getElementById('watermarkSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.watermark.length) throw new Error('Pilih file PDF.');
    const text = document.getElementById('watermarkText').value.trim();
    if (!text) throw new Error('Isi teks watermark.');
    const fd = new FormData();
    fd.append('file', fileState.watermark[0]);
    fd.append('text', text);
    const res = await fetch('/api/pdf/watermark', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'watermark.pdf');
  });
});

document.getElementById('imgSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState['images-to-pdf'].length) throw new Error('Pilih minimal satu gambar.');
    const fd = new FormData();
    fileState['images-to-pdf'].forEach((f) => fd.append('files', f));
    const res = await fetch('/api/pdf/images-to-pdf', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'dari-gambar.pdf');
  });
});

document.getElementById('compressSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.compress.length) throw new Error('Pilih file PDF.');
    const fd = new FormData();
    fd.append('file', fileState.compress[0]);
    const res = await fetch('/api/pdf/compress', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'terkompresi.pdf');
  });
});

document.getElementById('extractSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState['extract-pages'].length) throw new Error('Pilih file PDF.');
    const pages = parsePageList(document.getElementById('extractPagesInput').value);
    if (!pages.length) throw new Error('Isi nomor halaman yang mau diekstrak.');
    const fd = new FormData();
    fd.append('file', fileState['extract-pages'][0]);
    fd.append('pages', JSON.stringify(pages));
    const res = await fetch('/api/pdf/extract-pages', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'ekstrak-halaman.pdf');
  });
});

document.getElementById('pageNumSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState['page-numbers'].length) throw new Error('Pilih file PDF.');
    const fd = new FormData();
    fd.append('file', fileState['page-numbers'][0]);
    fd.append('position', document.getElementById('pageNumPos').value);
    fd.append('start', document.getElementById('pageNumStart').value || '1');
    fd.append('format', document.getElementById('pageNumFormat').value || '{n}');
    const res = await fetch('/api/pdf/page-numbers', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'nomor-halaman.pdf');
  });
});

document.getElementById('cropSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.crop.length) throw new Error('Pilih file PDF.');
    const fd = new FormData();
    fd.append('file', fileState.crop[0]);
    fd.append('top', document.getElementById('cropTop').value || '0');
    fd.append('bottom', document.getElementById('cropBottom').value || '0');
    fd.append('left', document.getElementById('cropLeft').value || '0');
    fd.append('right', document.getElementById('cropRight').value || '0');
    const res = await fetch('/api/pdf/crop', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'terpotong-crop.pdf');
  });
});
