const fileState = { image: [], audio: [], video: [], 'video-to-audio': [], 'csv-json': [] };
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

// ================= DROPZONE + FILE LIST (satu file per alat) =================

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFileList(listEl, key) {
  listEl.innerHTML = fileState[key].map((f, i) => `
    <li>
      <span>${f.name} <span style="color:var(--text-dim)">(${fmtSize(f.size)})</span></span>
      <button type="button" class="file-remove" data-key="${key}" data-idx="${i}">✕</button>
    </li>
  `).join('');
  listEl.querySelectorAll('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      fileState[key].splice(parseInt(btn.dataset.idx, 10), 1);
      renderFileList(listEl, key);
    });
  });
}

function setupDropzone(dropzoneEl, inputEl, key, listEl) {
  dropzoneEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) { fileState[key] = [inputEl.files[0]]; renderFileList(listEl, key); }
    inputEl.value = '';
  });
  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropzoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzoneEl.classList.toggle('dragover', evt === 'dragover');
    });
  });
  dropzoneEl.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) {
      fileState[key] = [e.dataTransfer.files[0]];
      renderFileList(listEl, key);
    }
  });
}

const dropzoneConfig = [
  ['imageFile', 'image', 'imageFileList'],
  ['audioFile', 'audio', 'audioFileList'],
  ['videoFile', 'video', 'videoFileList'],
  ['v2aFile', 'video-to-audio', 'v2aFileList'],
  ['csvJsonFile', 'csv-json', 'csvJsonFileList'],
];
dropzoneConfig.forEach(([inputId, key, listId]) => {
  const inputEl = document.getElementById(inputId);
  const listEl = document.getElementById(listId);
  const dropzoneEl = document.querySelector(`.dropzone[data-input="${inputId}"]`);
  setupDropzone(dropzoneEl, inputEl, key, listEl);
});

// ================= SUBMIT HELPERS =================

async function downloadFromResponse(res, fallbackName) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Terjadi kesalahan.' }));
    throw new Error(err.message || 'Terjadi kesalahan.');
  }
  if (window.DownloadProgress) DownloadProgress.indeterminate('Menyiapkan file hasil…');
  const total = Number(res.headers.get('Content-Length') || 0);
  let blob;
  if (res.body && total && window.DownloadProgress) {
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      DownloadProgress.set((received / total) * 100, `Mengunduh hasil… ${Math.round((received / total) * 100)}%`);
    }
    blob = new Blob(chunks);
  } else {
    blob = await res.blob();
    if (window.DownloadProgress) DownloadProgress.set(100, 'Selesai');
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="(.+?)"/);
  const filename = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  if (window.DownloadProgress) setTimeout(() => DownloadProgress.hide(), 600);
}

async function runTool(btn, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Memproses…';
  setStatus('Memproses file… (audio/video besar bisa makan waktu lebih lama)');
  if (window.DownloadProgress) DownloadProgress.indeterminate('Memproses di server…');
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
    if (window.DownloadProgress) DownloadProgress.hide();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ================= SUBMIT HANDLERS =================

document.getElementById('imageSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.image.length) throw new Error('Pilih file gambar.');
    const fd = new FormData();
    fd.append('file', fileState.image[0]);
    fd.append('to', document.getElementById('imageTo').value);
    const width = document.getElementById('imageWidth').value;
    if (width) fd.append('width', width);
    const res = await fetch('/api/convert/image', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'hasil-konversi');
  });
});

document.getElementById('audioSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.audio.length) throw new Error('Pilih file audio.');
    const fd = new FormData();
    fd.append('file', fileState.audio[0]);
    fd.append('to', document.getElementById('audioTo').value);
    const bitrate = document.getElementById('audioBitrate').value;
    if (bitrate) fd.append('bitrate', bitrate);
    const res = await fetch('/api/convert/audio', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'hasil-konversi.mp3');
  });
});

document.getElementById('videoSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState.video.length) throw new Error('Pilih file video.');
    const fd = new FormData();
    fd.append('file', fileState.video[0]);
    fd.append('to', document.getElementById('videoTo').value);
    const resolution = document.getElementById('videoResolution').value;
    if (resolution) fd.append('resolution', resolution);
    const res = await fetch('/api/convert/video', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'hasil-konversi.mp4');
  });
});

document.getElementById('v2aSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState['video-to-audio'].length) throw new Error('Pilih file video.');
    const fd = new FormData();
    fd.append('file', fileState['video-to-audio'][0]);
    const bitrate = document.getElementById('v2aBitrate').value;
    if (bitrate) fd.append('bitrate', bitrate);
    const res = await fetch('/api/convert/video-to-audio', { method: 'POST', body: fd });
    await downloadFromResponse(res, 'audio.mp3');
  });
});

document.getElementById('csvJsonSubmit').addEventListener('click', (e) => {
  runTool(e.target, async () => {
    if (!fileState['csv-json'].length) throw new Error('Pilih file CSV atau JSON.');
    const direction = document.getElementById('csvJsonDirection').value;
    const fd = new FormData();
    fd.append('file', fileState['csv-json'][0]);
    const endpoint = direction === 'csv-to-json' ? '/api/convert/csv-to-json' : '/api/convert/json-to-csv';
    const fallback = direction === 'csv-to-json' ? 'hasil.json' : 'hasil.csv';
    const res = await fetch(endpoint, { method: 'POST', body: fd });
    await downloadFromResponse(res, fallback);
  });
});
