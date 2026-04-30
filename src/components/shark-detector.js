/**
 * A-Frame component to handle shark detection using GPS only.
 */
AFRAME.registerComponent('shark-detector', {
  schema: {
    gpsTargetLat: { type: 'number', default: 37.33564048861824 },
    gpsTargetLng: { type: 'number', default: -121.8978303846544 },
    gpsRadius: { type: 'number', default: 250 },
    useGps: { type: 'boolean', default: true }
  },

  init: function () {
    this.state = {
      sharkVisible: false,
      dismissedAt: 0,
      gpsWatchId: null,
      gpsActive: false
    };

    // Expose for debugging/manual trigger
    window.forceSpawnShark = () => {
      console.log("Manual spawn triggered");
      this.onSharkFound();
    };

    // Wait for scene to be ready
    if (this.el.sceneEl.hasLoaded) {
      this.waitForReality();
    } else {
      this.el.sceneEl.addEventListener('loaded', this.waitForReality.bind(this));
    }

    // Listen for UI dismissal to reset cooldown
    this.el.sceneEl.addEventListener('dismissSharkUi', () => {
      this.dismissShark();
    });
  },

  waitForReality: function() {
      // Wait for realityready to ensure AR is fully active
      window.addEventListener('realityready', () => {
          this.startDetection();
      }, {once: true});
  },

  startDetection: function () {
    console.log("GPS Detection Started");
    
    // Hide the custom ML loading screen if it exists
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    
    if (this.data.useGps) {
        this.startGpsWatch();
    }
  },

  startGpsWatch: function () {
    if (!('geolocation' in navigator)) {
        console.warn("Geolocation is not supported by this browser.");
        return;
    }
    
    try {
      if (this.state.gpsWatchId != null) navigator.geolocation.clearWatch(this.state.gpsWatchId);
    } catch (e) { }

    console.log(`Watching GPS for Shark. Target: ${this.data.gpsTargetLat}, ${this.data.gpsTargetLng} (Radius: ${this.data.gpsRadius}m)`);

    this.state.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Fallback in case MathUtils is not loaded
        let d = 999999;
        if (window.MathUtils && window.MathUtils.haversineMeters) {
            d = window.MathUtils.haversineMeters(
              pos.coords.latitude, pos.coords.longitude,
              this.data.gpsTargetLat, this.data.gpsTargetLng
            );
        } else {
             // Basic haversine if MathUtils is missing
             const R = 6371e3;
             const dLat = (this.data.gpsTargetLat - pos.coords.latitude) * Math.PI / 180;
             const dLon = (this.data.gpsTargetLng - pos.coords.longitude) * Math.PI / 180;
             const a = Math.sin(dLat/2)**2 + Math.cos(pos.coords.latitude * Math.PI / 180) * Math.cos(this.data.gpsTargetLat * Math.PI / 180) * Math.sin(dLon/2)**2;
             d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        console.log(`GPS Distance to Shark: ${d.toFixed(2)}m`);
        this.state.gpsActive = d <= this.data.gpsRadius;
        
        const cooldown = performance.now() - this.state.dismissedAt > 3000;
        
        if (this.state.gpsActive && cooldown && !this.state.sharkVisible) {
          this.onSharkFound();
        }
      },
      (err) => { 
          console.warn("GPS Watch Error:", err);
          this.state.gpsActive = false; 
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  },

  onSharkFound: function () {
    if (this.state.sharkVisible) return;
    this.state.sharkVisible = true;
    
    console.log("🦈 Shark Spawned via GPS!");
    
    const root = document.getElementById('shark-root');
    if (root) {
        // Position the shark slightly in front of the user's current view
        root.setAttribute('visible', true);
    }
    
    this.el.sceneEl.emit('sharkFound');
    if (window.AudioUtils) window.AudioUtils.playSound('found');
  },

  dismissShark: function () {
    this.state.sharkVisible = false;
    this.state.dismissedAt = performance.now();
    
    const root = document.getElementById('shark-root');
    if (root) root.setAttribute('visible', false);
  },

  remove: function () {
    if (this.state.gpsWatchId != null) {
      navigator.geolocation.clearWatch(this.state.gpsWatchId);
    }
  }
});