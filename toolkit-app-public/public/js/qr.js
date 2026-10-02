document.getElementById('qrGen').onclick = async () => {
  const text = document.getElementById('qrText').value.trim();
  if (!text) return toast.error('Kosong', 'Isi teks atau URL dulu.');
  try {
    const res = await fetch('/api/qr/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, size: 320 })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'Gagal');
    const prev = document.getElementById('qrPreview');
    prev.innerHTML = `<img src="${data.dataUrl}" alt="QR" style="max-width:280px;border-radius:8px;background:#fff;padding:8px">`;
    const dl = document.getElementById('qrDl');
    dl.href = data.dataUrl; dl.style.display = 'inline-block';
    toast.success('QR dibuat', 'Silakan unduh PNG-nya.');
  } catch (err) { toast.error('Gagal', err.message); }
};

// Scanner
let scanner;
async function startScan() {
  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('qrScanResult').textContent = 'Library scanner belum termuat.';
    return;
  }
  scanner = new Html5Qrcode('qrReader');
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 8, qrbox: 220 },
      (decoded) => {
        document.getElementById('qrScanResult').textContent = 'Hasil: ' + decoded;
        toast.success('QR terdeteksi', decoded.slice(0, 80));
        scanner.stop().catch(()=>{});
      }
    );
  } catch (err) {
    document.getElementById('qrScanResult').textContent = 'Kamera tidak tersedia: ' + err.message;
  }
}
startScan();
