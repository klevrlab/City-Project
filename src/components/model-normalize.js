/**
 * model-normalize — size a GLB in real-world metres instead of guessed scale factors.
 *
 * The GLBs in this repo come from wildly different sources and have no shared
 * unit convention. Measured with debug mode (`?debug=1`, MODELS tab):
 *
 *   Athena_Statue-point-left/right.glb   102 × 206 × 67 m   (!)
 *   Augustus_of_Prima_Porta.glb          0.53 × 1.02 × 0.44 m
 *   Leaning_Tower_of_Pisa.glb            23.6 × 47.5 × 23.5 m
 *   sharkie_final_pose.glb               1.08 × 1.95 × 2.27 m, floating 1.01 m up
 *   sammy_final_pose.glb                 1.68 × 2.96 × 2.67 m, floating 0.42 m up
 *
 * A hand-tuned `scale="1.1 1.1 1.1"` therefore means something different for
 * every asset, and breaks the moment an artist re-exports. This component
 * measures the model on load and scales it to a stated height (or longest
 * dimension), then drops it onto the ground plane.
 *
 *   model-normalize="height: 2.5"     → 2.5 m tall, feet at y=0
 *   model-normalize="maxDim: 3"       → longest axis 3 m (for long, low things
 *                                       like sharks, where height is the wrong
 *                                       axis to pin)
 *   model-normalize="height: 2.5; ground: false"  → size only, keep the pivot
 *
 * Scaling is applied to the *mesh*, not the entity, so an entity's own
 * position/rotation/scale — and anything debug mode saves into
 * data/placement-overrides.json — stack on top of the normalized size rather
 * than being overwritten by it.
 */
AFRAME.registerComponent('model-normalize', {
  schema: {
    height: { type: 'number', default: 0 },
    maxDim: { type: 'number', default: 0 },
    ground: { type: 'boolean', default: true }
  },

  init: function () {
    this.applied = false;
    const run = () => this.normalize();
    if (this.el.getObject3D('mesh')) run();
    this.el.addEventListener('model-loaded', run);
  },

  update: function () {
    // Re-normalize when height/maxDim is changed live (debug tweaks).
    this.applied = false;
    if (this.el.getObject3D('mesh')) this.normalize();
  },

  normalize: function () {
    if (this.applied) return;
    const mesh = this.el.getObject3D('mesh');
    if (!mesh) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (!isFinite(size.y) || size.y <= 0) return;

    let factor = 1;
    if (this.data.height > 0) {
      factor = this.data.height / size.y;
    } else if (this.data.maxDim > 0) {
      factor = this.data.maxDim / Math.max(size.x, size.y, size.z);
    }

    if (factor !== 1) mesh.scale.multiplyScalar(factor);

    if (this.data.ground) {
      mesh.updateMatrixWorld(true);
      const grounded = new THREE.Box3().setFromObject(mesh);
      // setFromObject is in world space; convert the lift into mesh-parent units.
      const worldScale = this.el.object3D.getWorldScale(new THREE.Vector3());
      const lift = grounded.min.y / (worldScale.y || 1);
      mesh.position.y -= lift;
    }

    this.applied = true;
    this.el.emit('model-normalized', { factor });
  }
});
