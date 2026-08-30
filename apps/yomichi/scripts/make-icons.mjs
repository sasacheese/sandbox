/**
 * アイコンの PNG を生成する。街灯が一本立っているだけの絵。
 *
 * SVG から変換するツール（rsvg-convert・ImageMagick）は環境によって入っていないので、
 * 図形を直接描いて PNG を書き出す。依存を増やさず、どの環境でも同じ絵になる。
 *
 *   node scripts/make-icons.mjs
 *
 * 絵は favicon.svg と同じ「二点が線でつながった認証印」。丸と線だけなので、
 * 距離の計算（円は中心からの距離、線は帯からの距離）で塗り分けられる。
 * 縁を滑らかにするため 1 ピクセルを 4x4 で見て平均を取る。
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '..', 'public');

// 夜道の街灯。styles.css の色と揃える
const NIGHT = [0x1d, 0x21, 0x29];
const LAMP = [0xe0, 0x8b, 0x3c];
const POLE = [0x8a, 0x8f, 0x98];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 各行の先頭にフィルタ種別 0 を挟むのが PNG の生データ形式
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** その座標にある色。マスク可能アイコンでは図をひとまわり小さく描く。 */
function colorAt(x, y, size, inset) {
  const u = (x / size) * 64;
  const v = (y / size) * 64;
  // inset ぶんだけ中心へ寄せた座標系で 64x64 の図を描く
  const s = 1 / (1 - inset * 2);
  const cx = (u - 32) * s + 32;
  const cy = (v - 32) * s + 32;

  if (Math.hypot(cx - 32, cy - 22) <= 9) return LAMP; // 灯り
  if (Math.abs(cx - 32) <= 1.5 && cy >= 31 && cy <= 53) return LAMP; // 柱
  if (Math.abs(cy - 55) <= 1.5 && cx >= 14 && cx <= 50) return POLE; // 地面
  return NIGHT;
}

function render(size, inset) {
  const rgba = Buffer.alloc(size * size * 4);
  const SUB = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const c = colorAt(x + (sx + 0.5) / SUB, y + (sy + 0.5) / SUB, size, inset);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 4;
      const n = SUB * SUB;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 0xff;
    }
  }
  return encodePng(size, rgba);
}

const files = [
  ['favicon-32.png', 32, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  // マスク可能アイコンは外周 10% を切られる前提で内側に寄せる
  ['maskable-icon-512.png', 512, 0.12],
];

for (const [name, size, inset] of files) {
  writeFileSync(resolve(OUT, name), render(size, inset));
  console.log(`${name} (${size}x${size})`);
}
