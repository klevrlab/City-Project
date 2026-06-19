/**
 * Plays/pauses the overlay video when MindAR finds/loses the mural image.
 * Attach to a `mindar-image-target` anchor entity:
 *   <a-entity mindar-image-target="targetIndex: 0" mural-plane="video: #muralVideoFront">
 *     <a-plane ...></a-plane>
 *   </a-entity>
 */
AFRAME.registerComponent('mural-plane', {
  schema: {
    video: { type: 'selector' }
  },

  init: function () {
    this._onFound = this._onFound.bind(this);
    this._onLost = this._onLost.bind(this);
    this.el.addEventListener('targetFound', this._onFound);
    this.el.addEventListener('targetLost', this._onLost);
  },

  _onFound: function () {
    const v = this.data.video;
    if (v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    const status = document.getElementById('mural-status');
    if (status) status.classList.remove('visible');
  },

  _onLost: function () {
    const v = this.data.video;
    if (v && !v.paused) v.pause();
  },

  remove: function () {
    this.el.removeEventListener('targetFound', this._onFound);
    this.el.removeEventListener('targetLost', this._onLost);
  }
});
