// Radio chatter: what each bird says when things happen. Every bird has its own voice for the
// moments it cares about; anything it has no line for falls back to the shared lines.
// `{b}` is replaced with the body's name.

const SHARED = {
  pick: ['Reporting for duty!', 'Ready when you are.'],
  launch: ['Here we go!', 'Liftoff!', 'Engines lit — hold on to your feathers!'],
  stage: ['Stage away!', 'Bye-bye, empty tank.'],
  meco: ['Engines off. Coasting up to the top of the climb.'],
  space: ['We are in space! Look at all those stars.', 'The sky just turned black. Space!'],
  orbit: ['We are in orbit! Falling around {b} forever.', 'Orbit achieved. No more falling down — just falling around.'],
  autoOrbit: ['Autopilot has the stick. Taking us to orbit.'],
  autoLand: ['Autopilot engaged. Bringing us down nice and gentle.'],
  land: ['Touchdown on {b}!', 'The bird has landed on {b}.'],
  splash: ['Splash! We are floating.'],
  eva: ['Stepping outside. Wish me luck!', 'Hatch open. Feathers out!'],
  sample: ['Got a sample! Into the pouch it goes.'],
  discover: ['A new place! Writing it down.'],
  treasure: ['Treasure! Space Seeds everywhere!', 'Ooh, shiny! Seed cache found.'],
  ruins: ['Alien ruins... who built these?', 'These stones are older than anything I have ever seen.'],
  lowFuel: ['Fuel is getting low.', 'Careful — we are nearly out of fuel.'],
  noFuel: ['Tank is empty!'],
  storm: ['Solar storm! My feathers are standing up.'],
  failure: ['Something just broke. Can we fix it?'],
  travel: ['Plotting the course to {b}...', 'Next stop: {b}!'],
  arrive: ['Arrived at {b}!', 'Welcome to {b}, everybird.'],
  idle: ['Quiet up here.', 'Is it snack time yet?', 'I can see my nest from here!'],
};

