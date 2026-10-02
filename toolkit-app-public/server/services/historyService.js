const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const TTL_MS = 30 * 60 * 1000; // 30 menit
const MAX_ENTRIES = 200;

let dataDir = null;
let historyFile = null;
let cleanupTimer = null;

/**
 * Inisialisasi path data. Dipanggil sekali saat server start.
 * Di Electron production, path diarahkan ke userData supaya bisa ditulis.
 */
function init(customDataDir) {
  if (customDataDir) {
    dataDir = customDataDir;
  } else {
    // Default: folder data/ di root project
    dataDir = path.join(__dirname, '..', '..', 'data');
  }
  historyFile = path.join(dataDir, 'history.json');
  ensureDataDir();
  // Cleanup saat startup (penting: jalan meski app sempat ditutup)
  cleanupExpired();
  // Cleanup berkala tiap 5 menit selama server hidup
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = setInterval(() => {
    try { cleanupExpired(); } catch (e) { console.warn('[history] cleanup interval', e.message); }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(historyFile)) return [];
  try {
    const raw = fs.readFileSync(historyFile, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  ensureDataDir();
  const tmp = historyFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf8');
  fs.renameSync(tmp, historyFile);
}

function now() {
  return Date.now();
}

/**
 * Tambah entri riwayat.
 * @param {object} opts
 * @param {string} opts.module  - id modul (pdfTools, bgRemoveBatch, ...)
 * @param {string} opts.action  - aksi singkat (merge, remove-bg, convert, download, ...)
 * @param {string} opts.label   - teks yang ditampilkan ke user
 * @param {object} [opts.meta]  - data tambahan (opsional)
 * @param {string[]} [opts.filePaths] - path file sementara yang perlu dihapus saat cleanup
 */
function add({ module, action, label, meta = {}, filePaths = [] }) {
  if (!historyFile) init();
  const entry = {
    id: randomBytes(8).toString('hex'),
    module: String(module || 'unknown'),
    action: String(action || 'unknown'),
    label: String(label || action || 'Operasi'),
    timestamp: now(),
    expiresAt: now() + TTL_MS,
    meta: meta || {},
    filePaths: Array.isArray(filePaths) ? filePaths.filter(Boolean) : [],
  };

  let entries = readAll();
  entries.unshift(entry); // terbaru di atas
  // Batasi jumlah
  if (entries.length > MAX_ENTRIES) {
    const removed = entries.splice(MAX_ENTRIES);
    removed.forEach(removeAssociatedFiles);
  }
  writeAll(entries);
  return entry;
}

function list() {
  if (!historyFile) init();
  // Selalu filter yang sudah expired dulu
  cleanupExpired();
  return readAll().map((e) => ({
    id: e.id,
    module: e.module,
    action: e.action,
    label: e.label,
    timestamp: e.timestamp,
    expiresAt: e.expiresAt,
    meta: e.meta || {},
  }));
}

function remove(id) {
  if (!historyFile) init();
  let entries = readAll();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  const [removed] = entries.splice(idx, 1);
  removeAssociatedFiles(removed);
  writeAll(entries);
  return true;
}

function clearAll() {
  if (!historyFile) init();
  const entries = readAll();
  entries.forEach(removeAssociatedFiles);
  writeAll([]);
  return true;
}

function removeAssociatedFiles(entry) {
  if (!entry || !Array.isArray(entry.filePaths)) return;
  for (const fp of entry.filePaths) {
    try {
      if (fp && fs.existsSync(fp)) {
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) {
          fs.rmSync(fp, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fp);
        }
      }
    } catch (err) {
      console.warn('[history] gagal hapus file', fp, err.message);
    }
  }
}

/**
 * Hapus entri yang sudah lewat 30 menit + file terkait.
 * Dipanggil saat startup dan tiap 5 menit.
 */
function cleanupExpired() {
  if (!historyFile) return { removed: 0 };
  const nowTs = now();
  let entries = readAll();
  const keep = [];
  let removed = 0;
  for (const e of entries) {
    if (e.expiresAt && e.expiresAt <= nowTs) {
      removeAssociatedFiles(e);
      removed += 1;
    } else {
      keep.push(e);
    }
  }
  if (removed > 0) {
    writeAll(keep);
    console.log(`[history] auto-cleanup: ${removed} entri kedaluwarsa dihapus`);
  }
  return { removed };
}

function getDataDir() {
  return dataDir;
}

module.exports = {
  init,
  add,
  list,
  remove,
  clearAll,
  cleanupExpired,
  getDataDir,
  TTL_MS,
};
