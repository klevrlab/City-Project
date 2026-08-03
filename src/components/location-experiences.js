/**
 * June 10 redline — location-based placeholders for Sharks Way Phase II.
 *
 * - Little Italy: always-on Athena statues (left/right) at the 8 street pins.
 *   Odd pins use Augustus_of_Prima_Porta.glb (CC-BY Sketchfab / Arqueomodel3D).
 * - Leaning Tower: Leaning_Tower_of_Pisa.glb scaled to 8 m near western corner.
 * - Jump zones: underpass / river / grand finale fire a one-shot dive with
 *   maria-shark-jump-jimmy-txtr.glb (splash TBD — Rhonda). Finale also plants
 *   circle-swim + dancing mascot placeholders.
 *
 * Statues are planted in world space relative to the camera when the user
 * enters each geofence (SLAM keeps them anchored). Absolute GPS→ENU without a
 * compass lock is unreliable in browser XR, so entry-time local layout is the
 * intentional placeholder strategy.
 */
/**
 * Real-world sizes, in metres, for everything this component plants. Models are
 * normalized to these on load (see model-normalize.js) — none of the source
 * GLBs share a unit convention, so per-asset scale factors were guesswork.
 * Ceiling is roughly one storey (~3 m); the Leaning Tower is the deliberate
 * exception, spec'd at 8 m in the June 10 redline.
 */
const STATUE_HEIGHT_M = 2.5;   // marble statues — taller than a person, well under a storey
const MASCOT_HEIGHT_M = 1.9;   // Sharkie / Sammy — person-scale for photos
const SHARK_MAX_DIM_M = 3.0;   // sharks are long and low, so pin the longest axis

