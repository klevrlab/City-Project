AFRAME.registerComponent('soccer-ball-material', {
  init: function () {
    this._mat = this._buildMaterial();
    const apply = () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;
      mesh.traverse(child => { if (child.isMesh) child.material = this._mat; });
    };
    apply();
    this.el.addEventListener('object3dset', apply);
  },

  _buildMaterial: function () {
    const vertexShader = `
bool isPerspectiveMatrix(mat4 m) { return m[2][3] == -1.0; }
#include <logdepthbuf_pars_vertex>

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vWorldPos    = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

    const fragmentShader = `
#include <logdepthbuf_pars_fragment>

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vWorldNormal);

  // 12 icosahedron vertex directions = pentagon centers on a soccer ball
  // s = 1/sqrt(1+phi^2), t = phi/sqrt(1+phi^2)
  const float s = 0.52573111;
  const float t = 0.85065081;

  float d0  = dot(n, vec3( 0.0,  s,  t));
  float d1  = dot(n, vec3( 0.0,  s, -t));
  float d2  = dot(n, vec3( 0.0, -s,  t));
  float d3  = dot(n, vec3( 0.0, -s, -t));
  float d4  = dot(n, vec3( s,  t,  0.0));
  float d5  = dot(n, vec3( s, -t,  0.0));
  float d6  = dot(n, vec3(-s,  t,  0.0));
  float d7  = dot(n, vec3(-s, -t,  0.0));
  float d8  = dot(n, vec3( t,  0.0,  s));
  float d9  = dot(n, vec3( t,  0.0, -s));
  float d10 = dot(n, vec3(-t,  0.0,  s));
  float d11 = dot(n, vec3(-t,  0.0, -s));

  // Best (nearest pentagon) dot
  float md = max(d0,  max(d1,  max(d2,  max(d3,  max(d4,  max(d5,
             max(d6,  max(d7,  max(d8,  max(d9,  max(d10, d11)))))))))));

  // Second-best dot — mask out the winner
  float e0  = (d0  < md - 0.001) ? d0  : -2.0;
  float e1  = (d1  < md - 0.001) ? d1  : -2.0;
  float e2  = (d2  < md - 0.001) ? d2  : -2.0;
  float e3  = (d3  < md - 0.001) ? d3  : -2.0;
  float e4  = (d4  < md - 0.001) ? d4  : -2.0;
  float e5  = (d5  < md - 0.001) ? d5  : -2.0;
  float e6  = (d6  < md - 0.001) ? d6  : -2.0;
  float e7  = (d7  < md - 0.001) ? d7  : -2.0;
  float e8  = (d8  < md - 0.001) ? d8  : -2.0;
  float e9  = (d9  < md - 0.001) ? d9  : -2.0;
  float e10 = (d10 < md - 0.001) ? d10 : -2.0;
  float e11 = (d11 < md - 0.001) ? d11 : -2.0;

  float sd = max(e0,  max(e1,  max(e2,  max(e3,  max(e4,  max(e5,
             max(e6,  max(e7,  max(e8,  max(e9,  max(e10, e11)))))))))));

  // Pentagon patch (black)
  float pentagon = smoothstep(0.82, 0.90, md);

  // Seam lines: two Voronoi regions nearly equidistant (Voronoi boundary)
  float seamDiff = md - sd;
  float seam = (1.0 - smoothstep(0.0, 0.065, seamDiff)) * smoothstep(0.44, 0.56, md);

  float darkness = max(pentagon, seam * 0.88);
  vec3 ballColor = mix(vec3(0.96, 0.97, 0.99), vec3(0.04, 0.04, 0.06), darkness);

  // Diffuse + specular lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diff = max(dot(n, lightDir), 0.0) * 0.55 + 0.45;
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(n, halfVec), 0.0), 28.0) * 0.35;

  vec3 finalColor = ballColor * diff + vec3(spec);

  gl_FragColor = vec4(finalColor, 1.0);
  #include <logdepthbuf_fragment>
}`;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.FrontSide
    });
  },

  remove: function () {
    if (this._mat) { this._mat.dispose(); this._mat = null; }
  }
});
