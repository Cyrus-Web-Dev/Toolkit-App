const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const ExcelJS = require('exceljs');
const PptxGenJS = require('pptxgenjs');
const geminiService = require('./geminiService');

/**
 * Generate struktur dokumen dari prompt user via Gemini, lalu bangun file biner.
 */

async function generateWord(prompt) {
  const systemHint = `Kamu membuat struktur dokumen Word.
Balas HANYA JSON valid tanpa markdown:
{
  "title": "judul dokumen",
  "sections": [
    { "heading": "Judul bagian (opsional)", "paragraphs": ["paragraf 1", "paragraf 2"] }
  ]
}
Isi harus relevan dengan permintaan user, bahasa mengikuti bahasa user.`;

  const data = await geminiService.generateJson(
    systemHint + '\n\nPermintaan user:\n' + prompt,
    { temperature: 0.7, maxOutputTokens: 3000 }
  );

  const children = [];
  if (data.title) {
    children.push(
      new Paragraph({
        text: String(data.title),
        heading: HeadingLevel.TITLE,
        spacing: { after: 300 },
      })
    );
  }
  for (const sec of data.sections || []) {
    if (sec.heading) {
      children.push(
        new Paragraph({
          text: String(sec.heading),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    }
    for (const para of sec.paragraphs || []) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: String(para), size: 22 })],
          spacing: { after: 160 },
        })
      );
    }
  }
  if (!children.length) {
    children.push(new Paragraph({ text: 'Dokumen kosong — coba prompt yang lebih jelas.' }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  const filename = safeName(data.title || 'dokumen', 'docx');
  return { buffer, filename, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

async function generateExcel(prompt) {
  const systemHint = `Kamu membuat struktur spreadsheet Excel.
Balas HANYA JSON valid tanpa markdown:
{
  "title": "nama sheet",
  "headers": ["Kolom1", "Kolom2"],
  "rows": [
    ["nilai1", "nilai2"],
    ["nilai3", "nilai4"]
  ]
}
Maksimal 50 baris data. Bahasa mengikuti user.`;

  const data = await geminiService.generateJson(
    systemHint + '\n\nPermintaan user:\n' + prompt,
    { temperature: 0.5, maxOutputTokens: 3000 }
  );

  const wb = new ExcelJS.Workbook();
  const sheetName = String(data.title || 'Sheet1').slice(0, 31) || 'Sheet1';
  const ws = wb.addWorksheet(sheetName);

  const headers = Array.isArray(data.headers) ? data.headers.map(String) : ['Kolom'];
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };

  for (const row of data.rows || []) {
    ws.addRow((Array.isArray(row) ? row : [row]).map((c) => (c == null ? '' : c)));
  }

  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = 18;
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = safeName(data.title || 'spreadsheet', 'xlsx');
  return {
    buffer,
    filename,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

async function generatePpt(prompt) {
  const systemHint = `Kamu membuat struktur presentasi PowerPoint.
Balas HANYA JSON valid tanpa markdown:
{
  "title": "judul presentasi",
  "slides": [
    { "title": "Judul slide", "bullets": ["poin 1", "poin 2"] }
  ]
}
Maksimal 12 slide. Bahasa mengikuti user.`;

  const data = await geminiService.generateJson(
    systemHint + '\n\nPermintaan user:\n' + prompt,
    { temperature: 0.7, maxOutputTokens: 3000 }
  );

  const pptx = new PptxGenJS();
  pptx.author = 'Toolkit App';
  pptx.title = String(data.title || 'Presentasi');

  // Slide judul
  const titleSlide = pptx.addSlide();
  titleSlide.addText(String(data.title || 'Presentasi'), {
    x: 0.5, y: 2.2, w: 9, h: 1.2,
    fontSize: 32, bold: true, color: '1B2026',
  });

  for (const s of data.slides || []) {
    const slide = pptx.addSlide();
    slide.addText(String(s.title || 'Slide'), {
      x: 0.5, y: 0.4, w: 9, h: 0.8,
      fontSize: 24, bold: true, color: '1B2026',
    });
    const bullets = (s.bullets || []).map(String);
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        { x: 0.7, y: 1.4, w: 8.5, h: 4.5, fontSize: 16, color: '333333', valign: 'top' }
      );
    }
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);
  const filename = safeName(data.title || 'presentasi', 'pptx');
  return {
    buffer,
    filename,
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
}

function safeName(title, ext) {
  const base = String(title || 'dokumen')
    .replace(/[^\w\s\-().\u00C0-\u024F]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'dokumen';
  return `${base}.${ext}`;
}

module.exports = { generateWord, generateExcel, generatePpt };
