// Pooled point-sprite particle system (engine exhaust, surface dust, explosions).
import * as THREE from 'three';

const VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize; attribute vec4 aColor;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(512.0, aSize * uScale / max(0.2, -mv.z));
  #include <logdepthbuf_vertex>
}`;
const FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vColor;
void main() {
  #include <logdepthbuf_fragment>
  float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

export class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.cursor = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max); this.size1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
    this.aSize = new Float32Array(max); this.aColor = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.aColor, 4));
    this.uniforms = { uScale: { value: 800 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1) {
    const i = this.cursor; this.cursor = (i + 1) % this.max;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size0[i] = s0; this.size1[i] = s1;
    this.c0.set(c0, i * 4); this.c1.set(c1, i * 4);
  }

  update(dt, drag = 0) {
    const { p, v, life, maxLife, aSize, aColor, c0, c1 } = this;
    const k = Math.max(0, 1 - drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { aSize[i] = 0; continue; }
      life[i] -= dt;
      v[i * 3] *= k; v[i * 3 + 1] *= k; v[i * 3 + 2] *= k;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      const t = 1 - Math.max(0, life[i]) / maxLife[i];
      aSize[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      for (let c = 0; c < 4; c++) aColor[i * 4 + c] = c0[i * 4 + c] + (c1[i * 4 + c] - c0[i * 4 + c]) * t;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true; a.aSize.needsUpdate = true; a.aColor.needsUpdate = true;
  }

  clear() { this.life.fill(0); }
}
