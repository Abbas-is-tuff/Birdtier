// Craft designs: a design is a list of stages, top (index 0, holds the capsule) to bottom
// (last index, fires first). Each stage is a vertical stack of parts plus radial attachments.
import { PARTS } from './parts.js';
import { G0 } from '../physics/constants.js';

export const DEFAULT_DESIGN = {
  name: 'Wayfarer I',
  stages: [
    { parts: ['capsule', 'chute', 'thermo', 'battery'] },
    { parts: ['tankM', 'engKestrel'] },
    { parts: ['tankM', 'tankM', 'engHarrier'] },
  ],
};

export function stageInfo(parts) {
  const s = { dry: 0, fuel: 0, solid: 0, h: 0, cost: 0, liquid: [], solids: [] };
  for (const id of parts) {
    const p = PARTS[id];
    s.dry += p.mass; s.cost += p.cost; s.h += p.h || 0;
    if (p.fuel) s.fuel += p.fuel;
    if (p.solid) { s.solid += p.solid; s.solids.push(p); } else if (p.thrust) s.liquid.push(p);
  }
  return s;
}

export function sortParts(parts) {
  return [...parts].sort((a, b) => (PARTS[a].order ?? 20) - (PARTS[b].order ?? 20));
}

// Mass, cost and an approximate delta-v budget (ideal rocket equation, per stage, vacuum).
export function designStats(design, g = 9.81) {
  const infos = design.stages.map((s) => stageInfo(s.parts));
  const problems = [];
  const count = (st, f) => st.parts.filter((id) => f(PARTS[id])).length;
  if (!design.stages.length || count(design.stages[0], (p) => p.crew) !== 1) problems.push('The top stage needs exactly one command capsule.');
  design.stages.forEach((st, i) => {
    if (!st.parts.length) problems.push(`Stage ${i + 1} is empty.`);
    if (i > 0 && count(st, (p) => p.crew)) problems.push(`Stage ${i + 1}: only the top stage can hold the capsule.`);
    if (count(st, (p) => p.thrust && !p.solid) > 1) problems.push(`Stage ${i + 1}: one liquid engine per stage.`);
    if (count(st, (p) => p.fuel) > 4) problems.push(`Stage ${i + 1}: at most four tanks per stage.`);
    for (const key of ['solid', 'legs', 'chute', 'rcs', 'solar', 'dock', 'rover']) {
      if (count(st, (p) => p[key]) > 1) problems.push(`Stage ${i + 1}: only one “${st.parts.map((id) => PARTS[id]).find((p) => p[key]).name}” per stage.`);
    }
    const inf = infos[i];
    if (inf.fuel > 0 && !inf.liquid.length) problems.push(`Stage ${i + 1}: fuel tanks but no liquid engine.`);
    if (inf.liquid.length && inf.fuel === 0) problems.push(`Stage ${i + 1}: engine has no fuel tank.`);
  });
  if (design.stages.length > 6) problems.push('At most six stages.');
  let above = 0, total = 0, cost = 0;
  const stages = [];
  for (let i = 0; i < infos.length; i++) {
    const s = infos[i];
    const wet = above + s.dry + s.fuel + s.solid, prop = s.fuel + s.solid;
    let F = 0, mdot = 0;
    for (const e of s.liquid) if (s.fuel > 0) { F += e.thrust; mdot += e.thrust / (e.ispVac * G0); }
    for (const e of s.solids) { F += e.thrust; mdot += e.thrust / (e.ispVac * G0); }
    const isp = mdot > 0 ? F / (mdot * G0) : 0;
    const dv = prop > 0 && isp > 0 ? isp * G0 * Math.log(wet / (wet - prop)) : 0;
    stages.push({ wet, dry: wet - prop, dv, twr: F / (wet * g), thrust: F, prop });
    above = wet; total += dv; cost += s.cost;
  }
  return { mass: above, cost, stages, totalDv: total, problems, valid: problems.length === 0 };
}
