const express = require('express');
const geminiService = require('../services/geminiService');
const historyService = require('../services/historyService');
const quotaService = require('../services/quotaService');

const router = express.Router();

/**
 * Detector berbasis AI (bukan database plagiarisme penuh).
 * Memberikan estimasi probabilitas gaya AI + saran perbaikan.
 * Bukan pengganti Turnitin.
 */
router.post('/analyze', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text || text.length < 80) {
      throw new Error('Teks minimal sekitar 80 karakter untuk dianalisis.');
    }

    const prompt =
      'Analisis teks berikut. Balas HANYA JSON valid:\n' +
      '{\n' +
      '  "aiLikelihood": 0-100,\n' +
      '  "humanLikelihood": 0-100,\n' +
      '  "signals": ["indikator1", "indikator2"],\n' +
      '  "plagiarismRisk": "low|medium|high",\n' +
      '  "notes": "penjelasan singkat",\n' +
      '  "rewriteTips": ["saran1", "saran2"]\n' +
      '}\n' +
      'Ini estimasi gaya tulisan, BUKAN hasil pencocokan database plagiarisme.\n\nTeks:\n' +
      text.slice(0, 8000);

    const data = await geminiService.generateJson(prompt, {
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    try {
      historyService.add({
        module: 'aiDetect',
        action: 'analyze',
        label: 'Analisis AI/plagiarisme (estimasi)',
      });
    } catch {}

    res.json({
      ok: true,
      result: data,
      disclaimer:
        'Hasil ini adalah estimasi gaya tulisan berbasis AI, bukan pemeriksaan plagiarisme database seperti Turnitin.',
      quota: quotaService.status(),
    });
  } catch (err) {
    console.error('[detect]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
