# CLAUDE.md — city-project memory

## Project Identity
**Sharks Way — Immersion 2026**
WebAR platform for the Sharks Way corridor between downtown San José and SAP Center, built by SJSU students/faculty for **Immersion 2026**.

- Repo: `klevrlab/city-project` (GitHub)
- Version: 2.0 (`src/app.js` global `App.version = '2.0.0'`)
- Stack: Vanilla JS / HTML5 / CSS3 — **no framework, no backend**
- Build tool: Vite (`vite.config.js`), `npm run dev` / `npm run build`
- Local dev server: `python3 -m http.server 8080` (no build needed for plain HTML pages)

## Repo Layout

```
city-project/
├── index.html                  # Landing / hub page
├── sharks-way.html             # Redirect → shark-ar-8thwall.html (MobileNet page retired)
├── shark-ar-8thwall.html       # 8th Wall WebAR (GPS-triggered, 5 shark experiences)
├── shark-ar-demo.html          # Demo / sandbox
├── location-tour.html          # GPS checkpoint tour (Leaflet.js)
├── selfie-ar.html              # MediaPipe selfie AR (Sammy / Sharkie on shoulder)
├── marker-demo.html            # AR.js marker demo
├── debug-8thwall.html          # 8th Wall debug page
├── soccer-ar-8thwall.html      # Soccer AR variant
├── sharks-way-v0.html          # Legacy v0
├── src/
│   ├── app.js                  # 8th Wall entry point — registers A-Frame components/systems
│   ├── components/
│   │   ├── shark-animator.js
│   │   ├── shark-detector.js
│   │   ├── tour-ui.js
│   │   ├── navigation.js
│   │   └── soccer-game.js
│   ├── systems/
│   │   └── event-system.js
│   ├── utils/
│   │   ├── shark-embedding-detector.js   # TensorFlow MobileNet cosine similarity
│   │   ├── shared-gps-tracking.js        # Haversine GPS distance
│   │   ├── shared-map-markers.js
│   │   ├── shared-navigation.js
│   │   ├── checkpoint-loader.js
│   │   ├── xr8-shark-video-bridge.js     # 8th Wall ↔ video bridge
│   │   ├── xr8-scene-bootstrap.js
│   │   ├── audio-utils.js
│   │   └── math-utils.js
│   └── css/                    # Per-page stylesheets + shared-styles.css
├── assets/
│   ├── 3D-models/              # GLB files (SHAUN, STELLA, SEAN, Maria, Sharkie, etc.)
│   ├── Markers/                # AR marker images (hiro, shark-pattern)
│   ├── SharkLogo.png
│   └── video.mp4
├── data/
│   ├── shark-locations.json        # GPS coordinates for checkpoints
│   └── shark-embeddings-browser.json  # Pre-computed MobileNet v2 embeddings
├── 8w-distributed-engine/      # Placeholder for 8th Wall distributed engine
├── pattern-shark.patt          # AR.js custom shark marker pattern
├── sammy_final_pose.glb        # Sammy Spartan (SJSU mascot)
├── sharkie_final_pose.glb      # Sharkie (Sharks mascot)
├── vite.config.js
└── package.json
```

## Tech Stack (CDN-loaded, no npm install needed at runtime)

| Layer | Library | Version |
|---|---|---|
| WebAR | 8th Wall WebAR | cloud key required |
| WebAR fallback | AR.js | 3.4.5 |
| 3D scenes | A-Frame | 1.6.0 |
| AI detection | TensorFlow.js + MobileNet v2 | 4.22.0 |
| 3D model viewer | model-viewer | 3.4.0 |
| Maps | Leaflet.js | 1.9.4 |
| Pose tracking | MediaPipe Pose | latest CDN |
| Build | Vite | ^8.0.13 |

## Key Design Decisions

