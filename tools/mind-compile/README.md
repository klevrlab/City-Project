# MindAR target compiler (`japan-am.mind`)

Compiles the Japantown memorial photos into the MindAR image-target file used by
`mural-ar.html`. Runs fully offline — no node-canvas native build required.

## Recompile

```bash
cd tools/mind-compile
npm install mind-ar@1.2.5 jimp@0.22.12 --ignore-scripts

# node-canvas can't build headless; MindAR's OfflineCompiler only needs
# createCanvas -> drawImage -> getImageData, so swap in the pure-JS stub:
cp canvas-stub.js node_modules/canvas/index.js

node compile-mind.mjs
```

Output: `assets/targets/japan-am.mind` (targetIndex 0 = front, 1 = back).

## Inputs
- `assets/Markers/japan-am-front.jpg`
- `assets/Markers/japan-am-back.jpg`

Edit the `INPUTS` array in `compile-mind.mjs` to add/replace panels.
You can also drag the JPEGs into the official web compiler instead:
https://hiukim.github.io/mind-ar-js-doc/tools/compile
