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

/**
 * The Pisa GLB is handed the wrong way round for us, so it gets mirrored on X.
 * Flip this to false, or hit MIRROR X in the debug panel and SAVE, to undo.
 */
const TOWER_MIRROR_X = true;

/**
 * Measured lean of the GLB: its top sits 6.2 m off its base, toward local +X,
 * which reads as bearing 92° when the entity's yaw is 0. Mirroring on X flips
 * that to 268°. Knowing this lets the tower be aimed at a real bearing instead
 * of hand-turned until it looks right.
 */
const TOWER_LEAN_LOCAL_DEG = TOWER_MIRROR_X ? 267.6 : 92.4;

/**
 * Jump travel bearings, from the per-location descriptions in the notes:
 * underpass "from the east heading west", river "from the south heading north",
 * finale "from the east heading west toward SAP" (that one is recomputed from
 * the pin's real bearing to the arena).
 */
const JUMP_BEARINGS = { west: 270, north: 0, east: 90, south: 180 };

/**
 * "Maria & sharks swim in a 60 meter circle around the intersection" — read as
 * 60 m across, so a 30 m radius. Change this one number if it meant radius.
 */
const FINALE_CIRCLE_RADIUS_M = 30;
const FINALE_CIRCLE_PERIOD_MS = 60000;  // ~3 m/s at 30 m — an unhurried cruise