- **All processing is client-side** — no backend, no analytics, no PII collected.
- **GPS checkpoint radius:** 50 meters; Haversine formula in `shared-gps-tracking.js`.
- **Shark AI detection threshold:** cosine similarity ≥ 0.55 against pre-computed MobileNet embeddings in `data/shark-embeddings-browser.json`.
- **Selfie AR shoulder target:** MediaPipe landmark 12 (right shoulder), offset X+50px / Y-70px.
- **8th Wall Wayfinding cycle (June 10 redline):** Maria + Jimmy alternating swim-throughs on GPS detection; ground-tap "drops" a stationary looping Jimmy. (Little Italy is slated to swap its always-on shark rotation for always-on marble statues pointing toward SAP — blocked on Athena / Augustus GLB assets.)
- **HTTPS required** for camera and GPS (use localtunnel or ngrok for mobile testing).

## AR Experiences

1. ~~**sharks-way.html** — TF.js + MobileNet AI shark painting detection~~ — **retired**; the MobileNet page now redirects to `shark-ar-8thwall.html` (the public `sharks-way.html` URL is preserved for the SJSU landing-page link).
2. **shark-ar-8thwall.html** — 8th Wall GPS-triggered Wayfinding cycle. Per the **June 10, 2026 redline**, the cycle is **Maria + Jimmy only**, appearing alternately on detection (approach from behind → pause → swim off, no tap). Tapping the ground "drops a shark" — a single Jimmy that loops in place and stays so visitors can walk around it. Stella, Sharkie Waving, and the Diving Shark were removed from this cycle (Sharkie → selfie feature; Diving → future jump locations; Stella → retired).
3. **location-tour.html** — Leaflet.js GPS checkpoint tour along the corridor
4. **selfie-ar.html** — MediaPipe shoulder-mount selfie with Sammy Spartan / Sharkie
5. **mural-ar.html** — Japantown Living Mural: open-source MindAR image tracking + GPS gate (single compiled target — the front relief — in `assets/targets/japan-am.mind`; multiple similar bronze panels cross-matched and caused phantom locks). Loads a **custom loose-threshold MindAR build** (`assets/vendor/mindar-image-aframe.custom.js`, rebuilt via `npm run build-tracker` in `tools/mind-compile/`) — detection/tracking confidence gates are deliberately permissive ("always shows something" > "always the right panel"), and `mural-plane.js` holds the last pose for 2.5s after tracking drops.

> Note: the AR.js marker demo (`marker-demo.html`) was removed during the Phase II consolidation.

## 3D Models (assets/3D-models/)

- `SHAUN_SHARK_ANIMATED.glb` / `SHAUN_SHARK.glb` — Shaun shark character
- `SEAN_ANIMATED_WiTH_MARIA_SHARK.glb` — Sean + Maria animated
- `STELLA_CAI_SHARK_SJSU_TEST1.glb` — Stella shark
- `maria-shark-jump-jimmy-txtr.glb` — Maria jumping with Jimmy texture
- `basketball_animation.glb` — Basketball
- `plushie_shark.glb` — Plushie shark
- `Pose_sharky_01.glb`, `Pose_sharky_01._no_glass.glb`, `Pose_sharky_02.glb`, `sharkie_pose_02.glb`
- Root-level: `sammy_final_pose.glb`, `sharkie_final_pose.glb`

## Team

**Faculty:** Rhonda Holberton, Marjan Khatibi, Lacey Nein (SJSU)
**Students:** Chris Velez, Maria (Phuong-Trang) Vu, Ganesh Nagavenkatasai Mohan Kancherla, Antony Cucina, Sean Cruz-Colatriano, Andrea Oppliger-Delgado, Tharun Chunchu
**Partners:** San Jose Downtown Association, City of San José Office of Cultural Affairs, San Jose Sharks, artist Jimmy Paints, KLEVR Labs, Reimagining the Civic Commons

## Upcoming Events (as of scan date 2026-05-21)

- Free Throw at SAP Center — Mar 26 & 28, 2026 (past)
- Minis & Trophy at Arena Green West — Mar 26 & 28, 2026 (past)
- International Football Watch Together — Jun–Jul 2026, San Pedro Square Market

