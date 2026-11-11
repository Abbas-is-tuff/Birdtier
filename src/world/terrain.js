// Procedural terrain: one deterministic height / colour / biome function per body.
// The same functions drive collision, the orbital textures and the close-range terrain mesh,
// so what you see is what you land on.
//
// Convention: sample() and biome() reuse intermediate values of the most recent height() call,
// so always call height() for a point before sample() for that point.
import { Noise, hash3, smoothstep as ss, mix, clamp } from './noise.js';

function craters(x, y, z, freq, seed, density) {
  const px = x * freq, py = y * freq, pz = z * freq;
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  let sum = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const cx = ix + dx, cy = iy + dy, cz = iz + dz;
    const h0 = hash3(cx, cy, cz, seed);
    if (h0 > density) continue;
    const rad = 0.15 + (0.33 * h0) / density;
    const ax = px - cx - hash3(cx, cy, cz, seed + 1);
    if (ax > 0.75 || ax < -0.75) continue;
    const ay = py - cy - hash3(cx, cy, cz, seed + 2);
    const az = pz - cz - hash3(cx, cy, cz, seed + 3);
    const d2 = (ax * ax + ay * ay + az * az) / (rad * rad);
    if (d2 > 2.2) continue;
    const d = Math.sqrt(d2);
    const bowl = d < 1 ? d * d - 1 : 0;
    const e = (d - 1) / 0.18;
    sum += (bowl * 0.9 + 0.3 * Math.exp(-e * e)) * rad * 2;
  }
  return sum;
}

function cones(x, y, z, freq, seed) {
  const px = x * freq, py = y * freq, pz = z * freq;
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  let best = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const cx = ix + dx, cy = iy + dy, cz = iz + dz;
    const h0 = hash3(cx, cy, cz, seed);
    if (h0 > 0.3) continue;
    const rad = 0.2 + 0.8 * h0;
    const ax = px - cx - hash3(cx, cy, cz, seed + 1);
    const ay = py - cy - hash3(cx, cy, cz, seed + 2);
    const az = pz - cz - hash3(cx, cy, cz, seed + 3);
    const d = Math.sqrt(ax * ax + ay * ay + az * az) / rad;
    if (d >= 1) continue;
    let h = Math.pow(1 - d, 1.3);
    if (d < 0.12) h = Math.pow(0.88, 1.3) - (0.12 - d) * 2.2;
    h *= rad * 2;
    if (h > best) best = h;
  }
  return best;
}

const lerp3 = (o, a, b, t) => { o.r = mix(a[0], b[0], t); o.g = mix(a[1], b[1], t); o.b = mix(a[2], b[2], t); };
const blend3 = (o, b, t) => { o.r = mix(o.r, b[0], t); o.g = mix(o.g, b[1], t); o.b = mix(o.b, b[2], t); };

