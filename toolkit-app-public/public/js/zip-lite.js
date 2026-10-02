// ============================================================
// Zip writer minimal: implementasi format ZIP standar (metode STORE,
// tanpa kompresi) murni JS. Dipakai supaya "Unduh Semua" tidak butuh
// library eksternal / CDN — penting karena fitur ini harus tetap
// jalan 100% offline.
// ============================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F);
  const dosDate = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
  return { time, date: dosDate };
}

function u16(n) { return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF]); }
function u32(n) { return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]); }

function concatBytes(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((c) => { out.set(c, offset); offset += c.length; });
  return out;
}

/**
 * @param {{name: string, data: Uint8Array}[]} files
 * @returns {Blob} file .zip
 */
function createZip(files) {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((f) => {
    const nameBytes = encoder.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const localHeader = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0),
      u16(time), u16(date),
      u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, f.data);

    const centralHeader = concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
      u16(time), u16(date),
      u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.length + f.data.length;
  });

  const centralDir = concatBytes(centralParts);
  const localSection = concatBytes(localParts);

  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(centralDir.length), u32(localSection.length),
    u16(0),
  ]);

  return new Blob([localSection, centralDir, end], { type: 'application/zip' });
}
