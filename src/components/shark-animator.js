/**
 * Cycles through animated shark models upon trigger,
 * making them swim in, pause, swim past, and fade out.
 */
AFRAME.registerComponent('shark-animator', {
  schema: {
    models: { type: 'array', default: ['#shaun-shark', '#stella-shark', '#maria-shark'] },
    swimInDur: { type: 'number', default: 4000 },
    pauseDur: { type: 'number', default: 5000 },
    swimPastDur: { type: 'number', default: 4000 },
    startPos: { type: 'vec3', default: {x: -8, y: 0.5, z: -12} }, // Starts far left and back
    pausePos: { type: 'vec3', default: {x: 0, y: 0.5, z: -3} },    // Swims to center stage
    endPos: { type: 'vec3', default: {x: 12, y: 0.5, z: 2} },      // Swims past to the right
    scale: { type: 'vec3', default: {x: 0.8, y: 0.8, z: 0.8} }
  },

  init: function () {
    this.currentIndex = 0;
    this.isRunning = false;
    this.activeEntity = null;

    // Listen for the trigger from shark-detector
    this.el.sceneEl.addEventListener('sharkFound', () => {
      if (!this.isRunning) {
        this.startSequence();
      }
    });

    // Expose a clean manual cycle trigger that also handles UI cleanup
    window.manualSharkSpawn = () => {
       console.log("Manual shark spawn/cycle triggered");
       
       // Ensure the root is visible
       const root = document.getElementById('shark-root');
       if (root) root.setAttribute('visible', 'true');

       if (!this.isRunning) {
           this.startSequence();
       } else {
           this.cycleNext(); // Skip to next immediately
       }

       // Clean up the nav menu UI if it's open, to prevent it from getting stuck
       const navMenu = document.getElementById('nav-menu');
       const navOverlay = document.getElementById('nav-overlay');
       if (navMenu) navMenu.style.right = '-100%';
       if (navOverlay) navOverlay.classList.remove('visible');
    };
  },

  startSequence: function () {
    this.isRunning = true;
    this.cycleNext();
  },

  cycleNext: function () {
    if (!this.isRunning) return;

    if (this.activeEntity) {
      this.el.removeChild(this.activeEntity);
      this.activeEntity = null;
    }

    const modelId = this.data.models[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.data.models.length;

    const ent = document.createElement('a-entity');
    ent.setAttribute('gltf-model', modelId);
    // Play any embedded animations
    ent.setAttribute('animation-mixer', 'loop: repeat; timeScale: 1.0; crossFadeDuration: 0.3;');
    ent.setAttribute('scale', this.data.scale);
    
    // Start facing somewhat diagonally towards the center from the startPos
    ent.setAttribute('rotation', '0 60 0');
    
    // Keep it hidden until the heavy GLB is fully loaded and parsed
    ent.setAttribute('visible', 'false');

    // Enhancements: add some subtle environmental effects
    const shadow = document.createElement('a-cylinder');
    shadow.setAttribute('radius', '1.2');
    shadow.setAttribute('height', '0.01');
    shadow.setAttribute('color', '#004c54');
    shadow.setAttribute('opacity', '0.4');
    shadow.setAttribute('position', '0 -0.8 0');
    ent.appendChild(shadow);

    // Wait for the mesh to actually load before triggering the swim animation
    ent.addEventListener('model-loaded', () => {
      ent.setAttribute('visible', 'true');
      this.runAnimationPhases(ent);
    }, { once: true });

    // Handle potential errors if a model is missing
    ent.addEventListener('model-error', () => {
      console.warn("Failed to load shark model:", modelId);
      // Skip to the next shark if this one is broken
      setTimeout(() => this.cycleNext(), 1000);
    }, { once: true });

    this.el.appendChild(ent);
    this.activeEntity = ent;
  },

  runAnimationPhases: function (ent) {
    const { startPos, pausePos, endPos, swimInDur, pauseDur, swimPastDur } = this.data;

    // 1. Swim In
    ent.setAttribute('position', startPos);
    
    // Swim in position animation
    ent.setAttribute('animation__swimin', {
      property: 'position',
      from: `${startPos.x} ${startPos.y} ${startPos.z}`,
      to: `${pausePos.x} ${pausePos.y} ${pausePos.z}`,
      dur: swimInDur,
      easing: 'easeOutSine'
    });

    // Rotate to face the user once arrived
    ent.setAttribute('animation__rotatein', {
      property: 'rotation',
      to: '0 0 0',
      dur: swimInDur,
      easing: 'easeOutSine'
    });

    setTimeout(() => {
      if (!this.isRunning || this.activeEntity !== ent) return;
      
      // 2. Pause
      // Add a slight bobbing motion during pause to simulate water buoyance
      ent.setAttribute('animation__bob', {
        property: 'position',
        to: `${pausePos.x} ${pausePos.y + 0.3} ${pausePos.z}`,
        dir: 'alternate',
        loop: true,
        dur: 2000,
        easing: 'easeInOutSine'
      });

      // Subtle rotation back and forth
      ent.setAttribute('animation__sway', {
        property: 'rotation',
        to: '0 10 0',
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
        
        // Face the exit point
        ent.setAttribute('animation__rotateout', {
          property: 'rotation',
          to: '0 -75 0', // Face to the right
          dur: 1000,
          easing: 'easeInOutQuad'
        });

        // Swim away
        ent.setAttribute('animation__swimpast', {
          property: 'position',
          to: `${endPos.x} ${endPos.y} ${endPos.z}`,
          dur: swimPastDur,
          easing: 'easeInSine'
        });

        // 4. Fade Out Simulation (Scaling down to zero)
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
          this.cycleNext();
        }, swimPastDur);

      }, pauseDur);

    }, swimInDur);
  }
});