export function createTerrain(T, R) {
  const n = new Noise(T.seed), amp = T.amp || 0, sd = T.seed * 7;
  const cr = (x, y, z, f, s, dens, k) => (craters(x, y, z, f, sd + s, dens) * k * R) / f;
  const L = { c: 0, a: 0, b: 0, raw: 0 }; // intermediates from the last height() call
  const tint = T.tint || [0.5, 0.5, 0.5];
  let height, sample, biome, sea = false, lethalBelow = -Infinity, dust = [0.6, 0.55, 0.5];

  if (T.type === 'ocean') {
    sea = true; dust = [0.75, 0.72, 0.62];
    height = (x, y, z, o) => {
      const c = n.fbm(x * 1.7 + 3.1, y * 1.7 + 1.3, z * 1.7 - 2.2, o) * 2.0 - 0.1;
      const m = n.ridged(x * 5 + 9, y * 5, z * 5, o < 5 ? o : 5);
      const mt = m > 0.5 ? (m - 0.5) * 2 : 0;
      L.c = c; L.a = mt;
      return amp * (c * 0.45 + ss(0, 0.35, c) * mt * mt * 1.3);
    };
    const moist = (x, y, z) => n.fbm(x * 4 + 40, y * 4, z * 4, 3) * 2 + 0.5 - Math.abs(y) * 0.4;
    const core = (x, y, z, h, o) => {
      const lat = Math.abs(y), v = n.fbm(x * 9 + 20, y * 9, z * 9, 3);
      const iceLine = 0.9 + v * 0.07;
      o.emis = 0;
      if (h <= 0) {
        lerp3(o, [0.07, 0.36, 0.44], [0.012, 0.055, 0.19], Math.sqrt(Math.min(1, -h / 1500)));
        o.rough = 0.16;
      } else {
        const mo = clamp(moist(x, y, z), 0, 1);
        lerp3(o, [0.46, 0.42, 0.23], [0.1, 0.27, 0.13], mo);
        blend3(o, [0.6, 0.57, 0.44], (1 - ss(5, 45, h)) * 0.8);
        blend3(o, [0.36, 0.32, 0.29], ss(1300, 2500, h + v * 700));
        blend3(o, [0.93, 0.95, 0.98], ss(2800, 3500, h + lat * 2600 + v * 500));
        o.rough = 0.92;
      }
      if (lat > iceLine) { blend3(o, [0.9, 0.94, 0.98], ss(iceLine, iceLine + 0.02, lat)); o.rough = 0.6; }
    };
    // `soft` (metres) anti-aliases the coastline in low-resolution orbital textures by blending
    // the sea and land colours across a narrow band of heights around sea level.
    sample = (x, y, z, h, o, soft = 0) => {
      if (!(soft > 0) || Math.abs(h) >= soft) { core(x, y, z, h, o); return; }
      core(x, y, z, -1, o); const r = o.r, g = o.g, b = o.b, ro = o.rough;
      core(x, y, z, Math.max(h, 1), o);
      const k = ss(-soft, soft, h);
      o.r = r + (o.r - r) * k; o.g = g + (o.g - g) * k; o.b = b + (o.b - b) * k; o.rough = ro + (o.rough - ro) * k;
    };
    biome = (x, y, z, h) => {
      const lat = Math.abs(y);
      if (lat > 0.9) return h <= 0 ? 'Polar ice shelf' : 'Polar highlands';
      if (h <= 0) return 'Open ocean';
      if (h < 45) return 'Shoreline';
      if (h + lat * 2600 > 3100) return 'Glaciated peaks';
      if (h > 1500) return 'Highlands';
      return moist(x, y, z) > 0.5 ? 'Forest lowlands' : 'Grasslands';
    };
  } else if (T.type === 'desert') {
    dust = [0.8, 0.5, 0.3];
    height = (x, y, z, o) => {
      const c = n.fbm(x * 2 + 5, y * 2, z * 2, o) * 1.8;
      const cn = ss(0.07, 0, Math.abs(n.fbm(x * 2.6 + 11, y * 2.6 + 3, z * 2.6, 5)));
      const low = 1 - ss(0, 0.2, c);
      const dn = low > 0 ? n.ridged(x * 140, y * 140, z * 140, 2) * 0.012 * low : 0;
      L.c = c; L.a = cn; L.b = low;
      return amp * (c * 0.45 + ss(0.15, 0.3, c) * 0.22 - cn * 0.5 * ss(-0.1, 0.2, c) + dn)
        + cr(x, y, z, 5, 1, 0.35, 0.05) + cr(x, y, z, 14, 2, 0.3, 0.08);
    };
    sample = (x, y, z, h, o) => {
      const v = n.fbm(x * 9 + 20, y * 9, z * 9, 3) + 0.5;
      lerp3(o, [0.74, 0.44, 0.25], [0.6, 0.31, 0.18], clamp(v, 0, 1));
      blend3(o, [0.86, 0.63, 0.4], L.b * 0.7);
      blend3(o, [0.42, 0.23, 0.15], ss(0.15, 0.3, L.c) * 0.8);
      blend3(o, [0.3, 0.16, 0.11], L.a * 0.7);
      blend3(o, [0.92, 0.9, 0.88], ss(0.9, 0.95, Math.abs(y) + v * 0.03));
      o.rough = 0.95; o.emis = 0;
    };
    biome = (x, y, z) => {
      if (Math.abs(y) > 0.92) return 'Polar frost';
      if (L.a > 0.5 && L.c > 0) return 'Canyon floor';
      if (L.c > 0.2) return 'High plateau';
      if (L.c < -0.05) return 'Dune sea';
      return 'Rocky plains';
    };
  } else if (T.type === 'ice') {
    dust = [0.85, 0.9, 0.95];
    height = (x, y, z, o) => {
      const c = n.fbm(x * 1.5 + 2, y * 1.5, z * 1.5, o) * 1.6;
      const ck = ss(0.045, 0, Math.abs(n.fbm(x * 4 + 7, y * 4, z * 4, 4)));
      L.c = c; L.a = ck;
      return amp * (c * 0.5 - ck * 0.12) + cr(x, y, z, 6, 1, 0.25, 0.04);
    };
    sample = (x, y, z, h, o) => {
      const v = n.fbm(x * 9 + 20, y * 9, z * 9, 3) + 0.5;
      lerp3(o, [0.74, 0.83, 0.91], [0.94, 0.96, 0.98], clamp(v, 0, 1));
      blend3(o, tint, 0.25);
      blend3(o, [0.2, 0.4, 0.56], L.a * 0.85);
      blend3(o, [0.55, 0.7, 0.84], ss(-0.1, -0.4, L.c) * 0.6);
      o.rough = 0.5; o.emis = 0;
    };
    biome = () => (L.a > 0.5 ? 'Fracture zone' : L.c > 0.25 ? 'Ice highlands' : L.c < -0.2 ? 'Frozen basin' : 'Ice plains');
  } else if (T.type === 'volcanic') {
    dust = [0.3, 0.27, 0.25];
    const lavaLevel = -0.16 * amp;
    lethalBelow = lavaLevel + 0.5;
    height = (x, y, z, o) => {
      const c = n.fbm(x * 2.2 + 1, y * 2.2, z * 2.2, o) * 1.6;
      const m = n.ridged(x * 5, y * 5 + 4, z * 5, o < 5 ? o : 5);
      const mt = m > 0.45 ? (m - 0.45) * 1.8 : 0;
      const cn = cones(x, y, z, 7, sd + 9);
      const raw = amp * (c * 0.45 + mt * mt * 0.7) + (cn * 0.1 * R) / 7;
      L.c = raw <= lavaLevel ? 1 : 0; L.a = cn; L.b = mt; L.raw = raw;
      return raw > lavaLevel ? raw : lavaLevel;
    };
    const core = (x, y, z, h, o, lava) => {
      const v = n.fbm(x * 9 + 20, y * 9, z * 9, 3) + 0.5;
      if (lava) {
        const crust = ss(0.45, 0.6, n.fbm(x * 60, y * 60, z * 60, 3) + 0.5);
        lerp3(o, [1.0, 0.42, 0.06], [0.16, 0.05, 0.03], crust);
        o.emis = 1 - crust * 0.92; o.rough = 0.6;
      } else {
        lerp3(o, [0.1, 0.09, 0.09], [0.24, 0.21, 0.19], clamp(v, 0, 1));
        blend3(o, tint, 0.2);
        blend3(o, [0.58, 0.5, 0.14], ss(0.15, 0.5, L.a) * ss(0.4, 0.7, v) * 0.8);
        const near = ss(lavaLevel + 0.06 * amp, lavaLevel, h);
        blend3(o, [0.5, 0.14, 0.03], near * 0.6);
        o.emis = near * 0.12; o.rough = 0.9;
      }
    };
    // Same coastline anti-aliasing as the ocean world, applied to lava shores.
    sample = (x, y, z, h, o, soft = 0) => {
      const s = soft * 2, raw = L.raw;
      if (!(soft > 0) || Math.abs(raw - lavaLevel) >= s) { core(x, y, z, h, o, L.c); return; }
      core(x, y, z, lavaLevel, o, 1); const r = o.r, g = o.g, b = o.b, e = o.emis, ro = o.rough;
      core(x, y, z, Math.max(h, lavaLevel + 1), o, 0);
      const k = ss(lavaLevel - s, lavaLevel + s, raw);
      o.r = r + (o.r - r) * k; o.g = g + (o.g - g) * k; o.b = b + (o.b - b) * k; o.emis = e + (o.emis - e) * k; o.rough = ro + (o.rough - ro) * k;
    };
    biome = () => (L.c ? 'Lava sea' : L.a > 0.25 ? 'Volcanic cone' : L.b > 0.3 ? 'Basalt ridges' : 'Ash plains');
  } else if (T.type === 'rock') {
    dust = [tint[0] * 1.1, tint[1] * 1.1, tint[2] * 1.1];
    height = (x, y, z, o) => {
      const c = n.fbm(x * 2 + 4, y * 2 + 1, z * 2, o) * 1.5;
      let k = cr(x, y, z, 4, 1, 0.45, 0.045) + cr(x, y, z, 11, 2, 0.5, 0.07);
      if (o >= 6) k += cr(x, y, z, 31, 3, 0.5, 0.1);
      if (o >= 9) k += cr(x, y, z, 97, 4, 0.5, 0.12);
      L.c = c; L.a = k;
      return amp * c * 0.5 + k;
    };
    sample = (x, y, z, h, o) => {
      const v = n.fbm(x * 9 + 20, y * 9, z * 9, 3) + 0.5;
      const k = 0.72 + 0.4 * clamp(v, 0, 1);
      o.r = tint[0] * k; o.g = tint[1] * k; o.b = tint[2] * k;
      const maria = ss(-0.1, -0.3, L.c) * 0.45;
      o.r *= 1 - maria; o.g *= 1 - maria; o.b *= 1 - maria;
      const rim = clamp((L.a / R) * 400, -0.25, 0.3);
      o.r += rim * 0.25; o.g += rim * 0.25; o.b += rim * 0.25;
      o.rough = 0.97; o.emis = 0;
    };
    biome = () => (L.a < -0.004 * R ? 'Crater floor' : L.c < -0.2 ? 'Mare lowlands' : L.c > 0.25 ? 'Highlands' : 'Regolith plains');
  } else {
    // gas giant: no solid surface, colour only
    const pal = T.palette;
    height = () => 0;
    // Zonal bands: noise is stretched along longitude (low x/z frequency, high y frequency)
    // so turbulence appears as streaks, then a single large anticyclone and darker poles.
    const stormLon = 1.1, stormLat = -0.32;
    sample = (x, y, z, h, o) => {
      const streak = n.fbm(x * 2.2, y * 14, z * 2.2, 5);
      const fine = n.fbm(x * 9, y * 40, z * 9, 3);
      const t = y * 10.5 + streak * 0.42 + fine * 0.08;
      let f = (Math.sin(t * 2.0) * 0.5 + 0.5) * 0.72 + (Math.sin(t * 5.1 + 1.7) * 0.5 + 0.5) * 0.28;
      f = clamp(f, 0, 0.999) * (pal.length - 1);
      const i = Math.floor(f);
      lerp3(o, pal[i], pal[i + 1], ss(0, 1, f - i));
      // great oval storm
      let dl = Math.atan2(-z, x) - stormLon; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
      const swirl = n.fbm(x * 12, y * 12, z * 12, 3) * 0.25;
      const oval = Math.exp(-((dl * dl) / 0.035 + ((y - stormLat) ** 2) / 0.0025)) + swirl * 0.2;
      blend3(o, [0.78, 0.42, 0.28], ss(0.25, 0.7, oval) * 0.85);
      blend3(o, pal[0], ss(0.75, 0.95, oval) * 0.4);
      blend3(o, pal[4], ss(0.62, 0.96, Math.abs(y)) * 0.55);
      const k = 0.9 + 0.16 * fine;
      o.r *= k; o.g *= k; o.b *= k;
      o.rough = 1; o.emis = 0;
    };
    biome = () => 'Upper cloud deck';
  }

  // Estimate the height range once so renderers and collision can cull cheaply.
  let minH = 0, maxH = 0;
  if (T.type !== 'gas') {
    for (let i = 0; i < 2500; i++) {
      const u = hash3(i, 1, 2, 99) * 2 - 1, a = hash3(i, 3, 4, 99) * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const h = height(s * Math.cos(a), u, s * Math.sin(a), 8);
      if (h < minH) minH = h; if (h > maxH) maxH = h;
    }
    const pad = (maxH - minH) * 0.15;
    minH -= pad; maxH += pad;
  }
  return { type: T.type, height, sample, biome, sea, lethalBelow, dust, minH, maxH: sea ? maxH : maxH, amp };
}
