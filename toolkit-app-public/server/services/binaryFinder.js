const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function existsFile(p) {
  try {
    return !!(p && fs.existsSync(p) && fs.statSync(p).isFile());
  } catch {
    return false;
  }
}

function pathDirs() {
  const raw = process.env.PATH || process.env.Path || '';
  return raw.split(path.delimiter).filter(Boolean);
}

/** where.exe / command -v */
function whichSync(cmd) {
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('where.exe', [cmd], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 8000,
        env: process.env,
      });
      if (r.status === 0 && r.stdout) {
        const lines = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        for (const line of lines) {
          if (existsFile(line)) return line;
        }
      }
    } else {
      const r = spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8', timeout: 5000 });
      const p = (r.stdout || '').trim();
      if (existsFile(p)) return p;
    }
  } catch { /* ignore */ }
  return null;
}

function walkFind(root, names, maxDepth = 5) {
  if (!root || !fs.existsSync(root)) return null;
  const want = new Set(names.map((n) => n.toLowerCase()));
  const queue = [{ dir: root, depth: 0 }];
  let steps = 0;
  while (queue.length && steps < 4000) {
    steps += 1;
    const { dir, depth } = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && want.has(ent.name.toLowerCase())) return full;
      if (ent.isDirectory() && depth < maxDepth) {
        if (/node_modules|\.git|Windows|WinSxS|System32/i.test(ent.name)) continue;
        queue.push({ dir: full, depth: depth + 1 });
      }
    }
  }
  return null;
}

/**
 * POPPLER_PATH boleh:
 * - folder berisi pdftoppm.exe
 * - path penuh ke pdftoppm.exe
 */
function fromEnvPath(envVal, names) {
  if (!envVal || /path\\to\\folder|contoh|example/i.test(envVal)) return null;
  if (existsFile(envVal)) return envVal;
  for (const n of names) {
    const p = path.join(envVal, n);
    if (existsFile(p)) return p;
  }
  // kadang user kasih parent folder
  return walkFind(envVal, names, 3);
}

function findBinary(names) {
  const list = Array.isArray(names) ? names : [names];

  // Env khusus
  if (list.some((n) => /pdftoppm/i.test(n))) {
    const fromPoppler = fromEnvPath(process.env.POPPLER_PATH, list);
    if (fromPoppler) return fromPoppler;
  }
  if (list.some((n) => /soffice/i.test(n))) {
    if (process.env.LIBREOFFICE_PATH && existsFile(process.env.LIBREOFFICE_PATH)) {
      return process.env.LIBREOFFICE_PATH;
    }
  }

  // where
  for (const n of list) {
    const w = whichSync(n);
    if (w) return w;
  }

  // PATH dirs
  for (const dir of pathDirs()) {
    for (const n of list) {
      const p = path.join(dir, n);
      if (existsFile(p)) return p;
    }
  }

  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const home = process.env.USERPROFILE || '';

  const roots = [
    path.join(programData, 'chocolatey', 'bin'),
    path.join(programData, 'chocolatey', 'lib', 'poppler'),
    path.join(programData, 'chocolatey', 'lib'),
    path.join(pf, 'poppler'),
    path.join(pf, 'Poppler'),
    path.join(pf, 'LibreOffice', 'program'),
    path.join(pf86, 'LibreOffice', 'program'),
    path.join(home, 'scoop', 'shims'),
    path.join(home, 'scoop', 'apps', 'poppler'),
  ];

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    for (const n of list) {
      const direct = path.join(root, n);
      if (existsFile(direct)) return direct;
    }
    const found = walkFind(root, list, root.includes('chocolatey') ? 6 : 4);
    if (found) return found;
  }

  return null;
}

function findPdftoppm() {
  return findBinary(process.platform === 'win32' ? ['pdftoppm.exe', 'pdftoppm'] : ['pdftoppm']);
}

function findSoffice() {
  return findBinary(
    process.platform === 'win32' ? ['soffice.exe', 'soffice.com', 'soffice'] : ['soffice', 'libreoffice']
  );
}

module.exports = { findBinary, findPdftoppm, findSoffice, existsFile };
