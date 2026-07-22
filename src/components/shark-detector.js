/**
 * A-Frame component to handle shark detection using GPS only.
 */
AFRAME.registerComponent('shark-detector', {
  schema: {
    gpsTargetLat: { type: 'number', default: 37.33564048861824 },
    gpsTargetLng: { type: 'number', default: -121.8978303846544 },
    gpsRadius: { type: 'number', default: 250 },
    useGps: { type: 'boolean', default: true },
    // Little Italy "always-on" bounding box (West / East corners from the task spec).
    littleItalyWestLat: { type: 'number', default: 37.334778 },
    littleItalyWestLng: { type: 'number', default: -121.899222 },
    littleItalyEastLat: { type: 'number', default: 37.335444 },
    littleItalyEastLng: { type: 'number', default: -121.896778 },
    littleItalyPaddingDeg: { type: 'number', default: 0.0006 }
  },

  init: function () {
    this.state = {
      sharkVisible: false,
      dismissedAt: 0,
      gpsWatchId: null,
      gpsActive: false,
      gpsPingCount: 0,
      alwaysOn: false,
      inLittleItaly: false
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
        this.state.gpsPingCount += 1;
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

        const inLittleItaly = this.isInLittleItaly(pos.coords.latitude, pos.coords.longitude);
        const enteredLittleItaly = inLittleItaly && !this.state.inLittleItaly;
        const leftLittleItaly = !inLittleItaly && this.state.inLittleItaly;
        this.state.inLittleItaly = inLittleItaly;
        // June 10 redline: Little Italy uses always-on marble statues (handled by
        // location-experiences) — no wayfinding shark cycle in this corridor.
        this.state.alwaysOn = false;

        if (leftLittleItaly) {
          console.log("Left Little Italy zone");
          this.el.sceneEl.emit('sharkAlwaysOnExit');
        }

        const cooldown = performance.now() - this.state.dismissedAt > 3000;

        if (enteredLittleItaly) {
          console.log("Entered Little Italy — statues take over (no shark cycle)");
          this.state.sharkVisible = false;
          this.el.sceneEl.emit('dismissSharkUi');
          this.el.sceneEl.emit('littleItalyEnter', {
            position: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          });
        } else if (!inLittleItaly && this.state.gpsActive && cooldown && !this.state.sharkVisible) {
          this.onSharkFound({
            trigger: 'gps',
            alwaysOn: false,
            pingCount: this.state.gpsPingCount,
            distanceMeters: d
          });
        }
      },
      (err) => { 
          console.warn("GPS Watch Error:", err);
          this.state.gpsActive = false; 
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  },

  onSharkFound: function (detail) {
    if (this.state.sharkVisible) return;
    this.state.sharkVisible = true;
    
    console.log("🦈 Shark Spawned via GPS!");
    
    const root = document.getElementById('shark-root');
    if (root) {
        // Position the shark slightly in front of the user's current view
        root.setAttribute('visible', true);
    }
    
    this.el.sceneEl.emit('sharkFound', detail || { trigger: 'manual', pingCount: this.state.gpsPingCount });
    if (window.AudioUtils) window.AudioUtils.playSound('found');
  },

  dismissShark: function () {
    // While in Little Italy we ignore dismiss requests so the rotation stays "always on".
    if (this.state.alwaysOn) {
      console.log("Dismiss ignored — Little Italy always-on rotation active");
      return;
    }
    this.state.sharkVisible = false;
    this.state.dismissedAt = performance.now();

    const root = document.getElementById('shark-root');
    if (root) root.setAttribute('visible', false);
  },

  // Little Italy always-on zone test — uses a padded bounding box around the
  // configured West / East coordinates so users near the edges still trigger it.
  isInLittleItaly: function (lat, lng) {
    const pad = this.data.littleItalyPaddingDeg;
    const minLat = Math.min(this.data.littleItalyWestLat, this.data.littleItalyEastLat) - pad;
    const maxLat = Math.max(this.data.littleItalyWestLat, this.data.littleItalyEastLat) + pad;
    const minLng = Math.min(this.data.littleItalyWestLng, this.data.littleItalyEastLng) - pad;
    const maxLng = Math.max(this.data.littleItalyWestLng, this.data.littleItalyEastLng) + pad;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  },

  remove: function () {
    if (this.state.gpsWatchId != null) {
      navigator.geolocation.clearWatch(this.state.gpsWatchId);
    }
  }
});