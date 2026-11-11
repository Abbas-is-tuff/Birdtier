// Surface colonies: modules, crew and a life-support economy that runs in game time
// (including under time warp and while the player is elsewhere).
import { Vector3 } from 'three';

// Rates are per game hour. power < 0 consumes, > 0 produces.
export const MODULES = {
  habitat: { name: 'Habitat', cost: 120, power: -2, beds: 4, info: 'Houses 4 colonists (arrives with 2). Recycles most water.' },
  greenhouse: { name: 'Greenhouse', cost: 100, power: -3, info: 'Uses water and power to grow food and release oxygen for about 3 people.' },
  solar: { name: 'Solar farm', cost: 60, power: 14, info: 'Generates power in daylight, scaled by distance from Kaelis.' },
  storage: { name: 'Storage facility', cost: 80, power: 0, info: '+400 capacity for every resource, +150 battery.' },
  lab: { name: 'Laboratory', cost: 150, power: -4, info: 'Produces science when staffed by 2+ colonists and linked by an antenna.' },
  pad: { name: 'Landing pad', cost: 90, power: 0, info: 'Allows resupply flights to be ordered from Thalen.' },
  antenna: { name: 'Communication antenna', cost: 50, power: -0.5, info: 'Allows remote management and science transmission.' },
};
export const RESUPPLY = { cost: 4000, o2: 150, water: 200, food: 150, materials: 200 };

const _d = new Vector3();

export class Colony {
  constructor(name, body, dir, t) {
    this.name = name; this.body = body; this.dir = dir.clone(); this.founded = t;
    this.modules = []; this.pop = 0; this.temp = 20; this.status = 'active';
    this.res = { o2: 120, water: 160, food: 120, power: 60, materials: 0 };
    this.cap = { o2: 300, water: 300, food: 300, power: 120, materials: 800 };
    this.net = { o2: 0, water: 0, food: 0, power: 0 };
    this.sciAcc = 0; this.growth = 0; this.starve = 0; this.daylight = 1;
    this.log = [];
  }

  count(type, working = true) { return this.modules.filter((m) => m.type === type && (!working || m.ok)).length; }
  has(type) { return this.count(type) > 0; }

  canBuild(type) {
    if (this.status !== 'active') return 'Colony is abandoned.';
    if (this.res.materials < MODULES[type].cost) return `Needs ${MODULES[type].cost} materials (have ${Math.floor(this.res.materials)}).`;
    if (type !== 'habitat' && !this.count('habitat', false)) return 'Build a habitat first.';
    if (this.modules.length >= 19) return 'Site is full.';
    return null;
  }
  build(type) {
    this.res.materials -= MODULES[type].cost;
    this.modules.push({ type, ok: true });
    if (type === 'habitat') this.pop += 2;
    if (type === 'storage') { for (const k of ['o2', 'water', 'food', 'materials']) this.cap[k] += 400; this.cap.power += 150; }
  }
  repair(i) { const m = this.modules[i]; if (m && !m.ok && this.res.materials >= 20) { this.res.materials -= 20; m.ok = true; return true; } return false; }

  // Simulate dt seconds. env: { flux, sunVis, ambientK, storm, weather }
  tick(dt, t, system, env, events) {
    if (this.status !== 'active') return;
    const b = this.body, h = dt / 3600, r = this.res, c = this.cap;
    // daylight from the real sun angle at the site (planet rotation gives the day/night cycle)
    _d.copy(this.dir).applyQuaternion(b.quat);
    const pos = _d.clone().multiplyScalar(b.radius).add(b.pos);
    const sunDir = system.star.pos.clone().sub(pos).normalize();
    const elev = Math.max(0, _d.dot(sunDir));
    this.daylight = Math.min(1, elev * 2.5) * env.sunVis;
    const ambient = b.temperature(this.dir, 0, elev);

    const hab = this.count('habitat'), gh = this.count('greenhouse'), sol = this.count('solar'), lab = this.count('lab');
    let demand = hab * 2 + gh * 3 + lab * 4 + this.count('antenna') * 0.5;
    const supply = sol * 14 * env.flux * this.daylight * (env.weather ? 0.3 : 1) * (env.storm ? 0.7 : 1);
    let powered = 1;
    const energy = r.power + (supply - demand) * h;
    if (energy < 0) { powered = demand > 0 ? Math.max(0, (r.power + supply * h) / (demand * h)) : 1; r.power = 0; } else r.power = Math.min(c.power, energy);
    const ghOut = gh * powered * (r.water > 0 ? 1 : 0);
    const d = { o2: ghOut * 3 - this.pop * 1, water: -ghOut * 1 - this.pop * 0.3, food: ghOut * 2.5 - this.pop * 0.8 };
    for (const k of ['o2', 'water', 'food']) { r[k] = Math.max(0, Math.min(c[k], r[k] + d[k] * h)); this.net[k] = d[k]; }
    this.net.power = supply - demand;
    // habitat temperature: heating needs power
    const targetT = powered > 0.5 && hab > 0 ? 21 : ambient - 273.15;
    this.temp += (targetT - this.temp) * Math.min(1, h * 0.5);
    // science
    if (lab && this.pop >= 2 && this.has('antenna') && !env.storm) {
      this.sciAcc += lab * 0.5 * powered * h * (b.def.sciMult || 1) * 0.2;
      if (this.sciAcc >= 1) { const n = Math.floor(this.sciAcc); this.sciAcc -= n; events.push({ type: 'science', value: n, label: `${this.name} laboratory` }); }
    }
    // crew health
    const critical = r.o2 <= 0 || r.water <= 0 || r.food <= 0 || this.temp < 2 || this.temp > 45;
    if (this.pop > 0 && critical) {
      this.starve += h;
      const limit = r.o2 <= 0 ? 0.5 : 12;
      if (this.starve >= limit) {
        this.starve = 0; this.pop--;
        events.push({ type: 'log', kind: 'bad', msg: `${this.name}: a colonist was lost (${r.o2 <= 0 ? 'no oxygen' : r.water <= 0 ? 'no water' : r.food <= 0 ? 'no food' : 'habitat temperature'})` });
        if (this.pop === 0) { this.status = 'abandoned'; events.push({ type: 'log', kind: 'bad', msg: `${this.name} has been abandoned.` }); }
      }
    } else {
      this.starve = 0;
      const beds = hab * 4;
      if (this.pop > 0 && this.pop < beds && this.has('pad') && r.food > 60 && r.o2 > 60 && r.water > 60) {
        this.growth += h;
        if (this.growth > 30) { this.growth = 0; this.pop++; events.push({ type: 'log', kind: 'good', msg: `${this.name}: a new colonist arrived (population ${this.pop})` }); }
      }
    }
  }

  toJSON() {
    return { name: this.name, body: this.body.id, dir: this.dir.toArray(), founded: this.founded, modules: this.modules, pop: this.pop,
      temp: this.temp, status: this.status, res: this.res, cap: this.cap };
  }
  static fromJSON(d, system) {
    const c = new Colony(d.name, system.byId[d.body], new Vector3().fromArray(d.dir), d.founded);
    Object.assign(c, { modules: d.modules, pop: d.pop, temp: d.temp, status: d.status, res: d.res, cap: d.cap });
    return c;
  }
}
