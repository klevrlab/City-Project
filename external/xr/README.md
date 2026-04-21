## 8th Wall Engine (self-hosted)

This repo is a static site (GitHub Pages compatible). To run 8th Wall Engine in the browser, you must include the **Distributed Engine Binary** assets locally.

### Setup

1. Download `xr-standalone.zip` from `https://8th.io/xrjs`
2. Unzip it into this folder so you have (at minimum):
   - `external/xr/xr.js`
   - the associated `.wasm` / worker / chunk assets that `xr.js` expects

### Optional: separate “engine” repository

The template at [`8w-distributed-engine/README.md`](../../8w-distributed-engine/README.md) describes a **sibling** GitHub repository that holds only unzipped engine files, tagged for reproducible rollouts. This app repo can keep a minimal or empty `external/xr` in git and populate it in CI; see [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) (variables `EIGHTH_WALL_ENGINE_*`).

### Why is the full engine not always committed?

The engine binary is distributed under a **binary-only license** and is large. Some teams keep it out of the main app history so:
- clones stay small
- you can swap engine versions via the companion repo or a local unzip

### Related docs

- Self-hosted migration guide: `https://8thwall.org/docs/migration/self-hosted`

