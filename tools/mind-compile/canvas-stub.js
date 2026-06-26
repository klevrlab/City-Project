// Pure-JS stub of node-canvas — implements only what MindAR's OfflineCompiler uses:
// createCanvas(w,h).getContext('2d').drawImage(img) + getImageData().
// The image we pass carries its RGBA pixels on img.__rgba (Uint8ClampedArray).
'use strict';
function createCanvas(width, height) {
  let buffer = null;
  const ctx = {
    drawImage(img) {
      buffer = img && img.__rgba ? img.__rgba : null;
    },
    getImageData(x, y, w, h) {
      if (!buffer) buffer = new Uint8ClampedArray(width * height * 4);
      return { data: buffer, width: w, height: h };
    }
  };
  return { width, height, getContext() { return ctx; } };
}
function loadImage() { return Promise.reject(new Error('loadImage not supported in stub')); }
module.exports = { createCanvas, loadImage, Canvas: function(){}, Image: function(){} };
