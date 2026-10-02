/**
 * Portofolio AI — Gemini menyusun kontennya, fungsi ini merangkainya jadi
 * satu file HTML mandiri (CSS inline, tanpa dependency luar) yang bisa
 * langsung dibuka di browser atau di-hosting di mana saja (Netlify,
 * GitHub Pages, dst). Desainnya sengaja dibuat beda dari tampilan
 * Toolkit App sendiri — ini portofolio pribadi user, bukan dashboard tool.
 */

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(url = '') {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  return 'https://' + u;
}

function renderPortfolioHtml(data, opts = {}) {
  const {
    nama = 'Nama Kamu',
    headline = '',
    tentang = '',
    proyek = [],
    keahlian = [],
    kontak = {},
  } = data;

  const accent = opts.accent || '#6d5efc';
  const accent2 = opts.accent2 || '#22d3c5';

  const projectCards = (proyek || []).map((p, i) => `
    <article class="pf-card" style="--delay:${i * 0.06}s">
      <div class="pf-card-num">${String(i + 1).padStart(2, '0')}</div>
      <h3>${esc(p.judul || 'Proyek')}</h3>
      <p>${esc(p.deskripsi || '')}</p>
      ${p.teknologi ? `<div class="pf-tags">${(Array.isArray(p.teknologi) ? p.teknologi : String(p.teknologi).split(',')).map(t => `<span>${esc(t.trim())}</span>`).join('')}</div>` : ''}
      ${p.link ? `<a class="pf-card-link" href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener">Lihat proyek ↗</a>` : ''}
    </article>`).join('\n');

  const skillChips = (keahlian || []).map((k) => `<span class="pf-skill">${esc(k)}</span>`).join('');

  const contactLinks = [
    kontak.email ? { label: 'Email', href: `mailto:${esc(kontak.email)}`, text: kontak.email } : null,
    kontak.linkedin ? { label: 'LinkedIn', href: safeUrl(kontak.linkedin), text: 'LinkedIn' } : null,
    kontak.github ? { label: 'GitHub', href: safeUrl(kontak.github), text: 'GitHub' } : null,
    kontak.website ? { label: 'Website', href: safeUrl(kontak.website), text: 'Website' } : null,
  ].filter(Boolean);

  const contactHtml = contactLinks.map((c) =>
    `<a href="${esc(c.href)}" target="_blank" rel="noopener">${esc(c.text)}</a>`
  ).join('<span class="pf-dot">·</span>');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(nama)} — Portofolio</title>
<meta name="description" content="${esc(headline || tentang).slice(0, 150)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --accent: ${accent};
    --accent2: ${accent2};
    --bg: #0b0c10;
    --panel: #14161c;
    --line: #23262f;
    --text: #eef0f4;
    --text-dim: #9498a3;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
  }
  h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; margin: 0; }
  a { color: var(--accent2); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .pf-wrap { max-width: 880px; margin: 0 auto; padding: 0 28px; }

  .pf-hero {
    position: relative;
    padding: 96px 0 72px;
    overflow: hidden;
  }
  .pf-hero::before {
    content: "";
    position: absolute;
    top: -180px; left: 50%;
    width: 720px; height: 480px;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%);
    pointer-events: none;
  }
  .pf-eyebrow {
    display: inline-block;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent2);
    background: color-mix(in srgb, var(--accent2) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent2) 35%, transparent);
    padding: 5px 12px;
    border-radius: 999px;
    margin-bottom: 22px;
  }
  .pf-hero h1 {
    font-size: clamp(2.1rem, 5vw, 3.2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 14px;
  }
  .pf-hero h1 .accent {
    background: linear-gradient(120deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .pf-headline {
    font-size: 1.08rem;
    color: var(--text-dim);
    max-width: 560px;
    margin-bottom: 28px;
  }
  .pf-contact {
    font-size: 0.9rem;
    color: var(--text-dim);
  }
  .pf-dot { margin: 0 10px; opacity: 0.5; }

  section { padding: 52px 0; border-top: 1px solid var(--line); }
  .pf-section-title {
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 22px;
  }
  .pf-about p { font-size: 1.02rem; color: var(--text); max-width: 680px; }

  .pf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
  }
  .pf-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 22px;
    position: relative;
    opacity: 0;
    animation: pfRise 0.6s ease-out forwards;
    animation-delay: var(--delay, 0s);
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .pf-card:hover { border-color: color-mix(in srgb, var(--accent2) 50%, var(--line)); transform: translateY(-3px); }
  .pf-card-num {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.78rem;
    color: var(--accent2);
    opacity: 0.7;
    margin-bottom: 10px;
  }
  .pf-card h3 { font-size: 1.08rem; margin-bottom: 8px; }
  .pf-card p { font-size: 0.9rem; color: var(--text-dim); margin: 0 0 14px; }
  .pf-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .pf-tags span {
    font-size: 0.72rem;
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: color-mix(in srgb, var(--accent2) 60%, var(--text));
    padding: 3px 9px;
    border-radius: 999px;
  }
  .pf-card-link { font-size: 0.85rem; font-weight: 500; }

  .pf-skills { display: flex; flex-wrap: wrap; gap: 10px; }
  .pf-skill {
    font-size: 0.86rem;
    background: var(--panel);
    border: 1px solid var(--line);
    padding: 8px 15px;
    border-radius: 999px;
    color: var(--text);
  }

  .pf-footer {
    text-align: center;
    padding: 48px 0 60px;
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  .pf-footer .pf-contact { margin-bottom: 6px; }
  .pf-footer .made-with { opacity: 0.5; font-size: 0.78rem; margin-top: 18px; }

  @keyframes pfRise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pf-card { animation: none; opacity: 1; }
  }
</style>
</head>
<body>

  <div class="pf-wrap">
    <section class="pf-hero" style="border-top:none">
      <span class="pf-eyebrow">Portofolio</span>
      <h1>${esc(nama)}${headline ? '' : ''}</h1>
      ${headline ? `<p class="pf-headline">${esc(headline)}</p>` : ''}
      ${contactHtml ? `<div class="pf-contact">${contactHtml}</div>` : ''}
    </section>

    ${tentang ? `
    <section class="pf-about">
      <div class="pf-section-title">Tentang</div>
      <p>${esc(tentang)}</p>
    </section>` : ''}

    ${projectCards ? `
    <section class="pf-projects">
      <div class="pf-section-title">Proyek &amp; Karya</div>
      <div class="pf-grid">${projectCards}</div>
    </section>` : ''}

    ${skillChips ? `
    <section class="pf-skills-section">
      <div class="pf-section-title">Keahlian</div>
      <div class="pf-skills">${skillChips}</div>
    </section>` : ''}

    <div class="pf-footer">
      ${contactHtml ? `<div class="pf-contact">${contactHtml}</div>` : ''}
      <div class="made-with">Dibuat dengan Toolkit App</div>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { renderPortfolioHtml };
