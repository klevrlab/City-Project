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
    kickDurationMs: { type: 'number', default: 1100 },
    minSwipePx: { type: 'number', default: 30 },
    resetDelayMs: { type: 'number', default: 1200 },
    // Max lateral deflection from "straight ahead" in degrees, regardless of how
    // diagonal the swipe is. Keeps aiming predictable in a cone, not a full circle.
    maxAimAngleDeg: { type: 'number', default: 22 },
    // Minimum upward swipe ratio (0–1 of reference distance) required to fire.
    minForwardRatio: { type: 'number', default: 0.15 },
    // How far up the screen a "full power" swipe needs to travel, as fraction of screen height.
    fullPowerScreenRatio: { type: 'number', default: 0.4 },
    // Top dead zone (px) — touches that start above this are ignored (topbar area).
    topDeadZonePx: { type: 'number', default: 60 },
    aimDotCount: { type: 'number', default: 14 }
  },

  init: function () {
    this.state = 'idle';
    this.ballEntity = null;
    this.goalEntity = null;
    this.ballPlacementPos = null;
    this.goalCenter = null;
    this.goalForward = null;
    this.goalRight = null;
    this.touchStartX = null;
    this.touchStartY = null;
    this.touchStartT = 0;
    this.kickRafId = null;
    this.resetTimerId = null;
    this.score = 0;
    this.attempts = 0;
    this.aimDots = [];
    this.aimVisible = false;

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
    const pt = e.detail && e.detail.intersection && e.detail.intersection.point;
    if (!pt) return;
    this.placeField(pt.clone ? pt.clone() : new THREE.Vector3(pt.x, pt.y, pt.z));
  },

  placeField: function (ballPos) {
    const cam = document.getElementById('camera');
    const camPos = cam ? cam.object3D.position.clone() : new THREE.Vector3();
    const forward = new THREE.Vector3().subVectors(ballPos, camPos);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();

    this.goalForward = forward.clone();
    // Perpendicular in XZ (right-hand of forward when looking down +Y).
    this.goalRight = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

    const goalPos = ballPos.clone().add(forward.clone().multiplyScalar(this.data.goalDistance));
    goalPos.y = 0;
    this.goalCenter = goalPos.clone();
    this.ballPlacementPos = ballPos.clone();
    this.ballPlacementPos.y = this.data.ballRadius;

    this.ensureBall();
    this.ensureGoal();

    this.ballEntity.object3D.position.copy(this.ballPlacementPos);

    const goalYawDeg = Math.atan2(-forward.x, -forward.z) * (180 / Math.PI);
    this.goalEntity.object3D.position.copy(this.goalCenter);
    this.goalEntity.object3D.position.y = 0;
    this.goalEntity.setAttribute('rotation', `0 ${goalYawDeg} 0`);

    this.ensureAimGuide();

    this.state = 'placed';
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

    const net = document.createElement('a-plane');
    net.setAttribute('width', w);
    net.setAttribute('height', h);
    net.setAttribute('position', `0 ${h / 2} -0.35`);
    net.setAttribute('material', 'color: #66ccff; opacity: 0.15; transparent: true; side: double; depthWrite: false');
    group.appendChild(net);

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

    return { dir: dir, power: power, fwdAmount: fwdAmount, distPx: distPx };
  },

  updateAim: function (dir, power) {
    if (!this.ballEntity || !this.aimDots.length) return;
    const ballPos = this.ballEntity.object3D.position;
    const distance = this.data.goalDistance * power;
    const arcHeight = 0.5 + power * 1.0;
    const count = this.aimDots.length;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = ballPos.x + dir.x * distance * t;
      const z = ballPos.z + dir.z * distance * t;
      const y = this.data.ballRadius + arcHeight * Math.sin(Math.PI * t);
      this.aimDots[i].object3D.position.set(x, y, z);
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
      this.kickToward(this.goalForward.clone(), 0.9);
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

    this.kickToward(shot.dir, shot.power);
  },

  kickToward: function (direction, power) {
    if (this.state !== 'placed' || !this.ballEntity) return;
    if (this.resetTimerId) {
      clearTimeout(this.resetTimerId);
      this.resetTimerId = null;
    }

    const distance = this.data.goalDistance * power;
    const start = this.ballEntity.object3D.position.clone();
    const end = start.clone().add(direction.clone().multiplyScalar(distance));
    end.y = this.data.ballRadius;

    this.kickStart = performance.now();
    this.kickFrom = start.clone();
    this.kickTo = end.clone();
    this.kickArc = 0.5 + power * 1.0;
    this.kickGoalDetected = false;

    this.state = 'kicking';
    this.attempts += 1;
    this.updateInstruction('');
    this.hideAim();
    if (window.AudioUtils) window.AudioUtils.playSound('kick');

    cancelAnimationFrame(this.kickRafId);
    this.kickRafId = requestAnimationFrame(this.tickKick);
  },

  tickKick: function (now) {
    const dur = this.data.kickDurationMs;
    const t = Math.min((now - this.kickStart) / dur, 1);
    // Ease-out horizontal motion so the ball decelerates from "air drag" —
    // feels heavier and lands softly. Y still uses sin(π·t) for clean arc.
    const eased = 1 - Math.pow(1 - t, 2.2);

    const x = this.kickFrom.x + (this.kickTo.x - this.kickFrom.x) * eased;
    const z = this.kickFrom.z + (this.kickTo.z - this.kickFrom.z) * eased;
    const baseY = this.data.ballRadius;
    const y = baseY + this.kickArc * Math.sin(Math.PI * t);

    this.ballEntity.object3D.position.set(x, y, z);

    if (!this.kickGoalDetected) {
      const relX = x - this.goalCenter.x;
      const relZ = z - this.goalCenter.z;
      const alongForward = relX * this.goalForward.x + relZ * this.goalForward.z;
      const lateral = relX * this.goalRight.x + relZ * this.goalRight.z;

      if (alongForward >= 0 && Math.abs(lateral) <= this.data.goalWidth / 2 && y <= this.data.goalHeight) {
        this.kickGoalDetected = true;
        this.onGoal();
      }
    }

    if (t < 1) {
      this.kickRafId = requestAnimationFrame(this.tickKick);
    } else {
      this.onKickEnd();
    }
  },

  onGoal: function () {
    this.score += 1;
    this.updateScore();
    this.showToast('GOAL!', 'goal');
    if (window.AudioUtils) window.AudioUtils.playSound('goal');
  },

  onKickEnd: function () {
    if (!this.kickGoalDetected) {
      this.showToast('Miss — try again', 'miss');
      this.updateScore();
    }
    this.resetTimerId = setTimeout(() => {
      this.resetTimerId = null;
      if (this.state !== 'kicking') return;
      if (this.ballEntity && this.ballPlacementPos) {
        this.ballEntity.object3D.position.copy(this.ballPlacementPos);
      }
      this.state = 'placed';
      this.updateInstruction('Swipe up to shoot — drag higher for more power · tap the ball for a straight kick');
      this.hideToast();
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
    this.touchStartX = null;
    this.touchStartY = null;
    this.state = 'idle';
    this.score = 0;
    this.attempts = 0;
    this.hideToast();
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
    el.textContent = `Goals ${this.score} / ${this.attempts}`;
  }
});
