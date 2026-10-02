const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomBytes } = require('crypto');
const archiver = require('archiver');
const historyService = require('../services/historyService');
const { findPdftoppm } = require('../services/binaryFinder');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

function enrichEnv() {
  const env = { ...process.env };
  if (process.platform === 'win32') {
    const extras = [
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin'),
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'),
    ];
    const cur = env.Path || env.PATH || '';
    env.Path = [...extras, cur].join(';');
    env.PATH = env.Path;
  }
  return env;
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const env = enrichEnv();
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      env,
      shell: false,
    });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      // Fallback: shell true (pakai PATH shell user)
      if (err.code === 'ENOENT' && process.platform === 'win32') {
        const shellCmd = `"${cmd}" ${args.map((a) => `"${a}"`).join(' ')}`;
        const child2 = spawn(shellCmd, [], { cwd, windowsHide: true, env, shell: true });
        let se2 = '';
        let so2 = '';
        child2.stdout.on('data', (d) => { so2 += d.toString(); });
        child2.stderr.on('data', (d) => { se2 += d.toString(); });
        child2.on('error', (e2) => reject(e2));
        child2.on('close', (code) => {
          if (code === 0) resolve({ stdout: so2, stderr: se2 });
          else reject(new Error((se2 || so2 || '').trim().slice(-800) || `pdftoppm exit ${code}`));
        });
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || '').trim().slice(-800) || `pdftoppm exit ${code}`));
    });
  });
}

router.get('/status', (req, res) => {
  try {
    const bin = findPdftoppm();
    res.json({
      ok: true,
      found: !!bin,
      path: bin || null,
      popplerEnv: process.env.POPPLER_PATH || null,
      hint: bin
        ? null
        : 'Jalankan di PowerShell: where.exe pdftoppm — lalu setx POPPLER_PATH "FOLDER_YANG_BERISI_pdftoppm.exe" (bukan path contoh). Restart terminal & server.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, found: false, message: err.message });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  const tmp = path.join(os.tmpdir(), 'toolkit-pdfjpg-' + randomBytes(6).toString('hex'));
  try {
    if (!req.file) throw new Error('File PDF wajib diisi.');

    let bin = findPdftoppm();
    if (!bin) {
      // Coba nama polos — shell PATH
      bin = process.platform === 'win32' ? 'pdftoppm.exe' : 'pdftoppm';
    }

    fs.mkdirSync(tmp, { recursive: true });
    const pdfPath = path.join(tmp, 'input.pdf');
    fs.writeFileSync(pdfPath, req.file.buffer);
    const outPrefix = path.join(tmp, 'page');
    const dpi = Math.min(200, Math.max(72, parseInt(req.body.dpi, 10) || 120));

    try {
      await run(bin, ['-jpeg', '-r', String(dpi), pdfPath, outPrefix], tmp);
    } catch (err) {
      if (/ENOENT|not found|tidak bisa dijalankan/i.test(String(err.message))) {
        throw new Error(
          'pdftoppm tidak bisa dijalankan dari aplikasi.\n' +
          '1) PowerShell: where.exe pdftoppm\n' +
          '2) Salin FOLDER hasilnya (bukan file)\n' +
          '3) setx POPPLER_PATH "C:\\folder\\asli\\bukan\\contoh"\n' +
          '4) Tutup semua terminal, buka lagi, npm run server\n' +
          'Detail: ' + err.message
        );
      }
      throw err;
    }

    const files = fs.readdirSync(tmp).filter((f) => /\.jpe?g$/i.test(f)).sort();
    if (!files.length) throw new Error('Tidak ada JPG dihasilkan. Binary: ' + bin);

    try {
      historyService.add({
        module: 'pdfToJpg',
        action: 'convert',
        label: `PDF → JPG (${files.length} halaman)`,
      });
    } catch { /* ignore */ }

    if (files.length === 1) {
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'attachment; filename="halaman-1.jpg"',
      });
      res.send(fs.readFileSync(path.join(tmp, files[0])));
    } else {
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="pdf-ke-jpg.zip"',
      });
      const zip = archiver('zip');
      zip.pipe(res);
      files.forEach((f, i) => zip.file(path.join(tmp, f), { name: `halaman-${i + 1}.jpg` }));
      await zip.finalize();
    }
  } catch (err) {
    console.error('[pdf-to-jpg]', err.message);
    if (!res.headersSent) res.status(400).json({ ok: false, message: err.message });
  } finally {
    setTimeout(() => {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    }, 2500);
  }
});

module.exports = router;
