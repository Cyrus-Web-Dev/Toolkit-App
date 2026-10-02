const express = require('express');
const geminiService = require('../services/geminiService');
const pdfService = require('../services/pdfService');
const historyService = require('../services/historyService');

const router = express.Router();

// Modul: Surat Lamaran AI (tier: online — butuh Gemini API)

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'Surat Lamaran AI', tier: 'online' });
});

function buildPrompt(fields) {
  const { nama, email, telepon, posisi, perusahaan, pengalaman, keahlian, tone } = fields;
  const toneDesc = tone === 'santai' ? 'semi-formal tapi tetap sopan dan profesional' : 'formal dan profesional';

  return `Kamu adalah asisten penulis profesional. Tulis SATU surat lamaran pekerjaan dalam Bahasa Indonesia,
dengan gaya ${toneDesc}, berdasarkan data berikut:

- Nama pelamar: ${nama}
- Email: ${email || '-'}
- Telepon: ${telepon || '-'}
- Posisi yang dilamar: ${posisi}
- Nama perusahaan tujuan: ${perusahaan}
- Ringkasan pengalaman/kualifikasi: ${pengalaman}
- Keahlian utama: ${keahlian}

Ketentuan:
- Format surat lengkap: tempat & tanggal (pakai placeholder "[Kota, Tanggal]"), salam pembuka, 3-4 paragraf isi
  (perkenalan diri & posisi yang dilamar, alasan tertarik & kecocokan dengan kualifikasi, penutup ajakan follow-up),
  salam penutup, dan nama pelamar.
- Jangan gunakan markdown (**tebal**, #, dsb) — teks polos saja, karena akan langsung dijadikan PDF.
- Jangan mengarang pengalaman yang tidak disebutkan di atas.
- Tulis langsung isi suratnya saja, tanpa komentar tambahan sebelum atau sesudahnya.`;
}

router.post('/generate', async (req, res) => {
  try {
    const { nama, posisi, perusahaan, pengalaman, keahlian } = req.body;
    if (!nama || !posisi || !perusahaan || !pengalaman || !keahlian) {
      throw new Error('Nama, posisi, perusahaan, pengalaman, dan keahlian wajib diisi.');
    }
    const prompt = buildPrompt(req.body);
    const text = await geminiService.generateText(prompt, { temperature: 0.75 });
    try {
      historyService.add({ module: 'coverLetterAI', action: 'generate', label: `Surat lamaran: ${req.body.posisi || ''} @ ${req.body.perusahaan || ''}` });
    } catch (e) {}
    res.json({ ok: true, text });
  } catch (err) {
    console.error('[cover-letter]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.post('/pdf', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) throw new Error('Teks surat kosong.');
    const bytes = await pdfService.createTextDocument(text);
    try {
      historyService.add({ module: 'coverLetterAI', action: 'pdf', label: 'Unduh surat lamaran (PDF)' });
    } catch (e) {}
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="surat-lamaran.pdf"',
    });
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error('[cover-letter:pdf]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
