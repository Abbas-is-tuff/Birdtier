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
  cabin: ['Stretching my wings in the cabin.', 'Cosy in here!'],
  spacewalk: ['Opening the hatch... whoa, that is a long way down!', 'Spacewalk! Nothing but stars under my feet.'],
  window: ['Look at {b} out there!', 'Best window seat in the universe.'],
  snack: ['Nom nom nom. Space seeds taste the same as home seeds.', 'Crunch! Refuelled.'],
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
    cabin: ["Crew, looking good. Everyone strapped in?"],
    spacewalk: ["Going outside. Keep the lights on for me."],
    snack: ["A commander needs his seeds."],
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
    cabin: ["Nobody sits in MY seat."],
    spacewalk: ["Outside. Finally, some peace and quiet."],
    snack: ["MY seeds. Hands off. Wings off."],
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
    cabin: ["Floating is just lying down without a bed. I love it."],
    spacewalk: ["Zoom outside! ...okay, can I come back in and nap?"],
    snack: ["Snack, then nap. Perfect plan."],
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
    cabin: ["I can do a backflip in zero-g! Watch!"],
    spacewalk: ["I’M OUTSIDE IN SPACE! THIS IS AMAZING!"],
    window: ["Is that {b}?! It is SO big!"],
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
    window: ["Look at the colour of {b}’s atmosphere. Beautiful data."],
    spacewalk: ["Checking the hull for micrometeorite marks. Fascinating."],
  },
  silver: {
    pick: ['Silver. Where are we going? Somewhere new, I hope.'],
    discover: ['Never been here before. That’s my favourite kind of place.', 'Another spot for the map!'],
    land: ['{b}... I want to see every corner of it.'],
    eva: ['Let’s go for a walk. A long one.'],
    idle: ['Wonder what’s over that hill.', 'Every planet has a secret.'],
    rescue: ['I wasn’t lost, I was exploring! ...ok, a bit lost. Thanks.'],
    window: ["I want to explore every bit of {b}."],
    spacewalk: ["Out here I can see everywhere I haven’t been yet."],
  },
  aziz: {
    pick: ['Aziz in the cockpit. Watch this.'],
    launch: ['Smooth as silk. That’s how a ringneck flies.'],
    orbit: ['Perfect orbit. You’re welcome.'],
    land: ['Textbook landing. Somebody film that?'],
    eva: ['Watch me jump!'],
    idle: ['I could fly this thing with my eyes closed.', 'Green feathers, red beak, best pilot.'],
    rescue: ['It’s hot down here! Get me out before my tail feathers melt!'],
    spacewalk: ["Jet pack online. Watch these moves!"],
  },
  lemon: {
    pick: ['Lemon here! I counted the snacks. We have enough. Probably.'],
    launch: ['Wheeee! Colours everywhere!'],
    treasure: ['Seeds! Counting... counting... SO many seeds!'],
    lowFuel: ['We are running low! I told you to buy the bigger tank!'],
    idle: ['Rainbow bird in a rainbow universe!', 'Budget looks good. Let’s spend it all.'],
    rescue: ['FINALLY! I ran out of snacks three days ago!'],
    snack: ["I counted them. 412 seeds. Now 411. Now 410."],
  },
  mango: {
    pick: ['Mango, navigator. I’ll find the way.'],
    discover: ['Marking it on the star chart.'],
    travel: ['Course plotted to {b}. The stars agree.'],
    idle: ['See that bright star? I named it after you.', 'Space smells like... nothing. Interesting.'],
    rescue: ['I knew someone would follow my beacon. The stars told me.'],
    window: ["I can see three constellations from here."],
  },
  coco: {
    pick: ['Coco! Coco! Let’s goooo!'],
    launch: ['Hold on to your beaks!'],
    eva: ['Bounce! Bounce! Run!'],
    land: ['Can we explore? Can we? NOW?'],
    idle: ['I want to bounce on every planet!'],
    rescue: ['Yay! A ride! I was bouncing around all alone!'],
    cabin: ["Bounce off the walls! Bounce off the ceiling!"],
  },
  mercury: {
    pick: ['M-me? Okay. I can do this. I think.'],
    launch: ['Eeep! Too fast! ...okay, actually, this is cool.'],
    orbit: ['We didn’t crash! Is that normal?'],
    land: ['I landed? I LANDED!'],
    idle: ['Is space always this big?', 'I’m the new bird. Be nice to me.'],
    rescue: ['I’m so glad you came. It was cold and I was scared.'],
    spacewalk: ["Don’t let go of my tether! Please don’t let go!"],
  },
  orange: {
    pick: ['♪ Orange on the radio, la la la ♪'],
    launch: ['♪ Up, up, up we go ♪'],
    orbit: ['♪ Round and round the planet ♪'],
    land: ['♪ We have landed on {b}, tra la la ♪'],
    idle: ['♪ Twinkle twinkle little star ♪', '♪ Tweet tweet, radio check ♪'],
    rescue: ['♪ You found me, you found me! ♪'],
    cabin: ["♪ Singing in the spaceship ♪"],
    spacewalk: ["♪ Floating, floating, la la la ♪"],
  },
  jafar: {
    pick: ['Jafar here. Did someone pack the rice?'],
    treasure: ['Seeds! Almost as good as rice. Almost.'],
    land: ['Landed. Lunch break?'],
    idle: ['Rice. I am thinking about rice.', 'Is there rice in space? There should be.'],
    rescue: ['You came! Did you bring rice?'],
    snack: ["Seeds are nice. But where is the RICE?"],
    cabin: ["First stop: the kitchen. Wait, there is no kitchen?"],
  },
  snowflake: {
    pick: ['Snowflake. Systems look calm. Let’s keep them that way.'],
    failure: ['Stay calm. I know exactly how to fix this.'],
    storm: ['Breathe. Storms pass. Keep the batteries charged.'],
    land: ['Soft landing. Very peaceful.'],
    idle: ['All systems quiet. I like quiet.'],
    rescue: ['Thank you. It was very quiet here. A bit too quiet.'],
    window: ["So peaceful out there."],
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

// ---------------------------------------------------------------- jokes
// "setup|punchline" (a "|" is a pause for comic timing). Shared jokes any bird can tell, plus each
// bird's own material. Told in a shuffled order so the same joke doesn't come back too soon.
const JOKES = [
  'Why don’t birds use the autopilot?|They prefer to wing it.',
  'Why did the rocket lose its job?|It got fired.',
  'What do you call a seed in space?|An astro-NUT!',
  'What did Mars say to Saturn?|“Give me a ring sometime!”',
  'How do astronauts plan a party?|They planet.',
  'Why are parrots the best astronauts?|Mission control says “repeat after me”... and we actually do.',
  'Why didn’t the Sun go to school?|It already had a million degrees.',
  'What’s an astronaut bird’s favourite key on the keyboard?|The SPACE bar. ...And the seed bar.',
  'Knock knock! Who’s there? Comet. Comet who?|Comet me when the snacks are ready!',
  'What kind of music do planets sing?|Nep-TUNES!',
  'I’m reading a book about anti-gravity.|It’s impossible to put down.',
  'Why did the star go to school?|To get a little brighter. Unlike some birds on this ship.',
  'Did you hear about the bird who swallowed the satellite dish?|Now he only tweets in high definition.',
  'Mission control asked for a status report.|I said “tweet.” They said that’s not a status. I said it’s MY status.',
  'How does the Moon cut its hair?|E-clipse it.',
  'Why did the cockatiel bring a ladder to the launch pad?|Someone said the prices were sky-high.',
  'What do aliens spread on their toast?|Space jam.',
  'Why do birds fly south for the winter?|Because walking takes forever. Same reason we built rockets.',
  'Why was the gas giant so popular?|Everybody said it was a real gas.',
  'What’s the best thing about living in space?|No one can hear you squawk at 6am. Mission control can, though. They complained.',
  'Why did the bird sit on the clock?|To be on time for launch. It didn’t work. The clock is now in orbit.',
  'What do you call a bird that’s afraid of heights?|A rock. Wait, no. A penguin. Sorry, penguins.',
  'Why did the astronaut break up with the Moon?|It needed space.',
  'What’s a bird’s favourite planet?|Saturn. Built-in perches all the way round.',
  'Why can’t you tell jokes on the Moon?|There’s no atmosphere. ...Get it? Like a party with no atmosphere? Tough crowd.',
  'Why did the parrot wear a spacesuit to the dentist?|In case they found a black hole.',
  'What did the rocket say to the launch pad?|“I’ll be back... in a few years... if the fuel works out.”',
];
const OWN_JOKES = {
  abbas: [
    'As commander I have one rule:|whoever tells a bad joke cleans the seed bowl. ...This rule starts AFTER my joke.',
    'Mission control said “Abbas, you are cleared for liftoff.”|I said “Great! Am I also cleared for snacks?” Long silence. Very long silence.',
    'Why do lovebirds make great commanders?|We love the crew. We love the mission. We REALLY love the snacks.',
  ],
  salman: [
    'People say I’m aggressive.|I’m not aggressive. I just bite things that deserve it. Which is everything.',
    'Why did I bite the asteroid?|It looked at me funny.',
    'Knock knock. Who’s there? Salman. Salman who?|SALMAN WHO?! You KNOW who. Open the hatch.',
    'What’s the difference between me and a black hole?|Sometimes light escapes from a black hole.',
    'I’m the best bird on this ship.|That’s not a joke. That’s a fact. You may laugh at the others.',
  ],
  cookie: [
    'I ran 100 metres in 2 seconds today.|Then I napped for 6 hours. It’s called balance.',
    'I’m not lazy.|I’m in energy-saving mode. The solar panels get it.',
    'What’s my favourite thing about zero gravity?|I can nap AND go places at the same time. Science finally did something useful.',
    'Why did Cookie skip leg day?|Wings. Next question. Actually, no more questions. Nap time.',
  ],
  lightning: [
    'Knock knock! Who’s there? Interrupting rocket. Interrupting ro—|WHOOOOOOSH!',
    'Why did I press the big red button?|It was BIG. And RED. What did you EXPECT?!',
    'I’m 3 months old and I’ve already been to space!|I still can’t eat a seed without dropping it, but SPACE!',
    'What’s faster than lightning?|NOTHING! Because I’M Lightning! ...Wait, light is. Okay, light is faster. But only a bit.',
  ],
  pikachu: [
    'I did an experiment: I let go of a seed in zero gravity.|Results: it is still up there. Experiment ongoing. Forever.',
    'Why are scientists terrible at hide and seek?|We keep writing down where everyone is.',
    'I measured the temperature of the gas giant.|The result was “too hot, too cold, too windy, go home.” Peer reviewed.',
    'I did the maths on Cookie’s naps.|If Cookie napped any more, Cookie would technically be a pillow.',
  ],
  silver: [
    'I wanted to explore every planet in the system.|Turns out you need a LOT of snacks and a very big map. I have neither.',
    'I’m not lost.|I’m discovering where I am. Very slowly. Possibly forever.',
    'Where do explorers go on holiday?|Somewhere new. Then we explore it. Then we need another holiday.',
  ],
  aziz: [
    'Why do ringnecks make the best pilots?|We come with a built-in seatbelt. Look at my neck.',
    'I land so softly...|the ground sends me a thank-you card.',
    'They asked me to fly “by the book.”|So I did a barrel roll and read the book upside down.',
  ],
  lemon: [
    'Why am I so colourful?|I spilled every paint on the space station. I’m still paying for it.',
    'I asked our budget how it was doing.|It just said “ouch.”',
    'I counted every seed on this ship.|Then Jafar walked in and now I have to start again.',
  ],
  mango: [
    'I named a star after you!|It’s very small, very far away, and slightly on fire. Just like your landings.',
    'I’m the navigator.|So when we’re lost, it’s technically my fault. Which is why I blame the map.',
  ],
  coco: [
    'Why did I bounce on the moon?|Because I could! Next question! BOUNCE!',
    'I’m a rainbow lorikeet in space.|Which makes me a rainbow in space. Which makes me the prettiest thing in space. You’re welcome.',
  ],
  mercury: [
    'My name is Mercury, like the planet closest to the Sun.|Which explains why I’m sweating. Is it hot in here or is it just me?',
    'I’m the new bird.|Yesterday I asked where the bathroom was. Salman bit me. I still don’t know where the bathroom is.',
  ],
  orange: [
    '♪ This next song is about gravity ♪|♪ It’s a real downer ♪',
    '♪ I tried to sing in a vacuum ♪|♪ ............ ♪ (that was my best performance)',
    'Why do canaries make great radio operators?|We were born to tweet over the airwaves.',
  ],
  jafar: [
    'What’s my favourite space food?|Rice. What’s my second favourite?|Also rice.',
    'Why did I bring a rice cooker to space?|In case of emergency. Every meal is an emergency.',
    'They told me space is full of stars.|I asked if any of them were rice. Nobody answered. Suspicious.',
  ],
  snowflake: [
    'Why am I always so calm?|I’m a snowflake. I chill.',
    'Want to hear a cold joke?|Ice to meet you.',
  ],
};
const LAUGHS = {
  abbas: ['Hahaha! Good one, crew.', 'Ha! That’s going in the mission log.'],
  salman: ['...Heh. That was okay. Tell anyone I laughed and I’ll bite you.', 'Hmph. ...Hehehe. NO. I didn’t laugh.'],
  cookie: ['Haha... *yawn*... haha. Funny. Can I sleep now?', 'Hehe... so funny... zzz...'],
  lightning: ['HAHAHAHAHA! I DON’T GET IT BUT HAHAHAHAHA!', 'AGAIN! TELL IT AGAIN!'],
  pikachu: ['Statistically, that was funny. Ha. Ha.', 'Hehe! Adding that to my research.'],
  silver: ['Ha! I’m stealing that one.', 'Hahaha, classic!'],
  aziz: ['Ha! Almost as smooth as my landings.', 'Hahaha! Okay, okay, that was good.'],
  lemon: ['HAHA! I’d pay to hear that again. Well... a little bit.', 'Hahahaha! My feathers hurt!'],
  mango: ['*giggles in navigator*', 'Hehe! The stars are laughing too.'],
  coco: ['Hahaha! Bounce bounce hahaha!', 'HAHA! *falls off perch*'],
  mercury: ['Hehe... wait, was that about me?', 'Haha! I laughed! Did I laugh right?'],
  orange: ['♪ Ha ha ha ha haaaa ♪', '♪ Tee-hee-hee ♪'],
  jafar: ['Haha! Funnier than rice. Barely.', 'Hahaha! That was nearly as good as rice.'],
  snowflake: ['*quiet, peaceful chuckle*', 'Hehe. Very nice.'],
};
const GROANS = ['Boooooo! ...Okay, that was a bit good.', 'Ugh. That was terrible. I loved it.', '*facewing*', 'Who let this bird near the radio?'];

const bags = {};
function draw(key, pool) {
  if (!bags[key] || !bags[key].length) { bags[key] = pool.slice(); for (let i = bags[key].length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bags[key][i], bags[key][j]] = [bags[key][j], bags[key][i]]; } }
  return bags[key].pop();
}
// A joke for this bird: usually one of its own, sometimes a shared one. Returns the parts to say in order.
export function joke(birdId) {
  const own = OWN_JOKES[birdId] || [];
  const text = own.length && Math.random() < 0.55 ? draw('own:' + birdId, own) : draw('shared', JOKES);
  return text.split('|');
}
export function laugh(birdId) {
  return Math.random() < 0.22 ? draw('groan', GROANS) : draw('laugh:' + birdId, LAUGHS[birdId] || LAUGHS.abbas);
}
// Laughing sound: a quick run of rising chirps.
export function giggle(birdId, volume = 0.5) {
  if (!ctx || ctx.state !== 'running' || volume <= 0) return;
  const base = 1300 * (PITCH[birdId] || 1), now = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    const t = now + i * 0.09, o = ctx.createOscillator(), gn = ctx.createGain(), f0 = base * (1 + (i % 2) * 0.25);
    o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.05);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.1 * volume, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(gn).connect(ctx.destination); o.start(t); o.stop(t + 0.08);
  }
}
