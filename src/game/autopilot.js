// Autopilot: flies the real spacecraft with the same throttle, staging and attitude control the
// player uses (the craft's SAS is pointed at a direction chosen here), so every manoeuvre obeys
// the physics and burns real fuel. Also provides the Δv estimates and the "fast travel" and
// "assisted landing" shortcuts, which are deliberately simplified (see README limitations).
import * as THREE from 'three';
import { G0 } from '../physics/constants.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _h = new THREE.Vector3(), _ev = new THREE.Vector3(), _rn = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------- orbit helpers
// Time until apoapsis for a bound orbit (s), from position/velocity relative to the body.
export function timeToApoapsis(r, v, mu) {
  const rl = r.length(), v2 = v.lengthSq();
  const a = 1 / (2 / rl - v2 / mu);
  if (!(a > 0)) return Infinity;
  const h = _h.crossVectors(r, v);
  const ev = _ev.crossVectors(v, h).divideScalar(mu).sub(_rn.copy(r).divideScalar(rl));
  const e = ev.length();
  const n = Math.sqrt(mu / (a * a * a)), period = (2 * Math.PI) / n;
  if (e < 1e-4) return 0;
  let nu = Math.acos(clamp(ev.dot(r) / (e * rl), -1, 1));
  if (r.dot(v) < 0) nu = 2 * Math.PI - nu;
  const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
  let M = E - e * Math.sin(E); if (M < 0) M += 2 * Math.PI;
  let t = (Math.PI - M) / n; if (t < 0) t += period;
  return t;
}

// Vacuum Δv of every stage still attached, from the active stage up.
export function totalDv(c) {
  let dv = 0;
  const extra = c.mono + c.cargo;
  for (let i = c.stages.length - 1; i >= 0; i--) {
    let m = extra;
    for (let j = 0; j <= i; j++) m += c.stages[j].dry + c.stages[j].fuel + c.stages[j].solid;
    const st = c.stages[i];
    if (st.liquid.length && st.fuel > 0) dv += st.liquid[0].ispVac * (c.ispMul || 1) * G0 * Math.log(m / (m - st.fuel));
  }
  return dv;
}

// Burn fuel for `dv` m/s using the rocket equation, staging as tanks run dry. Returns true if it all fitted.
export function spendDv(c, dv) {
  let guard = 0;
  while (dv > 0.01 && guard++ < 10) {
    const st = c.stage;
    if (st && st.liquid.length && st.fuel > 0) {
      const ve = st.liquid[0].ispVac * (c.ispMul || 1) * G0, m = c.mass();
      const need = m * (1 - Math.exp(-dv / ve));
      if (need <= st.fuel) { st.fuel -= need; return true; }
      dv -= ve * Math.log(m / (m - st.fuel)); st.fuel = 0;
    }
    if (c.activeStage === 0) return false;
    c.activateNextStage();
  }
  return dv <= 0.01;
}

const ancestors = (b) => { const out = []; for (let x = b; x; x = x.parent) out.push(x); return out; };
const parkingRadius = (b) => b.radius + Math.max(b.atmo ? b.atmo.top + 15000 : 0, b.landable ? b.terrain.maxH + 12000 : 0, b.radius * 0.12);

// Patched-conic estimate of the Δv and time to go from a circular orbit of radius rA around body A to a
// circular parking orbit around target T: a Hohmann transfer around their common parent, plus the
// escape and capture burns at each end.
export function transferPlan(A, rA, T) {
  if (T === A) return null;
  const upA = ancestors(A), upT = ancestors(T);
  const C = upA.find((x) => upT.includes(x));
  const childA = upA[upA.indexOf(C) - 1] || null, childT = upT[upT.indexOf(C) - 1] || null;
  const r1 = childA ? childA.orbit.a : rA, rT = parkingRadius(T), r2 = childT ? childT.orbit.a : rT;
  const mu = C.mu, at = (r1 + r2) / 2;
  const vt1 = Math.sqrt(mu * (2 / r1 - 1 / at)), vt2 = Math.sqrt(mu * (2 / r2 - 1 / at));
  const vinf1 = Math.abs(vt1 - Math.sqrt(mu / r1)), vinf2 = Math.abs(vt2 - Math.sqrt(mu / r2));
  // excess speed needed relative to a body sitting one level below the transfer (e.g. a moon of a planet)
  const throughLevel = (body, child, vinf) => {
    if (body === child) return vinf;
    const P = child, rr = body.orbit.a;
    return Math.sqrt(vinf * vinf + (2 * P.mu) / rr) - Math.sqrt(P.mu / rr);
  };
  const burn = (body, r, vinf) => Math.sqrt(vinf * vinf + (2 * body.mu) / r) - Math.sqrt(body.mu / r);
  const dep = childA ? burn(A, rA, throughLevel(A, childA, vinf1)) : vinf1;
  const arr = childT ? burn(T, rT, throughLevel(T, childT, vinf2)) : vinf2;
  return { dv: dep + arr, time: Math.PI * Math.sqrt(at ** 3 / mu), rT };
}

