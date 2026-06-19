/**
 * GPS gate for the MindAR mural experience.
 *
 * Lives on the <a-scene>. MindAR starts with autoStart:false; this component
 * only fires up the camera + tracker once the user is physically within
 * `radius` metres of the mural, and stops it again when they leave. The camera
 * is actually started from a user tap (required for iOS Safari getUserMedia),
 * so in-range we reveal a "Start" button rather than auto-starting.
 *
 * Fully client-side — reuses MathUtils.haversineMeters when present, falls back
 * to an inline haversine otherwise. No backend, no account.
 */
AFRAME.registerComponent('mural-geo-gate', {
  schema: {
    lat:    { type: 'number', default: 37.334900 },   // TODO: set to the memorial's real coords
    lng:    { type: 'number', default: -121.894400 },
    radius: { type: 'number', default: 40 },           // metres
    bypass: { type: 'boolean', default: false }        // dev: skip GPS, allow Start immediately
  },

  init: function () {
    this.started = false;
    this.inRange = false;
    this.system = null; // looked up lazily — may not be ready at init time

    this.statusEl = document.getElementById('mural-status');
    this.startBtn = document.getElementById('mural-start');

    this._onStartClick = this._onStartClick.bind(this);
    if (this.startBtn) this.startBtn.addEventListener('click', this._onStartClick);

    if (this.data.bypass) { this._arm(0); return; }

    if (!('geolocation' in navigator)) {
      this.setStatus('This device has no GPS — cannot geo-lock the mural.');
      return;
    }

    this.setStatus('Finding your location…');
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPos(pos),
      (err) => this.setStatus('Turn on Location to start (' + err.message + ')'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  },

  _onPos: function (pos) {
    const d = this._haversine(
      pos.coords.latitude, pos.coords.longitude,
      this.data.lat, this.data.lng
    );
    const within = d <= this.data.radius;
    if (within && !this.inRange) {
      this.inRange = true;
      this._arm(d);
    } else if (!within && this.inRange) {
      this.inRange = false;
      this._disarm(d);
    } else if (!within) {
      this.setStatus('Walk to the mural — about ' + Math.round(d) + 'm away');
    }
  },

  _getSystem: function () {
    if (!this.system) this.system = this.el.sceneEl.systems['mindar-image-system'];
    return this.system;
  },

  // In range (or bypassed): reveal the Start button — the camera needs a user
  // tap to start on iOS Safari.
  _arm: function (d) {
    this.setStatus('Tap Start, then point your camera at the mural.');
    if (this.startBtn) this.startBtn.classList.add('visible');
  },

  _disarm: function (d) {
    if (this.startBtn) this.startBtn.classList.remove('visible');
    const sys = this._getSystem();
    if (sys && this.started) {
      try { sys.stop(); } catch (e) {}
      this.started = false;
    }
    this.setStatus('Walk to the mural — about ' + Math.round(d) + 'm away');
  },

  _onStartClick: function () {
    if (this.startBtn) this.startBtn.classList.remove('visible');
    this.setStatus('Point your camera at the mural');
    const sys = this._getSystem();
    if (!sys) {
      this.setStatus('Tracker still loading — tap Start again in a moment.');
      if (this.startBtn) this.startBtn.classList.add('visible');
      return;
    }
    if (!this.started) {
      try {
        const p = sys.start();
        if (p && p.catch) p.catch(() => this.setStatus('Camera blocked — allow camera access and retry.'));
      } catch (e) {
        this.setStatus('Camera blocked — allow camera access and retry.');
      }
      this.started = true;
    }
  },

  _haversine: function (lat1, lng1, lat2, lng2) {
    if (window.MathUtils && window.MathUtils.haversineMeters) {
      return window.MathUtils.haversineMeters(lat1, lng1, lat2, lng2);
    }
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  setStatus: function (text) {
    if (!this.statusEl) this.statusEl = document.getElementById('mural-status');
    if (this.statusEl) { this.statusEl.textContent = text; this.statusEl.classList.add('visible'); }
  },

  remove: function () {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    if (this.startBtn) this.startBtn.removeEventListener('click', this._onStartClick);
  }
});
