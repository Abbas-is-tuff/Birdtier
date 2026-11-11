// Upgrades bought with Space Seeds (found in seed caches and alien ruins). Each has a few levels.
export const UPGRADES = [
  { id: 'engines', name: 'Efficient engines', icon: '🔥', desc: '+8% engine efficiency (Isp) per level: more Δv from the same fuel.', cost: [60, 140, 260] },
  { id: 'tanks', name: 'Bigger fuel tanks', icon: '⛽', desc: '+12% fuel in every tank per level.', cost: [50, 120, 230] },
  { id: 'battery', name: 'Super batteries', icon: '🔋', desc: '+50% battery capacity per level.', cost: [40, 100] },
  { id: 'legs', name: 'Tough landing legs', icon: '🦿', desc: 'Survive touchdowns 3 m/s faster per level.', cost: [50, 120] },
  { id: 'jetpack', name: 'Bird jetpack', icon: '🚀', desc: 'Hold Jump on EVA to fly with a jetpack. Higher levels fly longer.', cost: [80, 180] },
  { id: 'rover', name: 'Turbo rover', icon: '🏎️', desc: '+30% rover speed per level.', cost: [60, 150] },
  { id: 'magnet', name: 'Seed magnet', icon: '🧲', desc: 'Pick up treasure from 3× farther away, and caches give +25% seeds.', cost: [90] },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const level = (p, id) => (p.upgrades && p.upgrades[id]) || 0;
export const nextCost = (p, id) => { const u = UPGRADE_BY_ID[id], l = level(p, id); return l < u.cost.length ? u.cost[l] : null; };

// Apply ship upgrades (and the pilot's battery perk) to a craft. `fill` tops up the bigger tanks (new launch).
export function applyCraftUpgrades(c, p, pilotMods, fill) {
  c.ispMul = 1 + 0.08 * level(p, 'engines');
  c.ecMul = (1 + 0.5 * level(p, 'battery')) * ((pilotMods && pilotMods.ec) || 1);
  c.tolBonus = 3 * level(p, 'legs');
  const fm = 1 + 0.12 * level(p, 'tanks');
  for (const st of c.stages) {
    if (st.baseFuelCap === undefined) st.baseFuelCap = st.fuelCap;
    st.fuelCap = st.baseFuelCap * fm;
    if (fill) st.fuel = st.fuelCap;
  }
  const wasFull = c.ec >= c.ecCap - 1e-6;
  c.recompute();
  if (fill || wasFull) c.ec = c.ecCap;
}
