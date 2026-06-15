/**
 * Locks an animated video plane onto an 8th Wall named image target.
 *
 * Pair it with `xrextras-named-image-target` on the same entity:
 *   <a-entity xrextras-named-image-target="name: japan-am-front"
 *             mural-overlay="name: japan-am-front; video: #muralVideoFront"></a-entity>
 *
 * The named-image-target component positions / scales / shows the entity when
 * the physical mural is detected; this component builds the overlay plane and
 * plays the video on found, pauses it on lost.
 */
AFRAME.registerComponent('mural-overlay', {
  schema: {
    // Must match the image-target name configured in the 8th Wall console.
    name:   { type: 'string' },
    // <video> asset to play across the plane.
    video:  { type: 'selector' },
    // Plane size in image-target units. 8th Wall normalizes a detected image to
    // ~1 unit wide, so width:1 + height:(imgH/imgW) overlays it 1:1.
    // Japan-Am images are 3336x1349 -> 1349/3336 = 0.4045.
    // If the overlay looks too tall/short on device, tweak these two numbers
    // (e.g. swap to width: 2.4729, height: 1 if your console normalizes by height).
    width:  { type: 'number', default: 1.0 },
    height: { type: 'number', default: 0.4045 }
  },

  init: function () {
    const d = this.data;

    const plane = document.createElement('a-plane');
    plane.setAttribute('width', d.width);
    plane.setAttribute('height', d.height);
    plane.setAttribute('position', '0 0 0');
    plane.setAttribute('rotation', '0 0 0');
    if (d.video && d.video.id) {
      plane.setAttribute('material', `shader: flat; src: #${d.video.id}; side: double`);
    } else {
      // Placeholder tint until a real video is wired in.
      plane.setAttribute('material', 'shader: flat; color: #2bd1ff; opacity: 0.55; transparent: true; side: double');
    }
    this.el.appendChild(plane);
    this.plane = plane;

    this._onFound = this._onFound.bind(this);
    this._onLost = this._onLost.bind(this);
    const scene = this.el.sceneEl;
    scene.addEventListener('xrimagefound', this._onFound);
    scene.addEventListener('xrimageupdated', this._onFound);
    scene.addEventListener('xrimagelost', this._onLost);
  },

  _matches: function (e) {
    return e && e.detail && (!this.data.name || e.detail.name === this.data.name);
  },

  _onFound: function (e) {
    if (!this._matches(e)) return;
    const v = this.data.video;
    if (v && v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
    const hint = document.getElementById('mural-hint');
    if (hint) hint.classList.remove('visible');
  },

  _onLost: function (e) {
    if (!this._matches(e)) return;
    const v = this.data.video;
    if (v && !v.paused) v.pause();
  },

  remove: function () {
    const scene = this.el.sceneEl;
    scene.removeEventListener('xrimagefound', this._onFound);
    scene.removeEventListener('xrimageupdated', this._onFound);
    scene.removeEventListener('xrimagelost', this._onLost);
  }
});
