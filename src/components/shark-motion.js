/**
 * Hand-authored shark motion — circle swim and breaching jump.
 *
 * The GLBs only carry a swim-cycle (tail/body); they have no path animation, so
 * the travel is done here in code. The spec asks for a Blender follow-path
 * constraint with offset frames; this is the same idea evaluated per frame,
 * which also means radius, speed and phase stay tunable on site instead of
 * being baked into an export.
 *
 * Both components drive the entity's local transform, so the entity's parent is
 * the frame of reference: put the parent at the circle centre (or the jump's
 * start point) and, when that parent is a geo root, everything below is in real
 * compass bearings.
 *
 * Model convention: these sharks face **+Z**, matching the existing yaw math in
 * shark-animator and location-experiences (`atan2(dx, dz)`).
 */

const DEG = Math.PI / 180;

/**
 * Orbit the parent origin. Spec: "Maria & sharks swim in a 60 meter circle
 * around the intersection", with sharks placed at different points on the
 * circle by offsetting frames — `phaseDeg` here.
 */
AFRAME.registerComponent('shark-circle-swim', {
  schema: {
    radius: { type: 'number', default: 30 },
    period: { type: 'number', default: 48000 },  // ms per lap
    phaseDeg: { type: 'number', default: 0 },
    height: { type: 'number', default: 1.2 },    // cruise height above ground
    bobAmplitude: { type: 'number', default: 0.35 },
    bobCycles: { type: 'number', default: 3 },   // rises/dips per lap
    bankDeg: { type: 'number', default: 12 },    // roll into the turn
    clockwise: { type: 'boolean', default: true },
    yawOffset: { type: 'number', default: 0 }    // if a model's nose is not +Z
  },

  init: function () {
    this.t = 0;
  },

  tick: function (time, delta) {
    if (!delta) return;
    this.t += delta;

    const d = this.data;
    const dir = d.clockwise ? 1 : -1;
    const angle = (d.phaseDeg * DEG) + dir * (this.t / d.period) * Math.PI * 2;

    const x = Math.cos(angle) * d.radius;
    const z = Math.sin(angle) * d.radius;
    const bob = Math.sin(angle * d.bobCycles) * d.bobAmplitude;

    const obj = this.el.object3D;
    obj.position.set(x, d.height + bob, z);

    // Tangent of the circle is the travel direction; +Z-forward models want
    // atan2 of that tangent. Differentiating (cos, sin) gives (−sin, cos).
    const tx = -Math.sin(angle) * dir;
    const tz = Math.cos(angle) * dir;
    obj.rotation.y = Math.atan2(tx, tz) + d.yawOffset * DEG;

    // Bank into the turn, and pitch slightly with the bob so it reads as
    // swimming rather than sliding along a rail.
    obj.rotation.z = -dir * d.bankDeg * DEG;
    const climb = Math.cos(angle * d.bobCycles) * d.bobCycles * d.bobAmplitude;
    obj.rotation.x = -Math.atan2(climb, d.radius) * 2;
  }
});

/**
 * One breach: swim in along a bearing at water level, arc up out of the water,
 * come back down with a splash, keep swimming the same way.
 *
 * Spec, per location: underpass "swims into frame from the east heading west…
 * comes back down before the underpass and continues swimming west"; river
 * "from the south heading north… comes back down over the river with a splash";
 * finale "from the east heading west toward SAP… comes back down at the center
 * with a splash".
 *
 * Emits `shark-breach-exit` when it leaves the water and `shark-breach-entry`
 * when it lands, both with {position} — that's where the splash goes once
 * Rhonda's splash model lands.
 */
AFRAME.registerComponent('shark-arc-jump', {
  schema: {
    // Compass bearing of travel when under a north-aligned (geo) parent;
    // otherwise a plain local yaw in the parent's frame.
    bearing: { type: 'number', default: 270 },
    approachM: { type: 'number', default: 18 },   // distance travelled before the arc
    departM: { type: 'number', default: 18 },     // distance travelled after landing
    arcLengthM: { type: 'number', default: 14 },  // ground distance covered mid-air
    apexHeight: { type: 'number', default: 3.2 },
    swimY: { type: 'number', default: 0.35 },     // cruise height ("in the water")
    speed: { type: 'number', default: 6 },        // m/s
    yawOffset: { type: 'number', default: 0 },
    loop: { type: 'boolean', default: false }
  },

  init: function () {
    this.t = 0;
    this.total = this.data.approachM + this.data.arcLengthM + this.data.departM;
    this.firedExit = false;
    this.firedEntry = false;

    // Travel direction in the parent's frame. Under a geo root (−Z north,
    // +X east) a compass bearing b is (sin b, 0, −cos b).
    const b = this.data.bearing * DEG;
    this.dir = new THREE.Vector3(Math.sin(b), 0, -Math.cos(b));
    this.startOffset = this.dir.clone().multiplyScalar(-this.data.approachM);
  },

  tick: function (time, delta) {
    if (!delta) return;
    const d = this.data;
    this.t += delta / 1000;

    let travelled = this.t * d.speed;
    if (travelled > this.total) {
      if (!d.loop) {
        this.el.emit('shark-arc-complete');
        this.el.removeAttribute('shark-arc-jump');
        return;
      }
      this.t = 0;
      travelled = 0;
      this.firedExit = this.firedEntry = false;
    }

    const obj = this.el.object3D;
    const pos = this.startOffset.clone().add(this.dir.clone().multiplyScalar(travelled));

    // Height: flat while swimming, a sine hump while airborne. Using sine
    // rather than a parabola keeps the exit and entry angles shallow, which
    // looks like a breach instead of a mortar shell.
    const arcStart = d.approachM;
    const arcEnd = d.approachM + d.arcLengthM;
    let y = d.swimY;
    let climbRate = 0;

    if (travelled >= arcStart && travelled <= arcEnd) {
      const u = (travelled - arcStart) / d.arcLengthM;   // 0..1 through the arc
      y = d.swimY + Math.sin(u * Math.PI) * d.apexHeight;
      climbRate = Math.cos(u * Math.PI) * Math.PI * d.apexHeight / d.arcLengthM;

      if (!this.firedExit) {
        this.firedExit = true;
        this.el.emit('shark-breach-exit', { position: pos.clone().setY(d.swimY) });
      }
    } else if (travelled > arcEnd && !this.firedEntry) {
      this.firedEntry = true;
      const landing = this.startOffset.clone().add(this.dir.clone().multiplyScalar(arcEnd));
      this.el.emit('shark-breach-entry', { position: landing.setY(d.swimY) });
    }

    obj.position.copy(pos.setY(y));

    // Nose follows the velocity vector. A +Z-forward model pitches nose-up on
    // negative X rotation, hence the sign.
    obj.rotation.y = Math.atan2(this.dir.x, this.dir.z) + d.yawOffset * DEG;
    obj.rotation.x = -Math.atan2(climbRate, 1);
    // Roll a little at the top so the breach isn't perfectly rigid.
    obj.rotation.z = Math.sin(this.t * 1.6) * 4 * DEG;
  }
});
