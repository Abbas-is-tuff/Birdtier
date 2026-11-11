// Orbital-scale rendering of one body: displaced globe with procedurally generated textures
// (two levels of detail, generated asynchronously), atmosphere shell, cloud layer and rings.
import * as THREE from 'three';
import { Noise, smoothstep as ss } from '../world/noise.js';
import { dataTex } from './textures.js';

const _o = { r: 0, g: 0, b: 0, rough: 1, emis: 0 };
const to8 = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0);

// Sphere with u = longitude (eastward), v = latitude; optionally displaced by a height function.
export function buildSphereGeometry(R, segW, segH, hFn) {
  const nv = (segW + 1) * (segH + 1);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  let k = 0;
  for (let j = 0; j <= segH; j++) {
    const v = j / segH, lat = -Math.PI / 2 + v * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i <= segW; i++, k++) {
      const u = i / segW, lon = u * Math.PI * 2;
      const dx = cl * Math.cos(lon), dy = sl, dz = -cl * Math.sin(lon);
      const r = R + (hFn ? hFn(dx, dy, dz) : 0);
      pos[k * 3] = dx * r; pos[k * 3 + 1] = dy * r; pos[k * 3 + 2] = dz * r;
      nor[k * 3] = dx; nor[k * 3 + 1] = dy; nor[k * 3 + 2] = dz;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
    }
  }
  const idx = new Uint32Array(segW * segH * 6);
  let n = 0;
  for (let j = 0; j < segH; j++) for (let i = 0; i < segW; i++) {
    const a = j * (segW + 1) + i, b = a + 1, c = a + segW + 1, d = c + 1;
    idx[n++] = a; idx[n++] = b; idx[n++] = d; idx[n++] = a; idx[n++] = d; idx[n++] = c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Time-sliced texture bake (a generator so the asset queue can spread it over many frames).
export function* genTextures(body, W, H) {
  const T = body.terrain, gas = T.type === 'gas', R = body.radius;
  const col = new Uint8Array(W * H * 4), hts = gas ? null : new Float32Array(W * H);
  const rough = T.sea ? new Uint8Array(W * H * 4) : null;
  const emis = T.type === 'volcanic' ? new Uint8Array(W * H * 4) : null;
  const oct = W >= 1024 ? 7 : 6;
  const soft = 60 * (2048 / W); // coastline blend band, wider for coarser textures
  for (let j = 0; j < H; j++) {
    const lat = -Math.PI / 2 + ((j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * Math.PI * 2;
      const dx = cl * Math.cos(lon), dz = -cl * Math.sin(lon);
      const h = T.height(dx, sl, dz, oct);
      T.sample(dx, sl, dz, h, _o, soft);
      const k = (j * W + i) * 4;
      col[k] = to8(_o.r); col[k + 1] = to8(_o.g); col[k + 2] = to8(_o.b); col[k + 3] = 255;
      if (hts) hts[j * W + i] = T.sea && h < 0 ? 0 : h;
      if (rough) { rough[k + 1] = to8(_o.rough); rough[k + 3] = 255; }
      if (emis) { const e = _o.emis; emis[k] = to8(_o.r * e); emis[k + 1] = to8(_o.g * e); emis[k + 2] = to8(_o.b * e); emis[k + 3] = 255; }
    }
    if ((j & 3) === 3) yield;
  }
  let nrm = null;
  if (hts) {
    nrm = new Uint8Array(W * H * 4);
    const K = 3; // relief exaggeration so terrain reads from orbit
    for (let j = 0; j < H; j++) {
      const lat = -Math.PI / 2 + ((j + 0.5) / H) * Math.PI;
      const dxm = (R * Math.max(0.05, Math.cos(lat)) * Math.PI * 4) / W, dym = (R * Math.PI * 2) / H;
      const jd = Math.max(0, j - 1), ju = Math.min(H - 1, j + 1);
      for (let i = 0; i < W; i++) {
        let nx = (-(hts[j * W + ((i + 1) % W)] - hts[j * W + ((i + W - 1) % W)]) / dxm) * K;
        let ny = (-(hts[ju * W + i] - hts[jd * W + i]) / dym) * K;
        const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        const k = (j * W + i) * 4;
        nrm[k] = (nx * inv * 0.5 + 0.5) * 255; nrm[k + 1] = (ny * inv * 0.5 + 0.5) * 255; nrm[k + 2] = (inv * 0.5 + 0.5) * 255; nrm[k + 3] = 255;
      }
      if ((j & 31) === 31) yield;
    }
  }
  return { col, nrm, rough, emis, W, H };
}

function* genClouds(seed, W, H) {
  const n = new Noise(seed), d = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    const lat = -Math.PI / 2 + ((j + 0.5) / H) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const wx = n.fbm(x * 2 + 9, y * 2, z * 2, 3) * 0.6, wz = n.fbm(x * 2, y * 2 + 5, z * 2, 3) * 0.6;
      const f = n.fbm((x + wx) * 3.2, y * 5 + wz, (z + wz) * 3.2, 6);
      const a = ss(0.1, 0.45, f + 0.05 * Math.cos(y * 9));
      const k = (j * W + i) * 4;
      d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * 225;
    }
    if ((j & 7) === 7) yield;
  }
  return d;
}

