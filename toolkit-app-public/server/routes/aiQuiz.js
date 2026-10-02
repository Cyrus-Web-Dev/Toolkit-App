const express = require('express');
const geminiService = require('../services/geminiService');
const historyService = require('../services/historyService');
const quotaService = require('../services/quotaService');

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const count = Math.min(20, Math.max(3, parseInt(req.body?.count, 10) || 5));
    if (!text || text.length < 30) throw new Error('Tempel materi minimal ~30 karakter.');

    const prompt =
      `Dari materi berikut, buatkan ${count} soal pilihan ganda dan ${count} flashcard.\n` +
      `Balas HANYA JSON valid:\n` +
      `{\n` +
      `  "quiz": [{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}],\n` +
      `  "flashcards": [{"front":"...","back":"..."}]\n` +
      `}\n\nMateri:\n` +
      text.slice(0, 10000);

    const data = await geminiService.generateJson(prompt, {
      temperature: 0.5,
      maxOutputTokens: 4000,
    });

    try {
      historyService.add({
        module: 'quizGen',
        action: 'generate',
        label: `Buat kuis & flashcard (${count} soal)`,
      });
    } catch {}

    res.json({ ok: true, ...data, quota: quotaService.status() });
  } catch (err) {
    console.error('[quiz]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
