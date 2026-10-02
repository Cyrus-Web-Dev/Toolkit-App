const express = require('express');
const router = express.Router();

// OCR dijalankan di browser lewat tesseract.js (offline setelah model terunduh sekali).
// Endpoint ini hanya status/metadata.
router.get('/', (req, res) => {
  res.json({
    ok: true,
    module: 'OCR',
    tier: 'offline',
    engine: 'tesseract.js (client-side)',
    note: 'Pemrosesan OCR dilakukan di browser/Electron renderer, bukan di server Node.',
  });
});

module.exports = router;