AFRAME.registerComponent('location-experiences', {
  schema: {
    statueRadiusM: { type: 'number', default: 55 },
    towerRadiusM: { type: 'number', default: 60 },
    jumpRadiusM: { type: 'number', default: 40 },
    jumpCooldownMs: { type: 'number', default: 28000 }
  },

  init: function () {
    this.watchId = null;
    this.inLittleItaly = false;
    this.statueRoot = null;
    this.towerEl = null;
    this.jumpBusy = false;
    this.lastJumpAt = {};
    this.userLat = null;
    this.userLng = null;
    this.gpsStarted = false;
    this.statusEl = null;

    // June 10 redline pins — North side points Right/West; South points Left/West.
    this.statuePins = [
      { id: 1, lat: 37.335397, lng: -121.897650, side: 'north', odd: true },
      { id: 2, lat: 37.335416, lng: -121.897383, side: 'north', odd: false },
      { id: 3, lat: 37.335432, lng: -121.897074, side: 'north', odd: true },
      { id: 4, lat: 37.335430, lng: -121.896874, side: 'north', odd: false },
      { id: 5, lat: 37.335226, lng: -121.897639, side: 'south', odd: true },
      { id: 6, lat: 37.335222, lng: -121.897390, side: 'south', odd: false },
      { id: 7, lat: 37.335258, lng: -121.897086, side: 'south', odd: true },
      { id: 8, lat: 37.335275, lng: -121.896868, side: 'south', odd: false }
    ];

    this.towerPin = { lat: 37.335429, lng: -121.897883, heightM: 8 };

    this.jumpPins = [
      {
        id: 'underpass',
        lat: 37.335391,
        lng: -121.896682,
        label: 'Underpass Jump',
        heading: 'west'
      },
      {
        id: 'river',
        lat: 37.334664,
        lng: -121.899474,
        label: 'River Jump',
        heading: 'north'
      },
      {
        id: 'finale',
        lat: 37.334113,
        lng: -121.900460,
        label: 'Grand Finale Jump',
        heading: 'west',
        danceCorner: { lat: 37.334118, lng: -121.900262 }
      }
    ];

    // Spec Little Italy corridor (also used by shark-detector).
    this.liWest = { lat: 37.334778, lng: -121.899222 };
    this.liEast = { lat: 37.335444, lng: -121.896778 };

    // ?demoLocations=1 forces statues + tower in front of camera (no GPS needed).
    const params = new URLSearchParams(window.location.search);
    this.demoLocations = params.get('demoLocations') === '1' || params.get('demo') === 'locations';

    if (this.el.sceneEl.hasLoaded) this.start();
    else this.el.sceneEl.addEventListener('loaded', () => this.start(), { once: true });
  },

  start: function () {
    this.ensureStatusUi();

    // Dev helpers — plant without GPS.
    window.forceLittleItalyStatues = () => {
      this.plantStatuesAroundCamera();
      this.setStatus('Forced: Little Italy statues');
    };
    window.forceLeaningTower = () => {
      this.plantTowerInFront();
      this.setStatus('Forced: Leaning Tower');
    };
    window.forceJumpDemo = (id) => this.playJump(id || 'underpass');

    // GPS does not need XR — start immediately, and also on realityready as backup.
    this.startGps();
    window.addEventListener('realityready', () => {
      this.startGps();
      if (this.demoLocations) this.runDemoPlant();
      // Retry plants once AR camera is live (first GPS ping may have been early).
      if (this.inLittleItaly && !this.statueRoot) this.plantStatuesAroundCamera();
      if (this.userLat != null) this.onGps(this.userLat, this.userLng);
    }, { once: true });

    // Fallback if realityready never fires (seen on some iOS/WebView paths).
    setTimeout(() => {
      this.startGps();
      if (this.demoLocations) this.runDemoPlant();
      if (this.inLittleItaly && !this.statueRoot) this.plantStatuesAroundCamera();
    }, 4000);

    if (this.demoLocations) {
      // Plant shortly after load so the camera entity exists.
      setTimeout(() => this.runDemoPlant(), 1500);
    }
  },

  runDemoPlant: function () {
    this.plantStatuesAroundCamera();
    this.plantTowerInFront();
    this.setHint('Demo locations — statues + tower planted');
    this.setStatus('Demo mode (?demoLocations=1)');
  },

  ensureStatusUi: function () {
    if (document.getElementById('location-status')) {
      this.statusEl = document.getElementById('location-status');
      return;
    }
    const el = document.createElement('div');
    el.id = 'location-status';
    el.setAttribute('aria-live', 'polite');
    el.textContent = 'Location: waiting for GPS…';
    document.body.appendChild(el);
    this.statusEl = el;
  },

  setStatus: function (text) {
    if (!this.statusEl) this.ensureStatusUi();
    if (this.statusEl) this.statusEl.textContent = text;
  },

  startGps: function () {
    if (!('geolocation' in navigator)) {
      this.setStatus('Location: GPS unavailable');
      return;
    }
    if (this.watchId != null) return;
    this.gpsStarted = true;
    this.setStatus('Location: acquiring GPS…');
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onGps(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (err) => {
        console.warn('[location-experiences] GPS', err);
        this.setStatus(`Location: blocked (${err && err.message ? err.message : 'error'})`);
      },
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 20000 }
    );
  },

  haversineM: function (lat1, lng1, lat2, lng2) {
    if (window.MathUtils && window.MathUtils.haversineMeters) {
      return window.MathUtils.haversineMeters(lat1, lng1, lat2, lng2);
    }
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  isInLittleItaly: function (lat, lng) {
    // ~110 m pad so phone GPS jitter near the corridor still counts.
    const pad = 0.001;
    const minLat = Math.min(this.liWest.lat, this.liEast.lat) - pad;
    const maxLat = Math.max(this.liWest.lat, this.liEast.lat) + pad;
    const minLng = Math.min(this.liWest.lng, this.liEast.lng) - pad;
    const maxLng = Math.max(this.liWest.lng, this.liEast.lng) + pad;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  },

  onGps: function (lat, lng, accuracy) {
    this.userLat = lat;
    this.userLng = lng;

    const acc = typeof accuracy === 'number' ? ` ±${Math.round(accuracy)}m` : '';
    const towerDist = this.haversineM(lat, lng, this.towerPin.lat, this.towerPin.lng);
    const inLI = this.isInLittleItaly(lat, lng);

    if (inLI) {
      const wasIn = this.inLittleItaly;
      this.inLittleItaly = true;
      // Always (re)plant if missing — first enter used to race the AR camera and never retry.
      if (!this.statueRoot) {
        console.log('[location-experiences] Planting Little Italy statues');
        this.plantStatuesAroundCamera();
        if (this.statueRoot) {
          this.setHint('Little Italy — marble statues pointing toward SAP');
          if (!wasIn) this.el.sceneEl.emit('littleItalyEnter');
        }
      }
      this.setStatus(`Little Italy · tower ${Math.round(towerDist)}m${acc}`);
    } else if (this.inLittleItaly) {
      this.inLittleItaly = false;
      this.clearStatues();
      this.el.sceneEl.emit('littleItalyExit');
      this.setStatus(`Outside Little Italy · tower ${Math.round(towerDist)}m${acc}`);
    } else {
      this.setStatus(`GPS ok · tower ${Math.round(towerDist)}m${acc}`);
    }

    // Tower — wider catch radius; retry if plant failed earlier.
    if (towerDist <= this.data.towerRadiusM) {
      if (!this.towerEl) {
        this.plantTowerInFront();
        if (this.towerEl) this.setHint('Leaning Tower of Pisa — 8 m · walk around it');
      }
    } else if (this.towerEl && towerDist > this.data.towerRadiusM + 20) {
      this.clearTower();
    }

    // Jump zones (Wayfinding only so Photo/Goalie stay clean).
    if (window.SharksWayMode && !window.SharksWayMode.isWayfinding()) return;
    if (this.jumpBusy) return;

    for (const pin of this.jumpPins) {
      const d = this.haversineM(lat, lng, pin.lat, pin.lng);
      if (d > this.data.jumpRadiusM) continue;
      const last = this.lastJumpAt[pin.id] || 0;
      if (performance.now() - last < this.data.jumpCooldownMs) continue;
      this.playJump(pin.id);
      break;
    }
  },

  setHint: function (text) {
    const el = document.getElementById('tap-instruction');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => el.classList.remove('visible'), 4000);
  },

  // ---- Little Italy statues -------------------------------------------------

  /**
   * Anchor root at the camera's ground position, yawed so that local −Z is the
   * camera's forward. Children then live in a stable "metres ahead / metres
   * right" frame, which is what debug mode saves as a placement override.
   */
  makeAnchorRoot: function (id, cam) {
    const camObj = cam.object3D;
    const forward = window.MathUtils.cameraForward(cam);

    const origin = camObj.getWorldPosition(new THREE.Vector3());
    const root = document.createElement('a-entity');
    root.setAttribute('id', id);
    root.setAttribute('position', `${origin.x} 0 ${origin.z}`);
    root.setAttribute('rotation', `0 ${THREE.MathUtils.radToDeg(Math.atan2(-forward.x, -forward.z))} 0`);
    return root;
  },

  place: function (el, key, defaults) {
    if (window.PlacementOverrides) return window.PlacementOverrides.apply(el, key, defaults);
    if (defaults.position) el.setAttribute('position', defaults.position);
    if (defaults.rotation) el.setAttribute('rotation', defaults.rotation);
    if (defaults.scale) el.setAttribute('scale', defaults.scale);
    return el;
  },

  plantStatuesAroundCamera: function () {
    const cam = document.getElementById('camera');
    if (!cam || !cam.object3D) {
      console.warn('[location-experiences] No camera yet — will retry on next GPS');
      return false;
    }

    this.clearStatues();

    const root = this.makeAnchorRoot('little-italy-statues', cam);
    this.el.appendChild(root);
    this.statueRoot = root;

    // Two rows parallel to "street" (local −Z = toward SAP / west-ish).
    // North side = +X local, South side = −X local; spaced along Z.
    const northPins = this.statuePins.filter((p) => p.side === 'north');
    const southPins = this.statuePins.filter((p) => p.side === 'south');
    const spacing = 4.5;
    const lateral = 3.2;
    const aheadM = 6;

    northPins.forEach((pin, i) => {
      const along = (i - (northPins.length - 1) / 2) * spacing;
      this.spawnStatue(root, pin, { x: lateral, y: 0, z: -(aheadM + along) }, /*faceStreet*/ -90);
    });
    southPins.forEach((pin, i) => {
      const along = (i - (southPins.length - 1) / 2) * spacing;
      this.spawnStatue(root, pin, { x: -lateral, y: 0, z: -(aheadM + along) }, /*faceStreet*/ 90);
    });
    return true;
  },

  spawnStatue: function (root, pin, localPos, yaw) {
    const ent = document.createElement('a-entity');
    ent.setAttribute('shadow', 'cast: true');
    ent.setAttribute('data-statue-pin', String(pin.id));

    if (pin.odd) {
      // Spec: odd pins = Augustus of Prima Porta.
      ent.setAttribute('gltf-model', '#augustus-statue');
    } else {
      ent.setAttribute('gltf-model', pin.side === 'north' ? '#athena-point-right' : '#athena-point-left');
    }

    // Raw GLBs are 1 m (Augustus) and 206 m (Athena) tall — normalize both to a
    // consistent street-statue height rather than per-asset scale guesses.
    ent.setAttribute('model-normalize', `height: ${STATUE_HEIGHT_M}`);

    // Face across the street (pointing roughly west / toward SAP per redline).
    this.place(ent, `little-italy/pin-${pin.id}`, {
      position: localPos,
      rotation: { x: 0, y: yaw, z: 0 },
      scale: '1 1 1'
    });

    root.appendChild(ent);
  },

  clearStatues: function () {
    if (this.statueRoot && this.statueRoot.parentNode) {
      this.statueRoot.parentNode.removeChild(this.statueRoot);
    }
    this.statueRoot = null;
  },

  // ---- Leaning Tower (real GLB, scaled to 8 m) -----------------------------

  plantTowerInFront: function () {
    const cam = document.getElementById('camera');
    if (!cam || !cam.object3D) {
      console.warn('[location-experiences] No camera for tower — will retry');
      return false;
    }

    this.clearTower();

    const root = this.makeAnchorRoot('leaning-tower-anchor', cam);
    const h = this.towerPin.heightM;
    const tower = document.createElement('a-entity');
    tower.setAttribute('id', 'leaning-tower');
    tower.setAttribute('gltf-model', '#leaning-tower-model');
    tower.setAttribute('shadow', 'cast: true');

    // Raw GLB is 47.5 m tall; the redline calls for an 8 m landmark replica.
    tower.setAttribute('model-normalize', `height: ${h}`);
    this.place(tower, 'leaning-tower', {
      position: { x: 0, y: 0, z: -12 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: '1 1 1'
    });

    tower.addEventListener('model-error', () => {
      console.warn('[location-experiences] Failed to load Leaning_Tower_of_Pisa.glb');
      this.setStatus('Tower model failed to load');
    }, { once: true });

    root.appendChild(tower);
    this.el.appendChild(root);
    this.towerEl = root;
    this.setHint('Leaning Tower of Pisa — 8 m · walk around it');
    return true;
  },

  clearTower: function () {
    if (this.towerEl && this.towerEl.parentNode) {
      this.towerEl.parentNode.removeChild(this.towerEl);
    }
    this.towerEl = null;
  },

  // ---- Jump sequences (placeholder splash) ---------------------------------

  spawnSplashPlaceholder: function (x, z) {
    const group = document.createElement('a-entity');
    group.setAttribute('position', `${x} 0.02 ${z}`);

    const disc = document.createElement('a-cylinder');
    disc.setAttribute('radius', 0.05);
    disc.setAttribute('height', 0.04);
    disc.setAttribute('material', 'color: #7ec8e3; opacity: 0.65; transparent: true');
    group.appendChild(disc);

    const ring = document.createElement('a-torus');
    ring.setAttribute('radius', 0.08);
    ring.setAttribute('radius-tubular', 0.02);
    ring.setAttribute('rotation', '90 0 0');
    ring.setAttribute('material', 'color: #b8e8f8; opacity: 0.7; transparent: true');
    group.appendChild(ring);

    const label = document.createElement('a-text');
    label.setAttribute('value', 'splash TBD');
    label.setAttribute('align', 'center');
    label.setAttribute('width', 4);
    label.setAttribute('color', '#0a3a4a');
    label.setAttribute('position', '0 0.35 0');
    group.appendChild(label);

    this.el.appendChild(group);
    disc.setAttribute('animation__grow', {
      property: 'scale',
      from: '1 1 1',
      to: '28 1 28',
      dur: 1000,
      easing: 'easeOutQuad'
    });
    ring.setAttribute('animation__grow', {
      property: 'scale',
      from: '1 1 1',
      to: '22 1 22',
      dur: 1100,
      easing: 'easeOutQuad'
    });
    group.setAttribute('animation__fade', {
      property: 'scale',
      to: '0.01 0.01 0.01',
      dur: 400,
      delay: 900
    });
    setTimeout(() => {
      if (group.parentNode) group.parentNode.removeChild(group);
    }, 1400);
  },

  playJump: function (jumpId) {
    const pin = this.jumpPins.find((p) => p.id === jumpId) || this.jumpPins[0];
    if (!pin || this.jumpBusy) return;
    if (window.SharksWayMode && !window.SharksWayMode.isWayfinding()) return;

    this.jumpBusy = true;
    this.lastJumpAt[pin.id] = performance.now();
    this.setHint(`${pin.label} — diving shark (splash TBD)`);

    const cam = document.getElementById('camera');
    if (!cam) {
      this.jumpBusy = false;
      return;
    }

    const forward = window.MathUtils.cameraForward(cam);
    const right = window.MathUtils.cameraRight(cam);

    // Enter from the side matching the redline heading, jump at center, exit.
    const start = cam.object3D.position.clone()
      .add(forward.clone().multiplyScalar(8))
      .add(right.clone().multiplyScalar(pin.heading === 'north' ? 0 : 4));
    start.y = 0.4;
    const mid = cam.object3D.position.clone().add(forward.clone().multiplyScalar(5));
    mid.y = 3.2;
    const end = cam.object3D.position.clone()
      .add(forward.clone().multiplyScalar(14))
      .add(right.clone().multiplyScalar(pin.heading === 'north' ? 0 : -1));
    end.y = 0.35;

    const ent = document.createElement('a-entity');
    ent.setAttribute('gltf-model', '#diving-shark');
    ent.setAttribute('model-normalize', `maxDim: ${SHARK_MAX_DIM_M}; ground: false`);
    ent.setAttribute('position', `${start.x} ${start.y} ${start.z}`);
    ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.1');
    ent.setAttribute('shadow', 'cast: true');

    const yaw = Math.atan2(end.x - start.x, end.z - start.z) * (180 / Math.PI);
    ent.setAttribute('rotation', `0 ${yaw} 0`);

    this.el.appendChild(ent);

    // Approach
    ent.setAttribute('animation__approach', {
      property: 'position',
      to: `${mid.x} 0.9 ${mid.z}`,
      dur: 1800,
      easing: 'easeInOutSine'
    });

    // Jump arc peak + splash placeholder
    setTimeout(() => {
      if (!ent.parentNode) return;
      ent.setAttribute('animation__jump', {
        property: 'position',
        to: `${mid.x} ${mid.y} ${mid.z}`,
        dur: 700,
        easing: 'easeOutQuad'
      });
      this.spawnSplashPlaceholder(mid.x, mid.z);
    }, 1800);

    // Come down + continue
    setTimeout(() => {
      if (!ent.parentNode) return;
      ent.setAttribute('animation__down', {
        property: 'position',
        to: `${end.x} ${end.y} ${end.z}`,
        dur: 1600,
        easing: 'easeInQuad'
      });
    }, 2500);

    // Finale: circle sharks + dancing mascots (placeholders until art lands).
    if (pin.id === 'finale') {
      setTimeout(() => {
        this.plantFinaleCircle(cam);
        this.plantFinaleDancers(cam);
      }, 800);
    }

    setTimeout(() => {
      if (ent.parentNode) ent.parentNode.removeChild(ent);
      this.jumpBusy = false;
    }, 4800);
  },

  // Spec asks for a 60 m circle — AR scale uses ~10 m radius so it stays in view.
  plantFinaleCircle: function (cam) {
    const anchor = this.makeAnchorRoot('finale-circle-anchor', cam);

    const pivot = document.createElement('a-entity');
    pivot.setAttribute('id', 'finale-circle');
    // Rotation is driven by the orbit animation, so only position is overridable.
    this.place(pivot, 'finale/circle-center', { position: { x: 0, y: 0.5, z: -10 } });
    pivot.setAttribute('animation__orbit', {
      property: 'rotation',
      to: '0 360 0',
      loop: true,
      dur: 32000,
      easing: 'linear'
    });

    const radius = 10; // AR stand-in for the 60 m corridor circle
    const sharks = [
      { id: 'maria', model: '#circle-maria', angleDeg: 0 },
      { id: 'stella', model: '#circle-stella', angleDeg: 180 }
    ];

    sharks.forEach((s) => {
      const rad = s.angleDeg * Math.PI / 180;
      const ent = document.createElement('a-entity');
      ent.setAttribute('gltf-model', s.model);
      ent.setAttribute('model-normalize', `maxDim: ${SHARK_MAX_DIM_M}; ground: false`);
      ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.0');
      ent.setAttribute('shadow', 'cast: true');
      // Face tangent to the circle (travel direction).
      this.place(ent, `finale/circle-${s.id}`, {
        position: { x: Math.cos(rad) * radius, y: 0, z: Math.sin(rad) * radius },
        rotation: { x: 0, y: s.angleDeg + 90, z: 0 },
        scale: '1 1 1'
      });
      pivot.appendChild(ent);
    });

    const label = document.createElement('a-text');
    label.setAttribute('value', '60m circle\n(AR-scaled)');
    label.setAttribute('align', 'center');
    label.setAttribute('width', 6);
    label.setAttribute('color', '#ffffff');
    label.setAttribute('position', '0 2.2 0');
    pivot.appendChild(label);

    anchor.appendChild(pivot);
    this.el.appendChild(anchor);
    setTimeout(() => {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    }, 16000);
  },

  plantFinaleDancers: function (cam) {
    const anchor = this.makeAnchorRoot('finale-dancers-anchor', cam);

    const dancers = [
      { id: 'sharkie', model: '#photo-sharkie', offset: -0.8, label: 'Sharkie\n(dance TBD)' },
      { id: 'sammy', model: '#photo-sammy', offset: 0.8, label: 'Sammy\n(dance TBD)' }
    ];

    dancers.forEach((d) => {
      const ent = document.createElement('a-entity');
      ent.setAttribute('gltf-model', d.model);
      // Both mascot GLBs float above their origin and differ in height — normalize.
      ent.setAttribute('model-normalize', `height: ${MASCOT_HEIGHT_M}`);
      // Rotation is the spin animation; position/scale are overridable.
      this.place(ent, `finale/dancer-${d.id}`, {
        position: { x: d.offset, y: 0.02, z: -4 },
        scale: '1 1 1'
      });
      ent.setAttribute('animation__spin', {
        property: 'rotation',
        to: '0 360 0',
        loop: true,
        dur: 4000,
        easing: 'linear'
      });
      const label = document.createElement('a-text');
      label.setAttribute('value', d.label);
      label.setAttribute('align', 'center');
      label.setAttribute('width', 2.5);
      label.setAttribute('color', '#fff');
      label.setAttribute('position', '0 2.1 0');
      ent.appendChild(label);
      anchor.appendChild(ent);
    });

    this.el.appendChild(anchor);
    setTimeout(() => {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    }, 12000);
  },

  remove: function () {
    if (this.watchId != null) {
      try { navigator.geolocation.clearWatch(this.watchId); } catch (e) { /* ignore */ }
    }
    this.clearStatues();
    this.clearTower();
  }
});

// Ensure the component attaches even if the a-scene attribute was parsed before
// this module finished registering (ES module defer race).
function ensureLocationExperiencesAttached() {
  const scene = document.querySelector('a-scene');
  if (!scene || !window.AFRAME) return;
  if (!scene.components || !scene.components['location-experiences']) {
    scene.setAttribute('location-experiences', '');
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(ensureLocationExperiencesAttached, 0));
} else {
  setTimeout(ensureLocationExperiencesAttached, 0);
}