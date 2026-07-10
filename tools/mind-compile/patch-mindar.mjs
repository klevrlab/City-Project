/**
 * Copies mind-ar's published source into .mindar-patched/ and adjusts its
 * hardcoded confidence thresholds for the Japan-Am mural. Detection stays
 * slightly permissive for fast pickup, but tracking is kept near stock:
 * the targets are now compiled from real on-site photos (which match the
 * live camera view well), and the original very-loose tracking gates let
 * phantom locks "track" random surfaces indefinitely — the plane never
 * dropped when you looked away. Run before `vite build --config
 * vite.mindar.config.mjs` (the build-tracker npm script chains both).
 *
 * Patching a copy on disk (instead of a vite transform plugin) guarantees the
 * inlined web worker — where detection actually runs — gets the patched code
 * too, no matter how the bundler wires its worker pipeline.
 *
 * Every patch is an exact-string match against mind-ar@1.2.5 and this script
 * FAILS if any pattern is missing, so a version bump can never silently ship
 * unpatched defaults.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'node_modules/mind-ar/src');
const OUT = path.join(__dirname, '.mindar-patched');

const PATCHES = [
  // ── Initial detection (runs inside the controller web worker) ──────────
  {
    // Lowe's ratio test on FREAK descriptor distances. Higher accepts more
    // ambiguous feature matches as candidates. (default 0.7)
    file: 'image-target/matching/matching.js',
    from: 'const HAMMING_THRESHOLD = 0.7;',
    to: 'const HAMMING_THRESHOLD = 0.75;'
  },
  {
    // RANSAC reprojection tolerance when counting inliers — higher accepts
    // sloppier geometry (curved/glossy bronze relief, oblique angles).
    // (default 3; was 5, walked back with real-photo targets + 6 variants —
    // phantom detections scale with target count) (default 3)
    file: 'image-target/matching/matching.js',
    from: 'const INLIER_THRESHOLD = 3;',
    to: 'const INLIER_THRESHOLD = 4;'
  },
  // ── Frame-to-frame tracking (runs on the main thread) ──────────────────
  {
    // Normalized cross-correlation cutoff for tracked template points.
    // 0.62 held the lock through glare/blur but ALSO let phantom locks
    // "track" random surfaces forever — the plane never dropped when the
    // camera looked away. Near-stock keeps the drop crisp; real-photo
    // targets correlate well enough not to need the slack. (default 0.8)
    file: 'image-target/tracker/tracker.js',
    from: 'const AR2_SIM_THRESH = 0.8;',
    to: 'const AR2_SIM_THRESH = 0.75;'
  },
  // ── Pose refinement acceptance (controller web worker) ─────────────────
  {
    // Mean reprojection error allowed before a tracking update is rejected
    // and the target drops. Higher rides out wobbly frames; 8.0 rode out
    // far too much. (default 5.0)
    file: 'image-target/estimation/refine-estimate.js',
    from: 'const TRACKING_THRESH = 5.0; // default',
    to: 'const TRACKING_THRESH = 6.0; // default'
  }
];

if (!fs.existsSync(SRC)) {
  console.error('mind-ar source not found — run `npm install --ignore-scripts` first.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });

for (const p of PATCHES) {
  const target = path.join(OUT, p.file);
  const code = fs.readFileSync(target, 'utf8');
  if (!code.includes(p.from)) {
    console.error(
      `PATCH FAILED — pattern not found in ${p.file}:\n  "${p.from}"\n` +
      'mind-ar source changed; update PATCHES in patch-mindar.mjs'
    );
    process.exit(1);
  }
  fs.writeFileSync(target, code.replace(p.from, p.to));
  console.log(`patched ${p.file}: ${p.from}  →  ${p.to}`);
}
console.log(`\n${PATCHES.length}/${PATCHES.length} patches applied → ${path.relative(process.cwd(), OUT)}`);
