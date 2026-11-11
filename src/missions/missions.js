// Mission chain and research progression. A mission becomes active once the one it
// `requires` is complete; the player starts with exactly one.
export const MISSIONS = [
  { id: 'm1', title: 'First Light', text: 'Launch and climb above 5,000 m over Thalen.', reward: { funds: 6000, science: 5 },
    check: (g) => !g.craft.landed && g.craft.env.body.id === 'thalen' && g.craft.env.alt > 5000 },
  { id: 'm2', title: 'Above the Sky', text: 'Leave Thalen’s atmosphere (above 68.4 km).', requires: 'm1', reward: { funds: 9000, science: 10 },
    check: (g) => g.craft.env.body.id === 'thalen' && g.craft.env.alt > g.craft.env.body.atmo.top },
  { id: 'm3', title: 'Stable Orbit', text: 'Raise your periapsis above 70 km around Thalen.', requires: 'm2', reward: { funds: 15000, science: 20, materials: 150 },
    check: (g) => g.craft.env.body.id === 'thalen' && g.orbit && g.orbit.e < 1 && g.orbit.pe - 6e5 > 70000 },
  { id: 'm4', title: 'Safe Return', text: 'Come back from space and land or splash down on Thalen.', requires: 'm2', reward: { funds: 8000, science: 10 },
    check: (g) => g.craft.landed && g.craft.landed.body.id === 'thalen' && g.craft.beenToSpace },
  { id: 'm5', title: 'Lunar Passage', text: 'Enter the sphere of influence of Miro.', requires: 'm3', reward: { funds: 15000, science: 25 },
    check: (g) => g.craft.env.body.id === 'miro' },
  { id: 'm6', title: 'Miro Touchdown', text: 'Land on Miro.', requires: 'm5', reward: { funds: 25000, science: 40, materials: 300 },
    check: (g) => g.craft.landed && g.craft.landed.body.id === 'miro' },
  { id: 'm7', title: 'Field Geology', text: 'Collect a surface sample on any world other than Thalen.', requires: 'm3', reward: { funds: 10000, science: 20 },
    check: (g) => g.progress.flags.offworldSample },
  { id: 'm8', title: 'Rendezvous', text: 'Dock with Meridian Station (needs a docking port).', requires: 'm3', reward: { funds: 20000, science: 25 },
    check: (g) => g.craft.docked && g.craft.docked.id === 'meridian' },
  { id: 'm9', title: 'Foundations', text: 'Found a colony with a habitat on any world.', requires: 'm3', reward: { funds: 20000, science: 30, materials: 300 },
    check: (g) => g.colonies.some((c) => c.count('habitat', false) > 0) },
  { id: 'm10', title: 'Self-Sufficient', text: 'Grow a colony to 4 colonists with a working greenhouse.', requires: 'm9', reward: { funds: 40000, science: 60 },
    check: (g) => g.colonies.some((c) => c.pop >= 4 && c.has('greenhouse')) },
  { id: 'm11', title: 'Red Sands', text: 'Land on Ordun.', requires: 'm5', reward: { funds: 50000, science: 80, materials: 400 },
    check: (g) => g.craft.landed && g.craft.landed.body.id === 'ordun' },
  { id: 'm12', title: 'Ring Shepherd', text: 'Enter a closed orbit around Brannoch.', requires: 'm5', reward: { funds: 70000, science: 120 },
    check: (g) => g.craft.env.body.id === 'brannoch' && g.orbit && g.orbit.e < 1 && g.orbit.pe > 5.5e6 + 520e3 },
];

export function newProgress() {
  return { funds: 25000, science: 0, materials: 0, tier: 0, done: [], discoveries: [], sciDone: [], flags: {}, launches: 0 };
}
export function activeMissions(p) {
  return MISSIONS.filter((m) => !p.done.includes(m.id) && (!m.requires || p.done.includes(m.requires)));
}
