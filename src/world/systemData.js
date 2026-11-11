// The Kaelis system — an original fictional star system.
// Distances are deliberately compact (roughly 1/10 real-world scale) so that missions are
// playable in reasonable time; every number below is used by the simulation.
const D = Math.PI / 180;
export const HOME_ID = 'thalen';

export const BODIES = [
  {
    id: 'kaelis', name: 'Kaelis', type: 'star', mu: 1.4e18, radius: 2.4e8, rotPeriod: 2.2e6, tempK: 5650,
    terrainLabel: 'Convective photosphere', desc: 'A calm G-class dwarf. Its flares are the source of the solar storms that sweep the system.',
  },
  {
    id: 'cindra', name: 'Cindra', type: 'planet', parent: 'kaelis', mu: 5.32e11, radius: 3.2e5, rotPeriod: 108000, tilt: 2 * D,
    orbit: { a: 5.6e9, e: 0.08, i: 3 * D, lan: 40 * D, argp: 10 * D, M0: 1.0 },
    atmo: { p0: 4200, H: 7500, M: 0.064, color: [1.0, 0.55, 0.25], strength: 0.45, comp: 'SO₂ 71%, CO₂ 22%, Ar 7%' },
    tempK: 640, tempSwing: 90, terrain: { type: 'volcanic', amp: 3200, seed: 11, tint: [0.3, 0.2, 0.18] },
    terrainLabel: 'Basalt ridges, shield volcanoes and open lava seas', sciMult: 6,
    desc: 'A scorched volcanic world. Its lava seas never cool; landing on them is fatal.',
  },
  {
    id: 'thalen', name: 'Thalen', type: 'planet', parent: 'kaelis', mu: 3.5316e12, radius: 6.0e5, rotPeriod: 21600, tilt: 14 * D,
    orbit: { a: 1.4e10, e: 0.01, i: 0, lan: 0, argp: 0, M0: 0.3 },
    atmo: { p0: 101325, H: 5600, M: 0.029, color: [0.19, 0.42, 1.0], strength: 0.36, comp: 'N₂ 76%, O₂ 22%, Ar 1%, H₂O trace', clouds: 6500 },
    tempK: 288, tempSwing: 16, terrain: { type: 'ocean', amp: 4500, seed: 3 },
    terrainLabel: 'Global ocean with scattered continents, mountain belts and polar ice', sciMult: 1,
    desc: 'Home. Two thirds of the surface is ocean. The Halden Reach launch site sits on the equatorial coast.',
  },
  {
    id: 'miro', name: 'Miro', type: 'moon', parent: 'thalen', mu: 3.84e10, radius: 1.6e5, rotPeriod: 138970, tilt: 0,
    orbit: { a: 1.2e7, e: 0.02, i: 2 * D, lan: 0, argp: 0, M0: 2.2 },
    tempK: 240, tempSwing: 180, terrain: { type: 'rock', amp: 1800, seed: 21, tint: [0.52, 0.5, 0.47] },
    terrainLabel: 'Cratered regolith plains and dark mare lowlands', sciMult: 3,
    desc: 'Thalen’s large inner moon and the natural first step outward. Airless and heavily cratered.',
  },
  {
    id: 'pell', name: 'Pell', type: 'moon', parent: 'thalen', mu: 7.09e8, radius: 4.5e4, rotPeriod: 61000, tilt: 0,
    orbit: { a: 3.4e7, e: 0.05, i: 8 * D, lan: 70 * D, argp: 30 * D, M0: 0.4 },
    tempK: 230, tempSwing: 150, terrain: { type: 'rock', amp: 1500, seed: 22, tint: [0.4, 0.33, 0.28] },
    terrainLabel: 'Irregular rubble surface with deep impact scars', sciMult: 4,
    desc: 'A small captured body on an inclined orbit. Gravity is so weak a jump lasts half a minute.',
  },
  {
    id: 'ordun', name: 'Ordun', type: 'planet', parent: 'kaelis', mu: 4.16e11, radius: 3.4e5, rotPeriod: 88000, tilt: 21 * D,
    orbit: { a: 2.25e10, e: 0.05, i: 1.6 * D, lan: 110 * D, argp: 200 * D, M0: 4.0 },
    atmo: { p0: 6200, H: 9000, M: 0.044, color: [0.95, 0.6, 0.38], strength: 0.3, comp: 'CO₂ 94%, N₂ 3%, Ar 2%' },
    tempK: 215, tempSwing: 70, terrain: { type: 'desert', amp: 5200, seed: 31 },
    terrainLabel: 'Dune seas, high plateaus and winding canyon systems', sciMult: 5,
    desc: 'A cold rust-coloured desert. Thin air makes parachutes weak and dust storms long.',
  },
  {
    id: 'kesh', name: 'Kesh', type: 'moon', parent: 'ordun', mu: 5.8e7, radius: 2.2e4, rotPeriod: 30000, tilt: 0,
    orbit: { a: 4.5e6, e: 0.01, i: 1 * D, lan: 0, argp: 0, M0: 1.1 },
    tempK: 200, tempSwing: 110, terrain: { type: 'rock', amp: 900, seed: 32, tint: [0.36, 0.3, 0.27] },
    terrainLabel: 'Dark carbonaceous rubble', sciMult: 6,
    desc: 'A lumpy moonlet barely held together by its own gravity.',
  },
  {
    id: 'brannoch', name: 'Brannoch', type: 'planet', parent: 'kaelis', mu: 4.235e14, radius: 5.5e6, rotPeriod: 36000, tilt: 22 * D,
    orbit: { a: 5.6e10, e: 0.04, i: 1.1 * D, lan: 200 * D, argp: 80 * D, M0: 2.6 },
    atmo: { p0: 2.0e5, H: 40000, M: 0.0023, color: [0.75, 0.6, 0.42], strength: 0.25, comp: 'H₂ 88%, He 11%, CH₄ trace' },
    tempK: 130, tempSwing: 4,
    terrain: { type: 'gas', seed: 41, palette: [[0.93, 0.87, 0.74], [0.78, 0.6, 0.42], [0.62, 0.36, 0.24], [0.84, 0.74, 0.6], [0.5, 0.52, 0.6]] },
    rings: { inner: 1.45, outer: 2.3, seed: 5 },
    terrainLabel: 'No solid surface — banded hydrogen cloud decks', sciMult: 8,
    desc: 'A ringed gas giant with four moons. Descending below the cloud tops ends in crushing pressure.',
  },
  {
    id: 'vey', name: 'Vey', type: 'moon', parent: 'brannoch', mu: 5.18e10, radius: 1.8e5, rotPeriod: 96000, tilt: 0,
    orbit: { a: 2.6e7, e: 0.01, i: 0.5 * D, lan: 0, argp: 0, M0: 0.2 },
    tempK: 180, tempSwing: 60, terrain: { type: 'volcanic', amp: 2200, seed: 42, tint: [0.5, 0.42, 0.12] },
    terrainLabel: 'Tidally heated sulphur plains and active calderas', sciMult: 9,
    desc: 'Kneaded by Brannoch’s tides, Vey is the most volcanically active body in the system.',
  },
  {
    id: 'solme', name: 'Solme', type: 'moon', parent: 'brannoch', mu: 1.284e11, radius: 2.6e5, rotPeriod: 150000, tilt: 0,
    orbit: { a: 4.4e7, e: 0.01, i: 0.3 * D, lan: 0, argp: 0, M0: 3.0 },
    tempK: 105, tempSwing: 25, terrain: { type: 'ice', amp: 1300, seed: 43, tint: [0.8, 0.86, 0.9] },
    terrainLabel: 'Fractured ice shell over a suspected subsurface ocean', sciMult: 9,
    desc: 'A bright ice moon criss-crossed with fracture zones.',
  },
  {
    id: 'durn', name: 'Durn', type: 'moon', parent: 'brannoch', mu: 2.21e11, radius: 3.1e5, rotPeriod: 260000, tilt: 0,
    orbit: { a: 7.4e7, e: 0.02, i: 1 * D, lan: 0, argp: 0, M0: 5.1 },
    tempK: 115, tempSwing: 50, terrain: { type: 'rock', amp: 2400, seed: 44, tint: [0.44, 0.4, 0.36] },
    terrainLabel: 'Ancient cratered highlands', sciMult: 8,
    desc: 'The largest moon in the system; old, cold and geologically quiet.',
  },
  {
    id: 'aphra', name: 'Aphra', type: 'moon', parent: 'brannoch', mu: 1.8e8, radius: 3.0e4, rotPeriod: 42000, tilt: 0,
    orbit: { a: 1.3e8, e: 0.09, i: 15 * D, lan: 130 * D, argp: 0, M0: 4.4 },
    tempK: 100, tempSwing: 40, terrain: { type: 'rock', amp: 1100, seed: 45, tint: [0.5, 0.38, 0.34] },
    terrainLabel: 'Reddish irregular rubble', sciMult: 10,
    desc: 'A distant, inclined moonlet — probably a captured asteroid.',
  },
  {
    id: 'ysolde', name: 'Ysolde', type: 'planet', parent: 'kaelis', mu: 2.018e11, radius: 2.9e5, rotPeriod: 131000, tilt: 31 * D,
    orbit: { a: 9.2e10, e: 0.11, i: 5 * D, lan: 300 * D, argp: 140 * D, M0: 0.9 },
    atmo: { p0: 950, H: 14000, M: 0.028, color: [0.45, 0.62, 0.95], strength: 0.2, comp: 'N₂ 96%, CH₄ 3%, CO 1%' },
    tempK: 62, tempSwing: 12, terrain: { type: 'ice', amp: 2100, seed: 51, tint: [0.72, 0.8, 0.92] },
    terrainLabel: 'Nitrogen-ice plains, water-ice highlands and frozen basins', sciMult: 12,
    desc: 'The frozen outer planet. Sunlight here is forty times weaker than at Thalen.',
  },
  {
    id: 'lume', name: 'Lume', type: 'moon', parent: 'ysolde', mu: 2.45e9, radius: 7.0e4, rotPeriod: 77000, tilt: 0,
    orbit: { a: 3.2e6, e: 0.0, i: 3 * D, lan: 0, argp: 0, M0: 2.0 },
    tempK: 55, tempSwing: 10, terrain: { type: 'ice', amp: 800, seed: 52, tint: [0.66, 0.7, 0.78] },
    terrainLabel: 'Smooth grey ice plains', sciMult: 12,
    desc: 'Ysolde’s close companion, tidally locked and nearly featureless.',
  },
  {
    id: 'meridian', name: 'Meridian Station', type: 'station', parent: 'thalen', mu: 0, radius: 25,
    orbit: { a: 7.2e5, e: 0, i: 0, lan: 0, argp: 0, M0: 1.5 },
    desc: 'Orbital depot 120 km above Thalen. Dock here to refuel.',
  },
  {
    id: 'calder', name: 'Calder Outpost', type: 'station', parent: 'ordun', mu: 0, radius: 25,
    orbit: { a: 4.6e5, e: 0, i: 0, lan: 0, argp: 0, M0: 0.5 },
    desc: 'A waystation in low Ordun orbit, built for the desert expeditions.',
  },
];

export const BELTS = [
  { id: 'inner', name: 'Tessel Belt', inner: 3.1e10, outer: 4.3e10, thickness: 1.6e9, count: 1800, color: [0.62, 0.56, 0.5] },
  { id: 'outer', name: 'Rime Belt', inner: 1.15e11, outer: 1.45e11, thickness: 6e9, count: 1400, color: [0.6, 0.68, 0.78] },
];
