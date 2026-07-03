// Entry for the patched MindAR bundle build (see vite.mindar.config.mjs).
// Imports from the .mindar-patched/ overlay produced by patch-mindar.mjs —
// mind-ar source with loosened confidence thresholds. Registering the aframe
// module puts mindar-image-system / mindar-image / mindar-image-target on the
// global AFRAME, exactly like the official mindar-image-aframe.prod.js.
import './.mindar-patched/image-target/aframe.js';
