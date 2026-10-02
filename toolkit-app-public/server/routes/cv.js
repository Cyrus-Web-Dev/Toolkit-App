const express = require('express');
const geminiService = require('../services/geminiService');
const pdfService = require('../services/pdfService');
const historyService = require('../services/historyService');

const router = express.Router();

// Modul: CV Builder AI (tier: online — butuh Gemini API)

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'CV Builder AI', tier: 'online' });
});

function buildPrompt(fields) {
  const { nama, ringkasanKasar, pendidikanKasar, pengalamanKasar, keahlianKasar, sertifikasiKasar } = fields;

  return `Kamu adalah asisten penyusun CV profesional. Berdasarkan catatan mentah dari user di bawah,
susun ulang jadi CV yang rapi dan profesional dalam Bahasa Indonesia. JANGAN mengarang fakta
(perusahaan, tanggal, gelar) yang tidak disebutkan — kamu boleh merapikan kalimat dan membuatnya
lebih profesional, tapi isi faktualnya harus tetap dari data user.

Data mentah dari user:
- Nama: ${nama}
- Draft ringkasan karier (opsional): ${ringkasanKasar || '-'}
- Riwayat pendidikan (bebas format): ${pendidikanKasar}
- Riwayat pengalaman kerja (bebas format): ${pengalamanKasar}
- Keahlian (bebas format): ${keahlianKasar}
- Sertifikasi/lainnya (opsional): ${sertifikasiKasar || '-'}

Balas HANYA dengan JSON valid (tanpa markdown, tanpa penjelasan tambahan) dengan skema persis berikut:
{
  "ringkasan": "1 paragraf ringkasan profesional, maksimal 60 kata",
  "pengalaman": [
    { "posisi": "", "perusahaan": "", "periode": "", "deskripsi": "2-3 kalimat pencapaian/tanggung jawab" }
  ],
  "pendidikan": [
    { "gelar": "", "institusi": "", "periode": "" }
  ],
  "keahlian": ["daftar", "keahlian", "singkat"],
  "lainnya": "sertifikasi atau info tambahan, boleh string kosong"
}`;
}

router.post('/generate', async (req, res) => {
  try {
    const { nama, pendidikanKasar, pengalamanKasar, keahlianKasar } = req.body;
    if (!nama || !pendidikanKasar || !pengalamanKasar || !keahlianKasar) {
      throw new Error('Nama, pendidikan, pengalaman, dan keahlian wajib diisi.');
    }
    const prompt = buildPrompt(req.body);
    const data = await geminiService.generateJson(prompt, { temperature: 0.6 });
    try { historyService.add({ module: 'cvBuilderAI', action: 'generate', label: 'Generate CV dengan AI' }); } catch (e) {}
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[cv]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.post('/pdf', async (req, res) => {
  try {
    const { personal, data } = req.body;
    if (!personal?.nama) throw new Error('Nama wajib diisi.');
    if (!data) throw new Error('Data CV kosong.');
    const bytes = await pdfService.createCvPdf(personal, data);
    try { historyService.add({ module: 'cvBuilderAI', action: 'pdf', label: 'Unduh CV (PDF)' }); } catch (e) {}
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv.pdf"',
    });
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error('[cv:pdf]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
