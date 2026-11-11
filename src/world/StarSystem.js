// Runtime model of the star system: body states, rotation, atmosphere and gravity queries.
import { Vector3, Quaternion } from 'three';
import { BODIES, HOME_ID } from './systemData.js';
import { orbitState } from '../physics/kepler.js';
import { createTerrain } from './terrain.js';
import { GAS_R, G } from '../physics/constants.js';

const Y = new Vector3(0, 1, 0);
const _p = new Vector3(), _v = new Vector3(), _q = new Quaternion(), _d = new Vector3();

export class Body {
  constructor(def, parent) {
    this.def = def; this.id = def.id; this.name = def.name; this.type = def.type; this.parent = parent;
    this.mu = def.mu || 0; this.radius = def.radius; this.mass = this.mu / G;
    this.pos = new Vector3(); this.vel = new Vector3(); this.quat = new Quaternion();
    this.tiltQ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), def.tilt || 0);
    this.axis = new Vector3(0, 1, 0).applyQuaternion(this.tiltQ);
    this.omega = def.rotPeriod ? (2 * Math.PI) / def.rotPeriod : 0;
    this.orbit = def.orbit || null;
    this.rot0 = 0;
    this.children = [];
    this.soi = !parent ? Infinity : this.mu > 0 ? def.orbit.a * Math.pow(this.mu / parent.mu, 0.4) : 0;
    this.period = parent ? 2 * Math.PI * Math.sqrt(def.orbit.a ** 3 / parent.mu) : 0;
    this.g = this.mu / (this.radius * this.radius);
    this.atmo = def.atmo ? { ...def.atmo } : null;
    if (this.atmo) {
      this.atmo.top = this.atmo.H * Math.log(this.atmo.p0 / 0.5);
      this.atmo.rho0 = (this.atmo.p0 * this.atmo.M) / (GAS_R * def.tempK);
    }
    this.terrain = def.terrain ? createTerrain(def.terrain, def.radius) : null;
    this.landable = !!this.terrain && def.terrain.type !== 'gas';
    this.physOct = Math.max(8, Math.min(15, Math.round(Math.log2(this.radius / 80))));
    this.weather = null; // { type, until } set by the event system
  }

  update(t) {
    if (this.parent) {
      orbitState(this.orbit, this.parent.mu, t, _p, _v);
      this.pos.copy(this.parent.pos).add(_p);
      this.vel.copy(this.parent.vel).add(_v);
    }
    this.quat.copy(this.tiltQ).multiply(_q.setFromAxisAngle(Y, this.rot0 + this.omega * t));
  }

  // World position -> unit direction in the body's rotating frame.
  localDir(worldPos, out) {
    return out.subVectors(worldPos, this.pos).normalize().applyQuaternion(_q.copy(this.quat).invert());
  }
  worldDir(local, out) { return out.copy(local).applyQuaternion(this.quat); }

  // Height of the solid (or liquid) surface above the datum radius, for a body-frame direction.
  surfaceH(d) {
    if (!this.landable) return 0;
    const h = this.terrain.height(d.x, d.y, d.z, this.physOct);
    return this.terrain.sea && h < 0 ? 0 : h;
  }
  rawH(d) { return this.landable ? this.terrain.height(d.x, d.y, d.z, this.physOct) : 0; }
  biomeAt(d) {
    if (!this.terrain) return '—';
    const h = this.terrain.height(d.x, d.y, d.z, this.physOct);
    return this.terrain.biome(d.x, d.y, d.z, h);
  }

  pressure(alt) { const a = this.atmo; return a && alt < a.top ? a.p0 * Math.exp(-alt / a.H) : 0; }
  density(alt) {
    const a = this.atmo;
    if (!a || alt >= a.top) return 0;
    return a.rho0 * Math.exp(-alt / a.H) * (this.weather ? 1.15 : 1);
  }
  // Ambient temperature (K) at a body-frame direction and altitude; sunDot = cos of solar zenith angle.
  temperature(d, alt, sunDot) {
    const def = this.def;
    let T = def.tempK - (def.tempSwing || 0) / 2 + (def.tempSwing || 0) * Math.max(0, sunDot) - 25 * d.y * d.y;
    if (this.weather) T -= 12;
    if (this.atmo) T *= 1 - 0.25 * Math.min(1, Math.max(0, alt) / (3 * this.atmo.H));
    return T;
  }
  // Inertial velocity of the co-rotating surface/atmosphere at a position relative to the centre.
  surfaceVel(rel, out) {
    return out.copy(this.axis).multiplyScalar(this.omega).cross(rel).add(this.vel);
  }
}

export class StarSystem {
  constructor() {
    this.bodies = []; this.byId = {};
    for (const def of BODIES) {
      const parent = def.parent ? this.byId[def.parent] : null;
      const b = new Body(def, parent);
      this.bodies.push(b); this.byId[def.id] = b;
      if (parent) parent.children.push(b);
    }
    this.star = this.bodies[0];
    this.home = this.byId[HOME_ID];
    this.massive = this.bodies.filter((b) => b.mu > 0);
    this.stations = this.bodies.filter((b) => b.type === 'station');
    this.t = 0;
    this.update(0);
    this.launchSite = this.findLaunchSite(this.home);
    // Phase the home planet's rotation so a new career starts mid-morning at the launch site.
    const sun = this.star.pos.clone().sub(this.home.pos).normalize(), w = new Vector3();
    let best = 0, bestDot = -2;
    for (let i = 0; i < 720; i++) {
      this.home.rot0 = (i / 720) * Math.PI * 2; this.home.update(0);
      const d = this.home.worldDir(this.launchSite, w).dot(sun);
      if (d > bestDot) { bestDot = d; best = this.home.rot0; }
    }
    this.home.rot0 = best - 0.6; this.update(0);
  }

