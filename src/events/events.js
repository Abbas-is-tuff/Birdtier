// Dynamic events. Each one changes the simulation, not just the screen:
//   solar storm      – comms blackout (science and remote commands stall), SAS drops out,
//                      colony solar output falls, higher equipment failure risk
//   asteroid         – a real object on a near-miss trajectory; collision destroys the craft,
//                      a close pass yields science
//   equipment failure– engine thrust halved / solar arrays dead / wheels dead / battery degraded
//   meteor shower    – impacts near landed craft and colonies on thin-atmosphere worlds
//   weather          – dust storms, ashfall and blizzards cut solar power and visibility
// (Eclipses are not scheduled: they are detected geometrically in Game.updateEnvironment.)
import { Vector3 } from 'three';
import { mulberry } from '../world/noise.js';

const HOUR = 3600;
const WEATHER = { desert: 'Dust storm', volcanic: 'Ashfall', ice: 'Blizzard', ocean: 'Storm front' };
const FAILS = [
  ['engine', 'Engine turbopump fault — thrust reduced to 50%'],
  ['solar', 'Solar array drive failure — no power generation'],
  ['wheel', 'Reaction wheel bearing seized — no wheel torque'],
  ['battery', 'Battery cell failure — capacity reduced to 40%'],
];

export class EventSystem {
  constructor(game, seed = 7) {
    this.g = game; this.rnd = mulberry(seed);
    this.storm = null; this.shower = null; this.rogue = null;
    const t = game.t;
    this.next = { storm: t + this.exp(9), rogue: t + this.exp(5), fail: t + this.exp(18), shower: t + this.exp(14), weather: t + this.exp(10) };
  }
  exp(meanHours) { return -Math.log(1 - this.rnd() * 0.999) * meanHours * HOUR + 600; }

  update(dt) {
    const g = this.g, t = g.t, c = g.craft, rnd = this.rnd;
    // --- solar storm
    if (this.storm && t > this.storm.until) { this.storm = null; g.toast('Solar storm has passed — communications restored', 'good'); }
    if (!this.storm && t > this.next.storm) {
      this.storm = { until: t + (0.5 + rnd()) * HOUR };
      this.next.storm = this.storm.until + this.exp(9);
      g.dropWarp();
      g.toast('SOLAR STORM — communications blackout, SAS offline', 'bad'); if (g.chatter) g.chatter('storm');
      if (c && !c.destroyed) { c.sas = false; if (rnd() < 0.2) this.fail(); }
    }
    // --- equipment failure
    if (t > this.next.fail) {
      this.next.fail = t + this.exp(this.storm ? 6 : 18);
      if (c && !c.destroyed && !c.landed && !c.docked) this.fail();
    }
    // --- weather
    for (const b of g.system.bodies) if (b.weather && t > b.weather.until) { b.weather = null; if (g.nearBody === b) g.toast(`${b.name}: weather has cleared`, 'good'); }
    if (t > this.next.weather) {
      this.next.weather = t + this.exp(10);
      const cands = g.system.bodies.filter((b) => b.atmo && b.landable && !b.weather);
      const b = cands[Math.floor(rnd() * cands.length)];
      if (b) {
        b.weather = { type: WEATHER[b.terrain.type] || 'Storm', until: t + (2 + rnd() * 6) * HOUR };
        if (g.nearBody === b || g.colonies.some((k) => k.body === b)) g.toast(`${b.weather.type} on ${b.name} — solar output and visibility reduced`, 'warn');
      }
    }
    // --- meteor shower
    if (this.shower && t > this.shower.until) { this.shower = null; g.toast('Meteor shower has ended', 'good'); }
    if (!this.shower && t > this.next.shower) {
      this.next.shower = t + this.exp(14);
      const thin = (b) => b.landable && (!b.atmo || b.atmo.p0 < 10000);
      const onSurface = c && c.landed && thin(c.landed.body);
      const cols = g.colonies.filter((k) => thin(k.body) && k.status === 'active');
      if (onSurface || cols.length) {
        const body = onSurface ? c.landed.body : cols[0].body;
        this.shower = { until: t + 300, body, nextHit: t + 5 };
        g.dropWarp();
        g.toast(`METEOR SHOWER over ${body.name}`, 'bad');
        for (const k of cols) if (k.body === body && k.modules.length && rnd() < 0.5) {
          const m = k.modules[Math.floor(rnd() * k.modules.length)];
          if (m.ok) { m.ok = false; g.toast(`${k.name}: ${m.type} damaged by an impact — repair for 20 materials`, 'bad'); g.basesDirty = true; }
        }
      }
    }
    if (this.shower && t > this.shower.nextHit) {
      this.shower.nextHit = t + 3 + rnd() * 8;
      if (c && c.landed && c.landed.body === this.shower.body) {
        g.meteorImpact(40 + rnd() * 260, rnd() * Math.PI * 2);
        if (rnd() < 0.04) { this.fail(); g.toast('Meteor fragment struck the vehicle', 'bad'); }
      }
    }
    // --- rogue asteroid encounter
    if (!this.rogue && t > this.next.rogue) {
      this.next.rogue = t + this.exp(5);
      if (c && !c.destroyed && !c.landed && !c.docked && !c.env.inAtmo && c.env.radarAlt > 20000) this.spawnRogue();
    }
    if (this.rogue) this.stepRogue(dt);
  }

  fail() {
    const c = this.g.craft, opts = FAILS.filter(([k]) => !c.failures[k]);
    if (!opts.length) return;
    const [k, msg] = opts[Math.floor(this.rnd() * opts.length)];
    c.failures[k] = true;
    this.g.dropWarp();
    this.g.toast(`EQUIPMENT FAILURE: ${msg}`, 'bad'); if (this.g.chatter) this.g.chatter('failure');
  }

  spawnRogue() {
    const g = this.g, c = g.craft, rnd = this.rnd;
    const dir = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const side = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(dir).normalize();
    const miss = 25 + rnd() * 500, speed = 45 + rnd() * 90, radius = 8 + rnd() * 22;
    const pos = c.pos.clone().addScaledVector(dir, 5000).addScaledVector(side, miss);
    const vel = c.vel.clone().addScaledVector(dir, -speed);
    this.rogue = { pos, vel, radius, scanned: false, closest: 1e9, seed: rnd() * 100 };
    g.dropWarp();
    g.toast(`PROXIMITY ALERT — asteroid on a near-miss trajectory (${miss.toFixed(0)} m). Manoeuvre if needed.`, 'bad');
    g.spawnRogueMesh(this.rogue);
  }

  stepRogue(dt) {
    const g = this.g, r = this.rogue, c = g.craft, acc = new Vector3();
    g.system.gravity(r.pos, acc, c.env.body);
    r.vel.addScaledVector(acc, dt); r.pos.addScaledVector(r.vel, dt);
    const d = r.pos.distanceTo(c.pos);
    r.closest = Math.min(r.closest, d);
    if (!c.destroyed && d < r.radius + c.length * 0.5) c.destroy('The vehicle collided with an asteroid.');
    if (!r.scanned && d < 1500 && c.instruments.length) { r.scanned = true; g.addScience(8, 'Asteroid fly-by data'); }
    if (d > 9000 || c.destroyed) {
      if (!c.destroyed) g.toast(`Asteroid passed at ${r.closest.toFixed(0)} m`, 'good');
      g.removeRogueMesh(); this.rogue = null;
    }
  }

  toJSON() { return { next: this.next, storm: this.storm }; }
  load(d) { if (d) { Object.assign(this.next, d.next); this.storm = d.storm; } }
}
