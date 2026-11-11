// Background starfield, the star itself and the asteroid belts.
import * as THREE from 'three';
import { mulberry } from '../world/noise.js';
import { makeGlowTexture } from './textures.js';

export class Starfield {
  constructor(count) {
    this.group = new THREE.Group();
    const rnd = mulberry(1234);
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.0, 0.3, 0.4));
    const make = (n, size, bright) => {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        v.set(s * Math.cos(a), u, s * Math.sin(a));
        if (rnd() < 0.4) { v.y *= 0.18; v.normalize().applyQuaternion(tilt); } // galactic band
        pos.set([v.x * 1000, v.y * 1000, v.z * 1000], i * 3);
        const temp = rnd(), m = bright * (0.25 + 0.75 * Math.pow(rnd(), 2.5));
        col.set([m * (0.75 + 0.25 * temp), m * 0.85, m * (1 - 0.3 * temp)], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false; p.renderOrder = -10;
      this.group.add(p);
      return m;
    };
    this.mats = [make(count, 1.4, 0.9), make(Math.floor(count / 12), 2.6, 1.0)];
  }
  // Stars fade out in a bright daytime sky.
  setBrightness(k) { for (const m of this.mats) m.color.setScalar(k); }
}

const STAR_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime, uBoost;
varying vec3 vObj; varying vec3 vN;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vObj);
  float n = 0.55 * vnoise(p * 9.0 + uTime * 0.03) + 0.3 * vnoise(p * 28.0 - uTime * 0.05) + 0.15 * vnoise(p * 90.0 + uTime * 0.08);
  float spots = smoothstep(0.62, 0.7, vnoise(p * 4.0 + 11.0)) * smoothstep(0.5, 0.2, abs(p.y));
  float limb = pow(max(normalize(vN).z, 0.0), 0.5);
  vec3 c = mix(vec3(1.0, 0.5, 0.16), vec3(1.0, 0.95, 0.8), n) * (0.45 + 0.9 * limb) * (1.0 - 0.7 * spots);
  gl_FragColor = vec4(c * uBoost, 1.0);
}`;
const STAR_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj; varying vec3 vN;
void main() {
  vObj = position; vN = normalMatrix * normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

export class StarView {
  constructor(body) {
    this.body = body;
    this.group = new THREE.Group();
    this.uniforms = { uTime: { value: 0 }, uBoost: { value: 1.6 } };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 64, 48),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG }));
    this.group.add(this.mesh);
    const tex = makeGlowTexture(128, 2.4);
    const sprite = (scale, color, opacity) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false }));
      s.scale.setScalar(body.radius * scale);
      this.group.add(s);
      return s;
    };
    this.corona = sprite(7, 0xffc890, 0.9);
    this.halo = sprite(34, 0xff9a50, 0.28);
  }
  sync(origin, t, storm) {
    this.group.position.subVectors(this.body.pos, origin);
    this.uniforms.uTime.value = t * 0.002;
    const k = storm ? 1.5 + 0.2 * Math.sin(performance.now() * 0.006) : 1;
    this.corona.scale.setScalar(this.body.radius * 7 * k);
    this.corona.material.color.setHex(storm ? 0xffa0c0 : 0xffc890);
  }
}

// Asteroid belt: thousands of small bodies on individual circular Kepler orbits, drawn as points.
export class BeltView {
  constructor(def, star, seed) {
    this.def = def; this.star = star;
    const n = def.count, rnd = mulberry(seed);
    this.a = new Float32Array(n); this.ph = new Float32Array(n); this.y = new Float32Array(n); this.w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = def.inner + (def.outer - def.inner) * (0.5 + (rnd() + rnd() + rnd() - 1.5) / 3 * 1.6);
      this.a[i] = a; this.ph[i] = rnd() * Math.PI * 2;
      this.y[i] = (rnd() + rnd() - 1) * def.thickness;
      this.w[i] = Math.sqrt(star.mu / (a * a * a));
    }
    this.pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: new THREE.Color(...def.color), transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
    this.points.frustumCulled = false;
    this.frame = 0;
  }
  sync(origin, t, everyFrame) {
    this.points.position.subVectors(this.star.pos, origin);
    if (!everyFrame && this.frame++ % 30) return;
    const n = this.a.length, p = this.pos;
    for (let i = 0; i < n; i++) {
      const ang = this.ph[i] + this.w[i] * t, a = this.a[i];
      p[i * 3] = Math.cos(ang) * a; p[i * 3 + 1] = this.y[i]; p[i * 3 + 2] = -Math.sin(ang) * a;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
