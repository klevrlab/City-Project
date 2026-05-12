/**
 * Cycles through multiple shark "experiences" on each detection.
 */
AFRAME.registerComponent('shark-animator', {
  schema: {
    triggerDelayMs: { type: 'number', default: 1200 },
    minPingCount: { type: 'number', default: 1 },
    scale: { type: 'vec3', default: { x: 0.4, y: 0.4, z: 0.4 } }
  },

  init: function () {
    this.currentIndex = 0;
    this.isRunning = false;
    this.activeEntity = null;
    this.targetMarker = null;
    this.lastTriggerAt = 0;
    this.currentTarget = null;
    this.timers = [];

    // Keep the requested west/east Little Italy coordinates documented for future geo-anchoring.
    this.littleItalyCoords = {
      west: { lat: 37.334778, lng: -121.899222 },
      east: { lat: 37.335444, lng: -121.896778 }
    };

    this.experiences = [
      {
        label: 'Maria Swimmer',
        model: '#maria-swimmer',
        motion: 'enterCenter',
        y: 0.55,
        scale: '0.42 0.42 0.42',
        rotationOffsetY: 0
      },
      {
        label: 'Jimmy Swimmer',
        model: '#jimmy-swimmer',
        motion: 'hoverTrack',
        y: 1.1,
        scale: '0.4 0.4 0.4',
        rotationOffsetY: 0
      },
      {
        label: 'Sharkie Waving',
        model: '#sharkie-wave',
        motion: 'wavePose',
        y: 0.45,
        scale: '0.55 0.55 0.55',
        rotationOffsetY: 0
      },
      {
        label: 'Diving Shark',
        model: '#diving-shark',
        motion: 'diveArc',
        y: 0.65,
        scale: '0.42 0.42 0.42',
        rotationOffsetY: 0
      },
      {
        label: 'Stella Swimmer',
        model: '#stella-swimmer',
        motion: 'enterCenter',
        y: 0.55,
        scale: '0.4 0.4 0.4',
        rotationOffsetY: 0
      },
      {
        label: 'Little Italy Patrol',
        model: '#little-italy-shark',
        motion: 'patrolLoop',
        y: 0.65,
        scale: '0.34 0.34 0.34',
        rotationOffsetY: 0
      }
    ];

    this.createMarker();

    const ground = document.getElementById('ground');
    if (ground) {
      ground.addEventListener('click', (e) => {
        const pt = e.detail.intersection.point;
        this.spawnAtTarget(pt);
      });
    }

    window.addEventListener('realityready', () => {
      const instruction = document.getElementById('tap-instruction');
      if (instruction && !this.isRunning) instruction.classList.add('visible');
    });

    window.manualSharkSpawn = () => {
      const pt = this.getForwardTarget(4);
      this.spawnAtTarget(pt);
      this.closeNavIfOpen();
    };

    this.el.sceneEl.addEventListener('sharkFound', (e) => {
      const detail = (e && e.detail) || {};
      const now = performance.now();
      const pingCount = Number(detail.pingCount || 0);
      const delayReady = now - this.lastTriggerAt >= this.data.triggerDelayMs;
      const pingReady = pingCount === 0 || pingCount >= this.data.minPingCount;

      // Little Italy always-on bypasses the delay/ping gate so the cycle reseats
      // immediately when the user enters the zone.
      const isAlwaysOn = Boolean(detail.alwaysOn);
      this.alwaysOn = isAlwaysOn;

      if (!isAlwaysOn && (!delayReady || !pingReady)) return;
      this.lastTriggerAt = now;
      this.spawnAtTarget(this.getForwardTarget(4.2));
    });

    this.el.sceneEl.addEventListener('sharkAlwaysOnExit', () => {
      this.alwaysOn = false;
    });

    this.el.sceneEl.addEventListener('dismissSharkUi', () => {
      if (this.alwaysOn) return; // never dismiss while in Little Italy
      this.stopCycle();
    });
  },

  closeNavIfOpen: function () {
    const navMenu = document.getElementById('nav-menu');
    const navOverlay = document.getElementById('nav-overlay');
    if (navMenu) {
      navMenu.style.right = '-100%';
      navMenu.classList.remove('open');
    }
    if (navOverlay) navOverlay.classList.remove('visible');
  },

  getForwardTarget: function (distanceMeters) {
    const cam = document.getElementById('camera');
    const camPos = cam.object3D.position.clone();
    const camDir = new THREE.Vector3();
    cam.object3D.getWorldDirection(camDir);
    camDir.multiplyScalar(-1);
    const pt = camPos.add(camDir.multiplyScalar(distanceMeters));
    pt.y = 0;
    return pt;
  },

  createMarker: function () {
    this.targetMarker = document.createElement('a-entity');
    this.targetMarker.setAttribute('geometry', 'primitive: ring; radiusInner: 0.6; radiusOuter: 0.8;');
    this.targetMarker.setAttribute('material', 'color: #00A9E0; shader: flat; transparent: true; opacity: 0.8;');
    this.targetMarker.setAttribute('rotation', '-90 0 0');
    this.targetMarker.setAttribute('position', '0 -1000 0');
    this.targetMarker.setAttribute('animation__scale', 'property: scale; to: 1.2 1.2 1.2; dir: alternate; loop: true; dur: 1000');
    this.targetMarker.setAttribute('animation__fade', 'property: material.opacity; to: 0.2; dir: alternate; loop: true; dur: 1000');
    this.el.sceneEl.appendChild(this.targetMarker);
  },

  clearTimers: function () {
    this.timers.forEach((timerId) => clearTimeout(timerId));
    this.timers = [];
  },

  queue: function (fn, ms) {
    const timerId = setTimeout(fn, ms);
    this.timers.push(timerId);
    return timerId;
  },

  stopCycle: function () {
    this.isRunning = false;
    this.clearTimers();
    if (this.activeEntity && this.activeEntity.parentNode === this.el) {
      this.el.removeChild(this.activeEntity);
    }
    this.activeEntity = null;
    if (this.targetMarker) this.targetMarker.setAttribute('position', '0 -1000 0');
  },

  spawnAtTarget: function (targetPoint) {
    if (!targetPoint) return;
    this.currentTarget = targetPoint.clone ? targetPoint.clone() : new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z);
    this.isRunning = true;

    const root = document.getElementById('shark-root');
    if (root) root.setAttribute('visible', 'true');

    const instruction = document.getElementById('tap-instruction');
    if (instruction) instruction.classList.remove('visible');

    if (this.targetMarker) {
      this.targetMarker.setAttribute('position', `${this.currentTarget.x} ${this.currentTarget.y + 0.05} ${this.currentTarget.z}`);
    }

    this.cycleNext(this.currentTarget);
  },

  cycleNext: function (targetPoint) {
    if (!this.isRunning) return;
    this.clearTimers();

    if (this.activeEntity && this.activeEntity.parentNode === this.el) {
      this.el.removeChild(this.activeEntity);
      this.activeEntity = null;
    }

    const experience = this.experiences[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.experiences.length;

    const ent = document.createElement('a-entity');
    ent.addEventListener('model-loaded', () => {
      ent.setAttribute('visible', 'true');
      this.runAnimationPhases(ent, targetPoint, experience);
    }, { once: true });

    ent.addEventListener('model-error', () => {
      console.warn('Failed to load shark experience model:', experience.model);
      this.queue(() => this.cycleNext(targetPoint), 500);
    }, { once: true });

    ent.setAttribute('gltf-model', experience.model);
    ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.0; crossFadeDuration: 0.35;');
    ent.setAttribute('scale', experience.scale || `${this.data.scale.x} ${this.data.scale.y} ${this.data.scale.z}`);
    ent.setAttribute('visible', 'false');
    ent.setAttribute('shadow', 'cast: true');
    ent.setAttribute('data-experience', experience.label);

    this.el.appendChild(ent);
    this.activeEntity = ent;
  },

  runAnimationPhases: function (ent, targetPoint, experience) {
    const cam = document.getElementById('camera');
    const camPos = cam.object3D.position.clone();
    const dirToTarget = new THREE.Vector3().subVectors(targetPoint, camPos);
    dirToTarget.y = 0;
    if (dirToTarget.lengthSq() < 0.1) dirToTarget.set(0, 0, -1);
    dirToTarget.normalize();
    const baseYaw = Math.atan2(dirToTarget.x, dirToTarget.z) * (180 / Math.PI);
    const facingYaw = baseYaw + (experience.rotationOffsetY || 0);
    const y = Number(experience.y || 0.5);

    if (experience.motion === 'hoverTrack') {
      const hoverPos = new THREE.Vector3(targetPoint.x, y + 0.45, targetPoint.z);
      ent.setAttribute('position', `${hoverPos.x} ${hoverPos.y} ${hoverPos.z}`);
      ent.setAttribute('rotation', `0 ${facingYaw} 0`);
      ent.setAttribute('animation__hover', {
        property: 'position',
        from: `${hoverPos.x} ${(hoverPos.y - 0.16).toFixed(3)} ${hoverPos.z}`,
        to: `${hoverPos.x} ${(hoverPos.y + 0.16).toFixed(3)} ${hoverPos.z}`,
        dir: 'alternate',
        loop: true,
        dur: 950,
        easing: 'easeInOutSine'
      });
      this.queue(() => this.cycleNext(targetPoint), 4200);
      return;
    }

    if (experience.motion === 'wavePose') {
      const posePos = new THREE.Vector3(targetPoint.x, y, targetPoint.z - 0.35);
      ent.setAttribute('position', `${posePos.x} ${posePos.y} ${posePos.z}`);
      ent.setAttribute('rotation', `0 ${facingYaw} 0`);
      ent.setAttribute('animation__poseSway', {
        property: 'rotation',
        from: `0 ${(facingYaw - 10).toFixed(3)} 0`,
        to: `0 ${(facingYaw + 10).toFixed(3)} 0`,
        dir: 'alternate',
        loop: true,
        dur: 1400,
        easing: 'easeInOutSine'
      });
      this.queue(() => this.cycleNext(targetPoint), 3600);
      return;
    }

    if (experience.motion === 'diveArc') {
      const start = new THREE.Vector3(targetPoint.x, y + 2.4, targetPoint.z + 5.4);
      const mid = new THREE.Vector3(targetPoint.x, y + 0.2, targetPoint.z + 0.3);
      const end = new THREE.Vector3(targetPoint.x, y - 0.2, targetPoint.z - 8.0);
      ent.setAttribute('position', `${start.x} ${start.y} ${start.z}`);
      ent.setAttribute('rotation', `0 ${facingYaw} -8`);
      ent.setAttribute('animation__diveIn', {
        property: 'position',
        from: `${start.x} ${start.y} ${start.z}`,
        to: `${mid.x} ${mid.y} ${mid.z}`,
        dur: 1400,
        easing: 'easeInQuad'
      });
      this.queue(() => {
        if (!this.isRunning || this.activeEntity !== ent) return;
        ent.setAttribute('animation__diveOut', {
          property: 'position',
          from: `${mid.x} ${mid.y} ${mid.z}`,
          to: `${end.x} ${end.y} ${end.z}`,
          dur: 1900,
          easing: 'easeOutSine'
        });
      }, 1400);
      this.queue(() => this.cycleNext(targetPoint), 3500);
      return;
    }

    if (experience.motion === 'patrolLoop') {
      const westPos = new THREE.Vector3(targetPoint.x - 2.3, y, targetPoint.z - 2.0);
      const eastPos = new THREE.Vector3(targetPoint.x + 2.3, y, targetPoint.z - 2.0);
      ent.setAttribute('position', `${westPos.x} ${westPos.y} ${westPos.z}`);
      ent.setAttribute('rotation', `0 ${facingYaw} 0`);
      ent.setAttribute('animation__patrol', {
        property: 'position',
        from: `${westPos.x} ${westPos.y} ${westPos.z}`,
        to: `${eastPos.x} ${eastPos.y} ${eastPos.z}`,
        dir: 'alternate',
        loop: true,
        dur: 2600,
        easing: 'easeInOutSine'
      });
      this.queue(() => this.cycleNext(targetPoint), 5200);
      return;
    }

    // Default motion: enter center, hover, swim through.
    const startPos = new THREE.Vector3().copy(camPos).sub(dirToTarget.clone().multiplyScalar(3.4));
    startPos.y = y;
    const centerPos = new THREE.Vector3(targetPoint.x, y, targetPoint.z);
    const endPos = new THREE.Vector3().copy(targetPoint).add(dirToTarget.clone().multiplyScalar(10.5));
    endPos.y = y;

    ent.setAttribute('position', `${startPos.x} ${startPos.y} ${startPos.z}`);
    ent.setAttribute('rotation', `0 ${facingYaw} 0`);
    ent.setAttribute('animation__swimIn', {
      property: 'position',
      from: `${startPos.x} ${startPos.y} ${startPos.z}`,
      to: `${centerPos.x} ${centerPos.y} ${centerPos.z}`,
      dur: 2000,
      easing: 'easeOutSine'
    });

    this.queue(() => {
      if (!this.isRunning || this.activeEntity !== ent) return;
      ent.setAttribute('animation__hover', {
        property: 'position',
        from: `${centerPos.x} ${(centerPos.y - 0.12).toFixed(3)} ${centerPos.z}`,
        to: `${centerPos.x} ${(centerPos.y + 0.12).toFixed(3)} ${centerPos.z}`,
        dir: 'alternate',
        loop: true,
        dur: 900,
        easing: 'easeInOutSine'
      });
    }, 2000);

    this.queue(() => {
      if (!this.isRunning || this.activeEntity !== ent) return;
      ent.removeAttribute('animation__hover');
      ent.setAttribute('animation__swimOut', {
        property: 'position',
        from: `${centerPos.x} ${centerPos.y} ${centerPos.z}`,
        to: `${endPos.x} ${endPos.y} ${endPos.z}`,
        dur: 1900,
        easing: 'easeInSine'
      });
    }, 3900);

    this.queue(() => this.cycleNext(targetPoint), 6000);
  }
});
