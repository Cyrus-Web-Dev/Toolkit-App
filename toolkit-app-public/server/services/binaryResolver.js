const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Cari binary eksternal di PATH + lokasi umum Windows (Chocolatey, Program Files).
 * Node/Electron sering tidak mewarisi PATH yang sama dengan PowerShell user.
 */

function existsFile(p) {
  try {
    return p && fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function which(cmd) {
  try {
    const isWin = process.platform === 'win32';
    const finder = isWin ? 'where' : 'which';
    const r = spawnSync(finder, [cmd], {
      encoding: 'utf8',
      windowsHide: true,
      shell: isWin,
      env: process.env,
    });
    if (r.status === 0 && r.stdout) {
      const line = r.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (line && existsFile(line)) return line;
    }
  } catch { /* ignore */ }
  return null;
}

function walkFind(root, name, maxDepth = 4) {
  if (!root || !fs.existsSync(root)) return null;
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && ent.name.toLowerCase() === name.toLowerCase()) {
        return full;
      }
      if (ent.isDirectory() && depth < maxDepth) {
        // skip folder berat
        if (/node_modules|\.git|Windows|WinSxS/i.test(ent.name)) continue;
        queue.push({ dir: full, depth: depth + 1 });
      }
    }
  }
  return null;
}

/**
 * @param {string} commandName e.g. 'pdftoppm' or 'soffice'
 * @param {{envVar?: string, windowsNames?: string[], extraDirs?: string[]}} opts
 */
function resolveBinary(commandName, opts = {}) {
  // 1) Env override
  if (opts.envVar && process.env[opts.envVar]) {
    const p = process.env[opts.envVar];
    if (existsFile(p)) return p;
  }

  const isWin = process.platform === 'win32';
  const names = isWin
    ? (opts.windowsNames || [`${commandName}.exe`, commandName])
    : [commandName];

  // 2) which/where
  for (const n of names) {
    const found = which(n);
    if (found) return found;
  }

  // 3) Lokasi umum
  const dirs = [...(opts.extraDirs || [])];

  if (isWin) {
    const pd = process.env.ProgramData || 'C:\\ProgramData';
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';

    dirs.push(
      path.join(pd, 'chocolatey', 'bin'),
      path.join(pd, 'chocolatey', 'lib'),
      path.join(pf, 'poppler', 'Library', 'bin'),
      path.join(pf, 'poppler', 'bin'),
      path.join(pf86, 'poppler', 'Library', 'bin'),
      path.join(pf, 'LibreOffice', 'program'),
      path.join(pf86, 'LibreOffice', 'program'),
      path.join(local, 'Programs', 'poppler', 'Library', 'bin')
    );

    // Chocolatey package folders (strukturnya bisa berubah antar versi)
    const chocoLib = path.join(pd, 'chocolatey', 'lib');
    if (fs.existsSync(chocoLib)) {
      try {
        for (const pkg of fs.readdirSync(chocoLib)) {
          if (/poppler|libreoffice/i.test(pkg)) {
            dirs.push(path.join(chocoLib, pkg));
            dirs.push(path.join(chocoLib, pkg, 'tools'));
          }
        }
      } catch { /* ignore */ }
    }
  } else {
    dirs.push('/usr/bin', '/usr/local/bin', '/opt/homebrew/bin');
  }

  for (const dir of dirs) {
    for (const n of names) {
      const candidate = path.join(dir, n);
      if (existsFile(candidate)) return candidate;
    }
  }

  // 4) Deep search terbatas di chocolatey lib / poppler
  if (isWin) {
    const searchRoots = [];
    const pd = process.env.ProgramData || 'C:\\ProgramData';
    searchRoots.push(path.join(pd, 'chocolatey', 'lib', 'poppler'));
    searchRoots.push(path.join(pd, 'chocolatey', 'lib'));
    for (const root of searchRoots) {
      for (const n of names) {
        const found = walkFind(root, n, 5);
        if (found) return found;
      }
    }
  }

  // 5) Fallback: nama perintah (biar error ENOENT tetap informatif)
  return names[0];
}

function resolvePdftoppm() {
  return resolveBinary('pdftoppm', {
    envVar: 'PDFTOPPM_PATH',
    windowsNames: ['pdftoppm.exe', 'pdftoppm'],
  });
}

function resolveSoffice() {
  return resolveBinary('soffice', {
    envVar: 'LIBREOFFICE_PATH',
    windowsNames: ['soffice.exe', 'soffice.com', 'soffice'],
  });
}

module.exports = {
  resolveBinary,
  resolvePdftoppm,
  resolveSoffice,
  existsFile,
};