/** 'pod' = all three sharks travelling together; 'spread' = evenly spaced. */
const FINALE_CIRCLE_FORMATION = 'pod';

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

    /**
     * Corner of Little Italy Way & Sharks Way — the spot Chris pointed at in
     * Street View, which is the Street View camera position from that link.
     * The notes say "placed on ground when near 37.335429, -121.897883" and "at
     * western corner"; that is 12 m north-northeast of here, i.e. the same
     * corner within GPS error. Height is the notes' 8 m / 26 ft.
     *
     * Lean direction is deliberately not corrected — Chris: "you can ignore
     * where it leans".
     */
    this.towerPin = { lat: 37.335323, lng: -121.897912, heightM: 8 };

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
        /**
         * "Swims into frame from the east heading west toward SAP" — but due
         * west (270°) and the arena's true bearing from here (205°) disagree.
         * West Saint John Street, the same street the statues are on, runs
         * 239°/59° through this intersection, so this follows the street
         * toward SAP rather than flying the shark over the buildings.
         */
        bearingDeg: 239,
        danceCorner: { lat: 37.334118, lng: -121.900262 }
      }
    ];

    // Spec Little Italy corridor (also used by shark-detector).
    this.liWest = { lat: 37.334778, lng: -121.899222 };
    this.liEast = { lat: 37.335444, lng: -121.896778 };

    // ?demoLocations=1 forces statues + tower in front of camera (no GPS needed).
    const params = new URLSearchParams(window.location.search);
    this.demoLocations = params.get('demoLocations') === '1' || params.get('demo') === 'locations';
    // ?geo=0 pins everything to the old camera-relative layout.
    this.forceCameraRelative = params.get('geo') === '0' || this.demoLocations;
    this.geoPlaced = false;

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

    /** Re-run the plant with the current fix + heading (after calibrating). */
    window.reanchorLocations = () => {
      this.clearStatues();
      this.clearTower();
      const ok = this.plantStatuesAroundCamera();
      this.plantTowerInFront();
      this.setStatus(this.geoPlaced ? 'Re-anchored to GPS coordinates' : 'Re-anchored (camera-relative)');
      return ok;
    };

    if (window.GeoAnchor) {
      // Android reports absolute orientation without asking; iOS needs a tap,
      // which the debug panel's ENABLE COMPASS button provides.
      window.GeoAnchor.listen();

      // The compass usually settles after the first plant. Upgrade the
      // camera-relative fallback to real coordinates once, when it does.
      // Landmarks refuse to plant until there's a heading, and a device can
      // sit inside the geofence with no further GPS callback, so poll: once
      // the compass settles, drop anything camera-relative and re-run the
      // geofence with real coordinates.
      this._geoUpgradeTimer = setInterval(() => {
        if (this.forceCameraRelative) return clearInterval(this._geoUpgradeTimer);
        if (!window.GeoAnchor.stable || this.userLat == null) return;
        // One re-run is enough: from here a streaming watchPosition retries any
        // plant that is still missing. Without stopping, standing outside every
        // geofence would clear and re-run forever.
        clearInterval(this._geoUpgradeTimer);
        console.log('[location-experiences] compass settled — anchoring to GPS coordinates');
        this.clearStatues();
        this.clearTower();
        this.onGps(this.userLat, this.userLng);
      }, 1500);
    }

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

  /**
   * Ask for a metre-based size. If model-normalize.js failed to load, an
   * unknown-component setAttribute is a silent no-op and the model renders at
   * its raw GLB size — which for Athena is 206 m. Fall back to normalizing here
   * so a missing script tag can't put a skyscraper on the sidewalk.
   */
  sizeTo: function (el, spec) {
    if (AFRAME.components['model-normalize']) {
      el.setAttribute('model-normalize', spec);
      return;
    }
    if (!this._warnedNoNormalize) {
      this._warnedNoNormalize = true;
      console.warn('[location-experiences] model-normalize not registered — ' +
        'check the <script> for src/components/model-normalize.js. Using inline fallback.');
    }
    const parsed = {};
    String(spec).split(';').forEach((part) => {
      const [k, v] = part.split(':').map((s) => s && s.trim());
      if (k && v !== undefined) parsed[k] = v;
    });
    el.addEventListener('model-loaded', () => {
      const mesh = el.getObject3D('mesh');
      if (!mesh) return;
      const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
      const h = Number(parsed.height);
      const m = Number(parsed.maxDim);
      let f = 1;
      if (h > 0) f = h / Math.max(size.y, 0.001);
      else if (m > 0) f = m / Math.max(size.x, size.y, size.z, 0.001);
      mesh.scale.multiplyScalar(f);
      if (parsed.ground !== 'false') {
        mesh.updateMatrixWorld(true);
        mesh.position.y -= new THREE.Box3().setFromObject(mesh).min.y /
          (el.object3D.getWorldScale(new THREE.Vector3()).y || 1);
      }
    }, { once: true });
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

    // Preferred: put each statue at its actual pin coordinate.
    const geoRoot = this.makeGeoRoot('little-italy-statues', cam);
    if (geoRoot) {
      this.el.appendChild(geoRoot);
      this.statueRoot = geoRoot;
      this.statuePins.forEach((pin) => {
        const off = window.GeoAnchor.localOffset(pin.lat, pin.lng, this.userLat, this.userLng);
        // Face across the street: north-side statues look south, south-side
        // look north. CORRIDOR_AXIS_DEG runs east (87°), so +90 is south and
        // −90 is north. Inside a north-aligned root, a child's scene yaw is the
        // negated compass bearing.
        const facingBearing = pin.side === 'north'
          ? window.GeoAnchor.CORRIDOR_AXIS_DEG + 90   // 177° — looks south
          : window.GeoAnchor.CORRIDOR_AXIS_DEG - 90;  // 357° — looks north
        const yaw = -facingBearing;

        // Each pin gets its own anchor at the true coordinate, so a saved
        // placement override is an offset from the pin — still meaningful next
        // visit, when the user is standing somewhere else entirely.
        const pinAnchor = document.createElement('a-entity');
        pinAnchor.setAttribute('position', `${off.x} 0 ${off.z}`);
        pinAnchor.setAttribute('rotation', `0 ${yaw} 0`);
        pinAnchor.setAttribute('data-geo-pin', String(pin.id));
        geoRoot.appendChild(pinAnchor);

        this.spawnStatue(pinAnchor, pin, { x: 0, y: 0, z: 0 }, 0, off.distance);
      });
      this.geoPlaced = true;
      return true;
    }

    // No fix or no heading yet. These statues belong to specific street
    // corners, so putting them in front of whoever is holding the phone is
    // worse than showing nothing — it looks placed-at-you and moves when you
    // turn. Wait for the compass instead; the upgrade timer replants.
    if (!this.forceCameraRelative) {
      this.setStatus('Little Italy — waiting for compass to place statues…');
      this.setHint('Hold the phone up and turn slowly, or tap calibrate in debug');
      return false;
    }

    // ?geo=0 / demo mode only: lay the corridor out ahead of the user.
    const root = this.makeAnchorRoot('little-italy-statues', cam);
    this.el.appendChild(root);
    this.statueRoot = root;
    this.geoPlaced = false;

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

  /**
   * Root at the user's position whose −Z points true north, so children can be
   * addressed in east/north metres. Null when there's no fix or no heading yet,
   * which is the signal to fall back to camera-relative layout.
   */
  makeGeoRoot: function (id, cam) {
    if (this.forceCameraRelative) return null;
    if (this.userLat == null || !window.GeoAnchor) return null;
    if (!window.GeoAnchor.stable) return null;
    const northYaw = window.GeoAnchor.northYawDeg(cam);
    if (northYaw == null) return null;

    const origin = cam.object3D.getWorldPosition(new THREE.Vector3());
    // Anything built on a geo root is at real coordinates — the debug panel
    // reports this, so set it here rather than in each caller.
    this.geoPlaced = true;
    const root = document.createElement('a-entity');
    root.setAttribute('id', id);
    root.setAttribute('data-geo-root', '1');
    root.setAttribute('position', `${origin.x} 0 ${origin.z}`);
    root.setAttribute('rotation', `0 ${northYaw} 0`);
    return root;
  },

  spawnStatue: function (root, pin, localPos, yaw, distance) {
    const ent = document.createElement('a-entity');
    ent.setAttribute('shadow', 'cast: true');
    ent.setAttribute('data-statue-pin', String(pin.id));
    if (typeof distance === 'number') ent.setAttribute('data-geo-distance', distance.toFixed(1));

    if (pin.odd) {
      // Spec: odd pins = Augustus of Prima Porta.
      ent.setAttribute('gltf-model', '#augustus-statue');
    } else {
      ent.setAttribute('gltf-model', pin.side === 'north' ? '#athena-point-right' : '#athena-point-left');
    }

    // Raw GLBs are 1 m (Augustus) and 206 m (Athena) tall — normalize both to a
    // consistent street-statue height rather than per-asset scale guesses.
    this.sizeTo(ent, `height: ${STATUE_HEIGHT_M}`);

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

    // Geo when we can: the tower belongs on its corner, not 12 m ahead of you.
    let root = this.makeGeoRoot('leaning-tower-anchor', cam);
    let parent = root;
    const towerLocal = { x: 0, y: 0, z: root ? 0 : -12 };
    if (root) {
      // Sub-anchor at the true coordinate keeps a saved override meaningful as
      // an offset from the pin rather than from wherever the user stood.
      const off = window.GeoAnchor.localOffset(
        this.towerPin.lat, this.towerPin.lng, this.userLat, this.userLng);
      parent = document.createElement('a-entity');
      parent.setAttribute('position', `${off.x} 0 ${off.z}`);
      parent.setAttribute('data-geo-pin', 'tower');
      root.appendChild(parent);
    } else {
      // Same rule as the statues: the tower has a real corner. Don't drop an
      // 8 m landmark 12 m in front of whoever happens to be standing here.
      if (!this.forceCameraRelative) {
        this.setStatus('Leaning Tower — waiting for compass…');
        return false;
      }
      root = this.makeAnchorRoot('leaning-tower-anchor', cam);
      parent = root;
    }

    const h = this.towerPin.heightM;
    const tower = document.createElement('a-entity');
    tower.setAttribute('id', 'leaning-tower');
    tower.setAttribute('gltf-model', '#leaning-tower-model');
    tower.setAttribute('shadow', 'cast: true');

    // Raw GLB is 47.5 m tall; the redline calls for an 8 m landmark replica.
    this.sizeTo(tower, `height: ${h}`);

    // Aim the lean down the corridor toward SAP, so it leans the way visitors
    // are walking rather than at a random compass point. Inside a north-aligned
    // root a child's yaw is the negated bearing, and rotating the model rotates
    // its lean with it — hence lean-bearing minus target-bearing.
    const towardSap = root && this.userLat != null
      ? window.GeoAnchor.bearingToSap(this.towerPin.lat, this.towerPin.lng)
      : null;
    const yaw = towardSap == null ? 0 : (TOWER_LEAN_LOCAL_DEG - towardSap);

    this.place(tower, 'leaning-tower', {
      position: towerLocal,
      rotation: { x: 0, y: yaw, z: 0 },
      // Negative X mirrors the model; see TOWER_MIRROR_X.
      scale: TOWER_MIRROR_X ? '-1 1 1' : '1 1 1'
    });

    // A mirrored transform inverts winding, so the tower would light and cull
    // inside-out without this.
    if (TOWER_MIRROR_X) {
      tower.addEventListener('model-loaded', () => {
        tower.object3D.traverse((o) => {
          if (o.isMesh && o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
              mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;
            });
          }
        });
      }, { once: true });
    }

    tower.addEventListener('model-error', () => {
      console.warn('[location-experiences] Failed to load Leaning_Tower_of_Pisa.glb');
      this.setStatus('Tower model failed to load');
    }, { once: true });

    parent.appendChild(tower);
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

  /**
   * Spec, per location: the shark "swims into frame" from a compass direction,
   * "jumps up like it's jumping out of water", and "comes back down with a
   * splash" continuing the same way. Bearings are real when geo anchoring is
   * up; otherwise they degrade to the camera's own frame.
   */
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

    // Travel bearing: underpass and finale head west (finale specifically
    // toward SAP), the river jump heads north.
    let bearing = pin.bearingDeg != null
      ? pin.bearingDeg
      : (JUMP_BEARINGS[pin.heading] != null ? JUMP_BEARINGS[pin.heading] : 270);
    let root = this.makeGeoRoot(`jump-${pin.id}-anchor`, cam);
    if (!root) {
      // No heading available — put the arc across the camera's view instead, so
      // the visitor still sees a breach rather than a shark leaving sideways.
      root = this.makeAnchorRoot(`jump-${pin.id}-anchor`, cam);
      bearing = 270;
    }

    // The apex should land in front of the visitor rather than on top of them.
    const apexAhead = 9;
    const b = bearing * Math.PI / 180;
    const dir = new THREE.Vector3(Math.sin(b), 0, -Math.cos(b));
    const across = new THREE.Vector3(-dir.z, 0, dir.x);
    const arcLength = 14;
    const origin = dir.clone().multiplyScalar(apexAhead - arcLength / 2)
      .add(across.multiplyScalar(2));

    const ent = document.createElement('a-entity');
    ent.setAttribute('gltf-model', '#diving-shark');
    this.sizeTo(ent, `maxDim: ${SHARK_MAX_DIM_M}; ground: false`);
    ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.1');
    ent.setAttribute('shadow', 'cast: true');
    ent.setAttribute('position', `${origin.x} 0 ${origin.z}`);

    // The breach itself, evaluated per frame — see shark-motion.js.
    const carrier = document.createElement('a-entity');
    carrier.setAttribute('shark-arc-jump', {
      bearing: bearing,
      approachM: 16,
      arcLengthM: arcLength,
      departM: 20,
      apexHeight: 3.4,
      speed: 6.5
    });
    carrier.appendChild(ent);
    // Position/rotation of the shark live on the carrier; keep the model clean.
    ent.removeAttribute('position');

    const anchor = document.createElement('a-entity');
    anchor.setAttribute('position', `${origin.x} 0 ${origin.z}`);
    anchor.appendChild(carrier);
    root.appendChild(anchor);
    this.el.appendChild(root);

    // Splash placeholder where it leaves and re-enters the water.
    const splashAt = (evt) => {
      const p = evt.detail && evt.detail.position;
      if (!p) return;
      const world = new THREE.Vector3(p.x, 0, p.z);
      anchor.object3D.localToWorld(world);
      this.spawnSplashPlaceholder(world.x, world.z);
    };
    carrier.addEventListener('shark-breach-exit', splashAt);
    carrier.addEventListener('shark-breach-entry', splashAt);

    // Finale: circle sharks + dancing mascots (placeholders until art lands).
    if (pin.id === 'finale') {
      setTimeout(() => {
        this.plantFinaleCircle(cam);
        this.plantFinaleDancers(cam);
      }, 800);
    }

    carrier.addEventListener('shark-arc-complete', () => {
      if (root.parentNode) root.parentNode.removeChild(root);
      this.jumpBusy = false;
    }, { once: true });

    // Belt and braces: never strand the geofence in a busy state.
    setTimeout(() => {
      if (root.parentNode) root.parentNode.removeChild(root);
      this.jumpBusy = false;
    }, 12000);
  },

  /**
   * Spec: "Maria & sharks swim in a 60 meter circle around the intersection",
   * with sharks spread around the circle by offsetting their frames, and
   * "always have the sharks swimming West toward SAP" — which a circle can only
   * honour on one side, so the phases are chosen to put a shark on the
   * SAP-facing arc when the loop starts.
   *
   * 60 m is read as the circle's width, hence a 30 m radius. Sharks are that
   * far out, so they read small; FINALE_CIRCLE_RADIUS_M is the one number to
   * change if the intent was a 60 m radius or a tighter AR-scaled ring.
   */
  plantFinaleCircle: function (cam) {
    // The geofence can re-fire after its cooldown; one ring is enough.
    document.querySelectorAll('#finale-circle-anchor').forEach((el) => el.remove());
    const finale = this.jumpPins.find((p) => p.id === 'finale');
    let anchor = this.makeGeoRoot('finale-circle-anchor', cam);
    let centerLocal = { x: 0, y: 0, z: -10 };

    if (anchor && finale && this.userLat != null) {
      // Centre the ring on the intersection itself, not on the visitor.
      const off = window.GeoAnchor.localOffset(finale.lat, finale.lng, this.userLat, this.userLng);
      centerLocal = { x: off.x, y: 0, z: off.z };
    } else {
      anchor = this.makeAnchorRoot('finale-circle-anchor', cam);
    }

    const pivot = document.createElement('a-entity');
    pivot.setAttribute('id', 'finale-circle');
    this.place(pivot, 'finale/circle-center', { position: centerLocal });

    // All three swim the circle together as a pod, not spread around it.
    // (The notes' "offset the frames" trick would space them evenly — that's
    // FINALE_CIRCLE_FORMATION = 'spread' if the pod reads wrong on site.)
    const spread = FINALE_CIRCLE_FORMATION === 'spread';
    const sharks = [
      { id: 'maria', model: '#circle-maria', phase: spread ? 0 : 0, lane: 0 },
      { id: 'stella', model: '#circle-stella', phase: spread ? 120 : 7, lane: -2.5 },
      { id: 'jimmy', model: '#circle-jimmy', phase: spread ? 240 : 13, lane: 2.5 }
    ];

    sharks.forEach((s) => {
      const ent = document.createElement('a-entity');
      ent.setAttribute('gltf-model', s.model);
      this.sizeTo(ent, `maxDim: ${SHARK_MAX_DIM_M}; ground: false`);
      ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.0');
      ent.setAttribute('shadow', 'cast: true');
      // Path is evaluated per frame — see shark-motion.js.
      // Staggered lanes and heights so a pod doesn't read as one shark.
      ent.setAttribute('shark-circle-swim', {
        radius: FINALE_CIRCLE_RADIUS_M + s.lane,
        period: FINALE_CIRCLE_PERIOD_MS,
        phaseDeg: s.phase,
        height: 1.4 + s.lane * 0.12
      });
      ent.setAttribute('data-placement-key', `finale/circle-${s.id}`);
      pivot.appendChild(ent);
    });

    anchor.appendChild(pivot);
    this.el.appendChild(anchor);
    setTimeout(() => {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    }, 40000);
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
      this.sizeTo(ent, `height: ${MASCOT_HEIGHT_M}`);
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
    clearInterval(this._geoUpgradeTimer);
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