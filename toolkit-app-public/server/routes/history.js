const express = require('express');
const historyService = require('../services/historyService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const items = historyService.list();
    res.json({ ok: true, items, ttlMinutes: 30 });
  } catch (err) {
    console.error('[history:list]', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const ok = historyService.remove(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, message: 'Entri tidak ditemukan.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[history:delete]', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.delete('/', (req, res) => {
  try {
    historyService.clearAll();
    res.json({ ok: true });
  } catch (err) {
    console.error('[history:clear]', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
