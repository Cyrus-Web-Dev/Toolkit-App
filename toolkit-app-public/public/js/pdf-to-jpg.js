const fileInput = document.getElementById('file');
const btn = document.getElementById('btn');
const drop = document.getElementById('drop');
const dropLabel = document.getElementById('dropLabel');
const fileList = document.getElementById('fileList');
const statusLine = document.getElementById('statusLine');

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

function showSelected(file) {
  if (!file) {
    dropLabel.textContent = 'Pilih file PDF';
    fileList.innerHTML = '';
    btn.disabled = true;
    return;
  }
  dropLabel.textContent = 'File siap dikonversi — klik untuk ganti';
  fileList.innerHTML = `<li><span><strong>${file.name}</strong> <span style="color:var(--text-dim)">(${fmtSize(file.size)})</span></span></li>`;
  btn.disabled = false;
  statusLine.textContent = 'File terpilih: ' + file.name;
}

drop.onclick = () => fileInput.click();
fileInput.onchange = () => showSelected(fileInput.files[0]);
['dragover', 'dragleave', 'drop'].forEach((evt) => {
  drop.addEventListener(evt, (e) => {
    e.preventDefault();
    drop.classList.toggle('dragover', evt === 'dragover');
  });
});
drop.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const dt = new DataTransfer();
  dt.items.add(f);
  fileInput.files = dt.files;
  showSelected(f);
});

fetch('/api/pdf-to-jpg/status').then((r) => r.json()).then((d) => {
  const el = document.getElementById('toolStatus');
  if (d.found) el.textContent = 'ditemukan ✓ (' + d.path + ')';
  else el.textContent = (d.hint || 'tidak ditemukan') + (d.popplerEnv ? ' | POPPLER_PATH=' + d.popplerEnv : '');
}).catch((e) => {
  document.getElementById('toolStatus').textContent = 'tidak bisa dicek — pastikan server v0.6+ berjalan';
});

document.getElementById('form').onsubmit = async (e) => {
  e.preventDefault();
  if (!fileInput.files[0]) return toast.error('Belum ada file', 'Pilih PDF dulu.');
  btn.disabled = true;
  btn.textContent = 'Mengonversi…';
  toast.info('Sedang diproses', 'Permintaan PDF → JPG sedang dijalankan…');
  statusLine.textContent = 'Sedang mengonversi…';
  try {
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('dpi', document.getElementById('dpi').value);
    const res = await fetch('/api/pdf-to-jpg', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Gagal konversi');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const isZip = (res.headers.get('Content-Type') || '').includes('zip');
    a.download = isZip ? 'pdf-ke-jpg.zip' : 'halaman-1.jpg';
    a.click();
    toast.success('Berhasil', 'Permintaan Anda berhasil — file diunduh.');
    statusLine.textContent = 'Selesai.';
  } catch (err) {
    toast.error('Gagal', err.message);
    statusLine.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Konversi';
  }
};
