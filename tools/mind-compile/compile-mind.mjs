import fs from 'fs';
import path from 'path';
import Jimp from 'jimp';
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';

// Order defines targetIndex. One physical target (the front relief), compiled
// from three on-site photos under different lighting — real camera photos
// beat the source artwork, and since every target maps to the same overlay
// video in mural-ar.html, cross-matching between the variants is harmless.
// Picked from assets/JapanAM Training Photos (sharp, full-frame, near-frontal):
//   0 = Front 8  (bright, even midday light)
//   1 = Front 20 (even, slightly warm)
//   2 = Front 5  (darker dusk conditions)
const INPUTS = [
  '../../assets/Markers/japan-am-front-bright.jpg',
  '../../assets/Markers/japan-am-front-even.jpg',
  '../../assets/Markers/japan-am-front-dark.jpg',
];
const OUT = '../../assets/targets/japan-am.mind';
const MAX_WIDTH = 1600;

async function loadImage(p) {
  const img = await Jimp.read(p);
  if (img.bitmap.width > MAX_WIDTH) img.resize(MAX_WIDTH, Jimp.AUTO);
  const { width, height, data } = img.bitmap; // RGBA Buffer
  return { width, height, __rgba: new Uint8ClampedArray(data) };
}

(async () => {
  const images = [];
  for (const p of INPUTS) {
    const img = await loadImage(p);
    console.log(`loaded ${p}  ${img.width}x${img.height}`);
    images.push(img);
  }
  const compiler = new OfflineCompiler();
  let last = -1;
  await compiler.compileImageTargets(images, (pct) => {
    const r = Math.floor(pct);
    if (r !== last && r % 10 === 0) { console.log(`  compiling… ${r}%`); last = r; }
  });
  const buffer = compiler.exportData();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(buffer));
  console.log(`\nWROTE ${OUT}  (${(buffer.byteLength/1024).toFixed(0)} KB)`);
})().catch((e) => { console.error('COMPILE FAILED:', e); process.exit(1); });
