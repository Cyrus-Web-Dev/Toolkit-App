const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomBytes } = require('crypto');
const sharp = require('sharp');

let removeBackgroundFn = null;
let loadError = null;

function loadLib() {
  if (removeBackgroundFn) return removeBackgroundFn;
  if (loadError) throw loadError;
  try {
    const mod = require('@imgly/background-removal-node');
    removeBackgroundFn = mod.removeBackground || mod.default || mod;
    if (typeof removeBackgroundFn !== 'function') {
      throw new Error('Export removeBackground tidak ada di @imgly/background-removal-node');
    }
    return removeBackgroundFn;
  } catch (err) {
    loadError = new Error(
      'Paket @imgly/background-removal-node gagal dimuat. Di folder project jalankan:\n' +
        '  npm install @imgly/background-removal-node sharp\nDetail: ' + err.message
    );
    throw loadError;
  }
}

function hexToRgb(hex) {
  let h = String(hex || '#ffffff').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length >= 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toBuffer(result) {
  if (Buffer.isBuffer(result)) return result;
  if (result instanceof Uint8Array) return Buffer.from(result);
  if (result && typeof result.arrayBuffer === 'function') {
    return Promise.resolve(result.arrayBuffer()).then((ab) => Buffer.from(ab));
  }
  if (result && result.buffer) return Buffer.from(result.buffer);
  throw new Error('Output model tidak dikenali: ' + Object.prototype.toString.call(result));
}

/**
 * @imgly kadang gagal deteksi format dari Buffer mentah →
 * kita pakai beberapa strategi: Blob typed, lalu file sementara .png
 */
async function runRemoval(pngBuffer) {
  const removeBackground = loadLib();
  const opts = {
    model: 'medium',
    output: { format: 'image/png', quality: 0.9 },
  };

  // Strategi 1: Blob dengan MIME PNG (Node 18+)
  try {
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    const result = await removeBackground(blob, opts);
    return await toBuffer(result);
  } catch (err1) {
    const m1 = String(err1.message || err1);
    // Strategi 2: Uint8Array
    try {
      const result = await removeBackground(new Uint8Array(pngBuffer), opts);
      return await toBuffer(result);
    } catch (err2) {
      // Strategi 3: file path sementara
      const tmp = path.join(os.tmpdir(), 'toolkit-bg-' + randomBytes(6).toString('hex') + '.png');
      try {
        fs.writeFileSync(tmp, pngBuffer);
        const result = await removeBackground(tmp, opts);
        return await toBuffer(result);
      } catch (err3) {
        const m3 = String(err3.message || err3);
        if (/fetch|network|ENOTFOUND|ECONN|download|EAI_AGAIN/i.test(m3 + m1)) {
          throw new Error(
            'Gagal mengunduh model AI (butuh internet di pemakaian pertama, ~85–180MB). Detail: ' + m3
          );
        }
        throw new Error(
          'Gagal menghapus background. Coba simpan ulang gambar sebagai PNG/JPG biasa. Detail: ' + m3
        );
      } finally {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      }
    }
  }
}

async function removeBg(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) {
    throw new Error('Data gambar kosong atau tidak valid.');
  }

  const mode = opts.mode === 'color' ? 'color' : 'transparent';
  let color = (opts.color || '#ffffff').trim();
  if (!color.startsWith('#')) color = '#' + color;

  // Selalu konversi ke PNG RGBA murni via sharp
  let pngBuffer;
  try {
    pngBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .ensureAlpha()
      .toFormat('png')
      .toBuffer();
  } catch (err) {
    throw new Error('Gambar tidak bisa dibaca. Pakai JPG/PNG/WEBP. Detail: ' + err.message);
  }

  const cutout = await runRemoval(pngBuffer);

  if (mode !== 'color') return cutout;

  try {
    const meta = await sharp(cutout).metadata();
    const w = meta.width || 1;
    const h = meta.height || 1;
    const bg = hexToRgb(color);
    return await sharp({
      create: { width: w, height: h, channels: 3, background: bg },
    })
      .composite([{ input: cutout, blend: 'over' }])
      .png()
      .toBuffer();
  } catch (err) {
    throw new Error('Cutout OK, gagal isi warna: ' + err.message);
  }
}

module.exports = { removeBg };
