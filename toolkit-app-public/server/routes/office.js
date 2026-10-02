const express = require('express');
const officeService = require('../services/officeService');
const historyService = require('../services/historyService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'AI Office Docs', tier: 'online', formats: ['docx', 'xlsx', 'pptx'] });
});

/**
 * POST /api/ai/office/generate
 * body: { type: 'word'|'excel'|'ppt', prompt: string }
 */
router.post('/generate', async (req, res) => {
  try {
    const { type, prompt } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      throw new Error('Prompt / perintah wajib diisi.');
    }
    const t = String(type || '').toLowerCase();
    if (!['word', 'excel', 'ppt'].includes(t)) {
      throw new Error('type harus word, excel, atau ppt.');
    }

    let result;
    if (t === 'word') result = await officeService.generateWord(prompt);
    else if (t === 'excel') result = await officeService.generateExcel(prompt);
    else result = await officeService.generatePpt(prompt);

    try {
      historyService.add({
        module: 'officeAI',
        action: t,
        label: `Buat ${t.toUpperCase()} dengan AI: ${String(prompt).slice(0, 60)}`,
      });
    } catch { /* ignore */ }

    res.set({
      'Content-Type': result.mime,
      'Content-Disposition': `attachment; filename="${result.filename.replace(/"/g, '')}"`,
      'X-Filename': encodeURIComponent(result.filename),
    });
    res.send(result.buffer);
  } catch (err) {
    console.error('[office]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
