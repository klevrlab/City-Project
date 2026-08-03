/**
 * June 10 redline — Sharks Way mode switcher.
 * Wayfinding (default) | Photo Mode | Goalie Mode
 *
 * Photo Mode (real, in-page):
 *  - Place: back-camera XR, tap ground to place Sharkie/Sammy, Snap captures AR frame
 *  - Selfie: Flip Camera → front cam + MediaPipe shoulder mount (no page navigate)
 * Goalie Mode: soccer-game with hard-coded puck (Sharkie in goal).
 */
import '../css/sharks-way-modes.css';

const MODE = {
  WAYFINDING: 'wayfinding',
  PHOTO: 'photo',
  GOALIE: 'goalie'
};

const CHAR = {
  SHARKIE: 'sharkie',
  SAMMY: 'sammy'
};

const CHAR_MODEL = {
  [CHAR.SHARKIE]: '#photo-sharkie',
  [CHAR.SAMMY]: '#photo-sammy'
};

const CHAR_SELFIE_SRC = {
  [CHAR.SHARKIE]: './assets/3D-models/sharkie_final_pose.glb',
  [CHAR.SAMMY]: './assets/3D-models/sammy_final_pose.glb'
};

const state = {
  mode: MODE.WAYFINDING,
  photoCharacter: CHAR.SHARKIE,
  photoEntity: null,
  photoSubmode: 'place', // 'place' | 'selfie'
  soccerArmed: false,
  selfie: {
    stream: null,
    pose: null,
    camera: null,
    lastPos: null,
    size: 250,
    yNudge: -70,
    xNudge: 50,
    scriptsReady: false,
    scriptsLoading: null
  }
};

function closeNav() {
  const navMenu = document.getElementById('nav-menu');
  const navOverlay = document.getElementById('nav-overlay');
  if (navMenu) navMenu.classList.remove('open');
  if (navOverlay) navOverlay.classList.remove('visible');
}

function setInstruction(text, visible = true) {
  const el = document.getElementById('tap-instruction');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('visible', visible);
}

function flashToast(text, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashToast._t);
  flashToast._t = setTimeout(() => el.classList.remove('show'), ms);
}

function setWayfindingUi(on) {
  const spawn = document.getElementById('spawn-btn');
  if (spawn) spawn.style.display = on ? '' : 'none';
  const sharkRoot = document.getElementById('shark-root');
  if (sharkRoot && !on) {
    const animator = sharkRoot.components && sharkRoot.components['shark-animator'];
    if (animator && typeof animator.stopCycle === 'function') animator.stopCycle();
    sharkRoot.setAttribute('visible', 'false');
  }
}

function clearPhotoMascot() {
  if (state.photoEntity && state.photoEntity.parentNode) {
    state.photoEntity.parentNode.removeChild(state.photoEntity);
  }
  state.photoEntity = null;
}

function placePhotoMascot(point) {
  const root = document.getElementById('photo-root');
  if (!root || !point) return;

  clearPhotoMascot();

  let facingYaw = 0;
  const cam = document.getElementById('camera');
  if (cam) {
    const dir = new THREE.Vector3().subVectors(point, cam.object3D.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.01) facingYaw = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
  }

  const model = CHAR_MODEL[state.photoCharacter] || CHAR_MODEL[CHAR.SHARKIE];
  const ent = document.createElement('a-entity');
  ent.setAttribute('gltf-model', model);
  ent.setAttribute('position', `${point.x} ${point.y + 0.02} ${point.z}`);
  ent.setAttribute('rotation', `0 ${facingYaw} 0`);
  // Sharkie is 1.95 m in its GLB and Sammy 2.96 m, and both float above their
  // origin — normalize to a common person height so photos frame consistently.
  ent.setAttribute('model-normalize', 'height: 1.9');
  ent.setAttribute('shadow', 'cast: true');
  root.appendChild(ent);
  state.photoEntity = ent;

  setInstruction('Tap again to move · Snap to save · Flip for selfie', true);
  setTimeout(() => {
    const el = document.getElementById('tap-instruction');
    if (el) el.classList.remove('visible');
  }, 2800);
}

function syncPhotoCharacterButtons() {
  document.querySelectorAll('[data-photo-char]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-photo-char') === state.photoCharacter);
  });
}

