// The Birdtier astronaut corps. Each bird has its own colours (used by the 3D EVA model and the
// UI portraits) and one perk that changes real gameplay numbers through `mods`.
//
// mods keys (all multipliers, default 1):
//   sci       science from instruments, samples and science stations
//   sample    extra multiplier for surface samples and science stations only
//   repair    repair time
//   walk      EVA walking speed
//   jump      EVA jump velocity
//   drive     rover top speed
//   discover  science for discovering new locations
//   launch    launch cost
//   funds     mission fund rewards
//   seeds     Space Seeds from treasure
//   ec        battery capacity

export const CREW = [
  {
    id: 'abbas', name: 'Abbas', species: 'Peach-faced lovebird', role: 'Commander',
    perk: 'Leads every mission: +15% science from all experiments.',
    mods: { sci: 1.15 },
    look: { body: 0x4fae3a, chest: 0x8fd16a, head: 0x4fae3a, face: 0xff5f3a, cheek: null, wing: 0x3f9a2f, tail: 0x3a78d0, beak: 0xf0e2c0, eye: 0x111111, crest: null, tailLen: 0.32 },
  },
  {
    id: 'salman', name: 'Salman', species: 'African grey', role: 'Engineer',
    perk: 'The best bird, and a fierce one: repairs take half the time.',
    mods: { repair: 0.5 },
    look: { body: 0x7f858c, chest: 0x969ba1, head: 0x8b9097, face: 0xdcdcdc, cheek: null, wing: 0x6c7279, tail: 0xc8202a, beak: 0x1d1d1d, eye: 0xf2f2e6, crest: null, tailLen: 0.3 },
  },
  {
    id: 'cookie', name: 'Cookie', species: 'Cockatiel', role: 'Scout',
    perk: 'Fast but lazy: walks 45% faster on EVA, but samples are worth 15% less.',
    mods: { walk: 1.45, sample: 0.85 },
    look: { body: 0xf1eee6, chest: 0xf7f4ec, head: 0xf6e04a, face: 0xf6e04a, cheek: 0xff8a2a, wing: 0xe6e1d6, tail: 0xece8dd, beak: 0x9a948c, eye: 0x111111, crest: 0xf6e04a, tailLen: 0.62 },
  },
  {
    id: 'lightning', name: 'Lightning', species: 'Grey cockatiel', role: 'Rover driver',
    perk: 'Young and quick: drives the rover 35% faster.',
    mods: { drive: 1.35 },
    look: { body: 0x7a7c81, chest: 0x8a8c91, head: 0xf3d84a, face: 0xf3d84a, cheek: 0xff8a2a, wing: 0x6a6c71, wingPatch: 0xf2f2f2, tail: 0x5f6166, beak: 0x8f8a84, eye: 0x111111, crest: 0xb9b06a, tailLen: 0.62 },
  },
  {
    id: 'pikachu', name: 'Pikachu', species: 'Lutino cockatiel', role: 'Scientist',
    perk: 'Careful field work: samples and science stations are worth 30% more.',
    mods: { sample: 1.3 },
    look: { body: 0xf8efc4, chest: 0xfbf4d6, head: 0xfde35a, face: 0xfde35a, cheek: 0xff8a2a, wing: 0xf3e4a6, tail: 0xf2e3a8, beak: 0xd9cfb8, eye: 0x111111, crest: 0xfde35a, tailLen: 0.62 },
  },
  {
    id: 'silver', name: 'Silver', species: 'Lovebird', role: 'Explorer',
    perk: 'Always wandering: new locations give triple discovery science.',
    mods: { discover: 3 },
    look: { body: 0xc5c9ce, chest: 0xdadde1, head: 0xd2d5d9, face: 0xf3f3f3, cheek: null, wing: 0xb3b8be, tail: 0x9ea4ab, beak: 0xf0e2c0, eye: 0x111111, crest: null, tailLen: 0.3 },
  },
  {
    id: 'aziz', name: 'Aziz', species: 'Indian ringneck', role: 'Pilot',
    perk: 'Strong legs: jumps 60% higher on EVA.',
    mods: { jump: 1.6 },
    look: { body: 0x56be48, chest: 0x7fd36a, head: 0x62c852, face: 0x6fd05f, cheek: null, ring: 0x1a1a1a, wing: 0x48a83c, tail: 0x3d9fb0, beak: 0xd8262f, eye: 0x111111, crest: null, tailLen: 0.85 },
  },
  {
    id: 'lemon', name: 'Lemon', species: 'Rainbow lorikeet', role: 'Quartermaster',
    perk: 'Knows every supplier: launches cost 15% less.',
    mods: { launch: 0.85 },
    look: { body: 0x2f9e3a, chest: 0xff5a1f, head: 0x2c4fd6, face: 0x2c4fd6, cheek: null, nape: 0xb7e23a, wing: 0x2a8c34, tail: 0x3aa845, beak: 0xff6b1a, eye: 0x111111, crest: null, tailLen: 0.5 },
  },
  {
    id: 'mango', name: 'Mango', species: 'Peach-faced lovebird', role: 'Navigator',
    perk: 'Reads the stars: +10% science and double discovery science.',
    mods: { sci: 1.1, discover: 2 },
    look: { body: 0x5cb840, chest: 0x93d468, head: 0x5cb840, face: 0xffa07a, cheek: null, wing: 0x4aa236, tail: 0x3f86d6, beak: 0xf2e6c4, eye: 0x111111, crest: null, tailLen: 0.32 },
  },
  {
    id: 'coco', name: 'Coco', species: 'Rainbow lorikeet', role: 'Adventurer',
    perk: 'Young and bouncy: walks and drives 20% faster.',
    mods: { walk: 1.2, drive: 1.2 },
    look: { body: 0x34a83f, chest: 0xff7a1f, head: 0x3657e0, face: 0x3657e0, cheek: null, nape: 0xc6ec3c, wing: 0x2c9637, tail: 0x3db24a, beak: 0xff5a1a, eye: 0x111111, crest: null, tailLen: 0.5 },
  },
  {
    id: 'mercury', name: 'Mercury', species: 'Young cockatiel', role: 'Cadet',
    perk: 'The new kid: jumps 30% higher and walks 15% faster.',
    mods: { jump: 1.3, walk: 1.15 },
    look: { body: 0x9a9ca1, chest: 0xa9abaf, head: 0xd8cf8a, face: 0xe6dc8f, cheek: 0xf2964a, wing: 0x86888d, wingPatch: 0xeeeeee, tail: 0x7c7e83, beak: 0x9a948c, eye: 0x111111, crest: 0xb7ae74, tailLen: 0.5 },
  },
  {
    id: 'orange', name: 'Orange', species: 'Canary', role: 'Radio operator',
    perk: 'Loves to sing: mission rewards pay 20% more funds.',
    mods: { funds: 1.2 },
    look: { body: 0xffa726, chest: 0xffc04d, head: 0xffb238, face: 0xffb238, cheek: null, wing: 0xf08f12, tail: 0xe8890f, beak: 0xf3c9a0, eye: 0x111111, crest: null, tailLen: 0.38 },
  },
  {
    id: 'jafar', name: 'Jafar', species: 'Zebra finch', role: 'Cook',
    perk: 'Loves rice: finds 30% more Space Seeds in treasure caches.',
    mods: { seeds: 1.3 },
    look: { body: 0x8c7a6b, chest: 0xd9c9b3, head: 0x9a8a7c, face: 0xece4d8, cheek: 0xe07a3a, wing: 0x7a6758, tail: 0x2a2a2a, beak: 0xff6a2a, eye: 0x111111, crest: null, tailLen: 0.3 },
  },
  {
    id: 'snowflake', name: 'Snowflake', species: 'White cockatiel', role: 'Systems engineer',
    perk: 'Calm and careful: +40% battery capacity and 30% faster repairs.',
    mods: { ec: 1.4, repair: 0.7 },
    look: { body: 0xf5f3ee, chest: 0xfbfaf6, head: 0xfaf7ef, face: 0xfaf3d8, cheek: 0xffb07a, wing: 0xebe8e1, tail: 0xefece5, beak: 0xb3ada5, eye: 0x111111, crest: 0xfaf6ea, tailLen: 0.62 },
  },
];

// Birds you start with; the rest are lost on other worlds and join when you rescue them.
export const STARTING_CREW = ['abbas', 'cookie', 'lightning'];
// Where each missing bird is waiting to be rescued.
export const RESCUE_AT = { salman: 'miro', lemon: 'pell', pikachu: 'ordun', mango: 'kesh', aziz: 'cindra', mercury: 'ysolde', coco: 'lume', silver: 'vey', jafar: 'solme', snowflake: 'durn', orange: 'aphra' };

export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c]));
export const DEFAULT_PILOT = 'abbas';
export const crewById = (id) => CREW_BY_ID[id] || CREW_BY_ID[DEFAULT_PILOT];
export const mod = (bird, key) => (bird && bird.mods[key]) || 1;
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
