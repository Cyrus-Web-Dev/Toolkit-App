const drop = document.getElementById('ocrDrop');
const fileInput = document.getElementById('ocrFile');
const btn = document.getElementById('ocrBtn');
const out = document.getElementById('ocrOut');
const statusLine = document.getElementById('statusLine');
let file = null;

drop.onclick = () => fileInput.click();
fileInput.onchange = () => { file = fileInput.files[0]; btn.disabled = !file; statusLine.textContent = file ? file.name : ''; };
['dragover','dragleave','drop'].forEach(evt => {
  drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.toggle('dragover', evt==='dragover'); });
});
drop.addEventListener('drop', e => { file = e.dataTransfer.files[0]; btn.disabled = !file; statusLine.textContent = file?.name || ''; });

btn.onclick = async () => {
  if (!file) return;
  btn.disabled = true; btn.textContent = 'Memproses…';
  statusLine.textContent = 'OCR berjalan di perangkatmu…';
  try {
    const lang = document.getElementById('ocrLang').value;
    const result = await Tesseract.recognize(file, lang, {
      logger: m => { if (m.status === 'recognizing text') statusLine.textContent = `Mengenali… ${Math.round((m.progress||0)*100)}%`; }
    });
    out.value = result.data.text || '';
    statusLine.textContent = 'Selesai.';
    toast.success('OCR selesai', 'Teks berhasil diekstrak dari gambar.');
  } catch (err) {
    statusLine.textContent = err.message;
    toast.error('OCR gagal', err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Jalankan OCR';
  }
};
document.getElementById('ocrCopy').onclick = async () => {
  await navigator.clipboard.writeText(out.value || '');
  toast.success('Disalin', 'Teks disalin ke clipboard.');
};
