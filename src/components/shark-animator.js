/**
 * Cycles through animated shark models upon trigger,
 * making them swim from behind the camera towards a tapped marker.
 */
AFRAME.registerComponent('shark-animator', {
  schema: {
    models: { type: 'array', default: ['#shaun-shark', '#stella-shark', '#maria-shark'] },
    swimInDur: { type: 'number', default: 4000 },
    pauseDur: { type: 'number', default: 5000 },
    swimPastDur: { type: 'number', default: 4000 },
    scale: { type: 'vec3', default: {x: 0.8, y: 0.8, z: 0.8} }
  },

  init: function () {
    this.currentIndex = 0;
    this.isRunning = false;
    this.activeEntity = null;
    this.targetMarker = null;

    // Create a visual marker for the tap
    this.createMarker();

    // Listen for ground tap
    const ground = document.getElementById('ground');
    if (ground) {
        ground.addEventListener('click', (e) => {
            const pt = e.detail.intersection.point;
            this.spawnAtTarget(pt);
        });
    }

    // Expose a clean manual cycle trigger that also handles UI cleanup
    window.manualSharkSpawn = () => {
       console.log("Manual shark spawn/cycle triggered");
       
       const cam = document.getElementById('camera');
       const camPos = cam.object3D.position;
       const camDir = new THREE.Vector3();
       cam.object3D.getWorldDirection(camDir); // Points backward relative to camera local
       camDir.multiplyScalar(-1); // Fix to forward vector
       
       // Target point is 4 meters directly in front of the camera
       const pt = new THREE.Vector3().copy(camPos).add(camDir.multiplyScalar(4));
       pt.y = 0; // Force to ground level
       
       this.spawnAtTarget(pt);

       // Clean up the nav menu UI if it's open, to prevent it from getting stuck
       const navMenu = document.getElementById('nav-menu');
       const navOverlay = document.getElementById('nav-overlay');
       if (navMenu) navMenu.style.right = '-100%';
       if (navOverlay) navOverlay.classList.remove('visible');
    };

    // Listen for the trigger from shark-detector (GPS)
    this.el.sceneEl.addEventListener('sharkFound', () => {
        // Automatically trigger a spawn in front of the user
        if (!this.isRunning) {
            window.manualSharkSpawn();
        }
    });
  },

  createMarker: function() {
      this.targetMarker = document.createElement('a-entity');
      // A simple glowing ring on the ground
      this.targetMarker.setAttribute('geometry', 'primitive: ring; radiusInner: 0.6; radiusOuter: 0.8;');
      this.targetMarker.setAttribute('material', 'color: #00A9E0; shader: flat; transparent: true; opacity: 0.8;');
      this.targetMarker.setAttribute('rotation', '-90 0 0');
      this.targetMarker.setAttribute('position', '0 -1000 0'); // Hide initially
      
      // Animate the ring to pulse
      this.targetMarker.setAttribute('animation__scale', 'property: scale; to: 1.2 1.2 1.2; dir: alternate; loop: true; dur: 1000');
      this.targetMarker.setAttribute('animation__fade', 'property: material.opacity; to: 0.2; dir: alternate; loop: true; dur: 1000');

      this.el.sceneEl.appendChild(this.targetMarker);
  },

  spawnAtTarget: function (targetPoint) {
      this.isRunning = true;
      const root = document.getElementById('shark-root');
      if (root) root.setAttribute('visible', 'true');

      // Move marker to the target point (slightly above ground to avoid z-fighting)
      this.targetMarker.setAttribute('position', `${targetPoint.x} ${targetPoint.y + 0.05} ${targetPoint.z}`);

      this.cycleNext(targetPoint);
  },

  cycleNext: function (targetPoint) {
    if (!this.isRunning) return;

    if (this.activeEntity) {
      this.el.removeChild(this.activeEntity);
      this.activeEntity = null;
    }

    const modelId = this.data.models[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.data.models.length;

    const ent = document.createElement('a-entity');
    
    // Add event listener BEFORE setting gltf-model to catch cached synchronous loads just in case
    ent.addEventListener('model-loaded', () => {
      ent.setAttribute('visible', 'true');
      this.runAnimationPhases(ent, targetPoint);
    }, { once: true });

    ent.addEventListener('model-error', () => {
      console.warn("Failed to load shark model:", modelId);
      setTimeout(() => this.cycleNext(targetPoint), 1000);
    }, { once: true });

    ent.setAttribute('gltf-model', modelId);
    ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.0; crossFadeDuration: 0.3;');
    ent.setAttribute('scale', this.data.scale);
    ent.setAttribute('visible', 'false');
    ent.setAttribute('shadow', 'cast: true');

    this.el.appendChild(ent);
    this.activeEntity = ent;
  },

  runAnimationPhases: function (ent, targetPoint) {
    const { swimInDur, pauseDur, swimPastDur } = this.data;
    const cam = document.getElementById('camera');
    const camPos = cam.object3D.position;

    // Calculate directions
    const dirToTarget = new THREE.Vector3().subVectors(targetPoint, camPos);
    dirToTarget.y = 0;
    if (dirToTarget.lengthSq() < 0.1) dirToTarget.set(0, 0, -1); // Fallback if exactly on camera
    dirToTarget.normalize();

    // Start point: 3 meters *behind* the camera along the line to the target
    const startPos = new THREE.Vector3().copy(camPos).sub(dirToTarget.clone().multiplyScalar(3));
    startPos.y = 0.5;

    const pausePos = new THREE.Vector3().copy(targetPoint);
    pausePos.y = 0.5;

    // End point: 12 meters *past* the target point
    const endPos = new THREE.Vector3().copy(targetPoint).add(dirToTarget.clone().multiplyScalar(12));
    endPos.y = 0.5;

    // Calculate rotation to face the target
    // Three.js atan2(x, z) gives rotation around Y. A-Frame rotates CCW around Y.
    const yaw = Math.atan2(dirToTarget.x, dirToTarget.z) * (180 / Math.PI);
    const facingYaw = yaw;

    // 1. Swim In
    ent.setAttribute('position', startPos);
    ent.setAttribute('rotation', `0 ${facingYaw} 0`);
    
    ent.setAttribute('animation__swimin', {
      property: 'position',
      from: `${startPos.x} ${startPos.y} ${startPos.z}`,
      to: `${pausePos.x} ${pausePos.y} ${pausePos.z}`,
      dur: swimInDur,
      easing: 'easeOutSine'
    });

    setTimeout(() => {
      if (!this.isRunning || this.activeEntity !== ent) return;
      
      // 2. Pause
      ent.setAttribute('animation__bob', {
        property: 'position',
        to: `${pausePos.x} ${pausePos.y + 0.3} ${pausePos.z}`,
        dir: 'alternate',
        loop: true,
        dur: 2000,
        easing: 'easeInOutSine'
      });

      ent.setAttribute('animation__sway', {
        property: 'rotation',
        to: `0 ${facingYaw + 10} 0`,
        dir: 'alternate',
        loop: true,
        dur: 2500,
        easing: 'easeInOutQuad'
      });

      setTimeout(() => {
        if (!this.isRunning || this.activeEntity !== ent) return;

        // 3. Swim Past
        ent.removeAttribute('animation__bob');
        ent.removeAttribute('animation__sway');
        
        ent.setAttribute('animation__swimpast', {
          property: 'position',
          to: `${endPos.x} ${endPos.y} ${endPos.z}`,
          dur: swimPastDur,
          easing: 'easeInSine'
        });

        ent.setAttribute('animation__fade', {
          property: 'scale',
          to: '0.001 0.001 0.001',
          dur: 1500,
          delay: swimPastDur - 1500,
          easing: 'easeInCubic'
        });

        setTimeout(() => {
          if (!this.isRunning || this.activeEntity !== ent) return;
          // Loop to the next shark
          this.cycleNext(targetPoint);
        }, swimPastDur);

      }, pauseDur);

    }, swimInDur);
  }
});
