// Seeded 3D gradient noise + integer hashing used by all procedural generation.
export class Noise {
  constructor(seed) {
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    let s = (seed * 2654435761) >>> 0 || 1;
    for (let i = 255; i > 0; i--) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const j = s % (i + 1);
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  perlin(x, y, z) {
    const p = this.p;
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const g = grad;
    const x1 = x - 1, y1 = y - 1, z1 = z - 1;
    const a0 = g(p[AA], x, y, z), a1 = g(p[BA], x1, y, z);
    const b0 = g(p[AB], x, y1, z), b1 = g(p[BB], x1, y1, z);
    const c0 = g(p[AA + 1], x, y, z1), c1 = g(p[BA + 1], x1, y, z1);
    const d0 = g(p[AB + 1], x, y1, z1), d1 = g(p[BB + 1], x1, y1, z1);
    const l0 = a0 + u * (a1 - a0), l1 = b0 + u * (b1 - b0);
    const l2 = c0 + u * (c1 - c0), l3 = d0 + u * (d1 - d0);
    const m0 = l0 + v * (l1 - l0), m1 = l2 + v * (l3 - l2);
    return m0 + w * (m1 - m0);
  }

  // Fractal sum, normalised to roughly [-1, 1].
  fbm(x, y, z, oct) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) {
      s += a * this.perlin(x * f, y * f, z * f);
      n += a; a *= 0.5; f *= 2.03;
    }
    return s / n;
  }

  // Ridged multifractal in [0, 1].
  ridged(x, y, z, oct) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) {
      const v = 1 - Math.abs(this.perlin(x * f, y * f, z * f));
      s += a * v * v; n += a; a *= 0.5; f *= 2.07;
    }
    return s / n;
  }
}

function grad(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483629) ^ Math.imul(seed, 144665);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Small deterministic RNG for gameplay randomness that must survive save/load.
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a, b, x) => {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
