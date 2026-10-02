const config = require('../config/config.json');
const quotaService = require('./quotaService');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function requireApiKey() {
  const { apiKey } = config.gemini;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'API key Gemini belum diisi. Buka server/config/config.json, isi field "gemini.apiKey".'
    );
  }
  return apiKey.trim();
}

/**
 * Kuota HANYA dipotong setelah respons sukses (bukan sebelum request).
 */
async function callGeminiRaw(contents, opts = {}) {
  const apiKey = requireApiKey();
  const model = opts.model || config.gemini.model;
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const generationConfig = {
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
  };
  if (opts.jsonMode) generationConfig.responseMimeType = 'application/json';
  if (opts.responseModalities) generationConfig.responseModalities = opts.responseModalities;

  const body = { contents, generationConfig };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error('Gagal menghubungi Gemini API. Pastikan internet aktif. Detail: ' + err.message);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    let message = `Gemini API error (${res.status}).`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) message += ' ' + parsed.error.message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const data = await res.json();

  // Kuota hanya setelah sukses
  if (!opts.skipQuota) {
    try {
      quotaService.consume('ai');
    } catch (qerr) {
      // Kuota habis setelah call sukses — jarang; tetap kembalikan data tapi info kuota
      console.warn('[quota]', qerr.message);
    }
  }

  return data;
}

function extractText(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error('Gemini tidak mengembalikan jawaban.');
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Diblokir filter keamanan Gemini. Ubah redaksi input.');
  }
  const text = (candidate.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error('Gemini mengembalikan respons kosong.');
  return text;
}

/** Cek kuota SEBELUM call (supaya tidak buang request jika sudah habis) */
function assertQuota() {
  const st = quotaService.status();
  if (st.aiCalls >= st.limits.aiCallsPerDay) {
    throw new Error(
      `Kuota AI hari ini habis (${st.limits.aiCallsPerDay}/hari). Reset otomatis nanti.`
    );
  }
}

async function generateText(prompt, opts = {}) {
  assertQuota('ai');
  const data = await callGeminiRaw([{ role: 'user', parts: [{ text: prompt }] }], opts);
  return extractText(data);
}

async function generateJson(prompt, opts = {}) {
  assertQuota('ai');
  const data = await callGeminiRaw([{ role: 'user', parts: [{ text: prompt }] }], {
    ...opts,
    jsonMode: true,
  });
  const text = extractText(data);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini mengembalikan JSON tidak valid. Coba ulangi.');
  }
}

async function chat(history, opts = {}) {
  assertQuota('ai');
  if (!Array.isArray(history) || !history.length) throw new Error('Riwayat kosong.');
  const contents = history.map((msg) => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(msg.content || msg.text || '') }],
  }));
  if (contents[contents.length - 1].role !== 'user') {
    throw new Error('Pesan terakhir harus dari pengguna.');
  }
  const systemInstruction =
    opts.systemInstruction ||
    'Kamu asisten cerdas. Jawab dalam Bahasa Indonesia kecuali diminta lain. Jelas dan akurat. Jangan memakai markdown berlebihan; rumus tulis polos tanpa ** dan $.';
  const data = await callGeminiRaw(contents, {
    temperature: opts.temperature ?? 0.8,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
    systemInstruction,
  });
  return extractText(data);
}

async function generateWithImages(prompt, images = [], opts = {}) {
  assertQuota('ai');
  const parts = [{ text: prompt }];
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mime || 'image/jpeg',
        data: String(img.base64 || '').replace(/^data:[^;]+;base64,/, ''),
      },
    });
  }
  const data = await callGeminiRaw([{ role: 'user', parts }], {
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
    systemInstruction: opts.systemInstruction,
  });
  return extractText(data);
}

module.exports = {
  generateText,
  generateJson,
  chat,
  generateWithImages,
  callGeminiRaw,
  assertQuota,
};
