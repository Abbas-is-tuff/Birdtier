// Spacecraft component catalogue. Every property listed here is consumed by the simulation
// (spacecraft/Craft.js) or the builder (spacecraft/designs.js) — nothing is decorative.
//   mass   dry mass, kg            h      height in the stack, m (inline parts only)
//   fuel   liquid propellant, kg   solid  solid propellant, kg
//   thrust vacuum thrust, N        isp*   specific impulse, s
//   tier   research tier required  order  position in the stack (low = top)
export const PARTS = {
  dock: { name: 'Docking port', cat: 'Utility', mass: 60, cost: 500, tier: 2, h: 0.25, order: 0, dock: true,
    info: 'Lets the craft dock with orbital stations to refuel.' },
  capsule: { name: 'Pioneer command capsule', cat: 'Command', mass: 820, cost: 2400, tier: 0, h: 1.9, order: 1,
    crew: 1, torque: 4000, ec: 60, info: 'One crew. Built-in reaction wheel and a small battery.' },
  cargo: { name: 'Cargo container', cat: 'Utility', mass: 300, cost: 800, tier: 2, h: 1.8, order: 2, cargo: 600,
    info: 'Carries 600 kg of construction materials for colony building.' },
  rover: { name: 'Rover bay “Mule”', cat: 'Utility', mass: 420, cost: 2200, tier: 3, h: 1.4, order: 3, rover: true,
    info: 'Holds a deployable solar-electric surface rover.' },
  wheel: { name: 'Reaction wheel', cat: 'Control', mass: 90, cost: 500, tier: 1, h: 0.4, order: 4, torque: 9000,
    info: 'Extra attitude authority. Uses electric charge.' },
  battery: { name: 'Battery bank', cat: 'Power', mass: 55, cost: 350, tier: 0, h: 0.3, order: 5, ec: 400,
    info: 'Stores 400 units of electric charge.' },
  tankS: { name: 'FT-200 fuel tank', cat: 'Propulsion', mass: 230, cost: 500, tier: 0, h: 2.2, order: 6, fuel: 2000,
    info: '2,000 kg of liquid propellant.' },
  tankM: { name: 'FT-440 fuel tank', cat: 'Propulsion', mass: 480, cost: 900, tier: 0, h: 4.2, order: 6, fuel: 4400,
    info: '4,400 kg of liquid propellant.' },
  tankL: { name: 'FT-900 fuel tank', cat: 'Propulsion', mass: 950, cost: 1600, tier: 1, h: 7.5, order: 6, fuel: 9000,
    info: '9,000 kg of liquid propellant.' },
  engKestrel: { name: '“Kestrel” vacuum engine', cat: 'Propulsion', mass: 420, cost: 1100, tier: 0, h: 1.6, order: 9,
    thrust: 62e3, ispVac: 348, ispSL: 105, info: 'Efficient upper-stage engine. Very weak at sea level.' },
  engHarrier: { name: '“Harrier” booster engine', cat: 'Propulsion', mass: 1350, cost: 1500, tier: 0, h: 2.2, order: 9,
    thrust: 245e3, ispVac: 302, ispSL: 268, info: 'High-thrust first-stage engine.' },
  engSparrow: { name: '“Sparrow” landing engine', cat: 'Propulsion', mass: 180, cost: 700, tier: 2, h: 0.9, order: 9,
    thrust: 22e3, ispVac: 322, ispSL: 140, info: 'Light, throttleable engine for landers.' },
  srb: { name: '“Flint” solid boosters (pair)', cat: 'Propulsion', mass: 900, cost: 900, tier: 0, radial: true,
    solid: 5200, thrust: 310e3, ispVac: 212, ispSL: 188, info: 'Cannot be throttled or shut down once lit.' },
  legs: { name: 'Landing legs (set of 4)', cat: 'Structure', mass: 140, cost: 600, tier: 1, radial: true, legs: true,
    info: 'Raises the safe touchdown speed from 7 to 12 m/s when deployed.' },
  chute: { name: 'Parachute', cat: 'Recovery', mass: 90, cost: 400, tier: 0, radial: true, chute: 420,
    info: 'Opens below 250 m/s in atmosphere. Needs thick air to be useful.' },
  rcs: { name: 'RCS thruster set', cat: 'Control', mass: 110, cost: 700, tier: 1, radial: true, mono: 120, rcsThrust: 1600,
    info: 'Translation and rotation using 120 kg of monopropellant.' },
  solar: { name: 'Solar array (pair)', cat: 'Power', mass: 45, cost: 600, tier: 1, radial: true, solar: 3.2,
    info: 'Generates 3.2 charge/s at Thalen’s distance when deployed and sunlit.' },
  thermo: { name: 'Thermometer', cat: 'Science', mass: 8, cost: 200, tier: 0, radial: true, sci: { id: 'temp', label: 'Temperature scan', base: 4 },
    info: 'Records ambient temperature.' },
  baro: { name: 'Barometer', cat: 'Science', mass: 10, cost: 350, tier: 1, radial: true, sci: { id: 'pres', label: 'Pressure scan', base: 5 },
    info: 'Records atmospheric pressure.' },
  spectro: { name: 'Spectral scanner', cat: 'Science', mass: 60, cost: 1400, tier: 2, radial: true, sci: { id: 'spec', label: 'Spectral survey', base: 12 },
    info: 'Composition survey. High science value.' },
};

export const TIER_COST = [0, 20, 60, 150]; // science needed to unlock each research tier
export const TIER_NAMES = ['Starter hardware', 'Orbital operations', 'Deep-space logistics', 'Surface mobility'];
export const CATEGORIES = ['Command', 'Propulsion', 'Control', 'Power', 'Structure', 'Recovery', 'Science', 'Utility'];
