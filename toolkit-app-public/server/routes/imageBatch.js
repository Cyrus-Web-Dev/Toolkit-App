const express = require('express');
const multer = require('multer');
const imageBatchService = require('../services/imageBatchService');
const historyService = require('../services/historyService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File gambar wajib.');
    const result = await imageBatchService.compressResize(req.file.buffer, {
      maxWidth: req.body.maxWidth,
      maxHeight: req.body.maxHeight,
      quality: req.body.quality,
      format: req.body.format,
    });
    try {
      historyService.add({
        module: 'imageBatch',
        action: 'compress',
        label: `Kompres/resize: ${req.file.originalname || 'gambar'}`,
      });
    } catch {}
    res.set({ 'Content-Type': result.mime });
    res.send(result.buffer);
  } catch (err) {
    console.error('[image-batch]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
