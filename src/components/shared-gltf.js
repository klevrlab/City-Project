/**
 * shared-gltf — load a GLB once, then share it across every instance.
 *
 * Measured on the Little Italy corridor before this existed: 8 statues produced
 * 12 meshes with 12 *unique* geometries and 36 unique textures totalling 264
 * megapixels — roughly 1.34 GB of texture memory once uploaded with mipmaps.
 * That is what was killing older phones; Safari discards a tab well below it.
 *
 * Two causes, both fixed here:
 *
 * 1. A-Frame's `gltf-model` re-parses the file per entity, so four Augustus
 *    statues meant four independent copies of the same geometry and textures.
 *    This component parses once per src and hands out `THREE.Object3D.clone()`s,
 *    which share the underlying geometry and material references.
 *
 * 2. The source art carries print-resolution textures. `maxTexture` downsamples
 *    each map once, on the shared master, before any clone exists — so every
 *    instance gets the smaller version. 1024 px is far more than a 2.5 m statue
 *    needs on a phone screen.
 *
 * Only safe for models without skeletal animation: a plain clone shares the
 * skeleton, so animated sharks keep using `gltf-model`.
 */

const cache = new Map();          // key -> Promise<THREE.Object3D>
const mirrorCache = new Map();    // key -> THREE.Object3D (double-sided master)

/**
 * A master whose materials are double-sided, for instances that get a negative
 * scale. Mirroring reverses triangle winding, so with normal back-face culling
 * you end up looking at the inside of the model. Materials are cloned (which
 * still shares the textures) so the un-mirrored instances keep culling.
 */
function mirroredMaster(master, key) {
  if (mirrorCache.has(key)) return mirrorCache.get(key);
  const copy = master.clone(true);
  const swapped = new Map();
  const swap = (mat) => {
    if (swapped.has(mat.uuid)) return swapped.get(mat.uuid);
    const clone = mat.clone();
    clone.side = THREE.DoubleSide;
    swapped.set(mat.uuid, clone);
    return clone;
  };
  copy.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  mirrorCache.set(key, copy);
  return copy;
}

function loadOnce(src, maxTexture) {
  const key = `${src}|${maxTexture}`;
  if (cache.has(key)) return cache.get(key);

  const p = new Promise((resolve, reject) => {
    const loader = new THREE.GLTFLoader();
    loader.load(src, (gltf) => {
      const master = gltf.scene || gltf.scenes[0];
      if (maxTexture > 0) shrinkTextures(master, maxTexture);
      resolve(master);
    }, undefined, reject);
  });

  cache.set(key, p);
  return p;
}

/** Redraw every oversized map at maxSize, in place, once. */
function shrinkTextures(root, maxSize) {
  const done = new Set();
  const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
    'emissiveMap', 'specularMap'];

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((mat) => {
      maps.forEach((slot) => {
        const tex = mat[slot];
        if (!tex || done.has(tex.uuid)) return;
        done.add(tex.uuid);

        const img = tex.image;
        // Compressed formats (KTX2/Basis) have no drawable image — leave them.
        if (!img || !img.width || !img.height) return;
        const longest = Math.max(img.width, img.height);
        if (longest <= maxSize) return;

        const scale = maxSize / longest;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        try {
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch (e) {
          console.warn('[shared-gltf] could not downscale a texture', e);
          return;
        }

        tex.image = canvas;
        tex.needsUpdate = true;
        // Free the full-resolution decode where the browser allows it.
        if (typeof img.close === 'function') { try { img.close(); } catch (e) { /* ignore */ } }
      });
    });
  });
}

AFRAME.registerComponent('shared-gltf', {
  schema: {
    src: { type: 'string' },
    maxTexture: { type: 'number', default: 1024 },
    // Flip on local X. A statue with only one variant points its arm the same
    // way on both sides of a street, so one row needs mirroring to point the
    // same real-world direction as the other.
    mirrorX: { type: 'boolean', default: false }
  },

  init: function () {
    const raw = this.data.src;
    if (!raw) return;

    // Accept "#asset-id" the way gltf-model does, as well as a plain path.
    let src = raw;
    if (raw.charAt(0) === '#') {
      const asset = document.querySelector(raw);
      src = asset ? (asset.getAttribute('src') || asset.src) : raw;
    }

    loadOnce(src, this.data.maxTexture).then((master) => {
      if (!this.el.parentNode) return;   // removed while loading
      const source = this.data.mirrorX
        ? mirroredMaster(master, `${src}|${this.data.maxTexture}`)
        : master;
      const instance = source.clone(true);
      if (this.data.mirrorX) instance.scale.x *= -1;
      this.el.setObject3D('mesh', instance);
      // Same event gltf-model fires, so model-normalize and the debug panel
      // keep working unchanged.
      this.el.emit('model-loaded', { format: 'gltf', model: instance });
    }).catch((err) => {
      console.error('[shared-gltf] failed to load', src, err);
      this.el.emit('model-error', { format: 'gltf', src: src });
    });
  },

  remove: function () {
    // Only drop the instance — geometry and materials belong to the master.
    if (this.el.getObject3D('mesh')) this.el.removeObject3D('mesh');
  }
});

/**
 * Hide content past a distance. The statue row spans ~70 m of street, and
 * rendering the far half costs full price for a few pixels.
 */
AFRAME.registerComponent('cull-distance', {
  schema: {
    max: { type: 'number', default: 45 },
    interval: { type: 'number', default: 400 }
  },

  init: function () {
    this.lastCheck = 0;
    this.camEl = document.getElementById('camera');
  },

  tick: function (time) {
    if (time - this.lastCheck < this.data.interval) return;
    this.lastCheck = time;
    if (!this.camEl || !this.camEl.object3D) return;

    const here = this.el.object3D.getWorldPosition(new THREE.Vector3());
    const cam = this.camEl.object3D.getWorldPosition(new THREE.Vector3());
    here.y = cam.y = 0;
    this.el.object3D.visible = here.distanceTo(cam) <= this.data.max;
  }
});
