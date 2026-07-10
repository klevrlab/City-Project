# MindAR tooling (targets + custom tracker build)

Two jobs live here, both fully offline:

1. **Target compiler** — compiles the Japantown memorial photos into the
   `.mind` image-target file used by `mural-ar.html`.
2. **Custom tracker build** — bundles MindAR 1.2.5 **from source with loosened
   confidence thresholds**, producing the drop-in
   `assets/vendor/mindar-image-aframe.custom.js` that `mural-ar.html` loads
   instead of the CDN build. The project brief favours "always shows
   something" over "always tracks the exact right panel", so detection and
   tracking gates are deliberately permissive.

## Setup (once)

```bash
cd tools/mind-compile
npm install --ignore-scripts

# node-canvas can't build headless; MindAR's OfflineCompiler only needs
# createCanvas -> drawImage -> getImageData, so swap in the pure-JS stub:
cp canvas-stub.js node_modules/canvas/index.js
```

## Recompile image targets

```bash
npm run compile-targets
```

Output: `assets/targets/japan-am.mind` — a **single** target (the front
relief, targetIndex 0). Multiple similar-looking bronze panels cross-matched
and caused phantom locks, so the experience tracks one panel only.
Edit the `INPUTS` array in `compile-mind.mjs` to swap in better photos —
on-site phone photos of the actual panel beat the source artwork.
You can also drag the JPEGs into the official web compiler instead:
https://hiukim.github.io/mind-ar-js-doc/tools/compile

## Rebuild the loose-threshold tracker

```bash
npm run build-tracker
```

This runs `patch-mindar.mjs` (copies mind-ar source into `.mindar-patched/`
and applies the threshold patches — the script **fails loudly** if the
source ever drifts) and then a vite lib build.

Output: `assets/vendor/mindar-image-aframe.custom.js`

Thresholds patched (see `patch-mindar.mjs` for the full why). These were
originally much looser ("always shows something"), but with targets compiled
from real on-site photos the tracker no longer needs the slack — and the
loose tracking gates let phantom locks "track" random surfaces indefinitely,
so the plane never dropped when the camera looked away:

| Constant | Default | Ours | Effect |
|---|---|---|---|
| `HAMMING_THRESHOLD` | 0.7 | 0.75 | accepts slightly more ambiguous feature matches |
| `MIN_NUM_INLIERS` | 6 | 6 (stock) | was 5; reverted — phantom detections scale with target count |
| `INLIER_THRESHOLD` | 3 | 4 | slightly looser RANSAC geometry tolerance |
| `AR2_SIM_THRESH` | 0.8 | 0.6 | loose on purpose — stale locks are ended by mural-plane's deferred drop |
| `TRACKING_THRESH` | 5.0 | 7.0 | 8.0 rode out too much, 6.0 was twitchy on-panel |

To restore stock behaviour, point `mural-ar.html` back at the CDN
`mindar-image-aframe.prod.js` — the custom file is a pure superset drop-in.
