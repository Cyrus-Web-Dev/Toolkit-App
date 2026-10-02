const { PDFDocument, degrees, rgb, StandardFonts } = require('pdf-lib');

/**
 * Gabungkan banyak PDF jadi satu, urut sesuai urutan input.
 * @param {Buffer[]} buffers
 */
async function mergePdfs(buffers) {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/**
 * Pecah PDF jadi beberapa file berdasarkan rentang halaman.
 * @param {Buffer} buffer
 * @param {{from:number,to:number}[]} ranges - 1-indexed, inklusif
 * @returns {Promise<{name:string, buffer:Buffer}[]>}
 */
async function splitPdf(buffer, ranges) {
  const doc = await PDFDocument.load(buffer);
  const total = doc.getPageCount();
  const results = [];

  for (let i = 0; i < ranges.length; i++) {
    const { from, to } = ranges[i];
    if (from < 1 || to > total || from > to) {
      throw new Error(`Rentang halaman ${from}-${to} tidak valid (dokumen punya ${total} halaman).`);
    }
    const out = await PDFDocument.create();
    const indices = [];
    for (let p = from; p <= to; p++) indices.push(p - 1);
    const copied = await out.copyPages(doc, indices);
    copied.forEach((p) => out.addPage(p));
    results.push({ name: `bagian-${i + 1}_hal${from}-${to}.pdf`, buffer: Buffer.from(await out.save()) });
  }
  return results;
}

/**
 * Hapus halaman tertentu dari PDF.
 * @param {Buffer} buffer
 * @param {number[]} pagesToRemove - 1-indexed
 */
async function removePages(buffer, pagesToRemove) {
  const doc = await PDFDocument.load(buffer);
  const total = doc.getPageCount();

  const unique = [...new Set(pagesToRemove)];
  if (unique.length >= total) {
    throw new Error('Tidak bisa menghapus semua halaman — dokumen akan kosong.');
  }
  // hapus dari index terbesar dulu supaya index sisanya tidak bergeser
  unique.sort((a, b) => b - a).forEach((p) => {
    if (p < 1 || p > total) throw new Error(`Halaman ${p} tidak ada di dokumen.`);
    doc.removePage(p - 1);
  });
  return doc.save();
}

/**
 * Putar halaman (semua atau sebagian) sejumlah derajat kelipatan 90.
 * @param {Buffer} buffer
 * @param {number} angle - 90 | 180 | 270 | -90
 * @param {number[]|null} pages - 1-indexed, null = semua halaman
 */
async function rotatePages(buffer, angle, pages) {
  const doc = await PDFDocument.load(buffer);
  const targets = pages && pages.length ? pages.map((p) => p - 1) : doc.getPageIndices();
  targets.forEach((idx) => {
    const page = doc.getPage(idx);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle + 360) % 360));
  });
  return doc.save();
}

/**
 * Susun ulang urutan halaman.
 * @param {Buffer} buffer
 * @param {number[]} newOrder - 1-indexed, harus memuat semua halaman persis sekali
 */
async function reorderPages(buffer, newOrder) {
  const doc = await PDFDocument.load(buffer);
  const total = doc.getPageCount();
  if (newOrder.length !== total || new Set(newOrder).size !== total) {
    throw new Error('Urutan baru harus memuat setiap halaman tepat satu kali.');
  }
  const out = await PDFDocument.create();
  const indices = newOrder.map((p) => p - 1);
  const copied = await out.copyPages(doc, indices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

/**
 * Tambah watermark teks diagonal ke semua halaman.
 */
async function addWatermark(buffer, text, opts = {}) {
  const { size = 48, opacity = 0.25, rotate = -45 } = opts;
  const doc = await PDFDocument.load(buffer);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 2 - (text.length * size) / 4,
      y: height / 2,
      size,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity,
      rotate: degrees(rotate),
    });
  });
  return doc.save();
}

/**
 * Gabungkan beberapa gambar (JPG/PNG) jadi satu PDF, satu gambar per halaman.
 * @param {{buffer:Buffer, mime:string}[]} images
 */
