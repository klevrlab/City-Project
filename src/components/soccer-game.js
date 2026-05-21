/**
 * 8th Wall Soccer Prototype: tap the ground to place a ball + goal, then swipe
 * (or tap the ball) to kick. Ball flies in an arc; if it crosses the goal mouth
 * within width & height, it's a goal. Otherwise miss. Reset returns to idle.
 */
AFRAME.registerComponent('soccer-game', {
  schema: {
    ballRadius: { type: 'number', default: 0.11 },
    goalWidth: { type: 'number', default: 3.0 },
    goalHeight: { type: 'number', default: 1.5 },
    goalDistance: { type: 'number', default: 6.0 },
    // Keep the placed ball within a comfortable interaction ring around player.
    minBallDistanceFromPlayer: { type: 'number', default: 1.8 },
    maxBallDistanceFromPlayer: { type: 'number', default: 4.0 },
    // Keep goal from spawning too far out (or too close) relative to player.
    minGoalDistanceFromPlayer: { type: 'number', default: 5.0 },
    maxGoalDistanceFromPlayer: { type: 'number', default: 10.0 },
    // Re-anchor field only if player has moved this far from initial placement origin.
    reanchorDistanceFromOrigin: { type: 'number', default: 4.0 },
    challengeDurationSec: { type: 'number', default: 30 },
    kickDurationMs: { type: 'number', default: 1300 },
    minSwipePx: { type: 'number', default: 20 },
    resetDelayMs: { type: 'number', default: 1200 },
    // Max lateral deflection from "straight ahead" in degrees, regardless of how
    // diagonal the swipe is. Keeps aiming predictable in a cone, not a full circle.
    maxAimAngleDeg: { type: 'number', default: 30 },
    // Minimum upward swipe ratio (0–1 of reference distance) required to fire.
    minForwardRatio: { type: 'number', default: 0.15 },
    // How far up the screen a "full power" swipe needs to travel, as fraction of screen height.
    fullPowerScreenRatio: { type: 'number', default: 0.3 },
    // Top dead zone (px) — touches that start above this are ignored (topbar area).
    topDeadZonePx: { type: 'number', default: 60 },
    aimDotCount: { type: 'number', default: 14 }
  },

  init: function () {
    this.state = 'idle';
    this.ballEntity = null;
    this.goalEntity = null;
    this.netEl = null;
    this.lastGoalU = 0.5;
    this.lastGoalV = 0.5;
    this.ballPlacementPos = null;
    this.goalCenter = null;
    this.goalForward = null;
    this.goalRight = null;
    this.touchStartX = null;
    this.touchStartY = null;
    this.touchStartT = 0;
    this.kickRafId = null;
    this.resetTimerId = null;
    this.score = 0; // points
    this.goals = 0;
    this.attempts = 0;
    this.streak = 0;
    this.bestZone = 'None';
    this.challengeActive = false;
    this.challengeTimerId = null;
    this.challengeEndsAtMs = 0;
    this.pendingRoundSummary = false;
    this.preRoundCountdownActive = false;
    this.countdownTimeoutIds = [];
    this.aimDots = [];
    this.aimVisible = false;
    this.fieldOriginCameraPos = null;

    this.onGroundClick = this.onGroundClick.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchCancel = this.onTouchCancel.bind(this);
    this.tickKick = this.tickKick.bind(this);

    const ground = document.getElementById('ground');
    if (ground) ground.addEventListener('click', this.onGroundClick);

    document.addEventListener('touchstart', this.onTouchStart, { passive: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', this.onTouchCancel, { passive: true });

    const showHint = () => this.updateInstruction('Tap the ground to place the soccer ball');
    if (this.el.sceneEl && this.el.sceneEl.hasLoaded) {
      showHint();
    }
    window.addEventListener('realityready', showHint);

    window.manualSoccerSpawn = () => {
      const pt = this.getForwardPoint(3.0);
      this.placeField(pt);
    };

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resetField();
      });
    }
  },

  // Match the working camera-forward math from shark-animator.js — gives a
  // point on the ground in front of the user regardless of 8th Wall's camera
  // orientation conventions.
  getForwardPoint: function (distance) {
    const cam = document.getElementById('camera');
    if (!cam) return new THREE.Vector3(0, 0, -distance);
    const camPos = cam.object3D.position.clone();
    const dir = new THREE.Vector3();
    cam.object3D.getWorldDirection(dir);
    dir.multiplyScalar(-1);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    dir.normalize();
    const pt = camPos.add(dir.multiplyScalar(distance));
    pt.y = 0;
    return pt;
  },

  onGroundClick: function (e) {
    if (this.state === 'kicking') return;
    // Keep field stable during normal play; only re-anchor after large player movement.
    if (this.state === 'placed' && !this.hasMovedFarFromOrigin()) return;
    const pt = e.detail && e.detail.intersection && e.detail.intersection.point;
    if (!pt) return;
    this.placeField(pt.clone ? pt.clone() : new THREE.Vector3(pt.x, pt.y, pt.z));
  },

  zoneLabel: function (zone) {
    if (zone === 'top_corner') return 'Top Corner';
    if (zone === 'corner') return 'Corner';
    if (zone === 'center') return 'Center';
    return 'Goal';
  },

  zonePoints: function (zone) {
    if (zone === 'top_corner') return 2;
    return 1;
  },

  classifyGoalZone: function (lateral, y) {
    const halfW = this.data.goalWidth / 2;
    const absLat = Math.abs(lateral);
    const nearPost = absLat >= halfW * 0.62;
    const high = y >= this.data.goalHeight * 0.72;
    const center = absLat <= halfW * 0.22 && y <= this.data.goalHeight * 0.68;
    if (nearPost && high) return 'top_corner';
    if (nearPost) return 'corner';
    if (center) return 'center';
    return 'goal';
  },

  startChallengeIfNeeded: function () {
    if (this.challengeActive || this.preRoundCountdownActive) return;
    this.challengeActive = true;
    this.score = 0;
    this.goals = 0;
    this.attempts = 0;
    this.streak = 0;
    this.bestZone = 'None';
    this.pendingRoundSummary = false;
    this.updateScore();
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.style.display = 'inline-block';
    this.startPreRoundCountdown();
  },

  startPreRoundCountdown: function () {
    this.preRoundCountdownActive = true;
    this.updateInstruction('Get ready...');
    this.countdownTimeoutIds.forEach((id) => clearTimeout(id));
    this.countdownTimeoutIds = [];
    const steps = [
      { label: '3', sound: 'countdown-3' },
      { label: '2', sound: 'countdown-2' },
      { label: '1', sound: 'countdown-1' },
      { label: 'GO!', sound: 'countdown-go' }
    ];
    const stepMs = 520;

    steps.forEach((step, idx) => {
      const id = setTimeout(() => {
        this.showToast(step.label, 'countdown');
        if (window.AudioUtils) window.AudioUtils.playSound(step.sound);
      }, idx * stepMs);
      this.countdownTimeoutIds.push(id);
    });

    const kickoffId = setTimeout(() => {
      this.preRoundCountdownActive = false;
      this.hideToast();
      this.challengeEndsAtMs = Date.now() + this.data.challengeDurationSec * 1000;
      this.updateTimer();
      if (this.challengeTimerId) clearInterval(this.challengeTimerId);
      this.challengeTimerId = setInterval(() => {
        this.updateTimer();
        if (Date.now() >= this.challengeEndsAtMs) {
          this.finishChallengeRound();
        }
      }, 200);
      this.updateInstruction('GO! Swipe up to shoot');
    }, steps.length * stepMs);
    this.countdownTimeoutIds.push(kickoffId);
  },

  updateTimer: function () {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    if (!this.challengeActive) {
      timerEl.style.display = 'none';
      return;
    }
    const remainingMs = Math.max(0, this.challengeEndsAtMs - Date.now());
    const secs = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    timerEl.style.display = 'inline-block';
    timerEl.textContent = `${mm}:${ss}`;
  },

  finishChallengeRound: function () {
    if (!this.challengeActive) return;
    this.challengeActive = false;
    if (this.challengeTimerId) {
      clearInterval(this.challengeTimerId);
      this.challengeTimerId = null;
    }
    this.updateTimer();

    if (this.state === 'kicking') {
      this.pendingRoundSummary = true;
      return;
    }
    this.showRoundSummary();
  },

  showRoundSummary: function () {
    const accuracy = this.attempts > 0 ? Math.round((this.goals / this.attempts) * 100) : 0;
    const summary = `Time! ${this.data.challengeDurationSec}s complete\nPoints ${this.score} · Goals ${this.goals}/${this.attempts} · Accuracy ${accuracy}%\nBest ${this.bestZone}`;
    this.showToast(summary, 'summary');
    this.updateInstruction('Round complete. Swipe to start a new round');
  },

  hasMovedFarFromOrigin: function () {
    if (!this.fieldOriginCameraPos) return true;
    const cam = document.getElementById('camera');
    if (!cam) return false;
    const camPos = cam.object3D.position;
    const dx = camPos.x - this.fieldOriginCameraPos.x;
    const dz = camPos.z - this.fieldOriginCameraPos.z;
    return Math.hypot(dx, dz) >= this.data.reanchorDistanceFromOrigin;
  },

  clampPointToCameraDistance: function (point, minDist, maxDist) {
    const cam = document.getElementById('camera');
    if (!cam) {
      point.y = 0;
      return point;
    }
    const camPos = cam.object3D.position.clone();
    const delta = new THREE.Vector3().subVectors(point, camPos);
    delta.y = 0;

    if (delta.lengthSq() < 0.0001) {
      const fallback = this.getForwardPoint(minDist || 2.0);
      fallback.y = 0;
      return fallback;
    }

    const dist = delta.length();
    const clamped = Math.min(Math.max(dist, minDist), maxDist);
    delta.normalize().multiplyScalar(clamped);

    const out = camPos.add(delta);
    out.y = 0;
    return out;
  },

  placeField: function (ballPos) {
    const constrainedBallPos = this.clampPointToCameraDistance(
      ballPos.clone ? ballPos.clone() : new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z),
      this.data.minBallDistanceFromPlayer,
      this.data.maxBallDistanceFromPlayer
    );

    const cam = document.getElementById('camera');
    const camPos = cam ? cam.object3D.position.clone() : new THREE.Vector3();
    const forward = new THREE.Vector3().subVectors(constrainedBallPos, camPos);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();

    this.goalForward = forward.clone();
    // Perpendicular in XZ (right-hand of forward when looking down +Y).
    this.goalRight = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

    let goalPos = constrainedBallPos.clone().add(forward.clone().multiplyScalar(this.data.goalDistance));
    goalPos = this.clampPointToCameraDistance(
      goalPos,
      this.data.minGoalDistanceFromPlayer,
      this.data.maxGoalDistanceFromPlayer
    );
    goalPos.y = 0;
    this.goalCenter = goalPos.clone();
    this.ballPlacementPos = constrainedBallPos.clone();
    this.ballPlacementPos.y = this.data.ballRadius;

    this.ensureBall();
    this.ensureGoal();

    this.ballEntity.object3D.position.copy(this.ballPlacementPos);

    const goalYawDeg = Math.atan2(-forward.x, -forward.z) * (180 / Math.PI);
    this.goalEntity.object3D.position.copy(this.goalCenter);
    this.goalEntity.object3D.position.y = 0;
    this.goalEntity.setAttribute('rotation', `0 ${goalYawDeg} 0`);

    this.ensureAimGuide();

    // Anchor field origin to the player's current camera position so future
    // incidental taps/swipes don't move the goal unless the player relocates.
    if (cam) {
      this.fieldOriginCameraPos = new THREE.Vector3(camPos.x, 0, camPos.z);
    }

    this.state = 'placed';
    this.startChallengeIfNeeded();
    this.updateInstruction('Swipe up to shoot — drag higher for more power · tap the ball for a straight kick');
    this.showReset(true);
    this.updateScore();
  },

  ensureAimGuide: function () {
    if (this.aimDots.length) return;
    const count = this.data.aimDotCount;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('a-sphere');
      // Front dots are bigger/brighter, back dots smaller/dimmer — reads as direction-of-travel.
      const tInDots = (i + 1) / (count + 1);
      const r = 0.025 + tInDots * 0.025;
      dot.setAttribute('radius', r);
      dot.setAttribute('material', `color: #00A9E0; shader: flat; transparent: true; opacity: ${(0.35 + tInDots * 0.55).toFixed(2)}`);
      dot.setAttribute('visible', 'false');
      this.el.appendChild(dot);
      this.aimDots.push(dot);
    }
  },

  ensureBall: function () {
    if (this.ballEntity) return;
    const ent = document.createElement('a-sphere');
    ent.setAttribute('radius', this.data.ballRadius);
    ent.setAttribute('material', 'color: #f5f5f5; metalness: 0.05; roughness: 0.55');
    ent.setAttribute('shadow', 'cast: true');
    this.el.appendChild(ent);
    this.ballEntity = ent;
  },

  ensureGoal: function () {
    if (this.goalEntity) return;
    const w = this.data.goalWidth;
    const h = this.data.goalHeight;
    const postR = 0.045;
    const matAttr = 'color: #ffffff; metalness: 0.1; roughness: 0.6';

    const group = document.createElement('a-entity');

    const left = document.createElement('a-cylinder');
    left.setAttribute('radius', postR);
    left.setAttribute('height', h);
    left.setAttribute('material', matAttr);
    left.setAttribute('position', `${-w / 2} ${h / 2} 0`);
    left.setAttribute('shadow', 'cast: true');
    group.appendChild(left);

    const right = document.createElement('a-cylinder');
    right.setAttribute('radius', postR);
    right.setAttribute('height', h);
    right.setAttribute('material', matAttr);
    right.setAttribute('position', `${w / 2} ${h / 2} 0`);
    right.setAttribute('shadow', 'cast: true');
    group.appendChild(right);

    const cross = document.createElement('a-cylinder');
    cross.setAttribute('radius', postR);
    cross.setAttribute('height', w);
    cross.setAttribute('rotation', '0 0 90');
    cross.setAttribute('material', matAttr);
    cross.setAttribute('position', `0 ${h} 0`);
    cross.setAttribute('shadow', 'cast: true');
    group.appendChild(cross);

    const netEl = document.createElement('a-entity');
    netEl.setAttribute('net-material', `width: ${w}; height: ${h}; segW: 20; segH: 10`);
    group.appendChild(netEl);
    this.netEl = netEl;

    this.el.appendChild(group);
    this.goalEntity = group;
  },

  // Ignore touches that started on UI overlays (buttons, links) so the swipe
  // handler doesn't fire when the user taps Reset or the back arrow.
  isUiTarget: function (target) {
    if (!target || !target.closest) return false;
    return !!target.closest('button, a, [data-ui-overlay]');
  },

  // Convert an in-progress swipe (dx, dy in pixels, dt in ms) into a ground
  // direction + power. Direction lives in a forward-biased cone around the
  // goal direction, so casual diagonals still go mostly forward instead of
  // wildly veering sideways.
  computeSwipeShot: function (dx, dy, dt) {
    const screenH = window.innerHeight || 800;
    const screenW = window.innerWidth || 400;
    const refUp = screenH * this.data.fullPowerScreenRatio;

    // Forward intent = how far up the screen the user dragged, normalized.
    const fwdAmount = Math.max(0, Math.min(-dy / refUp, 1));

    // Lateral aim = horizontal drag normalized then clamped to ±1, mapped to ±maxAimAngleDeg.
    const latNorm = Math.max(-1, Math.min(dx / (screenW * 0.35), 1));
    const latRad = latNorm * (this.data.maxAimAngleDeg * Math.PI / 180);

    // Rotate goalForward around +Y by latRad to keep aim in the forward cone.
    const cos = Math.cos(latRad);
    const sin = Math.sin(latRad);
    const fx = this.goalForward.x * cos + this.goalForward.z * sin;
    const fz = -this.goalForward.x * sin + this.goalForward.z * cos;
    const dir = new THREE.Vector3(fx, 0, fz).normalize();

    // Power: linear in forward intent, with a small flick-speed bonus.
    const distPx = Math.hypot(dx, dy);
    const speedPxPerMs = distPx / Math.max(dt || 1, 50);
    let power = 0.45 + fwdAmount * 0.85;
    if (speedPxPerMs > 1.2) power += Math.min((speedPxPerMs - 1.2) * 0.12, 0.18);
    power = Math.max(0.45, Math.min(power, 1.45));

    return { dir: dir, power: power, fwdAmount: fwdAmount, distPx: distPx, latNorm: latNorm };
  },

  updateAim: function (dir, power) {
    if (!this.ballEntity || !this.aimDots.length) return;
    const ballPos = this.ballEntity.object3D.position;
    const distance = this.data.goalDistance * (0.5 + power);
    const arcHeight = 0.5 + power * 1.0;
    const count = this.aimDots.length;
    const powerNorm = Math.min(Math.max((power - 0.45) / 1.0, 0), 1);
    const rHex = Math.round(powerNorm * 255).toString(16).padStart(2, '0');
    const gHex = Math.round(169 - powerNorm * 63).toString(16).padStart(2, '0');
    const bHex = Math.round(224 * (1 - powerNorm)).toString(16).padStart(2, '0');
    const dotColor = `#${rHex}${gHex}${bHex}`;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = ballPos.x + dir.x * distance * t;
      const z = ballPos.z + dir.z * distance * t;
      const y = this.data.ballRadius + arcHeight * Math.sin(Math.PI * t);
      this.aimDots[i].object3D.position.set(x, y, z);
      this.aimDots[i].setAttribute('material', `color: ${dotColor}; shader: flat; transparent: true; opacity: ${(0.35 + t * 0.55).toFixed(2)}`);
      this.aimDots[i].setAttribute('visible', 'true');
    }
    this.aimVisible = true;
  },

  hideAim: function () {
    if (!this.aimVisible) return;
    for (let i = 0; i < this.aimDots.length; i++) {
      this.aimDots[i].setAttribute('visible', 'false');
    }
    this.aimVisible = false;
  },

  onTouchStart: function (e) {
    if (this.state !== 'placed') return;
    if (this.preRoundCountdownActive) return;
    if (!e.touches || e.touches.length === 0) return;
    if (this.isUiTarget(e.target)) { this.touchStartX = null; return; }
    const t = e.touches[0];
    // Top dead zone keeps the topbar from being a kick trigger.
    if (t.clientY < this.data.topDeadZonePx) { this.touchStartX = null; return; }
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchStartT = performance.now();
    this.hideAim();
  },

  onTouchMove: function (e) {
    if (this.state !== 'placed') return;
    if (this.touchStartX == null) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const distPx = Math.hypot(dx, dy);
    if (distPx < this.data.minSwipePx) { this.hideAim(); return; }
    const shot = this.computeSwipeShot(dx, dy, performance.now() - this.touchStartT);
    if (shot.fwdAmount < this.data.minForwardRatio * 0.6) { this.hideAim(); return; }
    this.updateAim(shot.dir, shot.power);
  },

  onTouchCancel: function () {
    this.touchStartX = null;
    this.touchStartY = null;
    this.hideAim();
  },

  onTouchEnd: function (e) {
    if (this.state !== 'placed') { this.hideAim(); return; }
    if (this.preRoundCountdownActive) return;
    if (this.touchStartX == null) return;
    if (this.isUiTarget(e.target)) { this.touchStartX = null; this.hideAim(); return; }
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) { this.touchStartX = null; this.hideAim(); return; }

    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const dt = performance.now() - this.touchStartT;
    this.touchStartX = null;
    this.touchStartY = null;
    this.hideAim();

    const distPx = Math.hypot(dx, dy);

    // Sub-threshold movement = tap → straight kick at default power.
    if (distPx < this.data.minSwipePx) {
      this.kickToward(this.goalForward.clone(), 0.9, 0);
      return;
    }

    const shot = this.computeSwipeShot(dx, dy, dt);

    // Require upward intent — a pure sideways/downward drag shouldn't fire.
    if (shot.fwdAmount < this.data.minForwardRatio) {
      this.showToast('Swipe up to kick', 'hint');
      if (this.hintTimerId) clearTimeout(this.hintTimerId);
      this.hintTimerId = setTimeout(() => this.hideToast(), 900);
      return;
    }

    this.kickToward(shot.dir, shot.power, shot.latNorm * 0.55);
  },

  kickToward: function (direction, power, curveAmount) {
    if (this.state !== 'placed' || !this.ballEntity) return;
    if (!this.challengeActive || this.preRoundCountdownActive) {
      this.startChallengeIfNeeded();
      return;
    }
    if (this.resetTimerId) {
      clearTimeout(this.resetTimerId);
      this.resetTimerId = null;
    }

    const distance = this.data.goalDistance * (0.5 + power);
    const start = this.ballEntity.object3D.position.clone();
    const end = start.clone().add(direction.clone().multiplyScalar(distance));
    end.y = this.data.ballRadius;

    this.kickStart = performance.now();
    this.kickFrom = start.clone();
    this.kickTo = end.clone();
    this.kickArc = 0.5 + power * 1.0;
    this.kickPower = power;
    this.kickDirection = direction.clone();
    this.kickGoalDetected = false;
    this.isBouncing    = false;
    this.bouncesLeft   = 1;
    this.bounceStartMs = 0;
    this.bounceFrom    = null;
    this.bounceVelX    = 0;
    this.bounceVelZ    = 0;
    this.bounceVelY    = 0;
    this.netCatchStartMs = 0;
    this.netCatchFrom    = null;
    this.kickCurveAmount = Math.max(-0.65, Math.min(curveAmount || 0, 0.65));
    this.kickCurveRight = new THREE.Vector3(direction.z, 0, -direction.x).normalize();

    this.state = 'kicking';
    this.attempts += 1;
    this.updateInstruction('');
    this.hideAim();
    if (window.AudioUtils) window.AudioUtils.playSound('kick');
    if (navigator.vibrate) navigator.vibrate(18);

    cancelAnimationFrame(this.kickRafId);
    this.kickRafId = requestAnimationFrame(this.tickKick);
  },

  tickKick: function (now) {
    // ── Bounce physics ────────────────────────────────────────────────────────
    if (this.isBouncing) {
      const bt = (now - this.bounceStartMs) / 1000;
      const bx = this.bounceFrom.x + this.bounceVelX * bt;
      const bz = this.bounceFrom.z + this.bounceVelZ * bt;
      const by = Math.max(
        this.data.ballRadius,
        this.bounceFrom.y + this.bounceVelY * bt - 4.9 * bt * bt
      );
      this.ballEntity.object3D.position.set(bx, by, bz);
      if (!this.kickGoalDetected) {
        const relX = bx - this.goalCenter.x;
        const relZ = bz - this.goalCenter.z;
        const alongFwd = relX * this.goalForward.x + relZ * this.goalForward.z;
        const lateral  = relX * this.goalRight.x   + relZ * this.goalRight.z;
        if (alongFwd >= 0 && Math.abs(lateral) <= this.data.goalWidth / 2 && by <= this.data.goalHeight) {
          this.kickGoalDetected = true;
          this.netCatchStartMs = 0;
          this.netCatchFrom = new THREE.Vector3(bx, by, bz);
          this.lastGoalU = (lateral + this.data.goalWidth / 2) / this.data.goalWidth;
          this.lastGoalV = by / this.data.goalHeight;
          this.onGoal(this.classifyGoalZone(lateral, by));
        }
      }
      if (by <= this.data.ballRadius + 0.01) { this.onKickEnd(); return; }
      this.kickRafId = requestAnimationFrame(this.tickKick);
      return;
    }

    // ── Net catch — ball settled in goal ──────────────────────────────────────
    if (this.kickGoalDetected) {
      if (!this.netCatchStartMs) this.netCatchStartMs = now;
      const nT = Math.min((now - this.netCatchStartMs) / 320, 1);
      if (nT < 1) {
        const ease = 1 - (1 - nT) * (1 - nT);
        const bx = this.netCatchFrom.x + this.goalForward.x * 0.28 * ease;
        const bz = this.netCatchFrom.z + this.goalForward.z * 0.28 * ease;
        const by = Math.max(this.data.ballRadius,
          this.netCatchFrom.y - (this.netCatchFrom.y - this.data.ballRadius) * ease * 0.45);
        this.ballEntity.object3D.position.set(bx, by, bz);
      }
      const mainT = Math.min((now - this.kickStart) / this.data.kickDurationMs, 1);
      if (mainT < 1) { this.kickRafId = requestAnimationFrame(this.tickKick); } else { this.onKickEnd(); }
      return;
    }

    // ── Normal kick ───────────────────────────────────────────────────────────
    const dur = this.data.kickDurationMs;
    const t = Math.min((now - this.kickStart) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 2.2);

    const x = this.kickFrom.x + (this.kickTo.x - this.kickFrom.x) * eased;
    const z = this.kickFrom.z + (this.kickTo.z - this.kickFrom.z) * eased;
    const curveOffset = this.kickCurveAmount * Math.sin(Math.PI * t) * this.data.goalDistance * 0.22;
    const cx = this.kickCurveRight ? this.kickCurveRight.x * curveOffset : 0;
    const cz = this.kickCurveRight ? this.kickCurveRight.z * curveOffset : 0;
    const baseY = this.data.ballRadius;
    const peakT = 0.38;
    const arcT = t < peakT
      ? Math.sin(Math.PI * 0.5 * t / peakT)
      : Math.sin(Math.PI * 0.5 * (1.0 - t) / (1.0 - peakT));
    const y = baseY + this.kickArc * arcT;

    if (t < 0.08) {
      const sq = 1.0 - t / 0.08;
      this.ballEntity.object3D.scale.set(1.0 + sq * 0.45, 1.0 - sq * 0.28, 1.0 + sq * 0.45);
    } else if (t < 0.18) {
      const s = 1.0 + (1.0 - (t - 0.08) / 0.10) * 0.12;
      this.ballEntity.object3D.scale.set(1.0, s, 1.0);
    } else {
      this.ballEntity.object3D.scale.set(1, 1, 1);
    }

    this.ballEntity.object3D.position.set(x + cx, y, z + cz);

    const spinAngle = t * Math.PI * 6 * this.kickPower;
    this.ballEntity.object3D.rotation.x =  spinAngle * this.kickDirection.z;
    this.ballEntity.object3D.rotation.z = -spinAngle * this.kickDirection.x;

    // Post/crossbar collision check
    if (!this.kickGoalDetected && this.bouncesLeft > 0) {
      const hit = this.checkPostCollision(new THREE.Vector3(x + cx, y, z + cz), t);
      if (hit) {
        this.startBounce(new THREE.Vector3(x + cx, y, z + cz), hit, t);
        this.kickRafId = requestAnimationFrame(this.tickKick);
        return;
      }
    }

    if (!this.kickGoalDetected) {
      const relX = (x + cx) - this.goalCenter.x;
      const relZ = (z + cz) - this.goalCenter.z;
      const alongForward = relX * this.goalForward.x + relZ * this.goalForward.z;
      const lateral = relX * this.goalRight.x + relZ * this.goalRight.z;
      if (alongForward >= 0 && Math.abs(lateral) <= this.data.goalWidth / 2 && y <= this.data.goalHeight) {
        this.kickGoalDetected = true;
        this.netCatchStartMs = 0;
        this.netCatchFrom = new THREE.Vector3(x + cx, y, z + cz);
        const zone = this.classifyGoalZone(lateral, y);
        this.lastGoalU = (lateral + this.data.goalWidth  / 2) / this.data.goalWidth;
        this.lastGoalV =  y       / this.data.goalHeight;
        this.onGoal(zone);
      }
    }

    if (t < 1) {
      this.kickRafId = requestAnimationFrame(this.tickKick);
    } else {
      this.onKickEnd();
    }
  },

  checkPostCollision: function (ballPos) {
    const postR  = 0.045;
    // Generous hit radius prevents tunneling at high ball speeds (~0.25m/frame peak)
    const hitR   = this.data.ballRadius + postR + 0.13;  // ~0.285m
    const xbarR  = this.data.ballRadius + postR + 0.08;  // ~0.235m crossbar
    const hw     = this.data.goalWidth / 2;
    const h      = this.data.goalHeight;

    // Depth guard: only check when ball is approaching or just inside the goal plane.
    // Prevents false positives when the ball is far away but happens to share XZ coords.
    const rel   = ballPos.clone().sub(this.goalCenter);
    const depth = rel.dot(this.goalForward); // negative = approaching, positive = past goal
    if (depth < -2.0 || depth > 0.4) return null;

    const leftPost  = this.goalCenter.clone().add(this.goalRight.clone().multiplyScalar(-hw));
    const rightPost = this.goalCenter.clone().add(this.goalRight.clone().multiplyScalar( hw));

    // Vertical posts — XZ cylinder check while ball is within goal height
    if (ballPos.y > 0 && ballPos.y < h + 0.15) {
      for (const post of [leftPost, rightPost]) {
        const dx = ballPos.x - post.x;
        const dz = ballPos.z - post.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d < hitR && d > 0.001)
          return { normalX: dx / d, normalZ: dz / d, normalY: 0 };
      }
    }

    // Crossbar — 3D cylinder check along goalRight axis at y=h
    const crossCenter = this.goalCenter.clone();
    crossCenter.y = h;
    const toCross = ballPos.clone().sub(crossCenter);
    const along   = toCross.dot(this.goalRight);
    if (Math.abs(along) <= hw) {
      const closest = crossCenter.clone().add(this.goalRight.clone().multiplyScalar(along));
      const perp    = ballPos.clone().sub(closest);
      const d       = perp.length();
      if (d < xbarR && d > 0.001)
        return { normalX: perp.x / d, normalZ: perp.z / d, normalY: perp.y / d };
    }

    return null;
  },

  startBounce: function (ballPos, hit, t) {
    this.isBouncing    = true;
    this.bouncesLeft  -= 1;
    this.bounceFrom    = ballPos.clone();
    this.bounceStartMs = performance.now();

    // Analytically derive velocity from parametric equations at time t
    const dur    = this.data.kickDurationMs / 1000;
    const deased = 2.2 * Math.pow(1 - t, 1.2);
    const velX   = (this.kickTo.x - this.kickFrom.x) * deased / dur;
    const velZ   = (this.kickTo.z - this.kickFrom.z) * deased / dur;

    const peakT = 0.38;
    const dArc  = t < peakT
      ?  Math.cos(Math.PI * 0.5 * t / peakT)         * (Math.PI * 0.5 / peakT)
      : -Math.cos(Math.PI * 0.5 * (1 - t) / (1 - peakT)) * (Math.PI * 0.5 / (1 - peakT));
    const velY = this.kickArc * dArc / dur;

    // Reflect XZ velocity around hit surface normal, apply restitution
    const restitution = 0.55;
    const dot = velX * hit.normalX + velZ * hit.normalZ;
    this.bounceVelX = (velX - 2 * dot * hit.normalX) * restitution;
    this.bounceVelZ = (velZ - 2 * dot * hit.normalZ) * restitution;
    this.bounceVelY = hit.normalY !== 0
      ? Math.abs(velY) * 0.4 * restitution
      : Math.max(velY * 0.35, 0.8);

    if (navigator.vibrate) navigator.vibrate(12);
  },

  onGoal: function (zone) {
    const basePoints = this.zonePoints(zone);
    this.goals += 1;
    this.streak += 1;
    let bonus = 0;
    if (this.streak >= 2) bonus = 1;
    this.score += basePoints + bonus;
    if (this.bestZone === 'None' ||
      (zone === 'top_corner') ||
      (zone === 'corner' && this.bestZone !== 'Top Corner') ||
      (zone === 'center' && this.bestZone === 'Goal')) {
      this.bestZone = this.zoneLabel(zone);
    }
    this.updateScore();
    const msg = bonus > 0
      ? `${this.zoneLabel(zone)} +${basePoints} · Streak +${bonus}`
      : `${this.zoneLabel(zone)} +${basePoints}`;
    this.showToast(msg, 'goal');
    if (window.AudioUtils) {
      window.AudioUtils.playSound('goal');
      if (bonus > 0) window.AudioUtils.playSound('bonus');
    }
    if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    if (this.netEl && this.netEl.components['net-material']) {
      this.netEl.components['net-material'].triggerHit(this.lastGoalU, this.lastGoalV);
    }
  },

  onKickEnd: function () {
    this.isBouncing = false;
    this.netCatchStartMs = 0;
    if (!this.kickGoalDetected) {
      this.streak = 0;
      this.showToast('Miss — try again', 'miss');
      this.updateScore();
    }
    this.resetTimerId = setTimeout(() => {
      this.resetTimerId = null;
      if (this.state !== 'kicking') return;
      if (this.ballEntity && this.ballPlacementPos) {
        this.ballEntity.object3D.position.copy(this.ballPlacementPos);
        this.ballEntity.object3D.rotation.set(0, 0, 0);
        this.ballEntity.object3D.scale.set(1, 1, 1);
      }
      this.state = 'placed';
      if (this.pendingRoundSummary) {
        this.pendingRoundSummary = false;
        this.showRoundSummary();
      } else {
        this.updateInstruction('Swipe up to shoot — drag higher for more power · tap the ball for a straight kick');
        this.hideToast();
      }
    }, this.data.resetDelayMs);
  },

  resetField: function () {
    cancelAnimationFrame(this.kickRafId);
    if (this.resetTimerId) {
      clearTimeout(this.resetTimerId);
      this.resetTimerId = null;
    }
    if (this.hintTimerId) {
      clearTimeout(this.hintTimerId);
      this.hintTimerId = null;
    }
    if (this.challengeTimerId) {
      clearInterval(this.challengeTimerId);
      this.challengeTimerId = null;
    }
    this.countdownTimeoutIds.forEach((id) => clearTimeout(id));
    this.countdownTimeoutIds = [];
    this.hideAim();
    for (let i = 0; i < this.aimDots.length; i++) {
      const d = this.aimDots[i];
      if (d.parentNode) d.parentNode.removeChild(d);
    }
    this.aimDots = [];
    if (this.ballEntity && this.ballEntity.parentNode) {
      this.ballEntity.parentNode.removeChild(this.ballEntity);
    }
    if (this.goalEntity && this.goalEntity.parentNode) {
      this.goalEntity.parentNode.removeChild(this.goalEntity);
    }
    this.ballEntity = null;
    this.goalEntity = null;
    this.netEl = null;
    this.isBouncing = false;
    this.touchStartX = null;
    this.touchStartY = null;
    this.state = 'idle';
    this.score = 0;
    this.goals = 0;
    this.attempts = 0;
    this.streak = 0;
    this.bestZone = 'None';
    this.challengeActive = false;
    this.preRoundCountdownActive = false;
    this.pendingRoundSummary = false;
    this.fieldOriginCameraPos = null;
    this.hideToast();
    this.updateTimer();
    this.updateInstruction('Tap the ground to place the soccer ball');
    this.showReset(false);
    this.updateScore();
  },

  updateInstruction: function (text) {
    const el = document.getElementById('tap-instruction');
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  },

  showToast: function (text, variant) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.setAttribute('data-variant', variant || '');
    el.classList.add('visible');
  },

  hideToast: function () {
    const el = document.getElementById('toast');
    if (el) el.classList.remove('visible');
  },

  showReset: function (show) {
    const el = document.getElementById('reset-btn');
    if (el) el.style.display = show ? 'inline-block' : 'none';
  },

  updateScore: function () {
    const el = document.getElementById('score');
    if (!el) return;
    if (this.state === 'idle') {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'inline-block';
    el.textContent = `Pts ${this.score} · Goals ${this.goals}/${this.attempts} · Streak ${this.streak}`;
  }
});
