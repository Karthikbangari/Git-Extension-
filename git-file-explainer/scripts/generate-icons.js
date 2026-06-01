const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── PNG plumbing ─────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcB]);
}

// ── Icon renderer ────────────────────────────────────────────────────────────
//
// Design: azure gradient tile (top #6BA6F5 → bottom #3B7DD8) with rounded
// corners, a 4-pointed sparkle centered in white, and a subtle top-glass sheen.
// 3×3 supersampling for clean antialiased edges at all sizes.

function makePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA

  // Layout constants (continuous pixel coords: pixel px covers [px, px+1])
  const r = size * 0.22; // rounded corner radius
  const cx = size / 2; // sparkle centre x
  const cy = size / 2; // sparkle centre y
  const AL = size * 0.38; // arm half-length
  const AW = Math.max(1.4, size * 0.082); // arm half-width at base

  // Gradient stops
  const [tR, tG, tB] = [107, 166, 245]; // #6BA6F5 top
  const [bR, bG, bB] = [59, 125, 216]; // #3B7DD8 bottom

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // True if continuous point (x,y) is inside the rounded rectangle.
  function inRRect(x, y) {
    if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
    if (x > size - r && y < r) return (x - (size - r)) ** 2 + (y - r) ** 2 <= r * r;
    if (x < r && y > size - r) return (x - r) ** 2 + (y - (size - r)) ** 2 <= r * r;
    if (x > size - r && y > size - r) return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r * r;
    return x >= 0 && x <= size && y >= 0 && y <= size;
  }

  // True if point is inside the 4-pointed sparkle (tapered diamond arms).
  function inSparkle(x, y) {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    const inH = dx <= AL && dy <= AW * Math.max(0, 1 - dx / AL); // horizontal arm
    const inV = dy <= AL && dx <= AW * Math.max(0, 1 - dy / AL); // vertical arm
    return inH || inV;
  }

  // Glass sheen: thin white gradient across the top third of the icon.
  // Returns opacity [0..1] at a given y within the tile.
  function sheenAlpha(y) {
    const sheenEnd = size * 0.42;
    if (y > sheenEnd) return 0;
    return 0.18 * (1 - y / sheenEnd);
  }

  const SS = 3; // supersampling grid (SS×SS per pixel)
  const rows = [];

  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // PNG filter: None

    for (let px = 0; px < size; px++) {
      let bgCount = 0,
        starCount = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          if (!inRRect(x, y)) continue;
          if (inSparkle(x, y)) starCount++;
          else bgCount++;
        }
      }

      const i = 1 + px * 4;
      const total = SS * SS;
      const alpha = (bgCount + starCount) / total;

      if (alpha < 0.004) {
        row[i] = row[i + 1] = row[i + 2] = row[i + 3] = 0;
        continue;
      }

      // Background gradient colour at this pixel row
      const t = py / (size - 1);
      let bgR = lerp(tR, bR, t);
      let bgG = lerp(tG, bG, t);
      let bgB = lerp(tB, bB, t);

      // Overlay glass sheen on background
      const sh = sheenAlpha(py + 0.5);
      bgR = lerp(bgR, 255, sh);
      bgG = lerp(bgG, 255, sh);
      bgB = lerp(bgB, 255, sh);

      // Composite star (white) over gradient background, weighted by coverage
      const cover = bgCount + starCount;
      const r8 = Math.round((starCount * 255 + bgCount * bgR) / cover);
      const g8 = Math.round((starCount * 255 + bgCount * bgG) / cover);
      const b8 = Math.round((starCount * 255 + bgCount * bgB) / cover);

      row[i] = Math.min(255, r8);
      row[i + 1] = Math.min(255, g8);
      row[i + 2] = Math.min(255, b8);
      row[i + 3] = Math.round(alpha * 255);
    }

    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Write icons ──────────────────────────────────────────────────────────────

const outDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const buf = makePNG(size);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
  console.log(`Generated icon${size}.png (${size}×${size})`);
}
