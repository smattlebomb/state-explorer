// Generates the PWA / home-screen icons into public/ with no external tools.
// A sky-blue rounded square with a big yellow star. Usage: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const star = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 0.36 : 0.15;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return [0.5 + r * Math.cos(a), 0.53 + r * Math.sin(a)];
});
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inRoundRect(x, y, rad, full) {
  if (full) return true; // apple-touch-icon / maskable: iOS rounds corners itself
  const cx = Math.min(Math.max(x, rad), 1 - rad);
  const cy = Math.min(Math.max(y, rad), 1 - rad);
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
}

function icon(size, full) {
  const S = 3; // supersampling
  return png(size, (px, py) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const x = (px + (sx + 0.5) / S) / size;
      const y = (py + (sy + 0.5) / S) / size;
      if (!inRoundRect(x, y, 0.22, full)) continue;
      let c;
      if (inPoly(x, y, star)) c = [250, 204, 21];
      else {
        const t = y; // vertical gradient sky-400 → sky-600
        c = [56 + (2 - 56) * t, 189 + (132 - 189) * t, 248 + (199 - 248) * t];
      }
      r += c[0]; g += c[1]; b += c[2]; a += 255;
    }
    const n = S * S;
    const cov = a / 255;
    return cov === 0 ? [0, 0, 0, 0] : [r / cov, g / cov, b / cov, a / n].map(Math.round);
  });
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', icon(192, true));
writeFileSync('public/icon-512.png', icon(512, true));
writeFileSync('public/apple-touch-icon.png', icon(180, true));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0284c7"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><polygon fill="#facc15" points="${star.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(' ')}"/></svg>\n`,
);
console.log('icons written to public/');
