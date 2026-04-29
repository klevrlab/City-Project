/**
 * A-Frame component to handle shark detection using TensorFlow.js and GPS fallback.
 */
AFRAME.registerComponent('shark-detector', {
  schema: {
    embeddingsUrl: { type: 'string', default: './data/shark-embeddings-browser.json' },
    threshold: { type: 'number', default: 0.55 },
    gpsTargetLat: { type: 'number', default: 37.33564048861824 },
    gpsTargetLng: { type: 'number', default: -121.8978303846544 },
    gpsRadius: { type: 'number', default: 250 },
    cacheKey: { type: 'string', default: 'shark-embeddings-v5' },
    imageListUrl: { type: 'string', default: '' },
    useGps: { type: 'boolean', default: false }
  },

  init: function () {
    this.SED = window.SharkEmbeddingDetector;
    this.mlState = {
      model: null,
      running: false,
      frameSkip: 0,
      sharkVisible: false,
      dismissedAt: 0,
      emb: this.SED.createEmbeddingState(),
      feedVideo: null,
      gpsWatchId: null,
      gpsActive: false
    };

    this.loadingEl = document.getElementById('loading');
    this.loadingStatus = document.getElementById('loading-status');
    this.debugCanvas = document.getElementById('debug-canvas');

    // Wait for scene to be ready before starting ML
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
      // With XRExtras, it's safer to wait for realityready to ensure the camera feed is active
      window.addEventListener('realityready', () => {
          this.startDetection();
      }, {once: true});
  },

  startDetection: function () {
    const status = (t) => { if (this.loadingStatus) this.loadingStatus.textContent = t; };
    
    status('Loading AI model…');
    this.SED.loadModel(status).then(model => {
      this.mlState.model = model;
      status('Loading embeddings…');
      return this.SED.loadEmbeddings(this.mlState.emb, model, {
        embeddingsUrl: this.data.embeddingsUrl,
        cacheKey: this.data.cacheKey,
        imageListUrl: this.data.imageListUrl,
        onStatus: status
      });
    }).then(() => {
      window.SharkXR8VideoBridge.whenVideoReady({
        onVideo: (v) => {
          this.mlState.feedVideo = v;
          if (this.loadingEl) this.loadingEl.classList.add('hidden');
          this.mlState.running = true;
          if (this.data.useGps) this.startGpsWatch();
          this.mlLoop();
        },
        delayMs: 400
      });
    }).catch(err => {
      console.error(err);
      status('Could not start detection.');
    });
  },

  startGpsWatch: function () {
    if (!('geolocation' in navigator)) return;
    try {
      if (this.mlState.gpsWatchId != null) navigator.geolocation.clearWatch(this.mlState.gpsWatchId);
    } catch (e) { }

    this.mlState.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = window.MathUtils.haversineMeters(
          pos.coords.latitude, pos.coords.longitude,
          this.data.gpsTargetLat, this.data.gpsTargetLng
        );
        this.mlState.gpsActive = d <= this.data.gpsRadius;
        const cooldown = performance.now() - this.mlState.dismissedAt > 3000;
        if (this.mlState.gpsActive && cooldown && !this.mlState.sharkVisible) {
          this.onSharkFound();
        }
      },
      () => { this.mlState.gpsActive = false; },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  },

  mlLoop: function () {
    if (!this.mlState.running) return;
    
    (async () => {
      try {
        if (this.mlState.model && this.mlState.feedVideo && this.mlState.emb.enrolled.length) {
          this.mlState.frameSkip += 1;
          if (this.mlState.frameSkip % 2 === 0) {
            const embedding = await this.SED.getFrameEmbedding(this.mlState.model, this.mlState.feedVideo, this.debugCanvas);
            if (embedding) {
              const rawMatch = this.SED.bestMatch(this.mlState.emb, embedding);
              const smoothed = this.SED.rollingScore(this.mlState.emb, rawMatch);
              const cooldownOver = performance.now() - this.mlState.dismissedAt > 3000;
              
              const mlMatch = cooldownOver && smoothed.name && smoothed.score >= this.data.threshold && smoothed.confidence >= 0.4;
              const gpsMatch = cooldownOver && this.mlState.gpsActive;
              
              if (mlMatch || gpsMatch) {
                this.onSharkFound();
              }
            }
          }
        }
      } catch (e) { console.error(e); }
      if (this.mlState.running) {
        requestAnimationFrame(this.mlLoop.bind(this));
      }
    })();
  },

  onSharkFound: function () {
    if (this.mlState.sharkVisible) return;
    this.mlState.sharkVisible = true;
    
    const root = document.getElementById('shark-root');
    if (root) root.setAttribute('visible', true);
    
    this.el.sceneEl.emit('sharkFound');
    if (window.AudioUtils) window.AudioUtils.playSound('found');
  },

  dismissShark: function () {
    this.mlState.sharkVisible = false;
    this.mlState.dismissedAt = performance.now();
    this.mlState.emb.recentScores = [];
    
    const root = document.getElementById('shark-root');
    if (root) root.setAttribute('visible', false);
  },

  remove: function () {
    this.mlState.running = false;
    if (this.mlState.gpsWatchId != null) {
      navigator.geolocation.clearWatch(this.mlState.gpsWatchId);
    }
  }
});
