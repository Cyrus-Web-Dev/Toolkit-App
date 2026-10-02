const express = require('express');
const multer = require('multer');
const geminiService = require('../services/geminiService');
const historyService = require('../services/historyService');
const quotaService = require('../services/quotaService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/solve', upload.single('image'), async (req, res) => {
  try {
    const question = String(req.body.question || '').trim();
    if (!question && !req.file) throw new Error('Isi soal teks atau unggah foto soal.');

    const system =
      'Kamu adalah tutor ahli Matematika, Fisika, Kimia, Sains, dan Akuntansi. ' +
      'Jawab dalam Bahasa Indonesia. Tunjukkan langkah penyelesaian secara runtut, ' +
      'rumus yang dipakai, dan jawaban akhir yang jelas. Jika soal dari gambar, baca dulu isinya.';

    let answer;
    if (req.file) {
      answer = await geminiService.generateWithImages(
        question || 'Selesaikan soal pada gambar ini. Jelaskan langkah-langkahnya.',
        [{ mime: req.file.mimetype, base64: req.file.buffer.toString('base64') }],
        { systemInstruction: system, maxOutputTokens: 4096, temperature: 0.3 }
      );
    } else {
      answer = await geminiService.generateText(
        system + '\n\nSoal:\n' + question,
        { maxOutputTokens: 4096, temperature: 0.3 }
      );
    }

    try {
      historyService.add({
        module: 'aiSolver',
        action: 'solve',
        label: `Selesaikan soal: ${(question || 'foto soal').slice(0, 50)}`,
      });
    } catch {}

    res.json({ ok: true, answer, quota: quotaService.status() });
  } catch (err) {
    console.error('[ai-solver]', err.message);
    res.status(400).json({ ok: false, message: err.message, quota: quotaService.status() });
  }
});

module.exports = router;
