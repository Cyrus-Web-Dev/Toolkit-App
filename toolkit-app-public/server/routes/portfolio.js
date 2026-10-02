const express = require('express');
const geminiService = require('../services/geminiService');
const portfolioService = require('../services/portfolioService');
const historyService = require('../services/historyService');

const router = express.Router();

// Modul: Portofolio AI (tier: online — butuh Gemini API)
// Hasil akhirnya adalah 1 file HTML mandiri (bisa langsung dibuka di
// browser atau di-hosting) — bukan PDF, supaya bisa dipublikasikan
// sebagai website portofolio pribadi.

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'Portofolio AI', tier: 'online' });
});

function buildPrompt(fields) {
  const { nama, profesiKasar, tentangKasar, proyekKasar, keahlianKasar } = fields;

  return `Kamu adalah copywriter portofolio profesional. Berdasarkan catatan mentah user di bawah,
susun konten portofolio pribadi yang ringkas, percaya diri, dan menarik dalam Bahasa Indonesia.
JANGAN mengarang proyek, angka, atau fakta yang tidak disebutkan user — kamu boleh merapikan
kalimat dan membuatnya lebih menjual, tapi isi faktualnya harus tetap dari data user.

Data mentah dari user:
- Nama: ${nama}
- Profesi/peran (bebas format): ${profesiKasar}
- Draft tentang diri (bebas format): ${tentangKasar}
- Daftar proyek/karya (bebas format, boleh beberapa, pisahkan per proyek): ${proyekKasar}
- Keahlian (bebas format): ${keahlianKasar}

Balas HANYA dengan JSON valid (tanpa markdown, tanpa penjelasan tambahan) dengan skema persis berikut:
{
  "headline": "1 kalimat pendek nan kuat yang merangkum siapa user (maks 12 kata)",
  "tentang": "1-2 paragraf singkat tentang diri, nada percaya diri tapi tetap jujur, maks 90 kata",
  "proyek": [
    { "judul": "", "deskripsi": "2-3 kalimat, fokus dampak/hasil kalau disebutkan user", "teknologi": ["opsional", "list", "tools"] }
  ],
  "keahlian": ["daftar", "keahlian", "singkat"]
}`;
}

router.post('/generate', async (req, res) => {
  try {
    const { nama, profesiKasar, tentangKasar, proyekKasar, keahlianKasar } = req.body;
    if (!nama || !profesiKasar || !tentangKasar || !proyekKasar || !keahlianKasar) {
      throw new Error('Nama, profesi, tentang diri, proyek, dan keahlian wajib diisi.');
    }
    const prompt = buildPrompt(req.body);
    const data = await geminiService.generateJson(prompt, { temperature: 0.65 });
    try { historyService.add({ module: 'portfolioAI', action: 'generate', label: 'Generate portofolio dengan AI' }); } catch (e) {}
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[portfolio]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.post('/render', async (req, res) => {
  try {
    const { nama, data, kontak, accent, download } = req.body;
    if (!nama) throw new Error('Nama wajib diisi.');
    if (!data) throw new Error('Data portofolio kosong.');

    const html = portfolioService.renderPortfolioHtml(
      { ...data, nama, kontak: kontak || {} },
      { accent: accent?.a1, accent2: accent?.a2 }
    );

    if (download) {
      try { historyService.add({ module: 'portfolioAI', action: 'download', label: 'Unduh Portofolio (HTML)' }); } catch (e) {}
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="portofolio.html"',
      });
      return res.send(html);
    }

    res.json({ ok: true, html });
  } catch (err) {
    console.error('[portfolio:render]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
