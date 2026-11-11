// The spacecraft simulation: resources, staging, attitude control and the numerical
// integration of its trajectory under the gravity of every body, thrust and drag.
//
// Integrator: velocity Verlet (symplectic, 2nd order) for gravity + thrust, with drag applied
// as an unconditionally stable implicit update. Step size is chosen by suggestDt().
import { Vector3, Quaternion, Matrix4 } from 'three';
import { PARTS } from './parts.js';
import { stageInfo, sortParts } from './designs.js';
import { G0, ATM } from '../physics/constants.js';

const _g0 = new Vector3(), _g1 = new Vector3(), _nose = new Vector3(), _aN = new Vector3(), _rel = new Vector3();
const _vs = new Vector3(), _va = new Vector3(), _t = new Vector3(), _t2 = new Vector3(), _dl = new Vector3();
const _q = new Quaternion(), _q2 = new Quaternion(), _m = new Matrix4();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class Craft {
  constructor(design) {
    this.design = JSON.parse(JSON.stringify(design));
    this.pos = new Vector3(); this.vel = new Vector3(); this.quat = new Quaternion(); this.angVel = new Vector3();
    this.stages = this.design.stages.map((s) => {
      const parts = sortParts(s.parts), inf = stageInfo(parts);
      return { parts, dry: inf.dry, fuel: inf.fuel, fuelCap: inf.fuel, solid: inf.solid, solidCap: inf.solid,
        h: inf.h, liquid: inf.liquid, solids: inf.solids, ignited: false };
    });
    this.activeStage = this.stages.length; // nothing ignited yet
    this.throttle = 0; this.sas = true; this.sasMode = 'stab'; this.rcs = false; this.gear = true; this.panels = false;
    this.chute = 'stowed'; this.chuteOpen = 0;
    this.failures = {}; this.landed = null; this.docked = null; this.destroyed = false; this.destroyReason = '';
    this.roverDeployed = false; this.cargo = 0; this.met = 0; this.beenToSpace = false;
    this.ctrl = { pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0, tz: 0 };
    this.sunVis = 1; this.flux = 1; this.gen = 0; this.q = 0; this.gForce = 0; this.tau = 0; this.wheelLoad = 0;
    this.env = { body: null, r: 0, alt: 0, radarAlt: 1e9, terrainH: 0, pressure: 0, density: 0, inAtmo: false,
      up: new Vector3(0, 1, 0), vSurf: new Vector3(), vRelSurf: new Vector3(), vOrb: new Vector3(), dirLocal: new Vector3(1, 0, 0) };
    this.thr = { F: 0, md: 0, mds: 0 };
    this.log = []; // messages for the game to show: { msg, kind }
    this.fx = []; // visual events: 'jettison', 'explode'
    this.recompute();
    this.ec = this.ecCap; this.mono = this.monoCap;
  }

  recompute() {
    let ecCap = 0, monoCap = 0, torque = 0, rcsThrust = 0, solar = 0, cargoCap = 0, len = 0;
    this.has = { legs: false, chute: false, dock: false, rover: false };
    this.instruments = [];
    for (const st of this.stages) {
      len += st.h;
      for (const id of st.parts) {
        const p = PARTS[id];
        ecCap += p.ec || 0; monoCap += p.mono || 0; torque += p.torque || 0; rcsThrust += p.rcsThrust || 0;
        solar += p.solar || 0; cargoCap += p.cargo || 0;
        if (p.chute) this.has.chute = true;
        if (p.dock) this.has.dock = true;
        if (p.rover) this.has.rover = true;
        if (p.sci) this.instruments.push(p.sci);
      }
    }
    const bottom = this.stages[this.stages.length - 1];
    this.has.legs = bottom.parts.some((id) => PARTS[id].legs);
    Object.assign(this, { ecCap, monoCap, torque, rcsThrust, solar, cargoCap });
    this.length = Math.max(len, 1.9);
    this.belowOrigin = len - this.stages[0].h;
    if (this.ec > ecCap) this.ec = ecCap;
    if (this.mono > monoCap) this.mono = monoCap;
    if (this.cargo > cargoCap) this.cargo = cargoCap;
  }

  get legsDown() { return this.has.legs && this.gear; }
  get bottomOffset() { return this.belowOrigin + (this.legsDown ? 0.9 : 0.15); }
  get crashTol() { return this.legsDown ? 12 : 7; }
  cda() {
    const base = 3.8 * (this.stages.length > 1 ? 0.35 : 0.9);
    return base + (this.panels && this.solar > 0 ? 6 : 0) + this.chuteOpen * 420;
  }
  mass() {
    let m = this.mono + this.cargo;
    for (const s of this.stages) m += s.dry + s.fuel + s.solid;
    return m;
  }
  get stage() { return this.stages[this.activeStage] || null; }

  // ---- staging -------------------------------------------------------------------------
  activateNextStage() {
    if (this.destroyed || this.docked) return;
    if (this.activeStage === 0) {
      if (this.has.chute && this.chute === 'stowed') { this.chute = 'armed'; this.say('Parachute armed — opens below 250 m/s in atmosphere'); }
      return;
    }
    if (this.activeStage < this.stages.length) {
      this.stages.pop();
      this.fx.push('jettison');
      this.say(`Stage ${this.activeStage + 1} separated`);
    }
    this.activeStage--;
    this.recompute();
    const st = this.stages[this.activeStage];
    st.ignited = true;
    if (st.liquid.length || st.solids.length) this.say(`Stage ${this.activeStage + 1} ignition`);
    else if (this.activeStage === 0 && this.has.chute && this.chute === 'stowed') {
      this.chute = 'armed'; this.say('Parachute armed — opens below 250 m/s in atmosphere');
    }
  }

  thrustInfo(pAmb) {
    const o = this.thr; o.F = 0; o.md = 0; o.mds = 0;
    const st = this.stage;
    if (!st || !st.ignited) return o;
    const pr = Math.min(1, pAmb / ATM);
    if (st.fuel > 0 && this.throttle > 0) {
      for (const e of st.liquid) {
        const isp = e.ispVac + (e.ispSL - e.ispVac) * pr;
        const f = e.thrust * (isp / e.ispVac) * this.throttle * (this.failures.engine ? 0.5 : 1);
        o.F += f; o.md += f / (isp * G0);
      }
    }
    if (st.solid > 0) {
      for (const e of st.solids) {
        const isp = e.ispVac + (e.ispSL - e.ispVac) * pr;
        const f = e.thrust * (isp / e.ispVac);
        o.F += f; o.mds += f / (isp * G0);
      }
    }
    return o;
  }

  consume(ti, dt) {
    const st = this.stage;
    if (!st) return;
    if (ti.md > 0) { st.fuel -= ti.md * dt; if (st.fuel <= 0) { st.fuel = 0; this.say('Liquid engine flame-out: tank empty', 'warn'); } }
    if (ti.mds > 0) { st.solid -= ti.mds * dt; if (st.solid <= 0) { st.solid = 0; this.say('Solid boosters burned out'); } }
  }

  // Remaining delta-v of the active stage (vacuum).
  stageDv() {
    const st = this.stage;
    if (!st || !st.liquid.length || st.fuel <= 0) return 0;
    const m = this.mass();
    return st.liquid[0].ispVac * G0 * Math.log(m / (m - st.fuel));
  }

  say(msg, kind = 'info') { this.log.push({ msg, kind }); }
  destroy(reason) {
    if (this.destroyed) return;
    this.destroyed = true; this.destroyReason = reason; this.throttle = 0; this.fx.push('explode');
  }

  // ---- environment ---------------------------------------------------------------------
  computeEnv(system) {
    const e = this.env, b = system.dominant(this.pos);
    e.body = b;
    _rel.subVectors(this.pos, b.pos);
    const r = _rel.length();
    e.r = r; e.alt = r - b.radius;
    e.up.copy(_rel).divideScalar(r);
    e.pressure = b.pressure(e.alt); e.density = b.density(e.alt); e.inAtmo = e.pressure > 0;
    b.surfaceVel(_rel, e.vSurf);
    e.vRelSurf.subVectors(this.vel, e.vSurf);
    e.vOrb.subVectors(this.vel, b.vel);
    if (b.landable && e.alt < b.terrain.maxH + 30000) {
      b.localDir(this.pos, e.dirLocal);
      e.terrainH = b.surfaceH(e.dirLocal);
      e.terrainKnown = true;
    } else { e.terrainH = 0; e.terrainKnown = false; }
    e.radarAlt = e.alt - e.terrainH - this.bottomOffset;
    if (e.alt > (b.atmo ? b.atmo.top : 0) && !this.landed) this.beenToSpace = true;
    return e;
  }

  suggestDt() {
    let dt = clamp(0.01 * (this.tau || 1), 0.002, 4000);
    if (this.thr.F > 0 || this.env.inAtmo || this.env.radarAlt < 3000 || this.chuteOpen > 0) dt = Math.min(dt, 0.02);
    return dt;
  }

  // ---- one integration step ------------------------------------------------------------
  step(dt, system, t) {
    const e = this.computeEnv(system);
    if (this.checkContact(e)) return;
    this.stepAttitude(dt, e);
    const m = this.mass(), ti = this.thrustInfo(e.pressure), c = this.ctrl;
    _nose.set(0, 1, 0).applyQuaternion(this.quat);
    _aN.copy(_nose).multiplyScalar(ti.F / m);
    if (this.rcs && this.mono > 0 && (c.tx || c.ty || c.tz)) {
      _t.set(c.tx, c.ty, c.tz).applyQuaternion(this.quat).multiplyScalar(this.rcsThrust / m);
      _aN.add(_t);
      this.mono = Math.max(0, this.mono - ((this.rcsThrust * (Math.abs(c.tx) + Math.abs(c.ty) + Math.abs(c.tz))) / (240 * G0)) * dt);
    }
    this.tau = system.gravity(this.pos, _g0, e.body);
    _g0.add(_aN);
    this.pos.addScaledVector(this.vel, dt).addScaledVector(_g0, 0.5 * dt * dt);
    system.update(t + dt);
    system.gravity(this.pos, _g1, e.body);
    _g1.add(_aN);
    this.vel.addScaledVector(_g0, 0.5 * dt).addScaledVector(_g1, 0.5 * dt);
    let dragAcc = 0;
    if (e.density > 0) {
      const b = e.body;
      _rel.subVectors(this.pos, b.pos);
      b.surfaceVel(_rel, _vs);
      _va.subVectors(this.vel, _vs);
      const sp = _va.length(), k = (0.5 * e.density * this.cda()) / m;
      this.vel.copy(_vs).addScaledVector(_va, 1 / (1 + k * sp * dt));
      this.q = 0.5 * e.density * sp * sp;
      dragAcc = k * sp * sp;
      if (this.chute === 'armed' && e.pressure > 1500 && sp < 250) { this.chute = 'open'; this.say('Parachute deployed'); }
      if (this.chute === 'open') {
        this.chuteOpen = Math.min(1, this.chuteOpen + dt / 3);
        if (sp > 320) { this.chute = 'lost'; this.chuteOpen = 0; this.say('Parachute torn away by airspeed', 'bad'); }
      }
      if (this.panels && this.solar > 0 && !this.failures.solar && this.q > 6000) {
        this.failures.solar = true; this.say('Solar arrays torn off by aerodynamic load', 'bad');
      }
    } else this.q = 0;
    this.gForce = (_aN.length() + dragAcc) / G0;
    this.consume(ti, dt);
    this.stepSystems(dt);
    this.met += dt;
  }

  stepSystems(dt) {
    this.gen = this.panels && !this.failures.solar ? this.solar * this.flux * this.sunVis : 0;
    const cap = this.ecCap * (this.failures.battery ? 0.4 : 1);
    this.ec = clamp(this.ec + (this.gen - 0.04 - this.wheelLoad * 0.6) * dt, 0, cap);
  }

  checkContact(e) {
    const b = e.body;
    if (!b.landable) {
      if (b.type === 'star' && e.alt < 0) this.destroy('The vehicle burned up in Kaelis.');
      else if (b.atmo && e.pressure > 3e6) this.destroy(`The vehicle was crushed by the pressure of ${b.name}’s atmosphere.`);
      return this.destroyed;
    }
    if (e.radarAlt > 0) return false;
    const vUp = e.vRelSurf.dot(e.up);
    if (vUp > 0.05 && e.radarAlt > -1.5) return false; // lifting off
    if (e.terrainH <= b.terrain.lethalBelow) { this.destroy('The vehicle sank into molten lava.'); return true; }
    const sp = e.vRelSurf.length();
    _nose.set(0, 1, 0).applyQuaternion(this.quat);
    if (sp > this.crashTol) this.destroy(`The vehicle hit the surface at ${sp.toFixed(1)} m/s (limit ${this.crashTol} m/s).`);
    else if (_nose.dot(e.up) < 0.6 && sp > 1.5) this.destroy('The vehicle tipped over on touchdown.');
    else this.setLanded(b, e.dirLocal);
    return true;
  }

  // ---- attitude --------------------------------------------------------------------------
  holdTarget(e, out) {
    const m = this.sasMode;
    if (m === 'up') return out.copy(e.up);
    const useSurf = e.inAtmo || e.radarAlt < 20000;
    out.copy(useSurf ? e.vRelSurf : e.vOrb);
    if (out.lengthSq() < 0.25) return null;
    out.normalize();
    if (m === 'retro') out.negate();
    return out;
  }

  stepAttitude(dt, e) {
    const c = this.ctrl, w = this.angVel;
    const powered = this.ec > 0;
    const tgt = this.sas && powered && this.sasMode !== 'stab' ? this.holdTarget(e, _t2) : null;
    _nose.set(0, 1, 0).applyQuaternion(this.quat);
    if (dt > 0.1) { // time warp: no rotational dynamics, hold modes track their target directly
      w.set(0, 0, 0);
      if (tgt) this.quat.premultiply(_q.setFromUnitVectors(_nose, tgt)).normalize();
      this.wheelLoad = 0;
      return;
    }
    const m = this.mass(), L = this.length;
    const I = Math.max(600, m * ((L * L) / 12 + 0.4));
    let torque = 0;
    if (powered && !this.failures.wheel) torque += this.torque;
    const rcsOn = this.rcs && this.mono > 0;
    if (rcsOn) torque += this.rcsThrust * L * 0.4;
    if (this.thr.F > 0) torque += this.thr.F * 0.04 * L;
    const maxA = Math.min(3.5, torque / I);
    let ax = -c.pitch * maxA, ay = c.roll * maxA, az = -c.yaw * maxA;
    if (this.sas && powered && maxA > 0) {
      if (tgt) {
        _t.crossVectors(_nose, tgt);
        const s = _t.length(), ang = Math.atan2(s, _nose.dot(tgt));
        if (s > 1e-6) _t.divideScalar(s).applyQuaternion(_q.copy(this.quat).invert()); else _t.set(1, 0, 0);
        const rate = Math.min(ang * 1.4, 0.6);
        if (!c.pitch) ax = clamp((_t.x * rate - w.x) * 5, -maxA, maxA);
        if (!c.yaw) az = clamp((_t.z * rate - w.z) * 5, -maxA, maxA);
        if (!c.roll) ay = clamp(-w.y * 5, -maxA, maxA);
      } else {
        if (!c.pitch) ax = clamp(-w.x * 5, -maxA, maxA);
        if (!c.roll) ay = clamp(-w.y * 5, -maxA, maxA);
        if (!c.yaw) az = clamp(-w.z * 5, -maxA, maxA);
      }
    }
    w.x += ax * dt; w.y += ay * dt; w.z += az * dt;
    const use = maxA > 0 ? (Math.abs(ax) + Math.abs(ay) + Math.abs(az)) / maxA : 0;
    this.wheelLoad = powered ? Math.min(1, use) : 0;
    if (rcsOn && use > 0.05) this.mono = Math.max(0, this.mono - use * 0.25 * dt);
    const wl = w.length();
    if (wl > 1e-9) {
      _q.setFromAxisAngle(_t.copy(w).divideScalar(wl), wl * dt);
      this.quat.multiply(_q).normalize();
    }
  }

  // ---- surface / station attachment -----------------------------------------------------
  // Place the craft upright on a body at a body-frame direction (used for the launch pad).
  placeOn(body, dirLocal) {
    const up = dirLocal.clone().normalize();
    const east = new Vector3(0, 1, 0).cross(up).normalize();
    const south = new Vector3().crossVectors(east, up);
    const q = new Quaternion().setFromRotationMatrix(_m.makeBasis(east, up, south));
    this.landed = { body, dir: up, q };
    this.angVel.set(0, 0, 0);
    this.syncLanded();
  }

  setLanded(body, dirLocal) {
    _nose.set(0, 1, 0).applyQuaternion(this.quat);
    _t.copy(dirLocal).applyQuaternion(body.quat);
    _q.setFromUnitVectors(_nose, _t).multiply(this.quat);
    const q = _q2.copy(body.quat).invert().multiply(_q).clone();
    this.landed = { body, dir: dirLocal.clone(), q };
    this.angVel.set(0, 0, 0); this.throttle = 0;
    if (this.chute === 'open') { this.chute = 'lost'; this.chuteOpen = 0; }
    this.syncLanded();
    const water = body.terrain.sea && body.rawH(dirLocal) < 0;
    this.say(water ? `Splashdown on ${body.name}` : `Touchdown on ${body.name}`, 'good');
    this.fx.push('landed');
  }

  syncLanded() {
    const { body, dir, q } = this.landed;
    const r = body.radius + body.surfaceH(dir) + this.bottomOffset;
    _t.copy(dir).applyQuaternion(body.quat).multiplyScalar(r);
    this.pos.copy(body.pos).add(_t);
    body.surfaceVel(_t, this.vel);
    this.quat.copy(body.quat).multiply(q);
  }

  stepLanded(dt, system) {
    this.syncLanded();
    const e = this.computeEnv(system);
    e.radarAlt = 0;
    const ti = this.thrustInfo(e.pressure);
    this.consume(ti, dt);
    this.stepSystems(dt);
    this.q = 0; this.gForce = 1 * (e.body.mu / (e.r * e.r)) / G0;
    this.met += dt;
    if (ti.F / this.mass() > (e.body.mu / (e.r * e.r)) * 1.01) {
      this.landed = null;
      this.pos.addScaledVector(e.up, 0.05);
      this.vel.addScaledVector(e.up, 0.1);
    }
  }

  dock(station) { this.docked = station; this.throttle = 0; this.angVel.set(0, 0, 0); this.syncDocked(); }
  undock() {
    if (!this.docked) return;
    const s = this.docked; this.docked = null;
    _t.subVectors(s.pos, s.parent.pos).normalize();
    this.vel.addScaledVector(_t, 0.8);
  }
  syncDocked() {
    const s = this.docked;
    _t.subVectors(s.pos, s.parent.pos).normalize();
    this.pos.copy(s.pos).addScaledVector(_t, 22 + this.belowOrigin);
    this.vel.copy(s.vel);
    this.quat.setFromUnitVectors(_t2.set(0, 1, 0), _t);
  }
  refuel() { for (const s of this.stages) s.fuel = s.fuelCap; this.mono = this.monoCap; this.ec = this.ecCap; }

  // ---- persistence -------------------------------------------------------------------------
  toJSON() {
    return {
      design: this.design, n: this.stages.length, st: this.stages.map((s) => [s.fuel, s.solid, s.ignited]),
      activeStage: this.activeStage, throttle: this.throttle, sas: this.sas, sasMode: this.sasMode, rcs: this.rcs,
      gear: this.gear, panels: this.panels, chute: this.chute, chuteOpen: this.chuteOpen, ec: this.ec, mono: this.mono,
      cargo: this.cargo, failures: this.failures, met: this.met, beenToSpace: this.beenToSpace, roverDeployed: this.roverDeployed,
      pos: this.pos.toArray(), vel: this.vel.toArray(), quat: this.quat.toArray(), angVel: this.angVel.toArray(),
      landed: this.landed ? { body: this.landed.body.id, dir: this.landed.dir.toArray(), q: this.landed.q.toArray() } : null,
      docked: this.docked ? this.docked.id : null,
    };
  }

  static fromJSON(d, system) {
    const c = new Craft(d.design);
    c.stages.length = d.n;
    d.st.forEach((s, i) => { c.stages[i].fuel = s[0]; c.stages[i].solid = s[1]; c.stages[i].ignited = s[2]; });
    for (const k of ['activeStage', 'throttle', 'sas', 'sasMode', 'rcs', 'gear', 'panels', 'chute', 'chuteOpen', 'failures', 'met', 'beenToSpace', 'roverDeployed'])
      c[k] = d[k];
    c.recompute();
    c.ec = d.ec; c.mono = d.mono; c.cargo = d.cargo;
    c.pos.fromArray(d.pos); c.vel.fromArray(d.vel); c.quat.fromArray(d.quat); c.angVel.fromArray(d.angVel);
    if (d.landed) {
      c.landed = { body: system.byId[d.landed.body], dir: new Vector3().fromArray(d.landed.dir), q: new Quaternion().fromArray(d.landed.q) };
      c.syncLanded();
    }
    if (d.docked) c.docked = system.byId[d.docked];
    return c;
  }
}
