const express = require('express');
const geminiService = require('../services/geminiService');
const pdfService = require('../services/pdfService');
const historyService = require('../services/historyService');

const router = express.Router();

// Modul: Resume ATS AI (tier: online — butuh Gemini API)
// Beda dari CV Builder: resume ini ditarget ke SATU posisi lamaran spesifik,
// dioptimasi kata kunci ATS, dan disertai skor kecocokan terhadap lowongan.

router.get('/', (req, res) => {
  res.json({ ok: true, module: 'Resume ATS AI', tier: 'online' });
});

function buildPrompt(fields) {
  const {
    nama, posisiTarget, deskripsiLowongan,
    ringkasanKasar, pendidikanKasar, pengalamanKasar, keahlianKasar,
  } = fields;

  return `Kamu adalah konsultan karier ahli ATS (Applicant Tracking System). Tugasmu menyusun resume
yang dioptimasi untuk SATU posisi lamaran spesifik, berdasarkan data mentah dari user.

ATURAN PENTING:
- JANGAN mengarang fakta (nama perusahaan, tanggal, gelar, angka pencapaian) yang tidak disebutkan user.
  Kamu boleh merapikan kalimat, menyorot kata kunci relevan, dan menonjolkan pencapaian yang SUDAH ada.
- Setiap poin pengalaman kerja HARUS ditulis sebagai kalimat aksi singkat (mulai dengan kata kerja),
  bukan paragraf panjang — ini format bullet standar resume ATS.
- Sisipkan kata kunci dari deskripsi lowongan (jika ada) SECARA JUJUR — hanya jika memang relevan
  dengan pengalaman user, jangan memaksakan skill yang tidak disebutkan user.
- skorKecocokan adalah estimase kasar 0-100 seberapa cocok profil user dengan posisi target,
  berdasarkan overlap kata kunci & pengalaman yang disebutkan.

Posisi yang dilamar: ${posisiTarget}
Deskripsi lowongan (opsional, buat referensi kata kunci): ${deskripsiLowongan || '-'}

Data mentah dari user:
- Nama: ${nama}
- Draft ringkasan karier (opsional): ${ringkasanKasar || '-'}
- Riwayat pendidikan (bebas format): ${pendidikanKasar}
- Riwayat pengalaman kerja (bebas format): ${pengalamanKasar}
- Keahlian (bebas format): ${keahlianKasar}

Balas HANYA dengan JSON valid (tanpa markdown, tanpa penjelasan tambahan) dengan skema persis berikut:
{
  "posisiTarget": "judul posisi yang dilamar, rapikan kapitalisasinya",
  "ringkasan": "1 paragraf ringkasan profil yang ditarget ke posisi ini, maksimal 45 kata",
  "kataKunciATS": ["daftar", "kata kunci", "yang berhasil disisipkan secara jujur"],
  "skorKecocokan": 0,
  "catatanKecocokan": "1-2 kalimat penjelasan singkat skor & saran perbaikan jika ada",
  "pengalaman": [
    { "posisi": "", "perusahaan": "", "periode": "", "bullet": ["kalimat aksi 1", "kalimat aksi 2"] }
  ],
  "pendidikan": [
    { "gelar": "", "institusi": "", "periode": "" }
  ],
  "keahlian": ["daftar", "keahlian", "singkat"]
}`;
}

router.post('/generate', async (req, res) => {
  try {
    const { nama, posisiTarget, pendidikanKasar, pengalamanKasar, keahlianKasar } = req.body;
    if (!nama || !posisiTarget || !pendidikanKasar || !pengalamanKasar || !keahlianKasar) {
      throw new Error('Nama, posisi target, pendidikan, pengalaman, dan keahlian wajib diisi.');
    }
    const prompt = buildPrompt(req.body);
    const data = await geminiService.generateJson(prompt, { temperature: 0.55 });
    try { historyService.add({ module: 'resumeAI', action: 'generate', label: `Generate resume ATS — ${posisiTarget}` }); } catch (e) {}
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[resume]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.post('/pdf', async (req, res) => {
  try {
    const { personal, data } = req.body;
    if (!personal?.nama) throw new Error('Nama wajib diisi.');
    if (!data) throw new Error('Data resume kosong.');
    const bytes = await pdfService.createResumePdf(personal, data);
    try { historyService.add({ module: 'resumeAI', action: 'pdf', label: 'Unduh Resume (PDF)' }); } catch (e) {}
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="resume.pdf"',
    });
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error('[resume:pdf]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