## Model Sizing

The GLBs share no unit convention — measured raw heights: Athena **206 m**, Augustus **1.0 m**,
Leaning Tower **47.5 m**, Sharkie **1.95 m** (floating 1.01 m above its origin), Sammy **2.96 m**
(floating 0.42 m). Hand-tuned `scale="1.1 1.1 1.1"` values therefore meant something different per
asset and broke on every re-export.

`src/components/model-normalize.js` sizes a model in metres on load and drops it on the ground:
`model-normalize="height: 2.5"` or `maxDim: 3` for long, low shapes (sharks). It scales the *mesh*,
so entity transforms and saved placement overrides stack on top instead of being clobbered.

Current targets (ceiling ≈ one storey):

| Content | Size | Why |
|---|---|---|
| Little Italy statues (Athena + Augustus) | 2.5 m tall | street statue, above human, under a storey |
| Sharkie / Sammy (Photo Mode + finale dancers) | 1.9 m tall | person-scale for photos |
| Finale circle sharks, jump diving shark | 3.0 m longest axis | height is the wrong axis to pin on a shark |
| Leaning Tower | 8 m tall | deliberate exception — the June 10 redline spec's 8 m |

Wayfinding swim-through sharks (`shark-animator.js`, ~0.4 scale) are intentionally left as tuned.

## Placement Debug Mode

`shark-ar-8thwall.html?debug=1` loads `src/components/debug-placement.js` — an on-device HUD for
testing placements without walking the corridor. (Add `&demoLocations=1` to plant Little Italy +
tower with no GPS.)

- **STATUS** — XR/GPS/FPS, geofence distances with a "fire" button per jump pin, and every
  `<a-asset-item>` with its load state *and* HTTP status. A 404 GLB shows up here first.
- **MODELS** — spawn any GLB from the manifest 3 m ahead (or all of them in a grid). Each spawn
  logs its bounding-box size, which is how you tell "didn't load" from "loaded at 200 m tall".
- **OBJECTS** — every placed entity: key, loaded/ERROR, size, distance, visibility. Tap to select,
  or arm tap-to-select and tap the model in the camera view.
- **MOVE** — nudge/rotate/scale in camera-relative axes, drag along the ground, then SAVE.

Saves are keyed by `data-placement-key` (`little-italy/pin-3`, `leaning-tower`,
`finale/dancer-sammy`, …) and stored by `src/utils/placement-overrides.js`:

1. `data/placement-overrides.json` — committed baseline (optional; 404 is fine)
2. `localStorage['sharksway.placement']` — this device's tuning, wins over the baseline

EXPORT downloads the merged JSON; commit it as `data/placement-overrides.json` to make a tweak
everyone's. Saved transforms are **local to the plant anchor** (a root entity dropped at the
camera's ground position and yawed to camera-forward), not world coordinates — content is planted
relative to the camera when a geofence fires, so absolute world positions would be meaningless on
the next visit. `window.SharksWayDebug` exposes the same operations to the console.

## Development Notes

- No test suite (`npm test` is a placeholder).
- `vite.config.js` has a `copyStaticAssets` plugin that copies `assets/`, `data/`, and root GLB/patt files into `dist/` — vite can't trace runtime fetches (GLBs, `.mind`, JSON), so without it the deployed site 404s on all of them.
- CSS is per-page (e.g. `src/css/shark-ar-8thwall-styles.css` for `shark-ar-8thwall.html`) plus `shared-styles.css`.
- `src/app.js` is the 8th Wall entry point; other HTML pages inline or script-tag their own logic.
- `8w-distributed-engine/` is currently a placeholder (`.gitkeep`).
- Docs: `ARCHITECTURE.md` (system design), `DEPLOYMENT.md` (hosting guide).

## Git Workflow

- **Always push to `claude/scan-repo-memory-VYvsv`** (the soccer branch). Never push to main or any other branch without explicit permission from Chris.
- Commits should be attributed to Christopher Anthony Velez <lilvelezcav@gmail.com>.
