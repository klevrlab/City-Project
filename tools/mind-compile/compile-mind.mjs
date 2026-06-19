import fs from 'fs';
import path from 'path';
import Jimp from 'jimp';
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';

// Order defines targetIndex:
//   0 = front panel (full-res)
//   1 = back panel (full-res)
//   2 = front panel alt (BG1 — smaller reference photo)
//   3 = back panel alt (BG1 — smaller reference photo)
const INPUTS = [
  '../../assets/Japan-Am - Front BG.png',
  '../../assets/Japan-Am - Back BG.png',
  '../../assets/Japan-Am - Front BG1.png',
  '../../assets/Japan-Am - Back BG1.png',
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
