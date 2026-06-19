import fs from 'fs';
import path from 'path';
import Jimp from 'jimp';
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';

// Order defines targetIndex: 0 = front, 1 = back
const INPUTS = [
  '../../assets/Markers/japan-am-front.jpg',
  '../../assets/Markers/japan-am-back.jpg',
];
const OUT = '../../assets/targets/japan-am.mind';

async function loadImage(p) {
  const img = await Jimp.read(p);
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
