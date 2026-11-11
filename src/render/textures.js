// Small procedural textures (all generated in code — the project ships no image files).
import * as THREE from 'three';
import { hash3 } from '../world/noise.js';

export function dataTex(data, W, H, srgb, repeat) {
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Tileable value noise: lattice wraps every `period` cells.
function tileNoise(x, y, period, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const w = (a) => ((a % period) + period) % period;
  const a = hash3(w(ix), w(iy), 0, seed), b = hash3(w(ix + 1), w(iy), 0, seed);
  const c = hash3(w(ix), w(iy + 1), 0, seed), d = hash3(w(ix + 1), w(iy + 1), 0, seed);
  return a + (b - a) * fx + (c - a + (a - b + d - c) * fx) * fy;
}
function tileFbm(u, v, base, seed) {
  let s = 0, a = 0.5, p = base;
  for (let o = 0; o < 4; o++) { s += a * tileNoise(u * p, v * p, p, seed + o); a *= 0.5; p *= 2; }
  return s / 0.9375;
}

// Greyscale multiplier used to break up flat terrain colour close to the ground.
export function makeDetailTexture(N = 128) {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const v = 205 + (tileFbm(i / N, j / N, 8, 7) - 0.5) * 110;
    const k = (j * N + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = Math.max(0, Math.min(255, v)); d[k + 3] = 255;
  }
  return dataTex(d, N, N, false, true);
}

// Tangent-space normal map of small waves, scrolled over the water surface.
export function makeWaterNormals(N = 128) {
  const h = new Float32Array(N * N), d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = tileFbm(i / N, j / N, 6, 31);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const l = h[j * N + ((i + N - 1) % N)], r = h[j * N + ((i + 1) % N)];
    const dn = h[((j + N - 1) % N) * N + i], up = h[((j + 1) % N) * N + i];
    let nx = (l - r) * 6, ny = (dn - up) * 6;
    const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
    const k = (j * N + i) * 4;
    d[k] = (nx * inv * 0.5 + 0.5) * 255; d[k + 1] = (ny * inv * 0.5 + 0.5) * 255; d[k + 2] = (inv * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  return dataTex(d, N, N, false, true);
}

// Subtle panel lines for spacecraft hull plating.
export function makePanelTexture(N = 128) {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cell = hash3(Math.floor(i / 32), Math.floor(j / 16), 0, 5);
    let v = 232 + cell * 20 + (hash3(i, j, 0, 9) - 0.5) * 8;
    if (i % 32 === 0 || j % 16 === 0) v -= 46;
    const k = (j * N + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
  }
  return dataTex(d, N, N, true, true);
}

// Soft radial falloff for the star's corona sprite.
export function makeGlowTexture(N = 128, power = 2.2) {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1;
    const r = Math.min(1, Math.sqrt(x * x + y * y));
    const v = Math.pow(1 - r, power) * 255;
    const k = (j * N + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
  }
  const t = dataTex(d, N, N, false, false);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}
