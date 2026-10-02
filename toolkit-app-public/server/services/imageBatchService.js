const sharp = require('sharp');

/**
 * @param {Buffer} buffer
 * @param {{maxWidth?:number, maxHeight?:number, quality?:number, format?:string}} opts
 */
async function compressResize(buffer, opts = {}) {
  const quality = Math.min(100, Math.max(10, parseInt(opts.quality, 10) || 80));
  const maxWidth = opts.maxWidth ? parseInt(opts.maxWidth, 10) : null;
  const maxHeight = opts.maxHeight ? parseInt(opts.maxHeight, 10) : null;
  let format = (opts.format || 'jpeg').toLowerCase();
  if (format === 'jpg') format = 'jpeg';

  let pipeline = sharp(buffer).rotate();
  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize(maxWidth || null, maxHeight || null, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9 });
  else if (format === 'webp') pipeline = pipeline.webp({ quality });
  else pipeline = pipeline.jpeg({ quality, mozjpeg: true });

  const out = await pipeline.toBuffer();
  const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
  return { buffer: out, mime, format };
}

module.exports = { compressResize };
