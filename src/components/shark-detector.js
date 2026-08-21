/**
 * Shark detection: GPS proximity plus camera recognition of Jimmy's painted
 * sharks on the pavement.
 *
 * The vision half matches the live camera frame against pre-computed MobileNet
 * v2 embeddings of the street paintings (data/shark-embeddings-browser.json,
 * 180 crops) by cosine similarity — see src/utils/shark-embedding-detector.js.
 *
 * Two things keep it off the phones we just spent a release rescuing:
 *
 * - The model is loaded lazily, on the first tick that could actually produce a
 *   match. Walking the Little Italy block never pays the ~14 MB MobileNet cost,
 *   because the statues own that stretch and the shark cycle is suppressed there.
 * - Inference runs on an interval, not per frame, and every guard is checked
 *   before the frame is even grabbed. The legacy page inferred in a
 *   requestAnimationFrame loop; that is far too hot next to SLAM.
 *
 * The enrolled embeddings were computed with MobileNet v2 alpha 1.0. Changing
 * the model or alpha changes the feature space and silently invalidates every
 * stored embedding, so loadModel() pins both.
 */
AFRAME.registerComponent('shark-detector', {
  schema: {
    gpsTargetLat: { type: 'number', default: 37.33564048861824 },
    gpsTargetLng: { type: 'number', default: -121.8978303846544 },
    gpsRadius: { type: 'number', default: 250 },
    useGps: { type: 'boolean', default: true },
    // Camera recognition of the painted sharks. ?vision=0 disables at runtime.
    useVision: { type: 'boolean', default: true },
    visionIntervalMs: { type: 'number', default: 600 },
    visionThreshold: { type: 'number', default: 0.55 },
    visionConfidence: { type: 'number', default: 0.4 },
    visionCooldownMs: { type: 'number', default: 3000 },
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

    this.vision = {
      enabled: false,
      status: 'idle',
      model: null,
      embeddings: null,
      video: null,
      canvas: null,
      busy: false,
      loading: false,
      lastScore: 0,
      lastName: null,
      lastConfidence: 0,
      matches: 0
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
      // Prefer realityready — it means the AR camera is actually live. But it
      // can be missed: it has already fired on some iOS/WebView paths by the
      // time this listener attaches, and the desktop sim synthesises it on a
      // timer. Detection must not depend on catching a single event, so run
      // whichever arrives first and only once.
      const startOnce = () => {
        if (this.detectionStarted) return;
        this.detectionStarted = true;
        this.startDetection();
      };
      window.addEventListener('realityready', startOnce, { once: true });
      setTimeout(startOnce, 4000);
  },

  startDetection: function () {
    console.log("GPS Detection Started");
    
    // Hide the custom ML loading screen if it exists
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    
    if (this.data.useGps) {
        this.startGpsWatch();
    }
    if (this.data.useVision) {
        this.startVision();
    }
  },

  // ---- Camera recognition of the painted sharks ---------------------------

  startVision: function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('vision') === '0') {
      this.vision.status = 'off (?vision=0)';
      return;
    }
    if (!window.SharkEmbeddingDetector || !window.tf || !window.mobilenet) {
      this.vision.status = 'unavailable (tf/mobilenet not loaded)';
      console.warn('[shark-detector] vision libraries missing — skipping');
      return;
    }

    this.vision.enabled = true;
    this.vision.status = 'waiting for camera';
    this.vision.canvas = document.createElement('canvas');
    this.vision.canvas.width = 224;
    this.vision.canvas.height = 224;

    // The 8th Wall camera feed is not a plain <video> we can query for; the
    // bridge finds it via the pipeline module or by polling.
    if (window.SharkXR8VideoBridge) {
      window.SharkXR8VideoBridge.whenVideoReady({
        delayMs: 500,
        onVideo: (video) => {
          this.vision.video = video;
          this.vision.status = 'camera ready';
          console.log('[shark-detector] vision has the camera feed');
        }
      });
    } else {
      this.vision.status = 'unavailable (no video bridge)';
      return;
    }

    this.visionTimer = setInterval(() => this.visionTick(), this.data.visionIntervalMs);

    window.SharkVision = {
      status: () => this.vision.status,
      last: () => ({
        name: this.vision.lastName,
        score: +this.vision.lastScore.toFixed(3),
        confidence: +this.vision.lastConfidence.toFixed(2),
        matches: this.vision.matches
      }),
      threshold: () => this.data.visionThreshold
    };
  },

  /** Everything that would make an inference pointless, checked before we pay for one. */
  visionShouldRun: function () {
    if (!this.vision.enabled || !this.vision.video) return false;
    if (document.hidden) return false;
    if (this.state.sharkVisible) return false;
    // Little Italy runs always-on statues instead of the shark cycle.
    if (this.state.inLittleItaly) return false;
    if (window.SharksWayMode && !window.SharksWayMode.isWayfinding()) return false;
    if (performance.now() - this.state.dismissedAt < this.data.visionCooldownMs) return false;
    return true;
  },

  visionTick: function () {
    if (this.vision.busy) return;
    if (!this.visionShouldRun()) return;

    const SED = window.SharkEmbeddingDetector;

    // Lazy load: nothing above needed the model, so nothing loaded it.
    if (!this.vision.model || !this.vision.embeddings) {
      if (this.vision.loading) return;
      this.vision.loading = true;
      this.vision.status = 'loading model';
      SED.loadModel((s) => { this.vision.status = s; })
        .then((model) => {
          this.vision.model = model;
          const state = SED.createEmbeddingState();
          return SED.loadEmbeddings(state, model, {}).then(() => {
            this.vision.embeddings = state;
            this.vision.status = 'watching';
            console.log('[shark-detector] vision ready — watching for painted sharks');
          });
        })
        .catch((err) => {
          this.vision.status = 'load failed';
          console.warn('[shark-detector] vision load failed', err);
        })
        .then(() => { this.vision.loading = false; });
      return;
    }

    this.vision.busy = true;
    SED.getFrameEmbedding(this.vision.model, this.vision.video, this.vision.canvas)
      .then((embedding) => {
        if (!embedding) return;
        const raw = SED.bestMatch(this.vision.embeddings, embedding);
        const smoothed = SED.rollingScore(this.vision.embeddings, raw);
        this.vision.lastName = smoothed.name;
        this.vision.lastScore = smoothed.score || 0;
        this.vision.lastConfidence = smoothed.confidence || 0;

        // Same test the original page used: a confident match, sustained over
        // the rolling window, so one lucky frame of pavement cannot fire it.
        const hit = smoothed.name &&
          smoothed.score >= this.data.visionThreshold &&
          smoothed.confidence >= this.data.visionConfidence;

        if (hit && this.visionShouldRun()) {
          this.vision.matches++;
          this.vision.status = 'match: ' + smoothed.name;
          console.log('[shark-detector] painted shark recognised:', smoothed.name,
            smoothed.score.toFixed(3));
          this.onSharkFound({
            trigger: 'vision',
            name: smoothed.name,
            score: smoothed.score,
            confidence: smoothed.confidence
          });
        } else if (this.vision.status.indexOf('match') !== 0) {
          this.vision.status = 'watching';
        }
      })
      .catch((err) => console.warn('[shark-detector] vision frame failed', err))
      .then(() => { this.vision.busy = false; });
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
    
    console.log('🦈 Shark spawned via ' + ((detail && detail.trigger) || 'manual'));
    
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
    if (this.visionTimer) clearInterval(this.visionTimer);
  }
});