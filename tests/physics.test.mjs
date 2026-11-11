// Headless physics checks. Run with: npm test
import { Vector3, Quaternion, Matrix4 } from 'three';
import { StarSystem } from '../src/world/StarSystem.js';
import { Craft } from '../src/spacecraft/Craft.js';
import { DEFAULT_DESIGN, designStats } from '../src/spacecraft/designs.js';
import { elementsFromState, orbitState } from '../src/physics/kepler.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

const system = new StarSystem();
const home = system.home;

// 1. Kepler propagation conserves the orbit of a moon.
{
  const miro = system.byId.miro, p = new Vector3(), v = new Vector3();
  orbitState(miro.orbit, home.mu, 12345, p, v);
  const el = elementsFromState(p, v, home.mu);
  check('Kepler state matches elements', Math.abs(el.a / miro.orbit.a - 1) < 1e-9 && Math.abs(el.e - miro.orbit.e) < 1e-9, `a=${el.a.toFixed(1)} e=${el.e.toFixed(5)}`);
}

// 2. A circular low orbit integrated numerically for 20 revolutions keeps its energy and shape.
{
  system.update(0);
  const c = new Craft(DEFAULT_DESIGN);
  const r = home.radius + 100e3, vc = Math.sqrt(home.mu / r);
  c.pos.copy(home.pos).add(new Vector3(r, 0, 0));
  c.vel.copy(home.vel).add(new Vector3(0, 0, -vc));
  c.sas = false;
  let t = 0, steps = 0;
  const T = 2 * Math.PI * Math.sqrt(r ** 3 / home.mu) * 20;
  c.step(0.02, system, t); t += 0.02;
  while (t < T) { const dt = c.suggestDt(); c.step(dt, system, t); t += dt; steps++; }
  const el = elementsFromState(c.pos.clone().sub(home.pos), c.vel.clone().sub(home.vel), home.mu);
  check('Circular orbit stable over 20 revolutions', Math.abs(el.a / r - 1) < 2e-3 && el.e < 1e-3, `a err=${((el.a / r - 1) * 100).toFixed(4)}% e=${el.e.toExponential(2)} steps=${steps}`);
}

// 3. The starter rocket can reach orbit with a simple gravity-turn guidance program.
{
  system.update(0);
  const c = new Craft(DEFAULT_DESIGN);
  c.placeOn(home, system.launchSite);
  c.sas = false;
  const stats = designStats(DEFAULT_DESIGN);
  let t = 0;
  c.activateNextStage(); c.throttle = 1;
  const up = new Vector3(), east = new Vector3(), dir = new Vector3(), m = new Matrix4(), z = new Vector3();
  let phase = 'ascent', maxQ = 0, orbit = null;
  const point = (d) => { // orient nose along d
    z.crossVectors(east, d).normalize(); const x = new Vector3().crossVectors(d, z);
    c.quat.setFromRotationMatrix(m.makeBasis(x, d, z)); c.angVel.set(0, 0, 0);
  };
  for (let i = 0; i < 4e6 && t < 4000; i++) {
    const dt = c.landed ? 0.02 : Math.min(c.suggestDt(), 0.5);
    if (c.landed) { t += dt; system.update(t); c.stepLanded(dt, system); continue; }
    const e = c.env;
    up.copy(e.up); east.copy(home.axis).cross(up).normalize();
    const rel = c.pos.clone().sub(home.pos);
    const el = elementsFromState(rel, e.vOrb, home.mu);
    const ap = el.ap - home.radius, pe = el.pe - home.radius;
    if (c.stage && c.stage.fuel <= 0 && c.stage.solid <= 0 && c.activeStage > 1) c.activateNextStage();
    if (phase === 'ascent') {
      const th = Math.pow(Math.min(1, Math.max(0, (e.alt - 800) / 42000)), 0.55) * 86 * Math.PI / 180;
      dir.copy(up).multiplyScalar(Math.cos(th)).addScaledVector(east, Math.sin(th)); point(dir);
      c.throttle = 1;
      if (ap > 82000) { phase = 'coast'; c.throttle = 0; }
    } else if (phase === 'coast') {
      dir.copy(e.vOrb).normalize(); point(dir);
      if (e.alt > 70000 && (e.vRelSurf.dot(up) < 15 || e.alt > ap - 1500)) phase = 'circ';
      if (ap < 74000 && e.alt < 69000) { c.throttle = 1; } else c.throttle = 0;
    } else if (phase === 'circ') {
      dir.copy(up).cross(home.axis).negate().normalize(); // horizontal prograde
      dir.crossVectors(home.axis, up).normalize(); point(dir);
      c.throttle = 1;
      if (pe > 71000) { c.throttle = 0; orbit = { ap, pe, t }; break; }
    }
    if (process.env.TRACE && i % 1500 === 0) console.log(t.toFixed(0), phase, 'alt', (e.alt/1000).toFixed(1), 'ap', (ap/1000).toFixed(1), 'pe', (pe/1000).toFixed(1), 'v', e.vOrb.length().toFixed(0), 'stg', c.activeStage, 'fuel', c.stage?.fuel.toFixed(0), 'm', c.mass().toFixed(0));
    maxQ = Math.max(maxQ, c.q);
    c.step(dt, system, t); t += dt;
    if (c.destroyed) break;
  }
  const dvLeft = c.stageDv();
  check('Starter rocket reaches orbit', !!orbit && !c.destroyed,
    orbit ? `Ap ${(orbit.ap / 1000).toFixed(1)} km, Pe ${(orbit.pe / 1000).toFixed(1)} km at T+${orbit.t.toFixed(0)} s, ${dvLeft.toFixed(0)} m/s left of ${stats.totalDv.toFixed(0)} m/s, max Q ${(maxQ / 1000).toFixed(1)} kPa`
      : `phase=${phase} alt=${c.env.alt.toFixed(0)} destroyed=${c.destroyed} ${c.destroyReason}`);
}

// 4. Launch site is on dry land.
check('Launch site above sea level', home.rawH(system.launchSite) > 30, `h=${home.rawH(system.launchSite).toFixed(1)} m`);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll physics checks passed');
process.exit(failed ? 1 : 0);
