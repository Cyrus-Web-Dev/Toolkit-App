# Toolkit App (Public Edition)

Aplikasi desktop/lokal **Node.js + Express** (+ opsional **Electron**) untuk produktivitas: PDF, gambar, OCR, QR, dan beberapa fitur AI (Google Gemini).

Edisi ini disiapkan agar lebih **aman dipublikasikan di GitHub**: tanpa modul unduhan video massal / scraper media web, tanpa API key di repo, dan dilengkapi lisensi MIT.

## Fitur

### Offline
| Fitur | Keterangan |
|--------|------------|
| PDF Tools | Gabung, pisah, ekstrak, nomor halaman, crop, watermark, kompres |
| Hapus Background Massal | Batch remove background |
| Konversi File | Gambar, audio, video, CSV/JSON |
| OCR | Teks dari gambar (Tesseract) |
| Kompres & Resize Gambar | Batch |
| Generator & Pemindai QR | Buat & scan QR |

### Online (butuh internet + API key Gemini)
| Fitur | Keterangan |
|--------|------------|
| Surat Lamaran AI | Generate cover letter |
| CV Builder AI | Susun CV |
| Resume ATS AI | Resume + skor kecocokan |
| Portofolio AI | Draft website portofolio |
| AI Word / Excel / PPT | Generate dokumen Office |
| Penyelesai Soal | Matematika/sains (teks/foto) |
| Perangkum PDF AI | Ringkas dokumen |
| Kuis & Flashcard | Soal dari catatan |
| Deteksi AI | Estimasi gaya teks AI *(bukan alat plagiarisme resmi)* |
| AI Chat | Chat Gemini |
| PDF ke JPG | Butuh **Poppler** (`pdftoppm`) |
| Office ke PDF | Butuh **LibreOffice** |

### Tidak termasuk (sengaja dihapus dari edisi publik)
- Downloader Video/Audio (yt-dlp)
- Unduh Media dari Web / scraper HLS / host streaming

## Persyaratan

- **Node.js** ≥ 18
- (Opsional) **Electron** untuk jendela desktop
- (Opsional) **Google Gemini API key** untuk fitur AI
- (Opsional) Poppler, LibreOffice, ffmpeg sesuai fitur yang dipakai

## Setup

```bash
git clone <repo-anda>
cd toolkit-app-public
cp server/config/config.example.json server/config/config.json
# Edit config.json → isi gemini.apiKey (jangan commit file ini)
npm install
```

### Jalankan server saja (browser)

```bash
npm run server
# buka http://127.0.0.1:5217/app.html
```

### Jalankan Electron

```bash
npm start
```

## Keamanan & privasi

1. **Jangan commit** `server/config/config.json` yang berisi API key. Repo memakai `.gitignore` untuk file itu; gunakan `config.example.json`.
2. Server default hanya mendengarkan `127.0.0.1` (localhost).
3. Fitur AI memakai kuota harian lokal (lihat `limits.aiCallsPerDay`).
4. Pengguna bertanggung jawab atas konten yang diunggah dan kepatuhan terhadap ToS penyedia API.

## Lisensi

MIT — lihat file [LICENSE](LICENSE).

## Catatan

Ini adalah edisi **community / public**. Fitur unduhan media web tidak disertakan agar repo lebih netral untuk penggunaan produktivitas umum.
