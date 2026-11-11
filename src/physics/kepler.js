// Two-body (Kepler) mathematics.
// Celestial bodies follow exact Keplerian ellipses; the spacecraft is integrated numerically
// (see spacecraft/Craft.js) and only uses this module for orbit read-outs and map trajectories.
import { Vector3 } from 'three';

const TAU = Math.PI * 2;

export function solveKepler(M, e) {
  M %= TAU;
  if (M < 0) M += TAU;
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 16; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

// Position and velocity of a body on an elliptical orbit at time t, in the parent's frame.
// Frame: Y is ecliptic north, orbits are counter-clockwise seen from +Y.
export function orbitState(o, mu, t, outPos, outVel) {
  const { a, e } = o;
  const n = Math.sqrt(mu / (a * a * a));
  const E = solveKepler(o.M0 + n * t, e);
  const cE = Math.cos(E), sE = Math.sin(E);
  const b = Math.sqrt(1 - e * e);
  const xp = a * (cE - e), yp = a * b * sE;
  const r = a * (1 - e * cE);
  const k = Math.sqrt(mu * a) / r;
  const vxp = -k * sE, vyp = k * b * cE;
  const cO = Math.cos(o.lan), sO = Math.sin(o.lan);
  const cw = Math.cos(o.argp), sw = Math.sin(o.argp);
  const ci = Math.cos(o.i), si = Math.sin(o.i);
  const m11 = cO * cw - sO * sw * ci, m12 = -cO * sw - sO * cw * ci;
  const m21 = sO * cw + cO * sw * ci, m22 = -sO * sw + cO * cw * ci;
  const m31 = sw * si, m32 = cw * si;
  // standard (X, Y, Z north) -> three.js (X, Z, -Y)
  outPos.set(m11 * xp + m12 * yp, m31 * xp + m32 * yp, -(m21 * xp + m22 * yp));
  if (outVel) outVel.set(m11 * vxp + m12 * vyp, m31 * vxp + m32 * vyp, -(m21 * vxp + m22 * vyp));
  return outPos;
}

const _h = new Vector3(), _e = new Vector3(), _t = new Vector3();

// Osculating orbital elements from a state vector relative to the attracting body.
export function elementsFromState(r, v, mu) {
  const rm = r.length(), v2 = v.lengthSq();
  _h.crossVectors(r, v);
  const hm = _h.length();
  const energy = v2 / 2 - mu / rm;
  _e.crossVectors(v, _h).divideScalar(mu).sub(_t.copy(r).divideScalar(rm));
  const e = _e.length();
  const a = Math.abs(energy) < 1e-12 ? Infinity : -mu / (2 * energy);
  const p = (hm * hm) / mu;
  const pe = p / (1 + e);
  const ap = e < 1 ? p / (1 - e) : Infinity;
  const period = e < 1 && a > 0 ? TAU * Math.sqrt((a * a * a) / mu) : Infinity;
  const inc = hm > 0 ? Math.acos(Math.max(-1, Math.min(1, _h.y / hm))) : 0;
  return { a, e, p, pe, ap, period, inc, energy, h: _h.clone(), evec: _e.clone() };
}

// Sample the conic described by elementsFromState() into a Float32Array of xyz points
// (relative to the attracting body). Hyperbolas are clipped at maxR.
export function sampleConic(el, r, maxR, n, out) {
  const P = new Vector3(), Q = new Vector3(), H = el.h.clone().normalize();
  if (el.e > 1e-6) P.copy(el.evec).normalize(); else P.copy(r).normalize();
  Q.crossVectors(H, P);
  let nu0 = 0, nu1 = TAU;
  if (el.e >= 1 || el.ap > maxR) {
    // limit true anomaly so that radius <= maxR
    const c = Math.max(-1, Math.min(1, (el.p / maxR - 1) / Math.max(el.e, 1e-9)));
    const lim = Math.acos(c);
    nu0 = -lim; nu1 = lim;
  }
  for (let i = 0; i < n; i++) {
    const nu = nu0 + ((nu1 - nu0) * i) / (n - 1);
    const rr = el.p / (1 + el.e * Math.cos(nu));
    const c = Math.cos(nu) * rr, s = Math.sin(nu) * rr;
    out[i * 3] = P.x * c + Q.x * s;
    out[i * 3 + 1] = P.y * c + Q.y * s;
    out[i * 3 + 2] = P.z * c + Q.z * s;
  }
  return out;
}

export const circularSpeed = (mu, r) => Math.sqrt(mu / r);
export const escapeSpeed = (mu, r) => Math.sqrt((2 * mu) / r);