const VOICES = {
  abbas: {
    pick: ['Commander Abbas, ready. Let’s make history.'],
    launch: ['All systems go. Lighting the candle!', 'This is Abbas — we have liftoff!'],
    orbit: ['Orbit secured. Great flying, team.'],
    land: ['Abbas here. The lovebird has landed on {b}.'],
    lowFuel: ['Fuel is getting low. Let’s not waste a single drop.'],
    idle: ['A good commander always checks the instruments. All green.', 'I miss my seed bowl... but not that much.'],
    treasure: ['Seeds! The whole flock will eat well tonight.'],
  },
  salman: {
    pick: ['Salman. Best bird on the team. Obviously.', 'You picked the right bird.'],
    launch: ['FINALLY. Punch it!', 'Move, gravity! Out of my way!'],
    stage: ['Get lost, useless tank!'],
    orbit: ['Orbit. Easy. Next.'],
    land: ['Landed. Did anyone doubt me? No.'],
    failure: ['WHO BROKE MY SHIP? ...Fine. I will fix it myself.'],
    storm: ['A storm? I am not scared of a storm. The storm should be scared of ME.'],
    lowFuel: ['Fuel is low. Do NOT make me walk.'],
    idle: ['If anyone touches my seeds, they will regret it.', 'Bite first, ask questions later.'],
    rescue: ['About time you showed up. I was NOT scared. Let’s go.'],
    eva: ['Outside. Nobody follow me.'],
  },
  cookie: {
    pick: ['Cookie here. Can we do the fast part first? Then nap?'],
    launch: ['Fast! Fast! FAST! ...ok that is fast enough.'],
    meco: ['Engines off? Perfect. Nap time.'],
    orbit: ['Orbit is nice. Very floaty. Very napable.'],
    land: ['We landed? Wake me up when there is something to see.'],
    eva: ['Zoom zoom! ...ok I am tired now.', 'I will run there super fast. Then sit down.'],
    sample: ['Sample! Can I lie down on it?'],
    idle: ['Zzz... huh? I wasn’t sleeping.', 'Is the autopilot doing the work? Good.'],
    treasure: ['Seeds! I ran so fast to get them. Now I need a nap.'],
  },
  lightning: {
    pick: ['ME? I get to fly?! Best day EVER!'],
    launch: ['WOOOOOO!', 'This is the BEST thing that has ever happened!'],
    space: ['I’m only 3 months old and I’m IN SPACE!'],
    orbit: ['We’re going SO fast and we’re not even falling down!'],
    land: ['Can I drive the rover? Can I? Please?'],
    eva: ['Bounce bounce bounce!'],
    idle: ['Are we there yet?', 'What does this button do?', 'Can we go faster?'],
    rescue: [],
  },
  pikachu: {
    pick: ['Pikachu here. Instruments calibrated.'],
    launch: ['Recording launch data... this is fascinating.'],
    sample: ['Beautiful sample. I can see three kinds of minerals already.', 'Labelled and sealed.'],
    ruins: ['These carvings... someone was trying to send a message.'],
    discover: ['New region logged. Science is wonderful.'],
    land: ['Gentle touchdown on {b}. Now, let’s get to work.'],
    idle: ['Did you know cockatiels can whistle a whole song? Science.', 'I could study this view forever.'],
    rescue: ['You found me! My notes survived too — look at all this data!'],
  },
  silver: {
    pick: ['Silver. Where are we going? Somewhere new, I hope.'],
    discover: ['Never been here before. That’s my favourite kind of place.', 'Another spot for the map!'],
    land: ['{b}... I want to see every corner of it.'],
    eva: ['Let’s go for a walk. A long one.'],
    idle: ['Wonder what’s over that hill.', 'Every planet has a secret.'],
    rescue: ['I wasn’t lost, I was exploring! ...ok, a bit lost. Thanks.'],
  },
  aziz: {
    pick: ['Aziz in the cockpit. Watch this.'],
    launch: ['Smooth as silk. That’s how a ringneck flies.'],
    orbit: ['Perfect orbit. You’re welcome.'],
    land: ['Textbook landing. Somebody film that?'],
    eva: ['Watch me jump!'],
    idle: ['I could fly this thing with my eyes closed.', 'Green feathers, red beak, best pilot.'],
    rescue: ['It’s hot down here! Get me out before my tail feathers melt!'],
  },
  lemon: {
    pick: ['Lemon here! I counted the snacks. We have enough. Probably.'],
    launch: ['Wheeee! Colours everywhere!'],
    treasure: ['Seeds! Counting... counting... SO many seeds!'],
    lowFuel: ['We are running low! I told you to buy the bigger tank!'],
    idle: ['Rainbow bird in a rainbow universe!', 'Budget looks good. Let’s spend it all.'],
    rescue: ['FINALLY! I ran out of snacks three days ago!'],
  },
  mango: {
    pick: ['Mango, navigator. I’ll find the way.'],
    discover: ['Marking it on the star chart.'],
    travel: ['Course plotted to {b}. The stars agree.'],
    idle: ['See that bright star? I named it after you.', 'Space smells like... nothing. Interesting.'],
    rescue: ['I knew someone would follow my beacon. The stars told me.'],
  },
  coco: {
    pick: ['Coco! Coco! Let’s goooo!'],
    launch: ['Hold on to your beaks!'],
    eva: ['Bounce! Bounce! Run!'],
    land: ['Can we explore? Can we? NOW?'],
    idle: ['I want to bounce on every planet!'],
    rescue: ['Yay! A ride! I was bouncing around all alone!'],
  },
  mercury: {
    pick: ['M-me? Okay. I can do this. I think.'],
    launch: ['Eeep! Too fast! ...okay, actually, this is cool.'],
    orbit: ['We didn’t crash! Is that normal?'],
    land: ['I landed? I LANDED!'],
    idle: ['Is space always this big?', 'I’m the new bird. Be nice to me.'],
    rescue: ['I’m so glad you came. It was cold and I was scared.'],
  },
  orange: {
    pick: ['♪ Orange on the radio, la la la ♪'],
    launch: ['♪ Up, up, up we go ♪'],
    orbit: ['♪ Round and round the planet ♪'],
    land: ['♪ We have landed on {b}, tra la la ♪'],
    idle: ['♪ Twinkle twinkle little star ♪', '♪ Tweet tweet, radio check ♪'],
    rescue: ['♪ You found me, you found me! ♪'],
  },
  jafar: {
    pick: ['Jafar here. Did someone pack the rice?'],
    treasure: ['Seeds! Almost as good as rice. Almost.'],
    land: ['Landed. Lunch break?'],
    idle: ['Rice. I am thinking about rice.', 'Is there rice in space? There should be.'],
    rescue: ['You came! Did you bring rice?'],
  },
  snowflake: {
    pick: ['Snowflake. Systems look calm. Let’s keep them that way.'],
    failure: ['Stay calm. I know exactly how to fix this.'],
    storm: ['Breathe. Storms pass. Keep the batteries charged.'],
    land: ['Soft landing. Very peaceful.'],
    idle: ['All systems quiet. I like quiet.'],
    rescue: ['Thank you. It was very quiet here. A bit too quiet.'],
  },
};

export function line(birdId, key, vars = {}) {
  const own = VOICES[birdId] && VOICES[birdId][key];
  const pool = own && own.length ? own : SHARED[key];
  if (!pool || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].replace(/\{b\}/g, vars.b || '');
}

// Short bird "squawk" made with Web Audio: a couple of chirps whose pitch suits the bird.
const PITCH = { abbas: 1.1, salman: 0.75, cookie: 1.3, lightning: 1.45, pikachu: 1.25, silver: 1.05, aziz: 0.95, lemon: 1.2, mango: 1.05, coco: 1.35, mercury: 1.5, orange: 1.6, jafar: 1.55, snowflake: 1.15 };
let ctx = null;
export function unlockAudio() {
  try {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}
export function squawk(birdId, volume = 0.5) {
  if (!ctx || ctx.state !== 'running' || volume <= 0) return;
  const base = 1500 * (PITCH[birdId] || 1), now = ctx.currentTime;
  const n = birdId === 'orange' ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const t = now + i * 0.11, o = ctx.createOscillator(), gn = ctx.createGain();
    const f0 = base * (0.9 + Math.random() * 0.25);
    o.type = birdId === 'salman' ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (birdId === 'salman' ? 0.6 : 1.6), t + 0.07);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.12 * volume, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(gn).connect(ctx.destination);
    o.start(t); o.stop(t + 0.1);
  }
}