async function imagesToPdf(images) {
  const doc = await PDFDocument.create();
  for (const img of images) {
    // PENTING: pdf-lib membaca header JPEG langsung dari `buffer.buffer`
    // (ArrayBuffer mentah) tanpa memperhitungkan `byteOffset`. Buffer dari
    // multer/fs bisa punya byteOffset > 0 (dialokasikan dari pool internal
    // Node), sehingga pdf-lib salah baca header dan gagal dengan error
    // "SOI not found in JPEG" walau filenya valid. `Buffer.from(buffer)` SAJA
    // TIDAK CUKUP — untuk buffer kecil, Node tetap mengalokasikannya dari pool
    // yang sama sehingga byteOffset masih > 0. Kita harus benar-benar
    // memotong ArrayBuffer-nya (·slice·) supaya hasilnya punya ArrayBuffer
    // baru dengan byteOffset pasti 0.
    const safeBuffer = Buffer.from(
      img.buffer.buffer.slice(img.buffer.byteOffset, img.buffer.byteOffset + img.buffer.byteLength)
    );
    const embedded = img.mime === 'image/png'
      ? await doc.embedPng(safeBuffer)
      : await doc.embedJpg(safeBuffer);
    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  return doc.save();
}

/**
 * Kompresi "ringan": rewrite struktur internal PDF pakai object streams.
 * CATATAN JUJUR: ini bukan kompresi gambar di dalam PDF (itu perlu re-encode
 * tiap gambar, di luar kemampuan pdf-lib). Untuk PDF berisi banyak gambar
 * resolusi tinggi, penurunan ukurannya akan kecil. Perbaikan lanjutan bisa
 * pakai library image re-encode terpisah di tahap berikutnya.
 */
async function compressPdf(buffer) {
  const doc = await PDFDocument.load(buffer);
  return doc.save({ useObjectStreams: true });
}

// ================= GENERATOR PDF DARI TEKS (surat lamaran, dll) =================

const PAGE = { width: 595, height: 842, margin: 56 }; // A4

function wrapLine(font, text, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function wrapParagraphs(font, text, size, maxWidth) {
  // hormati baris kosong / newline yang sudah ada di teks asli
  return text.split('\n').flatMap((line) => (line.trim() === '' ? [''] : wrapLine(font, line, size, maxWidth)));
}

/**
 * Bikin PDF sederhana dari teks bebas, rata kiri, wrap otomatis, multi-halaman.
 * @param {string} bodyText
 * @param {{title?:string}} opts
 */
async function createTextDocument(bodyText, opts = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 11;
  const lineHeight = size * 1.5;
  const maxWidth = PAGE.width - PAGE.margin * 2;

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const newPageIfNeeded = () => {
    if (y < PAGE.margin) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };

  if (opts.title) {
    page.drawText(opts.title, { x: PAGE.margin, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= 16 * 1.8;
  }

  const lines = wrapParagraphs(font, bodyText, size, maxWidth);
  lines.forEach((line) => {
    newPageIfNeeded();
    if (line) page.drawText(line, { x: PAGE.margin, y, size, font, color: rgb(0.15, 0.15, 0.15) });
    y -= lineHeight;
  });

  return doc.save();
}

/**
 * Bikin PDF CV dari data terstruktur.
 * @param {{nama?:string, email?:string, telepon?:string, alamat?:string}} personal
 * @param {{ringkasan?:string, pengalaman?:{posisi?:string, perusahaan?:string, periode?:string, deskripsi?:string}[],
 *          pendidikan?:{institusi?:string, gelar?:string, periode?:string}[], keahlian?:string[], lainnya?:string}} data
 */
async function createCvPdf(personal, data) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE.width - PAGE.margin * 2;
  const accent = rgb(0.06, 0.45, 0.42); // senada warna teal aplikasi

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const newPageIfNeeded = (needed = 20) => {
    if (y < PAGE.margin + needed) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };

  const drawParagraph = (text, size = 10.5, color = rgb(0.2, 0.2, 0.2), f = font) => {
    wrapParagraphs(f, text, size, maxWidth).forEach((line) => {
      newPageIfNeeded();
      if (line) page.drawText(line, { x: PAGE.margin, y, size, font: f, color });
      y -= size * 1.45;
    });
  };

  const drawSectionTitle = (title) => {
    newPageIfNeeded(40);
    y -= 10;
    page.drawText(title.toUpperCase(), { x: PAGE.margin, y, size: 12, font: boldFont, color: accent });
    y -= 6;
    page.drawLine({
      start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y },
      thickness: 1, color: rgb(0.85, 0.85, 0.85),
    });
    y -= 16;
  };

  // --- header ---
  page.drawText(personal.nama || 'Tanpa Nama', { x: PAGE.margin, y, size: 22, font: boldFont, color: rgb(0.05, 0.05, 0.05) });
  y -= 26;
  const contactLine = [personal.email, personal.telepon, personal.alamat].filter(Boolean).join('   ·   ');
  if (contactLine) {
    page.drawText(contactLine, { x: PAGE.margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 20;
  }

  if (data.ringkasan) {
    drawSectionTitle('Ringkasan');
    drawParagraph(data.ringkasan);
  }

  if (data.pengalaman?.length) {
    drawSectionTitle('Pengalaman Kerja');
    data.pengalaman.forEach((exp) => {
      newPageIfNeeded(30);
      const heading = [exp.posisi, exp.perusahaan].filter(Boolean).join(' — ');
      page.drawText(heading, { x: PAGE.margin, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      if (exp.periode) {
        const w = boldFont.widthOfTextAtSize(exp.periode, 9.5);
        page.drawText(exp.periode, { x: PAGE.width - PAGE.margin - w, y, size: 9.5, font, color: rgb(0.5, 0.5, 0.5) });
      }
      y -= 15;
      if (exp.deskripsi) drawParagraph(exp.deskripsi, 10, rgb(0.25, 0.25, 0.25));
      y -= 6;
    });
  }

  if (data.pendidikan?.length) {
    drawSectionTitle('Pendidikan');
    data.pendidikan.forEach((edu) => {
      newPageIfNeeded(24);
      const heading = [edu.gelar, edu.institusi].filter(Boolean).join(' — ');
      page.drawText(heading, { x: PAGE.margin, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      if (edu.periode) {
        const w = boldFont.widthOfTextAtSize(edu.periode, 9.5);
        page.drawText(edu.periode, { x: PAGE.width - PAGE.margin - w, y, size: 9.5, font, color: rgb(0.5, 0.5, 0.5) });
      }
      y -= 20;
    });
  }

  if (data.keahlian?.length) {
    drawSectionTitle('Keahlian');
    drawParagraph(data.keahlian.join('   ·   '), 10.5, rgb(0.25, 0.25, 0.25));
  }

  if (data.lainnya) {
    drawSectionTitle('Lainnya');
    drawParagraph(data.lainnya);
  }

  return doc.save();
}


/**
 * Tambah nomor halaman di setiap halaman.
 * @param {Buffer} buffer
 * @param {{position?:'bottom-center'|'bottom-right'|'bottom-left', start?:number, format?:string}} opts
 * format contoh: "{n}" atau "Halaman {n} dari {total}"
 */
async function addPageNumbers(buffer, opts = {}) {
  const position = opts.position || 'bottom-center';
  const start = typeof opts.start === 'number' ? opts.start : 1;
  const format = opts.format || '{n}';
  const doc = await PDFDocument.load(buffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, i) => {
    const n = start + i;
    const label = format
      .replace(/\{n\}/g, String(n))
      .replace(/\{total\}/g, String(total));
    const { width } = page.getSize();
    const size = 10;
    const textWidth = font.widthOfTextAtSize(label, size);
    let x = (width - textWidth) / 2;
    if (position === 'bottom-right') x = width - textWidth - 40;
    if (position === 'bottom-left') x = 40;
    page.drawText(label, {
      x,
      y: 28,
      size,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  });
  return doc.save();
}

/**
 * Ekstrak halaman tertentu jadi PDF baru.
 * @param {Buffer} buffer
 * @param {number[]} pages - nomor halaman 1-based
 */
async function extractPages(buffer, pages) {
  const src = await PDFDocument.load(buffer);
  const total = src.getPageCount();
  const indices = [...new Set(pages.map((p) => p - 1))]
    .filter((i) => i >= 0 && i < total)
    .sort((a, b) => a - b);
  if (!indices.length) throw new Error('Tidak ada nomor halaman valid untuk diekstrak.');

  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

/**
 * Potong (crop) semua halaman dengan margin (pt) dari tiap sisi.
 * @param {Buffer} buffer
 * @param {{top?:number,right?:number,bottom?:number,left?:number}} margins
 */
async function cropPdf(buffer, margins = {}) {
  const top = Number(margins.top) || 0;
  const right = Number(margins.right) || 0;
  const bottom = Number(margins.bottom) || 0;
  const left = Number(margins.left) || 0;
  if (top + bottom + left + right === 0) {
    throw new Error('Isi minimal satu nilai margin crop (pt).');
  }

  const doc = await PDFDocument.load(buffer);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const newW = Math.max(20, width - left - right);
    const newH = Math.max(20, height - top - bottom);
    // CropBox: [x, y, x+w, y+h] di koordinat PDF (origin kiri-bawah)
    page.setCropBox(left, bottom, newW, newH);
    page.setMediaBox(left, bottom, newW, newH);
  });
  return doc.save();
}

/**
 * Resume ATS AI — beda dari CV Builder: fokus pada 1 posisi target,
 * pakai bullet point (bukan paragraf) untuk pengalaman, dan menampilkan
 * daftar kata kunci ATS yang berhasil disisipkan supaya lolos sistem
 * pemindai otomatis. Layout tetap 1 kolom murni teks — memang sengaja,
 * karena parser ATS sering gagal baca kolom ganda/tabel/ikon.
 */
async function createResumePdf(personal, data) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE.width - PAGE.margin * 2;
  const accent = rgb(0.06, 0.45, 0.42);

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const newPageIfNeeded = (needed = 20) => {
    if (y < PAGE.margin + needed) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };

  const drawParagraph = (text, size = 10.5, color = rgb(0.2, 0.2, 0.2), f = font) => {
    wrapParagraphs(f, text, size, maxWidth).forEach((line) => {
      newPageIfNeeded();
      if (line) page.drawText(line, { x: PAGE.margin, y, size, font: f, color });
      y -= size * 1.45;
    });
  };

  const drawBullet = (text, size = 10) => {
    wrapParagraphs(font, text, size, maxWidth - 14).forEach((line, i) => {
      newPageIfNeeded();
      if (i === 0) page.drawText('•', { x: PAGE.margin, y, size, font, color: accent });
      if (line) page.drawText(line, { x: PAGE.margin + 12, y, size, font, color: rgb(0.25, 0.25, 0.25) });
      y -= size * 1.45;
    });
  };

  const drawSectionTitle = (title) => {
    newPageIfNeeded(40);
    y -= 10;
    page.drawText(title.toUpperCase(), { x: PAGE.margin, y, size: 12, font: boldFont, color: accent });
    y -= 6;
    page.drawLine({
      start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y },
      thickness: 1, color: rgb(0.85, 0.85, 0.85),
    });
    y -= 16;
  };

  // --- header ---
  page.drawText(personal.nama || 'Tanpa Nama', { x: PAGE.margin, y, size: 22, font: boldFont, color: rgb(0.05, 0.05, 0.05) });
  y -= 20;
  if (data.posisiTarget) {
    page.drawText(data.posisiTarget, { x: PAGE.margin, y, size: 12.5, font: boldFont, color: accent });
    y -= 18;
  }
  const contactLine = [personal.email, personal.telepon, personal.alamat].filter(Boolean).join('   ·   ');
  if (contactLine) {
    page.drawText(contactLine, { x: PAGE.margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 20;
  }

  if (data.ringkasan) {
    drawSectionTitle('Ringkasan Profil');
    drawParagraph(data.ringkasan);
  }

  if (data.kataKunciATS?.length) {
    drawSectionTitle('Kata Kunci ATS Tersisip');
    drawParagraph(data.kataKunciATS.join('   ·   '), 10, accent, boldFont);
  }

  if (data.pengalaman?.length) {
    drawSectionTitle('Pengalaman Kerja');
    data.pengalaman.forEach((exp) => {
      newPageIfNeeded(30);
      const heading = [exp.posisi, exp.perusahaan].filter(Boolean).join(' — ');
      page.drawText(heading, { x: PAGE.margin, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      if (exp.periode) {
        const w = boldFont.widthOfTextAtSize(exp.periode, 9.5);
        page.drawText(exp.periode, { x: PAGE.width - PAGE.margin - w, y, size: 9.5, font, color: rgb(0.5, 0.5, 0.5) });
      }
      y -= 15;
      const bullets = Array.isArray(exp.bullet) ? exp.bullet : (exp.bullet ? [exp.bullet] : []);
      bullets.forEach((b) => drawBullet(b));
      y -= 6;
    });
  }

  if (data.pendidikan?.length) {
    drawSectionTitle('Pendidikan');
    data.pendidikan.forEach((edu) => {
      newPageIfNeeded(24);
      const heading = [edu.gelar, edu.institusi].filter(Boolean).join(' — ');
      page.drawText(heading, { x: PAGE.margin, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      if (edu.periode) {
        const w = boldFont.widthOfTextAtSize(edu.periode, 9.5);
        page.drawText(edu.periode, { x: PAGE.width - PAGE.margin - w, y, size: 9.5, font, color: rgb(0.5, 0.5, 0.5) });
      }
      y -= 20;
    });
  }

  if (data.keahlian?.length) {
    drawSectionTitle('Keahlian');
    drawParagraph(data.keahlian.join('   ·   '), 10.5, rgb(0.25, 0.25, 0.25));
  }

  return doc.save();
}

module.exports = {
  mergePdfs,
  splitPdf,
  removePages,
  rotatePages,
  reorderPages,
  addWatermark,
  imagesToPdf,
  compressPdf,
  addPageNumbers,
  extractPages,
  cropPdf,
  createTextDocument,
  createCvPdf,
  createResumePdf,
};
