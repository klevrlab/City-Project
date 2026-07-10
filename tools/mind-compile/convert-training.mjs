// Converts the HEIC training photos to downscaled JPEGs for inspection and
// target compilation. Pure JS (WASM libheif) — no system imagemagick needed.
// Usage: node convert-training.mjs <outDir>
import fs from 'fs';
import path from 'path';
import heicConvert from 'heic-convert';
import Jimp from 'jimp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../../assets/JapanAM Training Photos');
const OUT_DIR = process.argv[2] || path.join(__dirname, '.training-jpg');
const MAX_WIDTH = 1600;

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(SRC_DIR).filter((f) => /\.heic$/i.test(f)).sort();
console.log(`${files.length} HEIC files`);

for (const f of files) {
  const out = path.join(OUT_DIR, f.replace(/\.heic$/i, '.jpg'));
  if (fs.existsSync(out)) { console.log(`skip ${f}`); continue; }
  const buf = fs.readFileSync(path.join(SRC_DIR, f));
  // Many of these ".HEIC" files are actually JPEGs (iPhone export quirk) —
  // sniff the magic bytes and only run the HEIC decoder when needed.
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const decoded = isJpeg ? buf : Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.9 }));
  const img = await Jimp.read(decoded);
  if (img.bitmap.width > MAX_WIDTH) img.resize(MAX_WIDTH, Jimp.AUTO);
  await img.quality(88).writeAsync(out);
  console.log(`${f} → ${path.basename(out)}  ${img.bitmap.width}x${img.bitmap.height}`);
}
console.log('done →', OUT_DIR);
