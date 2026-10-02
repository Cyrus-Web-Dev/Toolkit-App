const express = require('express');
const router = express.Router();

// Generate QR as PNG data-URL via dynamic import of 'qrcode' if available,
// fallback error with install instruction.
router.post('/generate', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) throw new Error('Teks / URL untuk QR wajib diisi.');
    if (text.length > 2000) throw new Error('Teks terlalu panjang (maks 2000 karakter).');

    let QRCode;
    try {
      QRCode = require('qrcode');
    } catch {
      throw new Error('Library qrcode belum terinstal. Jalankan: npm install qrcode');
    }

    const size = Math.min(1024, Math.max(128, parseInt(req.body.size, 10) || 300));
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    res.json({ ok: true, dataUrl });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