function syncPhotoSubmodeUi() {
  const flip = document.getElementById('photo-flip-btn');
  if (flip) {
    flip.textContent = state.photoSubmode === 'selfie' ? 'Back Camera' : 'Flip Camera';
  }
  const layer = document.getElementById('sw-selfie-layer');
  if (layer) layer.classList.toggle('visible', state.photoSubmode === 'selfie');

  const root = document.getElementById('photo-root');
  if (root) {
    root.setAttribute('visible',
      state.mode === MODE.PHOTO && state.photoSubmode === 'place' ? 'true' : 'false');
  }
}

function setPhotoUi(on) {
  const bar = document.getElementById('photo-mode-bar');
  if (bar) bar.classList.toggle('visible', on);
  if (!on) {
    if (state.photoSubmode === 'selfie') stopSelfieMode();
    state.photoSubmode = 'place';
    clearPhotoMascot();
  }
  const root = document.getElementById('photo-root');
  if (root) root.setAttribute('visible', on && state.photoSubmode === 'place' ? 'true' : 'false');
  syncPhotoCharacterButtons();
  syncPhotoSubmodeUi();
}

function disarmSoccer() {
  const soccerRoot = document.getElementById('soccer-root');
  if (soccerRoot && soccerRoot.components && soccerRoot.components['soccer-game']) {
    const game = soccerRoot.components['soccer-game'];
    if (typeof game.resetField === 'function') game.resetField();
  }
  state.soccerArmed = false;

  ['timer', 'score', 'reset-btn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const toast = document.getElementById('toast');
  if (toast) toast.classList.remove('show');
}

function armSoccer() {
  const soccerRoot = document.getElementById('soccer-root');
  if (!soccerRoot) return;
  if (!soccerRoot.components || !soccerRoot.components['soccer-game']) {
    soccerRoot.setAttribute('soccer-game', '');
  } else if (typeof soccerRoot.components['soccer-game'].resetField === 'function') {
    soccerRoot.components['soccer-game'].resetField();
  }
  state.soccerArmed = true;

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.style.display = '';
}

function setGoalieUi(on) {
  if (on) armSoccer();
  else disarmSoccer();
}

function pauseXr() {
  try {
    if (window.XR8 && typeof window.XR8.pause === 'function') window.XR8.pause();
  } catch (e) { /* ignore */ }
  const scene = document.getElementById('xrscene');
  if (scene) scene.classList.add('sw-xr-paused');
}

function resumeXr() {
  const scene = document.getElementById('xrscene');
  if (scene) scene.classList.remove('sw-xr-paused');
  try {
    if (window.XR8 && typeof window.XR8.resume === 'function') window.XR8.resume();
  } catch (e) { /* ignore */ }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureSelfieScripts() {
  if (state.selfie.scriptsReady) return;
  if (state.selfie.scriptsLoading) return state.selfie.scriptsLoading;

  state.selfie.scriptsLoading = (async () => {
    // model-viewer as module
    if (!customElements.get('model-viewer')) {
      await import('https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js');
    }
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    state.selfie.scriptsReady = true;
  })();

  try {
    await state.selfie.scriptsLoading;
  } finally {
    state.selfie.scriptsLoading = null;
  }
}

function applySelfieCharacter() {
  const viewer = document.getElementById('sw-selfie-viewer');
  if (!viewer) return;
  viewer.setAttribute('src', CHAR_SELFIE_SRC[state.photoCharacter] || CHAR_SELFIE_SRC[CHAR.SHARKIE]);
}

function onSelfiePoseResults(results) {
  const overlay = document.getElementById('sw-selfie-overlay');
  const viewer = document.getElementById('sw-selfie-viewer');
  if (!overlay || !viewer) return;

  if (!results.poseLandmarks) {
    overlay.classList.remove('visible');
    state.selfie.lastPos = null;
    return;
  }

  const lm = results.poseLandmarks;
  // Landmark 12 = right shoulder (project convention); also blend left for stability.
  const left = lm[11];
  const right = lm[12];
  if (!left || !right) return;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const half = state.selfie.size / 2;

  // Mirrored selfie preview → flip X
  const lx = (1 - left.x) * W;
  const ly = left.y * H;
  const rx = (1 - right.x) * W;
  const ry = right.y * H;

  let px = rx + state.selfie.xNudge;
  let py = ry + state.selfie.yNudge;
  // Soft blend toward mid-shoulder so the mascot sits more naturally
  px = px * 0.65 + ((lx + rx) / 2) * 0.35;
  py = py * 0.65 + ((ly + ry) / 2) * 0.35;

  overlay.style.left = `${px - half}px`;
  overlay.style.top = `${py - half}px`;
  overlay.classList.add('visible');
  viewer.style.width = `${state.selfie.size}px`;
  viewer.style.height = `${state.selfie.size}px`;
  state.selfie.lastPos = { px, py };
}

async function startSelfieMode() {
  setInstruction('Selfie Mode — line up shoulders, then Snap', true);
  flashToast('Starting front camera…');

  try {
    await ensureSelfieScripts();
  } catch (e) {
    console.warn('Selfie scripts failed', e);
    flashToast('Could not load selfie libraries');
    return;
  }

  pauseXr();
  state.photoSubmode = 'selfie';
  syncPhotoSubmodeUi();
  applySelfieCharacter();

  const video = document.getElementById('sw-selfie-video');
  if (!video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    state.selfie.stream = stream;
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    console.warn('Front camera error', e);
    flashToast('Front camera blocked — check permissions');
    stopSelfieMode();
    return;
  }

  if (typeof Pose === 'undefined' || typeof Camera === 'undefined') {
    flashToast('Pose tracker unavailable');
    return;
  }

  const pose = new Pose({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
  });
  pose.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  pose.onResults(onSelfiePoseResults);
  state.selfie.pose = pose;

  const camera = new Camera(video, {
    onFrame: async () => {
      if (state.photoSubmode !== 'selfie' || !state.selfie.pose) return;
      try { await state.selfie.pose.send({ image: video }); } catch (e) { /* frame drop */ }
    },
    width: 1280,
    height: 720
  });
  state.selfie.camera = camera;
  await camera.start();
  setInstruction('Selfie Mode — Snap to capture · Flip returns to place', true);
}

function stopSelfieMode() {
  try {
    if (state.selfie.camera && typeof state.selfie.camera.stop === 'function') {
      state.selfie.camera.stop();
    }
  } catch (e) { /* ignore */ }
  state.selfie.camera = null;
  state.selfie.pose = null;
  state.selfie.lastPos = null;

  if (state.selfie.stream) {
    state.selfie.stream.getTracks().forEach((t) => t.stop());
    state.selfie.stream = null;
  }
  const video = document.getElementById('sw-selfie-video');
  if (video) video.srcObject = null;

  const overlay = document.getElementById('sw-selfie-overlay');
  if (overlay) overlay.classList.remove('visible');

  state.photoSubmode = 'place';
  syncPhotoSubmodeUi();
  resumeXr();
}

async function togglePhotoCamera() {
  if (state.mode !== MODE.PHOTO) return;
  if (state.photoSubmode === 'place') {
    await startSelfieMode();
  } else {
    stopSelfieMode();
    setInstruction('Photo Mode — tap the ground to place your mascot', true);
  }
}

function showPreview(dataUrl) {
  const preview = document.getElementById('sw-photo-preview');
  const img = document.getElementById('sw-photo-preview-img');
  if (!preview || !img) return;
  img.src = dataUrl;
  preview.classList.add('visible');
}

function hidePreview() {
  const preview = document.getElementById('sw-photo-preview');
  if (preview) preview.classList.remove('visible');
}

function capturePlaceMode() {
  const scene = document.querySelector('a-scene');
  const canvas = scene && (scene.canvas || scene.querySelector('canvas'));
  if (!canvas) {
    flashToast('AR canvas not ready');
    return;
  }
  try {
    showPreview(canvas.toDataURL('image/png'));
  } catch (e) {
    console.warn('Place capture failed', e);
    flashToast('Capture failed (try again)');
  }
}

function captureSelfieMode() {
  const video = document.getElementById('sw-selfie-video');
  const viewer = document.getElementById('sw-selfie-viewer');
  if (!video || !video.videoWidth) {
    flashToast('Camera not ready');
    return;
  }

  const out = document.createElement('canvas');
  out.width = video.videoWidth;
  out.height = video.videoHeight;
  const ctx = out.getContext('2d');
  const scaleX = video.videoWidth / window.innerWidth;
  const scaleY = video.videoHeight / window.innerHeight;

  ctx.save();
  ctx.translate(out.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, out.width, out.height);
  ctx.restore();

  if (state.selfie.lastPos && viewer && viewer.shadowRoot) {
    const mvCanvas = viewer.shadowRoot.querySelector('canvas');
    if (mvCanvas) {
      const size = state.selfie.size;
      ctx.save();
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
      const x = (out.width / scaleX - state.selfie.lastPos.px - size / 2) * scaleX;
      const y = (state.selfie.lastPos.py - size / 2) * scaleY;
      const w = size * scaleX;
      const h = size * scaleY;
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(mvCanvas, 0, 0, w, h);
      ctx.restore();
    }
  }

  showPreview(out.toDataURL('image/png'));
}

function snapPhoto() {
  if (state.mode !== MODE.PHOTO) return;
  const flash = document.getElementById('sw-photo-flash');
  if (flash) {
    flash.classList.add('on');
    setTimeout(() => flash.classList.remove('on'), 180);
  }
  if (state.photoSubmode === 'selfie') captureSelfieMode();
  else capturePlaceMode();
}

function savePreview() {
  const img = document.getElementById('sw-photo-preview-img');
  if (!img || !img.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = `sharks-way-photo-${Date.now()}.png`;
  a.click();
  hidePreview();
  flashToast('Saved');
}

async function sharePreview() {
  const img = document.getElementById('sw-photo-preview-img');
  if (!img || !img.src) return;
  try {
    if (navigator.share) {
      const blob = await (await fetch(img.src)).blob();
      await navigator.share({
        files: [new File([blob], 'sharks-way-photo.png', { type: 'image/png' })],
        title: 'Sharks Way Photo'
      });
    } else {
      flashToast('Share not supported — use Save');
    }
  } catch (e) {
    /* user cancelled */
  }
}

export function getSharksWayMode() {
  return state.mode;
}

export function setSharksWayMode(mode) {
  if (!Object.values(MODE).includes(mode)) {
    highlightModeButtons(state.mode);
    closeNav();
    return;
  }
  if (mode === state.mode) {
    highlightModeButtons(state.mode);
    closeNav();
    return;
  }

  const prev = state.mode;
  state.mode = mode;

  if (prev === MODE.PHOTO) setPhotoUi(false);
  if (prev === MODE.GOALIE) setGoalieUi(false);
  if (prev === MODE.WAYFINDING) setWayfindingUi(false);

  if (mode === MODE.WAYFINDING) {
    setWayfindingUi(true);
    setInstruction('Sharks appear automatically along Sharks Way — point your camera around', true);
    setTimeout(() => {
      const el = document.getElementById('tap-instruction');
      if (el && state.mode === MODE.WAYFINDING) el.classList.remove('visible');
    }, 3500);
  } else if (mode === MODE.PHOTO) {
    setPhotoUi(true);
    setInstruction('Photo Mode — tap the ground to place your mascot', true);
  } else if (mode === MODE.GOALIE) {
    setGoalieUi(true);
    setInstruction('Goalie Mode — tap the ground to place the goal & hockey puck', true);
  }

  highlightModeButtons(mode);
  closeNav();
  window.dispatchEvent(new CustomEvent('sharksWayModeChanged', { detail: { mode, prev } }));
}

function highlightModeButtons(mode) {
  document.querySelectorAll('[data-sw-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-sw-mode') === mode);
  });
}

