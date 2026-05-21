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
├── sharks-way.html             # AR.js + TensorFlow shark detection
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
- **8th Wall GPS zone:** "Little Italy" always-on rotation + 5 GPS-triggered shark cycles.
- **HTTPS required** for camera and GPS (use localtunnel or ngrok for mobile testing).

## AR Experiences

1. **sharks-way.html** — TF.js + MobileNet AI shark painting detection
2. **shark-ar-8thwall.html** — 8th Wall GPS-triggered 5-shark cycle (Maria, Stella, Jimmy, Sharkie Waving, Diving Shark)
3. **location-tour.html** — Leaflet.js GPS checkpoint tour along the corridor
4. **selfie-ar.html** — MediaPipe shoulder-mount selfie with Sammy Spartan / Sharkie
5. **marker-demo.html** — AR.js Hiro/custom marker → 3D shark + event info

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

## Development Notes

- No test suite (`npm test` is a placeholder).
- CSS is per-page (e.g. `src/css/sharks-way-styles.css` for `sharks-way.html`) plus `shared-styles.css`.
- `src/app.js` is the 8th Wall entry point; other HTML pages inline or script-tag their own logic.
- `8w-distributed-engine/` is currently a placeholder (`.gitkeep`).
- Docs: `ARCHITECTURE.md` (system design), `DEPLOYMENT.md` (hosting guide).
