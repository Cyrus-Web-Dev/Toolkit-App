const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomBytes } = require('crypto');
const historyService = require('../services/historyService');
const { findSoffice } = require('../services/binaryFinder');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (process.platform === 'win32') {
      const extra = [
        path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin'),
      ];
      env.Path = [...extra, env.Path || env.PATH || ''].join(';');
      env.PATH = env.Path;
    }
    const child = spawn(cmd, args, { cwd, windowsHide: true, env, shell: false });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          'LibreOffice (soffice) tidak ditemukan dari aplikasi. Set LIBREOFFICE_PATH ke path soffice.exe, lalu restart app.'
        ));
      } else reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-600) || `LibreOffice exit ${code}`));
    });
  });
}

router.get('/status', (req, res) => {
  const bin = findSoffice();
  res.json({ ok: true, found: !!bin, path: bin || null });
});

router.post('/', upload.single('file'), async (req, res) => {
  const tmp = path.join(os.tmpdir(), 'toolkit-office-' + randomBytes(6).toString('hex'));
  try {
    if (!req.file) throw new Error('File Office wajib diisi (.docx, .xlsx, .pptx, .odt, ...).');
    const bin = findSoffice();
    if (!bin) {
      throw new Error(
        'LibreOffice tidak ditemukan. Install LibreOffice atau set LIBREOFFICE_PATH ke soffice.exe, lalu restart aplikasi.'
      );
    }

    fs.mkdirSync(tmp, { recursive: true });
    const ext = path.extname(req.file.originalname || '') || '.docx';
    const inputPath = path.join(tmp, 'input' + ext);
    fs.writeFileSync(inputPath, req.file.buffer);

    await run(bin, ['--headless', '--nologo', '--nofirststartwizard', '--convert-to', 'pdf', '--outdir', tmp, inputPath], tmp);

    const pdfs = fs.readdirSync(tmp).filter((f) => f.endsWith('.pdf'));
    if (!pdfs.length) throw new Error('Konversi selesai tapi file PDF tidak ditemukan. Binary: ' + bin);

    const buf = fs.readFileSync(path.join(tmp, pdfs[0]));
    try {
      historyService.add({
        module: 'officeToPdf',
        action: 'convert',
        label: `Office → PDF: ${req.file.originalname || 'dokumen'}`,
      });
    } catch { /* ignore */ }

    const base = path.basename(req.file.originalname || 'converted', ext);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${base}.pdf"`,
    });
    res.send(buf);
  } catch (err) {
    console.error('[office-to-pdf]', err.message);
    res.status(400).json({ ok: false, message: err.message });
  } finally {
    setTimeout(() => {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    }, 1500);
  }
});

module.exports = router;
