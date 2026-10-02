const statusLine = document.getElementById('statusLine');
const messagesEl = document.getElementById('chatMessages');
const emptyEl = document.getElementById('chatEmpty');
const form = document.getElementById('chatForm');
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('chatSendBtn');
const clearBtn = document.getElementById('chatClearBtn');

/** @type {{role: string, content: string}[]} */
let history = [];

function setStatus(text, type = '') {
  statusLine.textContent = text || '';
  statusLine.className = `status-line ${type}`;
}

initOnlineGuard('offlineBanner', [sendBtn]);

function stripMd(s) {
  return String(s || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1');
}

function renderMessages() {
  // Hapus bubble lama (tapi biarkan emptyEl)
  messagesEl.querySelectorAll('.chat-bubble').forEach((n) => n.remove());

  if (history.length === 0) {
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  for (const msg of history) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;
    div.textContent = stripMd(msg.content);
    messagesEl.appendChild(div);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendPending() {
  const div = document.createElement('div');
  div.className = 'chat-bubble assistant pending';
  div.id = 'pendingBubble';
  div.textContent = 'Sedang berpikir…';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removePending() {
  const el = document.getElementById('pendingBubble');
  if (el) el.remove();
}

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
});

// Enter kirim, Shift+Enter baris baru
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  history.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  renderMessages();
  appendPending();

  sendBtn.disabled = true;
  setStatus('Menghubungi Gemini…');
  const _prog = window.toast ? toast.progress('Sedang diproses', 'Permintaan Anda sedang dijalankan…') : null;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'Gagal mendapat jawaban.');

    history.push({ role: 'assistant', content: data.reply });
    removePending();
    renderMessages();
    if (_prog) _prog.close();
    setStatus('Siap.', 'success');
    if (window.toast) toast.success('Berhasil', 'Permintaan Anda berhasil.');
  } catch (err) {
    removePending();
    // Hapus pesan user terakhir supaya bisa dicoba ulang
    if (history.length && history[history.length - 1].role === 'user') {
      history.pop();
    }
    renderMessages();
    if (typeof _prog !== 'undefined' && _prog) _prog.close();
    setStatus(err.message, 'error');
    if (window.toast) toast.error('Gagal', err.message);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});

clearBtn.addEventListener('click', () => {
  if (history.length === 0) return;
  if (!confirm('Hapus seluruh riwayat percakapan di sesi ini?')) return;
  history = [];
  renderMessages();
  setStatus('Riwayat dihapus.');
});

// Fokus ke input saat buka
document.addEventListener('DOMContentLoaded', () => {
  input.focus();
});