function onGroundClick(e) {
  if (state.mode !== MODE.PHOTO || state.photoSubmode !== 'place') return;
  const pt = e.detail && e.detail.intersection && e.detail.intersection.point;
  if (!pt) return;
  placePhotoMascot(pt);
}

function injectModeUi() {
  if (document.getElementById('photo-mode-bar')) return;

  const photoBar = document.createElement('div');
  photoBar.id = 'photo-mode-bar';
  photoBar.innerHTML = `
    <button type="button" data-photo-char="sharkie" class="sw-chip active">Sharkie</button>
    <button type="button" data-photo-char="sammy" class="sw-chip">Sammy</button>
    <button type="button" id="photo-flip-btn" class="sw-chip">Flip Camera</button>
    <button type="button" id="photo-snap-btn" class="sw-chip sw-chip-snap" aria-label="Take photo">Snap</button>
  `;
  document.body.appendChild(photoBar);

  // In-page selfie layer (front camera + shoulder mascot)
  const selfie = document.createElement('div');
  selfie.id = 'sw-selfie-layer';
  selfie.innerHTML = `
    <video id="sw-selfie-video" autoplay playsinline muted></video>
    <div id="sw-selfie-overlay">
      <model-viewer id="sw-selfie-viewer"
        src="./assets/3D-models/sharkie_final_pose.glb"
        camera-orbit="0deg 75deg 150%"
        field-of-view="60deg"
        disable-zoom
        interaction-prompt="none"
        environment-image="neutral"
        shadow-intensity="0"
        style="width:250px;height:250px;background:transparent;--poster-color:transparent;">
      </model-viewer>
    </div>
    <div id="sw-selfie-hint">Step back so your shoulders are visible</div>
  `;
  document.body.appendChild(selfie);

  const flash = document.createElement('div');
  flash.id = 'sw-photo-flash';
  document.body.appendChild(flash);

  const preview = document.createElement('div');
  preview.id = 'sw-photo-preview';
  preview.innerHTML = `
    <div class="sw-preview-card">
      <div class="sw-preview-label">Your Sharks Way Photo</div>
      <img id="sw-photo-preview-img" alt="Captured photo">
      <div class="sw-preview-actions">
        <button type="button" id="sw-photo-retake">Retake</button>
        <button type="button" id="sw-photo-save">Save</button>
        <button type="button" id="sw-photo-share">Share</button>
      </div>
    </div>
  `;
  document.body.appendChild(preview);

  if (!document.getElementById('timer')) {
    const topbar = document.getElementById('topbar');
    if (topbar) {
      topbar.insertAdjacentHTML('beforeend', `
        <span id="timer" class="pill sw-goalie-pill" style="display:none">00:30</span>
        <span id="score" class="pill sw-goalie-pill" style="display:none">Goals 0 / 0</span>
      `);
    }
  }
  if (!document.getElementById('reset-btn')) {
    const btn = document.createElement('button');
    btn.id = 'reset-btn';
    btn.className = 'pill';
    btn.style.display = 'none';
    btn.textContent = 'Reset';
    document.body.appendChild(btn);
  }
  if (!document.getElementById('toast')) {
    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
}

function injectNavModeSection() {
  const nav = document.getElementById('nav-menu');
  if (!nav || document.getElementById('sw-mode-section')) return;

  const section = document.createElement('div');
  section.id = 'sw-mode-section';
  section.innerHTML = `
    <h3 class="sw-mode-heading">Sharks Way Modes</h3>
    <button type="button" class="nav-link sw-mode-btn active" data-sw-mode="wayfinding">
      Wayfinding
    </button>
    <button type="button" class="nav-link sw-mode-btn" data-sw-mode="photo">
      Photo Mode
    </button>
    <button type="button" class="nav-link sw-mode-btn" data-sw-mode="goalie">
      Goalie Mode
    </button>
  `;

  const firstLink = nav.querySelector('a.nav-link');
  if (firstLink) nav.insertBefore(section, firstLink);
  else nav.appendChild(section);

  section.querySelectorAll('[data-sw-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setSharksWayMode(btn.getAttribute('data-sw-mode')));
  });
}

