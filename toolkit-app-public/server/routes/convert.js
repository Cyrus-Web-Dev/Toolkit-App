const express = require('express');
const multer = require('multer');
const path = require('path');
const convertService = require('../services/convertService');
const historyService = require('../services/historyService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

// Modul: Konversi File (tier: offline) — gambar & CSV/JSON instan, audio/video pakai ffmpeg lokal.

function extOf(filename) {
  return (path.extname(filename || '').replace('.', '') || 'bin').toLowerCase();
}

function sendFile(res, filename, mime, buffer) {
  res.set({ 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${filename}"` });
  res.send(buffer);
}

function handleError(res, err) {
  console.error('[convert]', err.message);
  res.status(400).json({ ok: false, message: err.message });
}

function logConvert(action, label, meta = {}) {
  try {
    historyService.add({ module: 'fileConvert', action, label, meta });
  } catch (e) { console.warn('[convert:history]', e.message); }
}

router.get('/', (req, res) => {
  res.json({
    ok: true,
    module: 'Konversi File',
    tier: 'offline',
    formats: {
      image: Object.keys(convertService.IMAGE_MIME),
      audio: Object.keys(convertService.AUDIO_MIME),
      video: Object.keys(convertService.VIDEO_MIME),
      videoResolutions: Object.keys(convertService.RESOLUTIONS),
    },
  });
});

// --- GAMBAR ---
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File gambar wajib diisi.');
    const to = req.body.to;
    if (!to) throw new Error('Format tujuan wajib diisi.');
    const opts = {
      width: req.body.width ? parseInt(req.body.width, 10) : undefined,
      height: req.body.height ? parseInt(req.body.height, 10) : undefined,
      quality: req.body.quality ? parseInt(req.body.quality, 10) : undefined,
    };
    const { buffer, mime } = await convertService.convertImage(req.file.buffer, to, opts);
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    logConvert('image', `Konversi gambar → ${to}`, { to });
    sendFile(res, `${baseName}.${to === 'jpg' ? 'jpg' : to}`, mime, buffer);
  } catch (err) { handleError(res, err); }
});

// --- AUDIO ---
router.post('/audio', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File audio wajib diisi.');
    const to = req.body.to;
    if (!to) throw new Error('Format tujuan wajib diisi.');
    const { buffer, mime } = await convertService.convertAudio(
      req.file.buffer, extOf(req.file.originalname), to, { bitrate: req.body.bitrate }
    );
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    logConvert('audio', `Konversi audio → ${to}`, { to });
    sendFile(res, `${baseName}.${to}`, mime, buffer);
  } catch (err) { handleError(res, err); }
});

// --- VIDEO ---
router.post('/video', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File video wajib diisi.');
    const to = req.body.to;
    if (!to) throw new Error('Format tujuan wajib diisi.');
    const { buffer, mime } = await convertService.convertVideo(
      req.file.buffer, extOf(req.file.originalname), to, { resolution: req.body.resolution }
    );
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    logConvert('video', `Konversi video → ${to}`, { to, resolution: req.body.resolution });
    sendFile(res, `${baseName}.${to}`, mime, buffer);
  } catch (err) { handleError(res, err); }
});

// --- EKSTRAK AUDIO DARI VIDEO ---
router.post('/video-to-audio', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File video wajib diisi.');
    const { buffer, mime } = await convertService.extractAudioFromVideo(
      req.file.buffer, extOf(req.file.originalname), { bitrate: req.body.bitrate }
    );
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    logConvert('video-to-audio', 'Ekstrak audio dari video → MP3');
    sendFile(res, `${baseName}.mp3`, mime, buffer);
  } catch (err) { handleError(res, err); }
});

// --- CSV -> JSON ---
router.post('/csv-to-json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File CSV wajib diisi.');
    const buffer = convertService.csvToJson(req.file.buffer);
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    sendFile(res, `${baseName}.json`, 'application/json', buffer);
  } catch (err) { handleError(res, err); }
});

// --- JSON -> CSV ---
router.post('/json-to-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('File JSON wajib diisi.');
    const buffer = convertService.jsonToCsv(req.file.buffer);
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    sendFile(res, `${baseName}.csv`, 'text/csv', buffer);
  } catch (err) { handleError(res, err); }
});

module.exports = router;
