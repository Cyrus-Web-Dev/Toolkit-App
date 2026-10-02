const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

// ================= GAMBAR =================

const IMAGE_MIME = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', avif: 'image/avif', tiff: 'image/tiff',
};

/**
 * @param {Buffer} buffer - gambar sumber (format apa saja yang didukung libvips: jpg/png/webp/gif/bmp/tiff)
 * @param {string} toFormat - jpeg|png|webp|avif|tiff
 * @param {{width?:number, height?:number, quality?:number}} opts
 */
async function convertImage(buffer, toFormat, opts = {}) {
  const fmt = toFormat.toLowerCase() === 'jpg' ? 'jpeg' : toFormat.toLowerCase();
  if (!IMAGE_MIME[fmt]) throw new Error(`Format gambar "${toFormat}" tidak didukung.`);

  let pipeline = sharp(buffer);
  if (opts.width || opts.height) {
    pipeline = pipeline.resize(opts.width || null, opts.height || null, { fit: 'inside', withoutEnlargement: true });
  }
  const quality = opts.quality || 82;
  if (fmt === 'jpeg') pipeline = pipeline.jpeg({ quality });
  else if (fmt === 'webp') pipeline = pipeline.webp({ quality });
  else if (fmt === 'avif') pipeline = pipeline.avif({ quality });
  else if (fmt === 'png') pipeline = pipeline.png();
  else if (fmt === 'tiff') pipeline = pipeline.tiff();

  const outBuffer = await pipeline.toBuffer();
  return { buffer: outBuffer, mime: IMAGE_MIME[fmt] };
}

// ================= AUDIO & VIDEO (via ffmpeg, butuh file sementara) =================

const AUDIO_MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' };
const VIDEO_MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo' };

const RESOLUTIONS = { '360p': '640x360', '720p': '1280x720', '1080p': '1920x1080' };

async function withTempFiles(inputBuffer, inputExt, outputExt, fn) {
  const dir = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(dir, `toolkit-in-${id}.${inputExt}`);
  const outputPath = path.join(dir, `toolkit-out-${id}.${outputExt}`);

  await fs.writeFile(inputPath, inputBuffer);
  try {
    await fn(inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} inputExt - ekstensi file asli, mis. 'wav'
 * @param {string} toFormat - mp3|wav|ogg|m4a|flac
 * @param {{bitrate?:string}} opts - contoh bitrate: '192k'
 */
async function convertAudio(buffer, inputExt, toFormat, opts = {}) {
  const fmt = toFormat.toLowerCase();
  if (!AUDIO_MIME[fmt]) throw new Error(`Format audio "${toFormat}" tidak didukung.`);

  const outBuffer = await withTempFiles(buffer, inputExt, fmt, (inputPath, outputPath) => new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath).toFormat(fmt);
    if (opts.bitrate) cmd = cmd.audioBitrate(opts.bitrate);
    cmd.on('end', resolve).on('error', reject).save(outputPath);
  }));

  return { buffer: outBuffer, mime: AUDIO_MIME[fmt] };
}

/**
 * @param {Buffer} buffer
 * @param {string} inputExt
 * @param {string} toFormat - mp4|webm|mov|mkv|avi
 * @param {{resolution?: '360p'|'720p'|'1080p', extractAudioOnly?: boolean}} opts
 */
async function convertVideo(buffer, inputExt, toFormat, opts = {}) {
  const fmt = toFormat.toLowerCase();
  if (!VIDEO_MIME[fmt]) throw new Error(`Format video "${toFormat}" tidak didukung.`);

  const outBuffer = await withTempFiles(buffer, inputExt, fmt, (inputPath, outputPath) => new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath).toFormat(fmt);
    if (opts.resolution && RESOLUTIONS[opts.resolution]) {
      cmd = cmd.size(RESOLUTIONS[opts.resolution]);
    }
    cmd.on('end', resolve).on('error', reject).save(outputPath);
  }));

  return { buffer: outBuffer, mime: VIDEO_MIME[fmt] };
}

/** Ekstrak audio dari video jadi MP3. */
async function extractAudioFromVideo(buffer, inputExt, opts = {}) {
  const outBuffer = await withTempFiles(buffer, inputExt, 'mp3', (inputPath, outputPath) => new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath).noVideo().toFormat('mp3');
    if (opts.bitrate) cmd = cmd.audioBitrate(opts.bitrate);
    cmd.on('end', resolve).on('error', reject).save(outputPath);
  }));
  return { buffer: outBuffer, mime: 'audio/mpeg' };
}

// ================= CSV <-> JSON (parser sendiri, tanpa dependency tambahan) =================

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.length > 1 || r[0] !== '').map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    return obj;
  });
}

function csvToJson(buffer) {
  const objs = parseCsv(buffer.toString('utf-8'));
  return Buffer.from(JSON.stringify(objs, null, 2), 'utf-8');
}

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function jsonToCsv(buffer) {
  const data = JSON.parse(buffer.toString('utf-8'));
  const arr = Array.isArray(data) ? data : [data];
  if (!arr.length) return Buffer.from('', 'utf-8');
  const headers = [...new Set(arr.flatMap((o) => Object.keys(o)))];
  const lines = [headers.map(csvField).join(',')];
  arr.forEach((o) => lines.push(headers.map((h) => csvField(o[h])).join(',')));
  return Buffer.from(lines.join('\r\n'), 'utf-8');
}

module.exports = {
  convertImage, convertAudio, convertVideo, extractAudioFromVideo,
  csvToJson, jsonToCsv,
  IMAGE_MIME, AUDIO_MIME, VIDEO_MIME, RESOLUTIONS,
};
