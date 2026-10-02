const express = require('express');
const geminiService = require('../services/geminiService');

const router = express.Router();

// Modul: AI Chat / Tanya  (tier: online)

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'AI Chat / Tanya', tier: 'online' });
});

/**
 * POST /api/ai/chat
 * body: { messages: [ { role: 'user'|'assistant', content: string }, ... ] }
 * response: { ok: true, reply: string }
 */
router.post('/', async (req, res) => {
  try {
    const { messages, temperature, maxOutputTokens } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Kirim minimal satu pesan di field "messages".');
    }

    for (const m of messages) {
      if (!m || typeof m.content !== 'string' || !m.content.trim()) {
        throw new Error('Setiap pesan harus punya content teks yang tidak kosong.');
      }
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'model') {
        throw new Error('Role pesan harus "user" atau "assistant".');
      }
    }

    // Batasi history biar token tidak meledak
    const trimmed = messages.slice(-20);

    const reply = await geminiService.chat(trimmed, {
      temperature: typeof temperature === 'number' ? temperature : 0.8,
      maxOutputTokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 2048,
    });

    res.json({ ok: true, reply });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
