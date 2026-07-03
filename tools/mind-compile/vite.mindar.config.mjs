import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Bundles the loose-threshold MindAR build for the Japan-Am living mural.
 *
 * Run via `npm run build-tracker`, which first executes patch-mindar.mjs —
 * that script copies mind-ar's source into .mindar-patched/ with its
 * confidence thresholds loosened (see the PATCHES table there for the what
 * and why). Building from the patched copy on disk guarantees the inlined
 * web worker — where target detection actually runs — is patched too.
 *
 * Output: assets/vendor/mindar-image-aframe.custom.js — a drop-in
 * replacement for the CDN mindar-image-aframe.prod.js script tag.
 */
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'mindar-entry.js'),
      name: 'MINDAR_CUSTOM',
      formats: ['iife'],
      fileName: () => 'mindar-image-aframe.custom.js'
    },
    outDir: resolve(__dirname, '../../assets/vendor'),
    emptyOutDir: true,
    minify: true
  }
});
