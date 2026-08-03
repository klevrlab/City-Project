/**
 * Geo anchoring — place content at real coordinates instead of "in front of you".
 *
 * GPS gives position but not facing. To convert a lat/lng into a scene position
 * you need to know which way in the scene is north, and that requires a compass:
 *
 *   scene yaw of north = camera's scene yaw + compass bearing the camera faces
 *
 * Once that's known, any pin becomes east/north metres from the user (local
 * tangent plane — equirectangular is accurate to millimetres over a few hundred
 * metres) and drops straight into the scene.
 *
 * Error budget, honestly: downtown GPS runs ±5–15 m with multipath off the
 * buildings, and a phone magnetometer ±10–20° (worse near steel and traffic).
 * At 30 m, 15° of heading error is ~8 m sideways. So geo placement wins for
 * "this statue belongs on that corner" and loses for "this shark should be
 * exactly 3 m in front of you" — which is why the swim-throughs stay
 * camera-relative and only the fixed landmarks go geo.
 *
 * calibrate() exists because the corridor bearing is known (the statue pin line
 * runs it): stand facing down Sharks Way toward SAP, tap once, and the compass
 * is replaced by a value that is right by construction.
 */

const DEG = Math.PI / 180;
const EARTH_R = 6378137;

const state = {
  heading: null,          // degrees clockwise from true north, camera facing
  headingSource: 'none',  // 'compass-ios' | 'compass-abs' | 'calibrated' | 'none'
  headingAt: 0,
  accuracy: null,
  listening: false,
  smoothed: null,
  samples: 0
};

/** Bearing along Sharks Way from the statue pin line, pin 1 → pin 4 (toward SAP). */
export const CORRIDOR_BEARING_TO_SAP = bearingDeg(37.335397, -121.897650, 37.335430, -121.896874);

function bearingDeg(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δλ = (lng2 - lng1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Metres east/north of (lat, lng) from (originLat, originLng). */
function enu(lat, lng, originLat, originLng) {
  const east = (lng - originLng) * DEG * EARTH_R * Math.cos(originLat * DEG);
  const north = (lat - originLat) * DEG * EARTH_R;
  return { east, north };
}

function smooth(next) {
  if (state.smoothed == null) {
    state.smoothed = next;
    return next;
  }
  // Circular low-pass so 359° → 1° doesn't swing the world around.
  const delta = ((next - state.smoothed + 540) % 360) - 180;
  state.smoothed = (state.smoothed + delta * 0.25 + 360) % 360;
  return state.smoothed;
}

function onOrientation(e) {
  let heading = null;
  let source = null;

  if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
    heading = e.webkitCompassHeading;         // iOS: already clockwise from north
    source = 'compass-ios';
    state.accuracy = typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null;
  } else if (e.absolute && typeof e.alpha === 'number') {
    heading = (360 - e.alpha) % 360;          // Android absolute
    source = 'compass-abs';
  }
  if (heading == null) return;

  // A manual calibration is trusted over the magnetometer.
  if (state.headingSource === 'calibrated') return;

  state.heading = smooth(heading);
  state.headingSource = source;
  state.headingAt = performance.now();
  state.samples++;
}

const GeoAnchor = {
  CORRIDOR_BEARING_TO_SAP,
  enu,
  bearingDeg,

  get heading() { return state.heading; },
  get headingSource() { return state.headingSource; },
  get accuracy() { return state.accuracy; },
  get ready() { return state.heading != null; },
  get samples() { return state.samples; },

  /**
   * The first magnetometer samples are junk and the low-pass needs a few
   * readings to settle, so placing on sample one puts the corridor at a random
   * angle. A hand calibration is trusted immediately.
   */
  get stable() {
    return state.headingSource === 'calibrated' || (state.heading != null && state.samples >= 6);
  },

  /** iOS needs a user gesture; call this from a button handler. */
  async requestPermission() {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return false;
      } catch (e) {
        console.warn('[geo-anchor] orientation permission refused', e);
        return false;
      }
    }
    this.listen();
    return true;
  },

  listen() {
    if (state.listening) return;
    state.listening = true;
    window.addEventListener('deviceorientationabsolute', onOrientation, true);
    window.addEventListener('deviceorientation', onOrientation, true);
  },

  /**
   * Pin the heading by hand: the user is facing `bearing` (default: down the
   * corridor toward SAP) right now. Removes magnetometer error entirely.
   */
  calibrate(bearing) {
    state.heading = typeof bearing === 'number' ? bearing : CORRIDOR_BEARING_TO_SAP;
    state.smoothed = state.heading;
    state.samples = 99;
    state.headingSource = 'calibrated';
    state.headingAt = performance.now();
    return state.heading;
  },

  clearCalibration() {
    state.headingSource = state.listening ? 'compass-abs' : 'none';
    state.smoothed = null;
  },

  /** Scene yaw (degrees) whose −Z axis points true north. */
  northYawDeg(cameraEl) {
    if (state.heading == null || !cameraEl) return null;
    const fwd = window.MathUtils.cameraForward(cameraEl);
    const camYaw = Math.atan2(-fwd.x, -fwd.z) / DEG;
    // Scene yaw runs counter-clockwise, compass bearings clockwise, so bearing
    // β of a scene yaw Y is β = heading − (Y − camYaw). Solving β = 0 for north:
    return camYaw + state.heading;
  },

  /**
   * Local offset, in metres, of a pin from the user's fix, expressed in a frame
   * whose −Z is north and +X is east — i.e. drop-in child coordinates for a root
   * yawed to northYawDeg().
   */
  localOffset(pinLat, pinLng, userLat, userLng) {
    const { east, north } = enu(pinLat, pinLng, userLat, userLng);
    return { x: east, y: 0, z: -north, distance: Math.hypot(east, north) };
  }
};

window.GeoAnchor = GeoAnchor;
export default GeoAnchor;