  update(t) {
    this.t = t;
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) bs[i].update(t);
  }

  // Newtonian gravity of every massive body on a small craft. Returns the shortest dynamical
  // timescale sqrt(r^3/mu), used to choose a stable integration step.
  //
  // Bodies move on Kepler rails, so the body the craft is orbiting (`dom`) does not itself
  // respond to its siblings. To stay consistent we integrate in dom's accelerating frame:
  //   a = g_dom(craft) + sum_b [ g_b(craft) - g_b(dom) ] + a_rails(dom)
  // i.e. other bodies act through their tidal (differential) pull, as in a restricted N-body problem.
  gravity(pos, out, dom) {
    out.set(0, 0, 0);
    let minTau = 1e30;
    const ms = this.massive;
    for (let i = 0; i < ms.length; i++) {
      const b = ms[i];
      const dx = b.pos.x - pos.x, dy = b.pos.y - pos.y, dz = b.pos.z - pos.z;
      const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
      const k = b.mu / (r2 * r);
      out.x += dx * k; out.y += dy * k; out.z += dz * k;
      const tau = r * Math.sqrt(r / b.mu);
      if (tau < minTau) minTau = tau;
      if (dom && b !== dom) {
        const ex = b.pos.x - dom.pos.x, ey = b.pos.y - dom.pos.y, ez = b.pos.z - dom.pos.z;
        const q2 = ex * ex + ey * ey + ez * ez, kk = b.mu / (q2 * Math.sqrt(q2));
        out.x -= ex * kk; out.y -= ey * kk; out.z -= ez * kk;
      }
    }
    if (dom) {
      for (let b = dom; b.parent; b = b.parent) {
        const p = b.parent;
        const ex = p.pos.x - b.pos.x, ey = p.pos.y - b.pos.y, ez = p.pos.z - b.pos.z;
        const q2 = ex * ex + ey * ey + ez * ez, kk = p.mu / (q2 * Math.sqrt(q2));
        out.x += ex * kk; out.y += ey * kk; out.z += ez * kk;
      }
    }
    return minTau;
  }

  // Body whose sphere of influence contains the position (deepest in the hierarchy).
  dominant(pos) {
    let cur = this.star;
    for (;;) {
      let next = null;
      for (const c of cur.children) {
        if (c.soi > 0 && _d.subVectors(pos, c.pos).lengthSq() < c.soi * c.soi) { next = c; break; }
      }
      if (!next) return cur;
      cur = next;
    }
  }

  // 1 = full sunlight, 0 = fully shadowed. Also reports which body is casting the shadow.
  sunVisibility(pos, info) {
    const star = this.star;
    const sx = star.pos.x - pos.x, sy = star.pos.y - pos.y, sz = star.pos.z - pos.z;
    const sl2 = sx * sx + sy * sy + sz * sz;
    let vis = 1, occ = null;
    for (const b of this.massive) {
      if (b === star) continue;
      const bx = b.pos.x - pos.x, by = b.pos.y - pos.y, bz = b.pos.z - pos.z;
      let t = (bx * sx + by * sy + bz * sz) / sl2;
      if (t <= 0 || t >= 1) continue;
      const cx = bx - sx * t, cy = by - sy * t, cz = bz - sz * t;
      const d = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const soft = b.radius * 0.03 + (b.atmo ? b.atmo.H * 2 : 0);
      const v = Math.min(1, Math.max(0, (d - b.radius + soft) / (2 * soft)));
      if (v < vis) { vis = v; occ = b; }
    }
    if (info) info.occluder = vis < 1 ? occ : null;
    return vis;
  }

  // Sunlight intensity relative to the home planet's orbit.
  flux(pos) {
    const a = this.home.orbit.a;
    return (a * a) / Math.max(1, _d.subVectors(pos, this.star.pos).lengthSq());
  }

  findLaunchSite(body) {
    const d = new Vector3(), e = new Vector3();
    let best = null, bestScore = 1e9;
    for (let i = 0; i < 720; i++) {
      const lon = (i / 720) * Math.PI * 2, lat = 0.02;
      d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
      const h = body.rawH(d);
      if (h < 40 || h > 700) continue;
      e.set(Math.cos(lat) * Math.cos(lon + 0.0004), Math.sin(lat), -Math.cos(lat) * Math.sin(lon + 0.0004));
      const slope = Math.abs(body.rawH(e) - h);
      e.set(Math.cos(lat + 0.0004) * Math.cos(lon), Math.sin(lat + 0.0004), -Math.cos(lat + 0.0004) * Math.sin(lon));
      const score = slope + Math.abs(body.rawH(e) - h) + h * 0.01;
      if (score < bestScore) { bestScore = score; best = d.clone(); }
    }
    return best || new Vector3(1, 0, 0);
  }
}
