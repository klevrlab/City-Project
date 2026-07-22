/**
 * Plays/pauses the overlay video when MindAR finds/loses the mural image,
 * and holds the last good pose for `holdMs` after tracking drops so brief
 * dropouts (glare, hands, motion blur) don't blank the showcase.
 *
 * The hold works by wrapping the mindar-image-target component's
 * updateWorldMatrix: MindAR sends the null (lost) update exactly once, so it
 * is swallowed to keep the last pose, and tick() delivers the deferred drop
 * when the grace window expires — targetLost fires and the video pauses only
 * then. Re-acquiring within the window resumes seamlessly with no found/lost
 * churn.
 *
 * Attach to a `mindar-image-target` anchor entity:
 *   <a-entity mindar-image-target="targetIndex: 0"
 *             mural-plane="video: #muralVideoFront; holdMs: 1250">
 *     <a-plane ...></a-plane>
 *   </a-entity>
 *
 * `video` is optional — omit it when the plane uses a static image texture.
 */

// All anchors are lighting variants of the same physical panel, so when the
// tracker cross-matches several at once only ONE plane should render. The
// first anchor to become visible claims this slot; it releases the claim when
// it truly loses tracking (after the hold), letting another variant take over.
let activeAnchor = null;

AFRAME.registerComponent('mural-plane', {
  schema: {
    video: { type: 'selector' },
    holdMs: { type: 'number', default: 1250 }   // 0 disables the hold
  },

  init: function () {
    this.lostAt = null;
    this._wrapped = false;

    this._onFound = this._onFound.bind(this);
    this._onLost = this._onLost.bind(this);
    this.el.addEventListener('targetFound', this._onFound);
    this.el.addEventListener('targetLost', this._onLost);

    this._wrapAnchor();
  },

  // mindar-image-target may not be initialised yet when we init (component
  // order); retry from tick until the wrap lands.
  _wrapAnchor: function () {
    if (this._wrapped) return true;
    const anchor = this.el.components['mindar-image-target'];
    if (!anchor || typeof anchor.updateWorldMatrix !== 'function') return false;

    const orig = anchor.updateWorldMatrix.bind(anchor);
    this._origUpdate = orig;
    anchor.updateWorldMatrix = (worldMatrix) => {
      if (worldMatrix === null && this.data.holdMs > 0 && this.el.object3D.visible) {
        // MindAR sends the null "lost" update ONCE (controller.js flips
        // showing=false and stops updating). Swallow it to freeze the last
        // pose — tick() delivers the deferred drop when the window expires.
        if (this.lostAt === null) this.lostAt = performance.now();
        return;
      }
      if (worldMatrix !== null) this.lostAt = null;
      orig(worldMatrix);
    };
    this._wrapped = true;
    return true;
  },

  tick: function () {
    if (!this._wrapped) this._wrapAnchor();

    // Deferred drop: the swallowed null never repeats, so the hold must
    // expire from here or the plane sticks forever once tracking is gone.
    if (this.lostAt !== null && this.el.object3D.visible &&
        performance.now() - this.lostAt >= this.data.holdMs) {
      this.lostAt = null;
      this._origUpdate(null); // emits targetLost, hides the anchor
    }

    // Claim/enforce the single-plane slot. Visibility of the anchor entity is
    // driven by MindAR; we only toggle the child plane so secondary variants
    // keep tracking silently without drawing a second plane.
    const visible = this.el.object3D.visible;
    if (visible && (activeAnchor === null || !activeAnchor.el.object3D.visible)) {
      activeAnchor = this;
    }
    this._setPlaneVisible(visible && activeAnchor === this);
  },

  _setPlaneVisible: function (v) {
    const plane = this.el.querySelector('a-plane');
    if (plane && plane.object3D) plane.object3D.visible = v;
  },

  _onFound: function () {
    this.lostAt = null;
    const v = this.data.video;
    // Static image overlays have no play(); only start real <video> elements.
    if (v && typeof v.play === 'function') {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
    const status = document.getElementById('mural-status');
    if (status) status.classList.remove('visible');
  },

  _onLost: function () {
    this.lostAt = null;
    if (activeAnchor === this) activeAnchor = null;
    const v = this.data.video;
    if (!v || typeof v.pause !== 'function' || v.paused) return;
    // Several anchors can share one video (multiple lighting variants of the
    // same panel) — only pause when no other anchor of the SAME video is
    // still showing it. Anchors for the other side have their own video.
    const others = this.el.sceneEl.querySelectorAll('[mural-plane]');
    for (const el of others) {
      if (el === this.el || !el.object3D || !el.object3D.visible) continue;
      const c = el.components['mural-plane'];
      if (c && c.data.video === v) return;
    }
    v.pause();
  },

  remove: function () {
    this.el.removeEventListener('targetFound', this._onFound);
    this.el.removeEventListener('targetLost', this._onLost);
  }
});
