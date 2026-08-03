/**
 * Placement overrides — persistent transform tweaks for AR content.
 *
 * Every piece of placed content (statue, tower, dancer, circle pivot…) is
 * tagged with a stable `data-placement-key`. Debug mode moves the entity in
 * world space, saves its *local* transform under that key, and every later
 * spawn re-applies it.
 *
 * Local, not world, is the important part: statues and the tower are planted
 * relative to the camera when the geofence fires, so an absolute world
 * position means nothing on the next visit. Each group is planted under a root
 * entity that carries the anchor pose, so a child's local transform is exactly
 * the tunable layout (right/up/forward metres from the anchor).
 *
 * Two layers, localStorage wins:
 *   1. data/placement-overrides.json — checked-in baseline (may not exist)
 *   2. localStorage['sharksway.placement'] — this device's unsaved tuning
 *
 * Export from the debug panel and commit the JSON to promote 2 → 1.
 */

const LS_KEY = 'sharksway.placement';
const BASELINE_URL = './data/placement-overrides.json';

const store = {
  baseline: {},
  local: {},
  baselineLoaded: false
};

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    store.local = raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[placement] localStorage unreadable', e);
    store.local = {};
  }
}

function writeLocal() {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(store.local));
  } catch (e) {
    console.warn('[placement] localStorage write failed', e);
  }
}

function vec(v, fallback) {
  if (!v) return fallback ? { ...fallback } : null;
  return {
    x: typeof v.x === 'number' ? v.x : (fallback ? fallback.x : 0),
    y: typeof v.y === 'number' ? v.y : (fallback ? fallback.y : 0),
    z: typeof v.z === 'number' ? v.z : (fallback ? fallback.z : 0)
  };
}

const PlacementOverrides = {
  /** Raw override record for a key (local layer over baseline), or null. */
  get(key) {
    const b = store.baseline[key];
    const l = store.local[key];
    if (!b && !l) return null;
    return {
      position: vec(l && l.position, b && b.position ? vec(b.position) : null),
      rotation: vec(l && l.rotation, b && b.rotation ? vec(b.rotation) : null),
      scale: vec(l && l.scale, b && b.scale ? vec(b.scale) : null)
    };
  },

  /** True when this device has an unexported tweak for the key. */
  isDirty(key) {
    return Object.prototype.hasOwnProperty.call(store.local, key);
  },

  dirtyKeys() {
    return Object.keys(store.local);
  },

  allKeys() {
    return Array.from(new Set([...Object.keys(store.baseline), ...Object.keys(store.local)]));
  },

  /** Save an entity's current local transform under its key. */
  saveFromEntity(key, el) {
    if (!el || !el.object3D) return null;
    const o = el.object3D;
    const rec = {
      position: { x: round(o.position.x), y: round(o.position.y), z: round(o.position.z) },
      rotation: {
        x: round(THREE.MathUtils.radToDeg(o.rotation.x), 2),
        y: round(THREE.MathUtils.radToDeg(o.rotation.y), 2),
        z: round(THREE.MathUtils.radToDeg(o.rotation.z), 2)
      },
      scale: { x: round(o.scale.x, 4), y: round(o.scale.y, 4), z: round(o.scale.z, 4) }
    };
    store.local[key] = rec;
    writeLocal();
    return rec;
  },

  set(key, rec) {
    store.local[key] = rec;
    writeLocal();
  },

  /** Drop this device's tweak for one key (baseline still applies). */
  clear(key) {
    delete store.local[key];
    writeLocal();
  },

  clearAll() {
    store.local = {};
    writeLocal();
  },

  /**
   * Apply defaults then any override to `el`, and tag it with the key so the
   * debug panel and `reapplyAll()` can find it later.
   *
   * `defaults` uses A-Frame attribute strings or {x,y,z} objects.
   */
  apply(el, key, defaults) {
    el.setAttribute('data-placement-key', key);
    const d = defaults || {};
    const ov = this.get(key) || {};

    const pos = ov.position || toVec(d.position);
    const rot = ov.rotation || toVec(d.rotation);
    const scl = ov.scale || toVec(d.scale);

    if (pos) el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    if (rot) el.setAttribute('rotation', `${rot.x} ${rot.y} ${rot.z}`);
    if (scl) el.setAttribute('scale', `${scl.x} ${scl.y} ${scl.z}`);
    return el;
  },

  /** Re-apply overrides to everything already in the scene (baseline arrives async). */
  reapplyAll() {
    document.querySelectorAll('[data-placement-key]').forEach((el) => {
      const key = el.getAttribute('data-placement-key');
      const ov = this.get(key);
      if (!ov) return;
      if (ov.position) el.setAttribute('position', `${ov.position.x} ${ov.position.y} ${ov.position.z}`);
      if (ov.rotation) el.setAttribute('rotation', `${ov.rotation.x} ${ov.rotation.y} ${ov.rotation.z}`);
      if (ov.scale) el.setAttribute('scale', `${ov.scale.x} ${ov.scale.y} ${ov.scale.z}`);
    });
  },

  /** Merged baseline+local, ready to be written to data/placement-overrides.json. */
  toJSON() {
    const out = {};
    this.allKeys().forEach((k) => { out[k] = this.get(k); });
    return JSON.stringify(out, null, 2);
  },

  download(filename) {
    const blob = new Blob([this.toJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'placement-overrides.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  },

  async copyToClipboard() {
    const text = this.toJSON();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }
};

function toVec(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const [x, y, z] = v.trim().split(/\s+/).map(Number);
    return { x: x || 0, y: y || 0, z: z || 0 };
  }
  return vec(v, { x: 0, y: 0, z: 0 });
}

function round(n, places) {
  const p = Math.pow(10, typeof places === 'number' ? places : 3);
  return Math.round(n * p) / p;
}

readLocal();

// Baseline is optional — a 404 just means nothing has been committed yet.
fetch(BASELINE_URL, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((json) => {
    if (json && typeof json === 'object') {
      store.baseline = json;
      PlacementOverrides.reapplyAll();
    }
  })
  .catch(() => { /* no baseline file — fine */ })
  .finally(() => { store.baselineLoaded = true; });

window.PlacementOverrides = PlacementOverrides;
export default PlacementOverrides;
