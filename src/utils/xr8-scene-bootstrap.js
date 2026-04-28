/**
 * Simplified 8th Wall / A-Frame scene bootstrap.
 */
(function (global) {
  'use strict';

  function startXrScene(opts) {
    opts = opts || {};
    var scene = opts.scene;
    
    if (!scene) {
      console.error('XR8SceneBootstrap: No scene element provided');
      return;
    }

    function onXrLoaded() {
      console.log('8th Wall Engine Loaded. Initializing scene components...');
      
      // Add XRExtras components first for standard UI
      scene.setAttribute('xrextras-loading', '');
      scene.setAttribute('xrextras-runtime-error', '');
      
      // Standard world tracking configuration
      // xrweb is the core 8th Wall component for A-Frame
      scene.setAttribute('xrweb', '');
      
      // Optional: Add tap to recenter if desired for world tracking
      scene.setAttribute('xrextras-tap-recenter', '');
    }

    if (global.XR8) {
      onXrLoaded();
    } else {
      global.addEventListener('xrloaded', onXrLoaded, { once: true });
    }
  }

  global.XR8SceneBootstrap = {
    start: startXrScene
  };
})(typeof window !== 'undefined' ? window : globalThis);
