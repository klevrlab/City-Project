## 8th Wall Engine (self-hosted)

This repo is a static site (GitHub Pages compatible). To run 8th Wall Engine in the browser, you must include the **Distributed Engine Binary** assets locally.

### Setup

1. Download `xr-standalone.zip` from `https://8th.io/xrjs`
2. Unzip it into this folder so you have (at minimum):
   - `external/xr/xr.js`
   - the associated `.wasm` / worker / chunk assets that `xr.js` expects

### Why is this not committed?

The engine binary is distributed under a **binary-only license** and is large. This repo keeps it out of git so:
- clones stay small
- you can swap engine versions locally

### Related docs

- Self-hosted migration guide: `https://8thwall.org/docs/migration/self-hosted`