function wirePhotoBar() {
  document.querySelectorAll('[data-photo-char]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.photoCharacter = btn.getAttribute('data-photo-char');
      syncPhotoCharacterButtons();
      if (state.photoEntity) {
        state.photoEntity.setAttribute('gltf-model', CHAR_MODEL[state.photoCharacter]);
      }
      if (state.photoSubmode === 'selfie') applySelfieCharacter();
    });
  });

  const flip = document.getElementById('photo-flip-btn');
  if (flip) flip.addEventListener('click', () => { togglePhotoCamera(); });

  const snap = document.getElementById('photo-snap-btn');
  if (snap) snap.addEventListener('click', () => snapPhoto());

  const retake = document.getElementById('sw-photo-retake');
  const save = document.getElementById('sw-photo-save');
  const share = document.getElementById('sw-photo-share');
  if (retake) retake.addEventListener('click', hidePreview);
  if (save) save.addEventListener('click', savePreview);
  if (share) share.addEventListener('click', () => { sharePreview(); });
}

export function initSharksWayModes() {
  injectModeUi();
  injectNavModeSection();
  if (!document.getElementById('sw-mode-section')) {
    let tries = 0;
    const id = setInterval(() => {
      injectNavModeSection();
      if (document.getElementById('sw-mode-section') || ++tries > 20) clearInterval(id);
    }, 50);
  }
  wirePhotoBar();
  highlightModeButtons(MODE.WAYFINDING);

  const ground = document.getElementById('ground');
  if (ground) ground.addEventListener('click', onGroundClick);

  window.SharksWayMode = {
    get: getSharksWayMode,
    set: setSharksWayMode,
    MODE,
    isWayfinding: () => state.mode === MODE.WAYFINDING,
    isPhoto: () => state.mode === MODE.PHOTO,
    isGoalie: () => state.mode === MODE.GOALIE,
    photoSubmode: () => state.photoSubmode
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharksWayModes);
} else {
  initSharksWayModes();
}
