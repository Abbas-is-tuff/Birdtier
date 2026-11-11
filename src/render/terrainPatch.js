// Close-range terrain: a circular mesh centred under the point of interest, with vertex
// density falling off with distance (rings at r ∝ k⁴). It is rebuilt from the body's height
// function as the focus moves, so it matches collision exactly near the centre. Also owns the
// water surface and the instanced surface rocks.
import * as THREE from 'three';
import { hash3 } from '../world/noise.js';
import { makeDetailTexture, makeWaterNormals } from './textures.js';

const _o = { r: 0, g: 0, b: 0, rough: 1, emis: 0 };
const _d = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _c0 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const lin = (v) => Math.pow(v < 0 ? 0 : v > 1 ? 1 : v, 2.2);
const WR = 40, WS = 64, ROCKS = 220;

export class TerrainPatch {
  constructor(q) {
    this.detail = makeDetailTexture();
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: this.detail, envMapIntensity: 0.15 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.waterN = makeWaterNormals();
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({
      color: 0x0a3550, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.86, normalMap: this.waterN, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.6 }));
    this.water.frustumCulled = false; this.water.receiveShadow = true;
    const rg = new THREE.IcosahedronGeometry(1, 1), rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const k = 0.75 + 0.5 * hash3(Math.round(rp.getX(i) * 50), Math.round(rp.getY(i) * 50), Math.round(rp.getZ(i) * 50), 3);
      rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.7, rp.getZ(i) * k);
    }
    rg.computeVertexNormals();
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.95, flatShading: true, envMapIntensity: 0.15 });
    this.rocks = new THREE.InstancedMesh(rg, this.rockMat, ROCKS);
    this.rocks.frustumCulled = false; this.rocks.castShadow = true; this.rocks.receiveShadow = true;
    this.mesh.add(this.water, this.rocks);
    this.center = new THREE.Vector3(); this.body = null; this.active = false;
    this.build(q);
  }

  build(q) {
    this.rings = q.rings; this.sectors = q.sectors;
    const R = this.rings, S = this.sectors, nv = (R + 1) * S;
    this.pos = new Float32Array(nv * 3); this.col = new Float32Array(nv * 3); this.uv = new Float32Array(nv * 2);
    const idx = new Uint32Array(R * S * 6);
    let n = 0;
    for (let k = 0; k < R; k++) for (let s = 0; s < S; s++) {
      const s1 = (s + 1) % S, a = k * S + s, b = (k + 1) * S + s, c = k * S + s1, d = (k + 1) * S + s1;
      idx[n++] = a; idx[n++] = b; idx[n++] = d; idx[n++] = a; idx[n++] = d; idx[n++] = c;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh.geometry.dispose(); this.mesh.geometry = g;
    // water disc
    const wn = (WR + 1) * WS, wi = new Uint32Array(WR * WS * 6);
    n = 0;
    for (let k = 0; k < WR; k++) for (let s = 0; s < WS; s++) {
      const s1 = (s + 1) % WS, a = k * WS + s, b = (k + 1) * WS + s, c = k * WS + s1, d = (k + 1) * WS + s1;
      wi[n++] = a; wi[n++] = b; wi[n++] = d; wi[n++] = a; wi[n++] = d; wi[n++] = c;
    }
    this.wpos = new Float32Array(wn * 3); this.wuv = new Float32Array(wn * 2); this.wnor = new Float32Array(wn * 3);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(this.wpos, 3));
    wg.setAttribute('uv', new THREE.BufferAttribute(this.wuv, 2));
    wg.setAttribute('normal', new THREE.BufferAttribute(this.wnor, 3));
    wg.setIndex(new THREE.BufferAttribute(wi, 1));
    this.water.geometry.dispose(); this.water.geometry = wg;
    this.body = null;
  }

  // dir: unit vector to the focus in the body's rotating frame. alt: camera height above terrain.
  update(view, dir, alt, time) {
    const body = view.body, R = body.radius;
    const rmax = Math.min(60000, R * 0.45);
    const want = body.landable && alt < rmax * 0.6;
    if (!want) {
      if (this.active) { this.mesh.removeFromParent(); view.holeCos.value = 2; this.active = false; this.body = null; }
      return;
    }
    if (this.body !== body) {
      if (this.view) this.view.holeCos.value = 2;
      this.mesh.removeFromParent(); view.group.add(this.mesh);
      this.body = body; this.view = view; this.active = true; this.center.set(0, 0, 0);
      this.water.visible = body.terrain.sea;
      this.rockMat.color.setRGB(lin(body.terrain.dust[0] * 0.75), lin(body.terrain.dust[1] * 0.75), lin(body.terrain.dust[2] * 0.75));
    }
    this.waterN.offset.set(time * 0.012, time * 0.007);
    const moved = this.center.distanceTo(dir) * R;
    if (moved < Math.max(2.5, alt * 0.03)) return;
    this.regen(body, dir, rmax, alt);
    view.holeDir.value.copy(dir);
    view.holeCos.value = Math.cos(Math.atan((rmax * 0.9) / R));
  }

  regen(body, dir, rmax, alt) {
    const T = body.terrain, R = body.radius, RN = this.rings, S = this.sectors, pos = this.pos, col = this.col, uv = this.uv;
    this.center.copy(dir);
    _c0.copy(dir).multiplyScalar(R);
    _e1.set(0, 1, 0).cross(dir);
    if (_e1.lengthSq() < 1e-6) _e1.set(1, 0, 0).cross(dir);
    _e1.normalize(); _e2.crossVectors(dir, _e1);
    let i = 0, prev = 0;
    for (let k = 0; k <= RN; k++) {
      const skirt = k === RN;
      const f = (skirt ? RN - 1 : k) / RN, r = rmax * f * f * f * f;
      const spacing = Math.max(r - prev, (Math.PI * 2 * r) / S, 0.5);
      if (!skirt) prev = r;
      const oct = Math.max(4, Math.min(body.physOct, Math.ceil(Math.log2(R / spacing))));
      for (let s = 0; s < S; s++, i++) {
        const a = (s / S) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        _d.copy(_c0).addScaledVector(_e1, x).addScaledVector(_e2, z).normalize();
        const h = T.height(_d.x, _d.y, _d.z, oct);
        T.sample(_d.x, _d.y, _d.z, h, _o);
        const rr = R + h - (skirt ? rmax * 0.03 : 0);
        pos[i * 3] = _d.x * rr - _c0.x; pos[i * 3 + 1] = _d.y * rr - _c0.y; pos[i * 3 + 2] = _d.z * rr - _c0.z;
        col[i * 3] = lin(_o.r); col[i * 3 + 1] = lin(_o.g); col[i * 3 + 2] = lin(_o.b);
        uv[i * 2] = x / 9; uv[i * 2 + 1] = z / 9;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    g.computeVertexNormals();
    this.mesh.position.copy(_c0);

    if (T.sea) {
      const wp = this.wpos, wu = this.wuv, wn = this.wnor;
      i = 0;
      for (let k = 0; k <= WR; k++) {
        const f = k / WR, r = rmax * f * f * f;
        for (let s = 0; s < WS; s++, i++) {
          const a = (s / WS) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
          _d.copy(_c0).addScaledVector(_e1, x).addScaledVector(_e2, z).normalize();
          wp[i * 3] = _d.x * R - _c0.x; wp[i * 3 + 1] = _d.y * R - _c0.y; wp[i * 3 + 2] = _d.z * R - _c0.z;
          wn[i * 3] = _d.x; wn[i * 3 + 1] = _d.y; wn[i * 3 + 2] = _d.z;
          wu[i * 2] = x / 60; wu[i * 2 + 1] = z / 60;
        }
      }
      const wg = this.water.geometry;
      wg.attributes.position.needsUpdate = true; wg.attributes.uv.needsUpdate = true; wg.attributes.normal.needsUpdate = true;
    }

    // Rocks live on a body-fixed lattice so they stay put as the patch re-centres.
    this.rocks.visible = alt < 500;
    if (this.rocks.visible) {
      const cell = 13, lat0 = Math.asin(dir.y), lon0 = Math.atan2(-dir.z, dir.x);
      const dLat = cell / R, dLon = cell / (R * Math.max(0.2, Math.cos(lat0)));
      const cj = Math.round(lat0 / dLat), ci = Math.round(lon0 / dLon);
      let n = 0;
      for (let j = -8; j <= 8 && n < ROCKS; j++) for (let ii = -8; ii <= 8 && n < ROCKS; ii++) {
        const a = ci + ii, b = cj + j;
        if (hash3(a, b, 1, 77) > 0.7) continue;
        const lon = (a + hash3(a, b, 2, 77) - 0.5) * dLon, lat = (b + hash3(a, b, 3, 77) - 0.5) * dLat, cl = Math.cos(lat);
        _d.set(cl * Math.cos(lon), Math.sin(lat), -cl * Math.sin(lon));
        const raw = body.rawH(_d);
        if ((T.sea && raw < 1) || raw <= T.lethalBelow) continue;
        const sz = 0.12 + 1.3 * Math.pow(hash3(a, b, 4, 77), 3);
        _p.copy(_d).multiplyScalar(R + raw + sz * 0.15).sub(_c0);
        _q.setFromUnitVectors(_s.set(0, 1, 0), _d);
        _q.multiply(new THREE.Quaternion().setFromAxisAngle(_s, hash3(a, b, 5, 77) * 6.28));
        _m.compose(_p, _q, _s.set(sz * (0.7 + hash3(a, b, 6, 77) * 0.8), sz, sz * (0.7 + hash3(a, b, 7, 77) * 0.8)));
        this.rocks.setMatrixAt(n++, _m);
      }
      this.rocks.count = n;
      this.rocks.instanceMatrix.needsUpdate = true;
    }
  }
}