const ATMO_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uRa;
varying vec3 vP;
void main() {
  vP = position * uRa;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

// Single-scattering approximation: march the view ray through an exponential atmosphere,
// attenuating by optical depth along the view ray and (approximately) towards the star.
const ATMO_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCam, uSun, uBeta;
uniform float uRa, uH, uGain;
varying vec3 vP;
vec2 raySphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vP - uCam);
  vec2 ta = raySphere(uCam, d, uRa);
  float t0 = max(ta.x, 0.0), t1 = ta.y;
  if (t1 <= t0) discard;
  vec2 tp = raySphere(uCam, d, 1.0);
  if (tp.x > 0.0 && tp.x < 1e8) t1 = min(t1, tp.x);
  const int N = 12;
  float dt = (t1 - t0) / float(N), od = 0.0;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < N; i++) {
    vec3 p = uCam + d * (t0 + (float(i) + 0.5) * dt);
    float r = length(p);
    float dens = exp(-max(r - 1.0, 0.0) / uH);
    od += dens * dt;
    float mu = dot(p, uSun) / r;
    float sunOD = uH * dens / (max(mu, 0.0) + 0.1);
    float lit = smoothstep(-0.2, 0.06, mu);
    sum += dens * lit * exp(-uBeta * (od + sunOD)) * dt;
  }
  float cs = dot(d, uSun);
  vec3 col = sum * uBeta * (0.75 * (1.0 + cs * cs)) * uGain;
  col += sum * uBeta * uGain * 0.6 * pow(max(cs, 0.0), 24.0);
  gl_FragColor = vec4(1.0 - exp(-col), 1.0);
}`;

export class PlanetView {
  constructor(body, quality, queue) {
    this.body = body; this.q = quality; this.queue = queue;
    this.group = new THREE.Group();
    const T = body.terrain, R = body.radius, gas = T.type === 'gas';
    this.holeDir = { value: new THREE.Vector3(0, 1, 0) };
    this.holeCos = { value: 2 };
    this.mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, fog: false, envMapIntensity: 0 });
    if (T.type === 'volcanic') { this.mat.emissive = new THREE.Color(1, 1, 1); this.mat.emissiveIntensity = 2.2; }
    // Cut a circular hole in the globe where the high-detail terrain patch takes over.
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uHoleDir = this.holeDir; sh.uniforms.uHoleCos = this.holeCos;
      sh.vertexShader = 'varying vec3 vObjDir;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjDir = position;');
      sh.fragmentShader = 'varying vec3 vObjDir;\nuniform vec3 uHoleDir;\nuniform float uHoleCos;\n' +
        sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (dot(normalize(vObjDir), uHoleDir) > uHoleCos) discard;');
    };
    this.hf = gas ? null : (x, y, z) => { const h = T.height(x, y, z, 5); return T.sea && h < 0 ? 0 : h; };
    this.geoLow = buildSphereGeometry(R, 64, 32, this.hf);
    this.geoHi = null;
    this.mesh = new THREE.Mesh(this.geoLow, this.mat);
    this.group.add(this.mesh);
    this.hi = 'none';
    this.ready = false;
    queue.add(this.texJob(quality.lowTex, false));

    if (body.atmo) {
      const a = body.atmo, uH = a.H / R;
      this.atmoU = {
        uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(1, 0, 0) },
        uBeta: { value: new THREE.Vector3(...a.color).multiplyScalar(a.strength / uH) },
        uRa: { value: 1 + a.top / R }, uH: { value: uH }, uGain: { value: 1.0 },
      };
      const geo = new THREE.SphereGeometry(1, 96, 64);
      const mk = (side) => new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: this.atmoU, vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      this.atmoFront = mk(THREE.FrontSide); this.atmoBack = mk(THREE.BackSide);
      this.atmoGroup = new THREE.Group();
      this.atmoGroup.add(this.atmoFront, this.atmoBack);
      this.atmoGroup.scale.setScalar(R * this.atmoU.uRa.value);
      this.atmoFront.renderOrder = this.atmoBack.renderOrder = 3;
      this.atmoFront.frustumCulled = this.atmoBack.frustumCulled = false;
      if (a.clouds && quality.clouds) {
        this.cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, roughness: 1, fog: false, envMapIntensity: 0 });
        this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R + a.clouds, 128, 64), this.cloudMat);
        this.clouds.renderOrder = 2;
        this.group.add(this.clouds);
        const W = quality.lowTex * 2;
        queue.add((function* (self) {
          const d = yield* genClouds(body.def.terrain.seed + 100, W, W / 2);
          self.cloudMat.map = dataTex(d, W, W / 2, true, false);
          self.cloudMat.opacity = 1; self.cloudMat.needsUpdate = true;
        })(this));
      }
    }
    if (body.def.rings) this.buildRings(body.def.rings, R);
  }

  buildRings(def, R) {
    const n = new Noise(def.seed), W = 1024, d = new Uint8Array(W * 4);
    for (let i = 0; i < W; i++) {
      const r = i / (W - 1);
      let a = 0.5 + 0.9 * n.perlin(r * 14, 1.5, 0) + 0.5 * n.perlin(r * 60, 4.5, 0) + 0.25 * n.perlin(r * 220, 7.5, 0);
      a *= ss(0, 0.04, r) * ss(1, 0.94, r);
      if (r > 0.55 && r < 0.6) a *= 0.08; // a gap swept by a shepherd moon
      const c = 0.75 + 0.3 * n.perlin(r * 25, 9.5, 0);
      d[i * 4] = to8(0.82 * c); d[i * 4 + 1] = to8(0.74 * c); d[i * 4 + 2] = to8(0.62 * c); d[i * 4 + 3] = to8(a * 0.9);
    }
    const tex = dataTex(d, W, 1, true, false);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    const seg = 180, pos = new Float32Array((seg + 1) * 2 * 3), uv = new Float32Array((seg + 1) * 2 * 2), idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.set([c * def.inner * R, 0, s * def.inner * R, c * def.outer * R, 0, s * def.outer * R], i * 6);
      uv.set([0, 0.5, 1, 0.5], i * 4);
      if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.1, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, fog: false, envMapIntensity: 0 });
    this.rings = new THREE.Mesh(g, m);
    this.rings.renderOrder = 1;
    this.group.add(this.rings);
  }

  *texJob(W, hi) {
    const body = this.body, T = body.terrain;
    const moon = body.type === 'moon' ? 2 : 1;
    const w = Math.max(128, W / (hi ? moon : 1)), h = w / 2;
    const res = yield* genTextures(body, w, h);
    if (hi && !this.geoHi) { this.geoHi = buildSphereGeometry(body.radius, this.q.sphere, this.q.sphere / 2, this.hf); yield; }
    const m = this.mat, old = [m.map, m.normalMap, m.roughnessMap, m.emissiveMap];
    m.map = dataTex(res.col, w, h, true, false);
    if (res.nrm) { m.normalMap = dataTex(res.nrm, w, h, false, false); m.normalScale.set(1, 1); }
    if (res.rough) { m.roughnessMap = dataTex(res.rough, w, h, false, false); m.roughness = 1; }
    if (res.emis) m.emissiveMap = dataTex(res.emis, w, h, true, false);
    m.needsUpdate = true;
    old.forEach((t) => t && t.dispose());
    this.ready = true;
    if (hi) this.hi = 'ready';
    void T;
  }

  setQuality(q) { this.q = q; if (this.hi === 'ready') this.hi = 'none'; }

  sync(origin, star, t) {
    const b = this.body, g = this.group, R = b.radius;
    g.position.subVectors(b.pos, origin);
    g.quaternion.copy(b.quat);
    const dist = g.position.length();
    this.dist = dist;
    this.mesh.visible = dist < R * 4000;
    this.mesh.geometry = this.geoHi && dist < R * 30 ? this.geoHi : this.geoLow;
    if (this.hi === 'none' && dist < R * 40) { this.hi = 'pending'; this.queue.add(this.texJob(this.q.tex, true)); }
    if (this.atmoGroup) {
      const u = this.atmoU, ag = this.atmoGroup;
      ag.visible = dist < R * 600;
      ag.position.copy(g.position);
      u.uCam.value.copy(g.position).multiplyScalar(-1 / R);
      u.uSun.value.subVectors(star.pos, b.pos).normalize();
      const inside = dist < R * u.uRa.value * 1.0005;
      // Seen from inside, the eye is adapted to the bright sky; from space, to the sunlit ground.
      u.uGain.value = 1.0 + 0.9 * Math.max(0, Math.min(1, 1 - (dist - R) / b.atmo.top));
      this.atmoBack.visible = inside; this.atmoFront.visible = !inside;
    }
    if (this.clouds) this.clouds.rotation.y = t * 1.5e-5;
  }
}
