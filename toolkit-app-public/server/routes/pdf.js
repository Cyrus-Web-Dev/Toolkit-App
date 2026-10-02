const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const pdfService = require('../services/pdfService');
const historyService = require('../services/historyService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Modul: PDF Tools (tier: offline) — semua proses di server lokal, tidak butuh internet.

function sendPdf(res, filename, bytes) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.send(Buffer.from(bytes));
}

function handleError(res, err) {
  console.error('[pdf]', err.message);
  res.status(400).json({ ok: false, message: err.message });
}

function logPdf(action, label, meta = {}) {
  try {
    historyService.add({ module: 'pdfTools', action, label, meta });
  } catch (e) { console.warn('[pdf:history]', e.message); }
}

// --- daftar operasi yang tersedia (dipakai frontend untuk render tombol) ---
router.get('/', (req, res) => {
  res.json({
    ok: true,
    module: 'PDF Tools',
    tier: 'offline',
    operations: [
      'merge', 'split', 'remove-pages', 'extract-pages', 'rotate', 'reorder',
      'watermark', 'page-numbers', 'crop', 'images-to-pdf', 'compress',
    ],
  });
});

// --- MERGE: gabung banyak PDF jadi satu ---
router.post('/merge', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      throw new Error('Pilih minimal 2 file PDF untuk digabung.');
    }
    const bytes = await pdfService.mergePdfs(req.files.map((f) => f.buffer));
    logPdf('merge', `Gabung ${req.files.length} PDF`, { count: req.files.length });
    sendPdf(res, 'gabungan.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- SPLIT: pecah PDF jadi beberapa bagian, dikirim sebagai zip ---
router.post('/split', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const ranges = JSON.parse(req.body.ranges || '[]');
    if (!ranges.length) throw new Error('Isi minimal satu rentang halaman, contoh: [{"from":1,"to":3}]');

    const parts = await pdfService.splitPdf(req.file.buffer, ranges);
    logPdf('split', `Pisah PDF jadi ${parts.length} bagian`, { parts: parts.length });

    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="hasil-split.zip"' });
    const zip = archiver('zip');
    zip.pipe(res);
    parts.forEach((p) => zip.append(p.buffer, { name: p.name }));
    zip.finalize();
  } catch (err) { handleError(res, err); }
});

// --- REMOVE PAGES ---
router.post('/remove-pages', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const pages = JSON.parse(req.body.pages || '[]');
    if (!pages.length) throw new Error('Pilih minimal satu halaman untuk dihapus.');
    const bytes = await pdfService.removePages(req.file.buffer, pages);
    logPdf('remove-pages', `Hapus ${pages.length} halaman dari PDF`, { pages: pages.length });
    sendPdf(res, 'terpotong.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- ROTATE ---
router.post('/rotate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const angle = parseInt(req.body.angle, 10);
    if (![90, 180, 270, -90].includes(angle)) throw new Error('Sudut putar harus 90, 180, atau 270 derajat.');
    const pages = req.body.pages ? JSON.parse(req.body.pages) : null;
    const bytes = await pdfService.rotatePages(req.file.buffer, angle, pages);
    logPdf('rotate', `Putar PDF ${angle}°`, { angle });
    sendPdf(res, 'terputar.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- REORDER ---
router.post('/reorder', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const order = JSON.parse(req.body.order || '[]');
    if (!order.length) throw new Error('Urutan halaman baru wajib diisi.');
    const bytes = await pdfService.reorderPages(req.file.buffer, order);
    logPdf('reorder', 'Susun ulang halaman PDF');
    sendPdf(res, 'tersusun-ulang.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- WATERMARK ---
router.post('/watermark', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const text = (req.body.text || '').trim();
    if (!text) throw new Error('Teks watermark wajib diisi.');
    const bytes = await pdfService.addWatermark(req.file.buffer, text, {
      size: req.body.size ? parseInt(req.body.size, 10) : undefined,
      opacity: req.body.opacity ? parseFloat(req.body.opacity) : undefined,
    });
    logPdf('watermark', 'Tambah watermark ke PDF');
    sendPdf(res, 'watermark.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- IMAGES TO PDF ---
router.post('/images-to-pdf', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || !req.files.length) throw new Error('Pilih minimal satu gambar (JPG/PNG).');
    const invalid = req.files.find((f) => !['image/jpeg', 'image/png'].includes(f.mimetype));
    if (invalid) throw new Error(`Format ${invalid.mimetype} tidak didukung. Hanya JPG dan PNG.`);
    const images = req.files.map((f) => ({ buffer: f.buffer, mime: f.mimetype }));
    const bytes = await pdfService.imagesToPdf(images);
    logPdf('images-to-pdf', 'Gambar → PDF');
    sendPdf(res, 'dari-gambar.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- COMPRESS ---
router.post('/compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const bytes = await pdfService.compressPdf(req.file.buffer);
    logPdf('compress', 'Kompres PDF');
    sendPdf(res, 'terkompresi.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- PAGE NUMBERS ---
router.post('/page-numbers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const position = req.body.position || 'bottom-center';
    const start = req.body.start ? parseInt(req.body.start, 10) : 1;
    const format = req.body.format || '{n}';
    const bytes = await pdfService.addPageNumbers(req.file.buffer, { position, start, format });
    logPdf('page-numbers', 'Tambah nomor halaman PDF');
    sendPdf(res, 'nomor-halaman.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- EXTRACT PAGES ---
router.post('/extract-pages', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const pages = JSON.parse(req.body.pages || '[]');
    if (!pages.length) throw new Error('Pilih minimal satu halaman untuk diekstrak.');
    const bytes = await pdfService.extractPages(req.file.buffer, pages);
    logPdf('extract-pages', `Ekstrak ${pages.length} halaman PDF`, { pages: pages.length });
    sendPdf(res, 'ekstrak-halaman.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

// --- CROP ---
router.post('/crop', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');
    const margins = {
      top: parseFloat(req.body.top) || 0,
      right: parseFloat(req.body.right) || 0,
      bottom: parseFloat(req.body.bottom) || 0,
      left: parseFloat(req.body.left) || 0,
    };
    const bytes = await pdfService.cropPdf(req.file.buffer, margins);
    logPdf('crop', 'Potong (crop) PDF');
    sendPdf(res, 'terpotong-crop.pdf', bytes);
  } catch (err) { handleError(res, err); }
});

module.exports = router;
