# 8th Wall Distributed Engine (sibling repository)

This folder is a **template** for a **separate, private** GitHub repository that holds the unzipped contents of the [8th Wall self-hosted engine](https://8thwall.org/docs/migration/self-hosted) (`xr-standalone.zip` from [8th.io/xrjs](https://8th.io/xrjs)).

## Why a separate repo?

- The distributed engine is **binary-only** (Niantic / 8th Wall license) and **large** (WASM, workers, chunk files). Keeping it out of the main app history keeps clones small and rolls forward cleanly.
- Tag releases (for example `v2026.04.0`) so this app repository’s deploy workflow can copy a **known-good** tree into `external/xr/` before GitHub Pages upload.

## What to put in the private engine repo

Unzip `xr-standalone.zip` at the **repository root** so you have (at minimum):

- `xr.js`
- `xr-slam.js` (if using `data-preload-chunks` / world tracking)
- `xr-face.js` (optional, face features)
- `resources/` and any other sibling assets `xr.js` references

**Do not** commit this template README into the engine repo if you only want engine binaries; you may replace it with a one-line `README` pointing at the license and download URL.

## Versioning

Use git tags for each engine drop, for example:

- `v2026.04.0` — first pinned bundle
- `v2026.04.1` — engine refresh from 8th.io

The main app’s [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) should reference the tag your team approves.

## License

The engine is subject to **8th Wall / Niantic** terms. This repository only stores what you are allowed to self-host. Do not redistribute outside your agreement.
