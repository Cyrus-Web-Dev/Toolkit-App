// ============================================================
// Markup skeleton shimmer generik, dipakai halaman-halaman AI
// (CV, Resume, Portofolio, dll) saat menunggu respons Gemini
// supaya panel preview tidak terasa kosong/diam.
// ============================================================
function skeletonPreviewHtml() {
  return `
    <div class="skeleton-wrap">
      <div class="skeleton-line tall w-55"></div>
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-block"></div>
      <div class="skeleton-line w-85"></div>
      <div class="skeleton-line w-70"></div>
      <div class="skeleton-line w-100"></div>
      <div class="skeleton-line w-55"></div>
    </div>
  `;
}
