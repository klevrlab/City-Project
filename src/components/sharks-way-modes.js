/**
 * June 10 redline — Sharks Way mode switcher.
 * Wayfinding (default) | Photo Mode | Goalie Mode
 *
 * Photo Mode: back-camera AR, tap ground to place Sharkie/Sammy; flip opens selfie.
 * Goalie Mode: activates the soccer-game prototype (Sharkie in goal) on this page.
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

const state = {
  mode: MODE.WAYFINDING,
  photoCharacter: CHAR.SHARKIE,
  photoEntity: null,
  soccerArmed: false
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
  ent.setAttribute('scale', '0.45 0.45 0.45');
  ent.setAttribute('shadow', 'cast: true');
  root.appendChild(ent);
  state.photoEntity = ent;

  setInstruction('Tap again to move · use Flip Camera for selfie', true);
  setTimeout(() => {
    const el = document.getElementById('tap-instruction');
    if (el) el.classList.remove('visible');
  }, 2800);
}

function setPhotoUi(on) {
  const bar = document.getElementById('photo-mode-bar');
  if (bar) bar.classList.toggle('visible', on);
  const root = document.getElementById('photo-root');
  if (root) root.setAttribute('visible', on ? 'true' : 'false');
  if (!on) clearPhotoMascot();
  syncPhotoCharacterButtons();
}

function syncPhotoCharacterButtons() {
  document.querySelectorAll('[data-photo-char]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-photo-char') === state.photoCharacter);
  });
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
  // Component is declared on the entity in HTML; just reset into idle placement.
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

export function getSharksWayMode() {
  return state.mode;
}

export function setSharksWayMode(mode) {
  if (!Object.values(MODE).includes(mode) || mode === state.mode) {
    highlightModeButtons(state.mode);
    closeNav();
    return;
  }

  const prev = state.mode;
  state.mode = mode;

  // Tear down previous mode.
  if (prev === MODE.PHOTO) setPhotoUi(false);
  if (prev === MODE.GOALIE) setGoalieUi(false);
  if (prev === MODE.WAYFINDING) setWayfindingUi(false);

  // Bring up new mode.
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
  if (state.mode !== MODE.PHOTO) return;
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
    <a id="photo-flip-btn" class="sw-chip sw-chip-link" href="./selfie-ar.html?character=sharkey">Flip Camera</a>
  `;
  document.body.appendChild(photoBar);

  // Goalie / soccer overlays (hidden until Goalie Mode)
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
      const flip = document.getElementById('photo-flip-btn');
      if (flip) {
        flip.href = state.photoCharacter === CHAR.SAMMY
          ? './selfie-ar.html'
          : './selfie-ar.html?character=sharkey';
      }
      if (state.photoEntity) {
        const model = CHAR_MODEL[state.photoCharacter];
        state.photoEntity.setAttribute('gltf-model', model);
      }
    });
  });
}

export function initSharksWayModes() {
  injectModeUi();
  injectNavModeSection();
  // Navigation injects #nav-menu asynchronously relative to this module — retry briefly.
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

  // Expose for shark-animator / console
  window.SharksWayMode = {
    get: getSharksWayMode,
    set: setSharksWayMode,
    MODE,
    isWayfinding: () => state.mode === MODE.WAYFINDING,
    isPhoto: () => state.mode === MODE.PHOTO,
    isGoalie: () => state.mode === MODE.GOALIE
  };
}

// Auto-init when this module is loaded on the Sharks Way page.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharksWayModes);
} else {
  initSharksWayModes();
}
