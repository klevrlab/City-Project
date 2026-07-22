/**
 * June 10 redline — location-based placeholders for Sharks Way Phase II.
 *
 * - Little Italy: always-on Athena statues (left/right) at the 8 street pins.
 *   Odd pins use Augustus_of_Prima_Porta.glb (CC-BY Sketchfab / Arqueomodel3D).
 * - Leaning Tower: 8 m placeholder near western corner (until tower GLB).
 * - Jump zones: underpass / river / grand finale fire a one-shot dive with
 *   maria-shark-jump-jimmy-txtr.glb (splash TBD — Rhonda).
 *
 * Statues are planted in world space relative to the camera when the user
 * enters each geofence (SLAM keeps them anchored). Absolute GPS→ENU without a
 * compass lock is unreliable in browser XR, so entry-time local layout is the
 * intentional placeholder strategy.
 */
AFRAME.registerComponent('location-experiences', {
  schema: {
    statueRadiusM: { type: 'number', default: 55 },
    towerRadiusM: { type: 'number', default: 35 },
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

    if (this.el.sceneEl.hasLoaded) this.start();
    else this.el.sceneEl.addEventListener('loaded', () => this.start(), { once: true });
  },

  start: function () {
    window.addEventListener('realityready', () => this.startGps(), { once: true });
    // Dev helper — plant Little Italy layout in front of the camera without GPS.
    window.forceLittleItalyStatues = () => this.plantStatuesAroundCamera();
    window.forceLeaningTower = () => this.plantTowerInFront();
    window.forceJumpDemo = (id) => this.playJump(id || 'underpass');
  },

  startGps: function () {
    if (!('geolocation' in navigator) || this.watchId != null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onGps(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn('[location-experiences] GPS', err),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 }
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
    const pad = 0.0006;
    const minLat = Math.min(this.liWest.lat, this.liEast.lat) - pad;
    const maxLat = Math.max(this.liWest.lat, this.liEast.lat) + pad;
    const minLng = Math.min(this.liWest.lng, this.liEast.lng) - pad;
    const maxLng = Math.max(this.liWest.lng, this.liEast.lng) + pad;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  },

  onGps: function (lat, lng) {
    this.userLat = lat;
    this.userLng = lng;

    const inLI = this.isInLittleItaly(lat, lng);
    if (inLI && !this.inLittleItaly) {
      this.inLittleItaly = true;
      console.log('[location-experiences] Entered Little Italy — planting marble statues');
      this.plantStatuesAroundCamera();
      this.setHint('Little Italy — marble statues pointing toward SAP');
      this.el.sceneEl.emit('littleItalyEnter');
    } else if (!inLI && this.inLittleItaly) {
      this.inLittleItaly = false;
      this.clearStatues();
      this.el.sceneEl.emit('littleItalyExit');
    }

    // Tower (western corner) — independent of Little Italy enter/exit.
    const towerDist = this.haversineM(lat, lng, this.towerPin.lat, this.towerPin.lng);
    if (towerDist <= this.data.towerRadiusM) {
      if (!this.towerEl) {
        this.plantTowerInFront();
        this.setHint('Leaning Tower placeholder (8 m) — walk around it');
      }
    } else if (this.towerEl && towerDist > this.data.towerRadiusM + 15) {
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

  plantStatuesAroundCamera: function () {
    this.clearStatues();
    const cam = document.getElementById('camera');
    if (!cam) return;

    const root = document.createElement('a-entity');
    root.setAttribute('id', 'little-italy-statues');
    this.el.appendChild(root);
    this.statueRoot = root;

    // Two rows parallel to "street" (camera forward = toward SAP / west-ish).
    // North side = +X local, South side = −X local; spaced along Z.
    const camObj = cam.object3D;
    const forward = new THREE.Vector3();
    camObj.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const origin = camObj.position.clone().add(forward.clone().multiplyScalar(6));

    const northPins = this.statuePins.filter((p) => p.side === 'north');
    const southPins = this.statuePins.filter((p) => p.side === 'south');
    const spacing = 4.5;
    const lateral = 3.2;

    northPins.forEach((pin, i) => {
      const along = (i - (northPins.length - 1) / 2) * spacing;
      const pos = origin.clone()
        .add(forward.clone().multiplyScalar(along))
        .add(right.clone().multiplyScalar(lateral));
      this.spawnStatue(root, pin, pos, /*yawTowardStreet*/ 180);
    });
    southPins.forEach((pin, i) => {
      const along = (i - (southPins.length - 1) / 2) * spacing;
      const pos = origin.clone()
        .add(forward.clone().multiplyScalar(along))
        .add(right.clone().multiplyScalar(-lateral));
      this.spawnStatue(root, pin, pos, /*yawTowardStreet*/ 0);
    });
  },

  spawnStatue: function (root, pin, worldPos, yawOffset) {
    const ent = document.createElement('a-entity');
    ent.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
    ent.setAttribute('shadow', 'cast: true');
    ent.setAttribute('data-statue-pin', String(pin.id));

    // Face across the street (pointing roughly west / toward SAP per redline).
    const cam = document.getElementById('camera');
    let yaw = yawOffset;
    if (cam) {
      const dir = new THREE.Vector3().subVectors(cam.object3D.position, worldPos);
      dir.y = 0;
      if (dir.lengthSq() > 0.01) yaw = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    }
    ent.setAttribute('rotation', `0 ${yaw} 0`);

    if (pin.odd) {
      // Spec: odd pins = Augustus of Prima Porta.
      ent.setAttribute('gltf-model', '#augustus-statue');
      ent.setAttribute('scale', '1.0 1.0 1.0');
    } else {
      const model = pin.side === 'north'
        ? '#athena-point-right'
        : '#athena-point-left';
      ent.setAttribute('gltf-model', model);
      ent.setAttribute('scale', '1.1 1.1 1.1');
    }

    root.appendChild(ent);
  },

  clearStatues: function () {
    if (this.statueRoot && this.statueRoot.parentNode) {
      this.statueRoot.parentNode.removeChild(this.statueRoot);
    }
    this.statueRoot = null;
  },

  // ---- Leaning Tower placeholder -------------------------------------------

  plantTowerInFront: function () {
    this.clearTower();
    const cam = document.getElementById('camera');
    if (!cam) return;

    const forward = new THREE.Vector3();
    cam.object3D.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    const pos = cam.object3D.position.clone().add(forward.multiplyScalar(10));
    pos.y = 0;

    const h = this.towerPin.heightM;
    const tower = document.createElement('a-entity');
    tower.setAttribute('id', 'leaning-tower-placeholder');
    tower.setAttribute('position', `${pos.x} 0 ${pos.z}`);
    // ~4° lean like Pisa
    tower.setAttribute('rotation', '0 0 4');

    const shaft = document.createElement('a-cylinder');
    shaft.setAttribute('radius', 1.1);
    shaft.setAttribute('height', h);
    shaft.setAttribute('position', `0 ${h / 2} 0`);
    shaft.setAttribute('material', 'color: #cfc6b8; roughness: 0.9; metalness: 0.05');
    shaft.setAttribute('shadow', 'cast: true');
    tower.appendChild(shaft);

    const bands = [0.2, 0.4, 0.6, 0.8].map((t) => {
      const ring = document.createElement('a-torus');
      ring.setAttribute('radius', 1.15);
      ring.setAttribute('radius-tubular', 0.06);
      ring.setAttribute('rotation', '90 0 0');
      ring.setAttribute('position', `0 ${h * t} 0`);
      ring.setAttribute('material', 'color: #b7aea0; roughness: 0.85');
      return ring;
    });
    bands.forEach((b) => tower.appendChild(b));

    const label = document.createElement('a-text');
    label.setAttribute('value', 'Leaning Tower\n(placeholder 8m)');
    label.setAttribute('align', 'center');
    label.setAttribute('width', 8);
    label.setAttribute('color', '#111');
    label.setAttribute('position', `0 ${h + 0.6} 0`);
    tower.appendChild(label);

    this.el.appendChild(tower);
    this.towerEl = tower;
  },

  clearTower: function () {
    if (this.towerEl && this.towerEl.parentNode) {
      this.towerEl.parentNode.removeChild(this.towerEl);
    }
    this.towerEl = null;
  },

  // ---- Jump sequences (placeholder splash) ---------------------------------

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

    const forward = new THREE.Vector3();
    cam.object3D.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

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
    ent.setAttribute('scale', '0.38 0.38 0.38');
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

    // Jump arc peak
    setTimeout(() => {
      if (!ent.parentNode) return;
      ent.setAttribute('animation__jump', {
        property: 'position',
        to: `${mid.x} ${mid.y} ${mid.z}`,
        dur: 700,
        easing: 'easeOutQuad'
      });
      // Placeholder splash disc
      const splash = document.createElement('a-cylinder');
      splash.setAttribute('radius', 0.01);
      splash.setAttribute('height', 0.05);
      splash.setAttribute('position', `${mid.x} 0.05 ${mid.z}`);
      splash.setAttribute('material', 'color: #7ec8e3; opacity: 0.55; transparent: true');
      this.el.appendChild(splash);
      splash.setAttribute('animation__grow', {
        property: 'scale',
        from: '1 1 1',
        to: '40 1 40',
        dur: 900,
        easing: 'easeOutQuad'
      });
      splash.setAttribute('animation__fade', {
        property: 'material.opacity',
        to: 0,
        dur: 900
      });
      setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 1000);
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

    // Finale: also drop placeholder dancing mascots at SW corner relative layout.
    if (pin.id === 'finale') {
      setTimeout(() => this.plantFinaleDancers(cam), 1200);
    }

    setTimeout(() => {
      if (ent.parentNode) ent.parentNode.removeChild(ent);
      this.jumpBusy = false;
    }, 4800);
  },

  plantFinaleDancers: function (cam) {
    const forward = new THREE.Vector3();
    cam.object3D.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const base = cam.object3D.position.clone().add(forward.clone().multiplyScalar(4));

    const dancers = [
      { model: '#photo-sharkie', offset: -0.8 },
      { model: '#photo-sammy', offset: 0.8 }
    ];

    dancers.forEach((d) => {
      const pos = base.clone().add(right.clone().multiplyScalar(d.offset));
      const ent = document.createElement('a-entity');
      ent.setAttribute('gltf-model', d.model);
      ent.setAttribute('scale', '0.35 0.35 0.35');
      ent.setAttribute('position', `${pos.x} 0.02 ${pos.z}`);
      ent.setAttribute('animation__spin', {
        property: 'rotation',
        to: '0 360 0',
        loop: true,
        dur: 4000,
        easing: 'linear'
      });
      this.el.appendChild(ent);
      setTimeout(() => {
        if (ent.parentNode) ent.parentNode.removeChild(ent);
      }, 12000);
    });
  },

  remove: function () {
    if (this.watchId != null) {
      try { navigator.geolocation.clearWatch(this.watchId); } catch (e) { /* ignore */ }
    }
    this.clearStatues();
    this.clearTower();
  }
});