// ---------------------------------------------------------------------------- autopilot
export class Autopilot {
  constructor(game) { this.g = game; this.mode = null; this.phase = ''; this.dir = new THREE.Vector3(0, 1, 0); this.stageCool = 0; }
  get active() { return !!this.mode; }

  start(mode) {
    const g = this.g, c = g.craft;
    if (!c || c.destroyed || g.entity) return 'Board your spacecraft first.';
    if (c.docked) return 'Undock first.';
    const b = c.env.body;
    if (mode === 'land' && !b.landable) return `${b.name} has no solid surface to land on.`;
    if (mode === 'land' && c.landed) return 'You are already landed.';
    if (mode === 'orbit' && !c.landed && g.orbit && g.orbit.e < 1 && g.orbit.pe > parkingRadius(b) - 20000) return 'You are already in orbit.';
    this.mode = mode; this.phase = mode === 'orbit' ? (c.landed ? 'liftoff' : 'ascent') : 'brake';
    this.body = b; this.targetR = parkingRadius(b); this.stageCool = 1;
    c.sas = true; c.sasMode = 'ap'; c.apDir = this.dir.copy(_a.set(0, 1, 0).applyQuaternion(c.quat));
    g.chatter(mode === 'orbit' ? 'autoOrbit' : 'autoLand');
    return null;
  }

  stop(msg, kind = 'info') {
    const c = this.g.craft;
    if (!this.mode) return;
    this.mode = null; this.phase = '';
    if (c && !c.destroyed) { c.throttle = 0; if (c.sasMode === 'ap') c.sasMode = 'stab'; }
    if (this.g.warpIdx > 2) this.g.warpIdx = 0;
    if (msg) this.g.toast(msg, kind);
  }

  // Called once per frame, before the physics steps.
  update() {
    const g = this.g, c = g.craft;
    if (!this.mode) return;
    if (!c || c.destroyed) { this.mode = null; return; }
    if (c.ec <= 0) { this.stop('Autopilot off: no electric charge for the control system', 'bad'); return; }
    c.sas = true; c.sasMode = 'ap'; c.apDir = this.dir;
    this.stageCool -= 1 / 60;
    if (this.mode === 'orbit') this.ascent(c);
    else this.landing(c);
  }

  maybeStage(c) {
    const st = c.stage;
    if (this.stageCool > 0 || c.activeStage === 0) return;
    const empty = !st || !st.ignited || ((!st.liquid.length || st.fuel <= 0) && st.solid <= 0);
    if (!empty) return;
    // only stage if something below the capsule still has propellant
    let more = false;
    for (let i = c.activeStage - 1; i >= 0; i--) { const s = c.stages[i]; if ((s.liquid.length && s.fuel > 0) || s.solid > 0) more = true; }
    if (!more && st && st.ignited) return;
    c.activateNextStage(); this.stageCool = 1.2;
  }

  ascent(c) {
    const g = this.g, e = c.env, b = e.body, top = b.atmo ? b.atmo.top : 0;
    const rel = _a.subVectors(c.pos, b.pos), el = g.orbit;
    const ap = el ? el.ap : 0, pe = el ? el.pe : 0;
    const east = _b.copy(b.axis).cross(e.up).normalize();
    if (this.phase === 'liftoff') { c.throttle = 1; this.dir.copy(e.up); if (!c.stage || !c.stage.ignited) c.activateNextStage(); this.phase = 'ascent'; this.stageCool = 1.5; return; }
    this.maybeStage(c);
    if (this.phase === 'ascent') {
      // gravity turn: vertical first, then tip east as the air thins
      const turnEnd = Math.max(top * 0.85, 25000);
      const frac = clamp((e.alt - 800) / turnEnd, 0, 1);
      const theta = (Math.PI / 2) * 0.92 * Math.pow(frac, 0.55);
      this.dir.copy(e.up).multiplyScalar(Math.cos(theta)).addScaledVector(east, Math.sin(theta)).normalize();
      if (frac > 0.5 && e.vOrb.lengthSq() > 1) { const pro = _c.copy(e.vOrb).normalize(); if (pro.dot(e.up) < this.dir.dot(e.up)) this.dir.copy(pro); }
      c.throttle = 1;
      g.autoWarp(2);
      if (ap >= this.targetR) { c.throttle = 0; this.phase = 'coast'; g.chatter('meco'); }
      return;
    }
    const tAp = timeToApoapsis(rel, e.vOrb, b.mu);
    const vAp = Math.sqrt(Math.max(0, b.mu * (2 / ap - 2 / (ap + pe))));
    const dvCirc = Math.max(0, Math.sqrt(b.mu / ap) - vAp);
    const acc = Math.max(0.1, c.thrustInfo(e.pressure).F || this.maxAccel(c));
    const burnT = dvCirc / Math.max(0.05, acc / c.mass());
    this.dir.copy(e.vOrb).normalize();
    if (this.phase === 'coast') {
      c.throttle = ap < this.targetR - 1500 && e.inAtmo ? 0.3 : 0; // top up if drag lowers the apoapsis
      g.autoWarp(tAp > burnT / 2 + 25 ? 4 : tAp > burnT / 2 + 8 ? 2 : 0);
      if (!e.inAtmo && tAp <= burnT / 2 + 1) this.phase = 'circularize';
      return;
    }
    // circularize: full thrust, easing off near the end
    g.autoWarp(1);
    const remaining = Math.max(0, Math.sqrt(b.mu / e.r) - e.vOrb.length());
    c.throttle = clamp(remaining / Math.max(1, acc / c.mass()) / 2 + 0.05, 0.05, 1);
    if (pe >= this.targetR - 8000 || el.e < 0.004 || (pe > b.radius + top + 5000 && ap - pe < 3000)) {
      this.stop(`Orbit reached around ${b.name}: ${Math.round((ap - b.radius) / 1000)} × ${Math.round((pe - b.radius) / 1000)} km`, 'good');
      g.chatter('orbit');
    }
    if (!c.stage || (c.stage.fuel <= 0 && c.activeStage === 0)) this.stop('Autopilot off: out of fuel before reaching orbit', 'bad');
  }

