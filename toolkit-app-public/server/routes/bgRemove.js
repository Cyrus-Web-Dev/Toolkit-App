const express = require('express');
const multer = require('multer');
const bgRemoveService = require('../services/bgRemoveService');
const historyService = require('../services/historyService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// Modul: Hapus Background Massal (tier: offline, model AI jalan lokal)
// Sengaja satu endpoint per-gambar (bukan satu endpoint besar untuk semua file
// sekaligus) supaya frontend bisa proses banyak foto secara paralel terbatas
// dan menampilkan status tiap foto secara langsung — bukan cuma "tunggu semua selesai".
// Penggabungan hasil jadi .zip dilakukan di sisi browser (lihat public/js/zip-lite.js),
// jadi tidak perlu proses ulang gambar yang sama di server.

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'Hapus Background Massal', tier: 'offline' });
});

router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File gambar wajib diisi.');
    if (!ALLOWED_MIME.includes(req.file.mimetype)) {
      throw new Error(`Format ${req.file.mimetype} tidak didukung. Pakai JPG, PNG, atau WEBP.`);
    }
    const mode = req.body.mode === 'color' ? 'color' : 'transparent';
    const color = req.body.color || '#ffffff';
    const outBuffer = await bgRemoveService.removeBg(req.file.buffer, { mode, color });
    try {
      historyService.add({
        module: 'bgRemoveBatch',
        action: 'remove-bg',
        label: mode === 'color'
          ? `Hapus BG + isi warna ${color}: ${req.file.originalname || 'foto'}`
          : `Hapus background: ${req.file.originalname || 'foto'}`,
        meta: { name: req.file.originalname, mode, color: mode === 'color' ? color : undefined },
      });
    } catch (e) { console.warn('[bg:history]', e.message); }
    res.set({ 'Content-Type': 'image/png' });
    res.send(outBuffer);
  } catch (err) {
    console.error('[bg-remove]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
