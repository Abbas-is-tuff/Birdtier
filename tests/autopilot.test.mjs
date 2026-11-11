// Headless autopilot checks: flies the real physics without rendering.
// Run: node tests/autopilot.test.mjs
import { Vector3 } from 'three';
import { StarSystem } from '../src/world/StarSystem.js';
import { Craft } from '../src/spacecraft/Craft.js';
import { DEFAULT_DESIGN } from '../src/spacecraft/designs.js';
import { elementsFromState } from '../src/physics/kepler.js';
import { Autopilot, transferPlan, totalDv } from '../src/game/autopilot.js';

const WARPS = [1, 2, 5, 10, 100, 1000];
function makeGame(sys) {
  const g = {
    system: sys, t: 0, warpIdx: 0, craft: null, entity: null, orbit: null, log: [],
    toast: (m) => g.log.push(m), chatter: () => {},
    maxWarpIdx() { const c = g.craft; return c.thr.F > 0 || c.env.inAtmo ? 4 : WARPS.length - 1; },
    autoWarp(i) { g.warpIdx = Math.max(0, Math.min(i, g.maxWarpIdx())); },
  };
  g.ap = new Autopilot(g);
  return g;
}
function frame(g) {
  const c = g.craft, sys = g.system;
  const b = c.env.body, rel = new Vector3().subVectors(c.pos, b.pos);
  g.orbit = elementsFromState(rel, c.env.vOrb, b.mu);
  g.ap.update();
  const dtGame = (1 / 60) * WARPS[g.warpIdx];
  if (c.landed) { g.t += dtGame; sys.update(g.t); c.stepLanded(dtGame, sys); return; }
  let rem = dtGame, n = 0;
  while (rem > 1e-9 && n < 900) { const dt = Math.min(rem, c.suggestDt()); c.step(dt, sys, g.t); if (c.landed || c.destroyed) { sys.update(g.t); break; } g.t += dt; rem -= dt; n++; }
  if (c.landed) c.syncLanded();
}
function run(g, until, maxFrames = 400000) { let i = 0; while (i++ < maxFrames && !until()) { frame(g); if (g.craft.destroyed) break; } return i; }
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

// 1. Pad to orbit around Thalen
{
  const sys = new StarSystem(); sys.update(0);
  const g = makeGame(sys), c = new Craft(DEFAULT_DESIGN);
  c.placeOn(sys.home, sys.launchSite); g.craft = c; c.computeEnv(sys);
  const err = g.ap.start('orbit');
  const frames = run(g, () => !g.ap.active);
  const b = c.env.body, el = g.orbit;
  check(!err && !c.destroyed && el.e < 1 && el.pe - b.radius > b.atmo.top, `ascent: orbit ${Math.round((el.ap - b.radius) / 1000)} x ${Math.round((el.pe - b.radius) / 1000)} km in ${Math.round(g.t)} s game time (${frames} frames), Δv left ${Math.round(totalDv(c))} m/s — ${g.log.at(-1)}`);
  // 2. plan to Miro is affordable from there
  const plan = transferPlan(b, c.env.r, sys.byId.miro);
  check(plan && plan.dv < totalDv(c), `transfer to Miro needs ${Math.round(plan.dv)} m/s, ${Math.round(plan.time / 3600)} h`);
}

// 3. Land on several bodies from a low circular orbit, with a fresh starter rocket's upper stage
for (const id of ['miro', 'thalen', 'ordun', 'pell']) {
  const sys = new StarSystem(); sys.update(0);
  const g = makeGame(sys), c = new Craft(DEFAULT_DESIGN);
  c.placeOn(sys.home, sys.launchSite); c.activateNextStage(); c.activateNextStage(); c.landed = null;
  const B = sys.byId[id], r = B.radius + Math.max(B.atmo ? B.atmo.top + 15000 : 0, B.terrain.maxH + 12000, B.radius * 0.12);
  const dir = new Vector3(1, 0, 0), pro = new Vector3().copy(B.axis).cross(dir).normalize();
  c.pos.copy(B.pos).addScaledVector(dir, r); c.vel.copy(B.vel).addScaledVector(pro, Math.sqrt(B.mu / r));
  c.quat.setFromUnitVectors(new Vector3(0, 1, 0), pro); g.craft = c; c.computeEnv(sys);
  const err = g.ap.start('land');
  run(g, () => !g.ap.active);
  check(!err && !!c.landed && !c.destroyed, `land on ${B.name}: ${c.landed ? 'landed' : c.destroyed ? 'CRASHED: ' + c.destroyReason : 'not landed'} after ${Math.round(g.t)} s, fuel left ${Math.round(c.stage ? c.stage.fuel : 0)} kg — ${g.log.at(-1)}`);
}
if (fails) { console.log(`${fails} autopilot check(s) failed`); process.exit(1); }
console.log('All autopilot checks passed');
