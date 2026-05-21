AFRAME.registerComponent('net-material', {
  schema: {
    width:         { type: 'number', default: 3.0 },
    height:        { type: 'number', default: 1.5 },
    segW:          { type: 'number', default: 20 },
    segH:          { type: 'number', default: 10 },
    hitDurationMs: { type: 'number', default: 800 }
  },

  init: function () {
    const d = this.data;

    const vertexShader = `
// isPerspectiveMatrix is normally in <common>; define it here so the
// logdepthbuf chunks compile without needing the full <common> include.
bool isPerspectiveMatrix(mat4 m) { return m[2][3] == -1.0; }

#include <logdepthbuf_pars_vertex>

uniform vec2  uHitUV;
uniform float uHitAge;
uniform float uHitActive;
uniform float uAspect;
varying vec2  vUv;

void main() {
  vUv = uv;
  vec3 displaced = position;

  if (uHitActive > 0.5) {
    vec2 delta = uv - uHitUV;
    delta.x *= uAspect;
    float dist = length(delta);
    float d1 = 1.0 - uHitAge;
    float eased = 1.0 - d1 * d1;

    float bulge = exp(-dist * dist * 18.0) * 0.18 * (1.0 - eased);

    float waveFront = eased * 1.6;
    float waveEnv   = max(0.0, 1.0 - abs(dist - waveFront) / 0.25);
    float ripple    = sin(dist * 25.0 - uHitAge * 14.0) * 0.07 * waveEnv
                      * clamp((1.0 - eased) * 0.5 + 0.5 * (1.0 - dist), 0.0, 1.0);

    displaced.z -= (bulge + ripple);
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  #include <logdepthbuf_vertex>
}`;

    const fragmentShader = `
#include <logdepthbuf_pars_fragment>

uniform vec2  uGridCount;
uniform float uLineWidth;
uniform vec3  uNetColor;
uniform float uHitAge;
uniform float uHitActive;
uniform vec2  uHitUV;
uniform float uAspect;
varying vec2  vUv;

void main() {
  vec2 cellUV   = fract(vUv * uGridCount);
  vec2 edgeDist = min(cellUV, 1.0 - cellUV);

  // Fixed-width soft edge — no fwidth/derivatives needed
  float aa = 0.008;
  vec2 lineMask = smoothstep(vec2(uLineWidth - aa), vec2(uLineWidth + aa), edgeDist);
  float onLine = 1.0 - lineMask.x * lineMask.y;

  if (onLine < 0.01) discard;

  vec3  color = uNetColor;
  float alpha = 0.75 * onLine;

  if (uHitActive > 0.5) {
    vec2  dv = vUv - uHitUV;
    dv.x *= uAspect;
    float flash = exp(-length(dv) * 4.0) * (1.0 - uHitAge);
    color = mix(color, vec3(0.85, 1.0, 1.0), flash * 0.85);
    alpha = clamp(alpha + flash * 0.45, 0.0, 1.0) * onLine;
  }

  gl_FragColor = vec4(color, alpha);
  #include <logdepthbuf_fragment>
}`;

    const uniforms = {
      uHitUV:     { value: new THREE.Vector2(0.5, 0.5) },
      uHitAge:    { value: 0.0 },
      uHitActive: { value: 0.0 },
      uNetColor:  { value: new THREE.Color(0.4, 0.8, 1.0) },
      uLineWidth: { value: 0.08 },
      uGridCount: { value: new THREE.Vector2(10.0, 5.0) },
      uAspect:    { value: d.width / d.height }
    };

    const geometry = new THREE.PlaneGeometry(d.width, d.height, d.segW, d.segH);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, d.height / 2, -0.35);
    this.el.object3D.add(this.mesh);

    this.material = material;
    this.hitActive = false;
    this.hitStartTime = 0;
  },

  tick: function (time) {
    if (this.hitActive) {
      const age = (time - this.hitStartTime) / this.data.hitDurationMs;
      if (age >= 1.0) {
        this.hitActive = false;
        this.material.uniforms.uHitAge.value = 0.0;
        this.material.uniforms.uHitActive.value = 0.0;
      } else {
        this.material.uniforms.uHitAge.value = age;
      }
    }
  },

  triggerHit: function (u, v) {
    this.hitActive = true;
    this.hitStartTime = performance.now();
    this.material.uniforms.uHitUV.value.set(u, v);
    this.material.uniforms.uHitActive.value = 1.0;
    this.material.uniforms.uHitAge.value = 0.0;
  },

  remove: function () {
    if (this.mesh) {
      this.el.object3D.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
});