  maxAccel(c) {
    const st = c.stage; let F = 0;
    if (st) for (const en of st.liquid) F += en.thrust * (c.failures.engine ? 0.5 : 1);
    return F;
  }

  landing(c) {
    const g = this.g, e = c.env, b = e.body;
    if (c.landed) { this.stop(`Touchdown on ${b.name}!`, 'good'); return; }
    if (e.body !== this.body) { this.stop('Autopilot off: left the body it was landing on', 'warn'); return; }
    this.maybeStage(c);
    const gl = b.mu / (e.r * e.r), m = c.mass();
    const vs = e.vRelSurf.dot(e.up), hs = Math.sqrt(Math.max(0, e.vRelSurf.lengthSq() - vs * vs));
    const h = e.terrainKnown ? e.radarAlt : e.alt;
    const Fmax = this.maxAccel(c) * (1 - 0.15 * Math.min(1, e.pressure / 101325));
    const aMax = Fmax / m;
    if (h < 4000 && c.has.legs && !c.gear) c.gear = true;
    if (b.atmo && c.has.chute && c.chute === 'stowed' && c.activeStage === 0) c.activateNextStage();
    const retro = _a.copy(e.vRelSurf).negate();
    if (retro.lengthSq() < 1) retro.copy(e.up);
    retro.normalize();
    // point mostly against the motion, never below the horizon, upright when nearly stopped
    this.dir.copy(hs < 3 && h < 300 ? e.up : retro);
    if (this.dir.dot(e.up) < 0.15) this.dir.addScaledVector(e.up, 0.15 - this.dir.dot(e.up)).normalize();
    const thick = b.atmo && b.atmo.p0 > 30000;
    if (aMax <= gl * 1.15 || this.phase === 'glide') {
      // engine too weak to hover: on a world with thick air, drop to the capsule and ride the parachute
      c.throttle = 0;
      if (this.phase !== 'glide') {
        this.phase = 'glide';
        g.toast(thick && c.has.chute ? 'Autopilot: engine too weak to land here — dropping to the capsule for a parachute landing' : 'Autopilot: not enough engine thrust to land here!', thick && c.has.chute ? 'warn' : 'bad');
      }
      if (thick && c.has.chute && this.stageCool <= 0 && h < b.atmo.top * 0.5) {
        if (c.activeStage > 0) { c.activateNextStage(); this.stageCool = 1; } else if (c.chute === 'stowed') c.activateNextStage();
      }
      this.dir.copy(retro);
      g.autoWarp(h > 20000 ? 3 : h > 3000 ? 2 : 0);
      return;
    }
    if (this.phase === 'brake') {
      // kill most of the sideways speed while high, then fall straight down
      g.autoWarp(1);
      if (thick) {
        // thick air: just lower the periapsis into the atmosphere and let drag do the braking
        c.throttle = g.orbit && g.orbit.pe > b.radius + b.atmo.top * 0.35 ? 1 : 0;
        if (!c.throttle) this.phase = 'descent';
        return;
      }
      c.throttle = hs > 25 ? 1 : 0;
      if (hs <= 25) this.phase = 'descent';
      return;
    }
    // suicide burn with a safety margin, then a gentle final descent
    const down = -vs, spd = e.vRelSurf.length();
    const stopDist = (spd * spd) / (2 * Math.max(0.1, aMax - gl));
    let thr = 0;
    if (thick && h > 2500 && spd > 60) thr = 0; // let the air slow us first
    else if (h < 120) {
      const want = 1.5 + h * 0.06;
      thr = (gl + (down - want) * 1.2 + hs * 0.3) / aMax;
    } else if (stopDist > (h - 60) * 0.72) {
      thr = (gl + (spd * spd) / (2 * Math.max(20, h - 60))) / aMax;
    }
    c.throttle = clamp(thr, 0, 1);
    g.autoWarp(stopDist < h * 0.4 && h > 3000 ? 3 : stopDist < h * 0.6 && h > 800 ? 2 : 0);
    if (!c.stage || (c.stage.fuel <= 0 && c.activeStage === 0 && down > 6)) this.stop('Autopilot off: out of fuel — brace for impact!', 'bad');
  }
}
