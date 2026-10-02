let items = [];
const drop = document.getElementById('ibDrop');
const input = document.getElementById('ibFiles');
const grid = document.getElementById('ibGrid');
const btn = document.getElementById('ibBtn');
const zipBtn = document.getElementById('ibZip');
const statusLine = document.getElementById('statusLine');

drop.onclick = () => input.click();
input.onchange = () => add(Array.from(input.files));
['dragover','dragleave','drop'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.toggle('dragover', evt==='dragover'); }));
drop.addEventListener('drop', e => add(Array.from(e.dataTransfer.files)));

function add(files) {
  files.filter(f => f.type.startsWith('image/')).forEach(f => items.push({ file: f, status: 'pending', blob: null }));
  render(); btn.disabled = !items.length;
}
function render() {
  grid.innerHTML = items.map((it,i) => `<div class="bg-card"><div class="bg-card-info"><span class="bg-filename">${it.file.name}</span><span class="bg-status ${it.status}">${it.status}</span></div></div>`).join('');
}

btn.onclick = async () => {
  btn.disabled = true;
  const opts = {
    maxWidth: document.getElementById('ibW').value,
    maxHeight: document.getElementById('ibH').value,
    quality: document.getElementById('ibQ').value,
    format: document.getElementById('ibFmt').value,
  };
  for (const it of items) {
    if (it.status === 'done') continue;
    it.status = 'processing'; render();
    try {
      const fd = new FormData();
      fd.append('file', it.file);
      Object.entries(opts).forEach(([k,v]) => fd.append(k,v));
      const res = await fetch('/api/image-batch/single', { method:'POST', body: fd });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'Gagal'); }
      it.blob = await res.blob();
      it.status = 'done';
    } catch (err) { it.status = 'error'; it.error = err.message; }
    render();
  }
  btn.disabled = false;
  zipBtn.disabled = !items.some(i => i.blob);
  const ok = items.filter(i=>i.status==='done').length;
  statusLine.textContent = `${ok}/${items.length} selesai`;
  toast.success('Selesai', `${ok} gambar berhasil diproses.`);
};

zipBtn.onclick = async () => {
  const files = items.filter(i=>i.blob).map((it, idx) => ({
    name: it.file.name.replace(/\.\w+$/, '') + '.' + (document.getElementById('ibFmt').value === 'jpeg' ? 'jpg' : document.getElementById('ibFmt').value),
    bytes: it.blob
  }));
  // zip-lite expects Uint8Array — convert
  const entries = [];
  for (const f of files) {
    entries.push({ name: f.name, bytes: new Uint8Array(await f.bytes.arrayBuffer()) });
  }
  const zipBytes = createZip ? createZip(entries) : null;
  if (!zipBytes) { toast.error('Zip gagal', 'zip-lite tidak tersedia'); return; }
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gambar-kompres.zip'; a.click();
  toast.success('Zip diunduh');
};
