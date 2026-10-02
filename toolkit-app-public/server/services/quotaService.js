const fs = require('fs');
const path = require('path');

/**
 * Kuota harian AI (reset tiap 24 jam real-time berdasarkan timestamp first-use window).
 * Disimpan di data/quota.json — di Electron ikut userData lewat historyService dataDir.
 */

const DEFAULTS = {
  aiCallsPerDay: 80, // semua panggilan Gemini (chat, surat, CV, solver, summary, quiz, office)
};

let quotaFile = null;

function init(dataDir) {
  const dir = dataDir || path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  quotaFile = path.join(dir, 'quota.json');
  ensure();
}

/** Tulis langsung ke disk. Tidak pernah memanggil ensure() lagi (hindari rekursi tak berujung). */
function writeRaw(data) {
  const tmp = quotaFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, quotaFile);
}

function ensure() {
  if (!quotaFile) init();
  if (!fs.existsSync(quotaFile)) {
    writeRaw({ windowStart: Date.now(), aiCalls: 0 });
  }
}

function read() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(quotaFile, 'utf8'));
  } catch {
    const fresh = { windowStart: Date.now(), aiCalls: 0 };
    writeRaw(fresh);
    return fresh;
  }
}

function write(data) {
  ensure();
  writeRaw(data);
}

function rollIfNeeded(state) {
  const now = Date.now();
  const elapsed = now - (state.windowStart || 0);
  if (elapsed >= 24 * 60 * 60 * 1000) {
    state = { windowStart: now, aiCalls: 0 };
    write(state);
  }
  return state;
}

function getLimits() {
  try {
    const config = require('../config/config.json');
    return {
      aiCallsPerDay: config.limits?.aiCallsPerDay ?? DEFAULTS.aiCallsPerDay,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function status() {
  let state = rollIfNeeded(read());
  const limits = getLimits();
  const resetInMs = Math.max(0, (state.windowStart || Date.now()) + 24 * 60 * 60 * 1000 - Date.now());
  return {
    aiCalls: state.aiCalls || 0,
    limits,
    resetInMs,
    resetAt: new Date((state.windowStart || Date.now()) + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * @param {'ai'} kind
 */
function consume(kind = 'ai') {
  let state = rollIfNeeded(read());
  const limits = getLimits();

  if ((state.aiCalls || 0) >= limits.aiCallsPerDay) {
    throw new Error(
      `Kuota AI hari ini habis (${limits.aiCallsPerDay}/hari). Reset otomatis dalam ${formatRemain(status().resetInMs)}.`
    );
  }
  state.aiCalls = (state.aiCalls || 0) + 1;

  write(state);
  return status();
}

function formatRemain(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} jam ${m} menit`;
  return `${m} menit`;
}

module.exports = { init, status, consume, getLimits };
