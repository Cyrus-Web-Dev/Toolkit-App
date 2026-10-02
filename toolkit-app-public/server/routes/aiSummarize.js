const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const geminiService = require('../services/geminiService');
const historyService = require('../services/historyService');
const quotaService = require('../services/quotaService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Ekstrak teks kasar dari PDF (hanya teks embedded; bukan OCR)
async function extractPdfText(buffer) {
  // pdf-lib tidak ekstrak teks penuh — kirim metadata + minta user paste jika kosong.
  // Alternatif: baca sebagai base64 terbatas. Untuk ringkasan, kita pakai pendekatan:
  // jika body.text ada, pakai itu; jika file PDF, coba parse strings sederhana.
  const str = buffer.toString('latin1');
  const matches = str.match(/\((?:\\.|[^\\)]){3,80}\)/g) || [];
  const texts = matches
    .map((m) => m.slice(1, -1).replace(/\\n/g, ' ').replace(/\\(.)/g, '$1'))
    .filter((t) => /[A-Za-z\u00C0-\u024F\u0900-\u0FFF]{3,}/.test(t));
  // dedupe & join
  const unique = [...new Set(texts)].slice(0, 400);
  return unique.join(' ').slice(0, 12000);
}

router.post('/', upload.single('file'), async (req, res) => {
  try {
    let sourceText = String(req.body.text || '').trim();
    if (!sourceText && req.file) {
      if (req.file.mimetype === 'application/pdf' || req.file.originalname?.endsWith('.pdf')) {
        sourceText = await extractPdfText(req.file.buffer);
      } else {
        sourceText = req.file.buffer.toString('utf8').slice(0, 12000);
      }
    }
    if (!sourceText || sourceText.length < 40) {
      throw new Error(
        'Teks terlalu pendek atau PDF tidak berisi teks yang bisa diekstrak (mungkin hasil scan). ' +
          'Tempel teks manual di kolom teks, atau gunakan OCR dulu untuk PDF hasil scan.'
      );
    }

    const prompt =
      'Buat rangkuman akademik yang rapi dalam Bahasa Indonesia dari teks berikut.\n' +
      'Strukturkan dengan heading:\n' +
      '1) Ringkasan singkat\n2) Poin-poin penting\n3) Metodologi (jika ada)\n4) Kesimpulan\n5) Istilah kunci\n\n' +
      'Teks sumber:\n' +
      sourceText.slice(0, 12000);

    const summary = await geminiService.generateText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 3000,
    });

    try {
      historyService.add({
        module: 'pdfSummarizer',
        action: 'summarize',
        label: 'Rangkum dokumen/PDF dengan AI',
      });
    } catch {}

    res.json({ ok: true, summary, quota: quotaService.status() });
  } catch (err) {
    console.error('[summarize]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
