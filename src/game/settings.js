// Graphics presets, key bindings and localStorage helpers.
export const QUALITY = {
  low: { label: 'Low (weaker computers)', lowTex: 256, tex: 512, sphere: 96, rings: 72, sectors: 72, shadows: 0, stars: 2500, pixelRatio: 1, particles: 350, clouds: true, aa: false },
  medium: { label: 'Medium', lowTex: 256, tex: 1024, sphere: 160, rings: 104, sectors: 96, shadows: 1024, stars: 5000, pixelRatio: 1.5, particles: 800, clouds: true, aa: true },
  high: { label: 'High', lowTex: 512, tex: 2048, sphere: 224, rings: 128, sectors: 128, shadows: 2048, stars: 9000, pixelRatio: 2, particles: 1400, clouds: true, aa: true },
};

// action -> [KeyboardEvent.code, description, group]
export const ACTIONS = {
  pitchDown: ['KeyW', 'Pitch nose forward / walk forward', 'Flight'],
  pitchUp: ['KeyS', 'Pitch nose back / walk back', 'Flight'],
  yawLeft: ['KeyA', 'Yaw left / turn left', 'Flight'],
  yawRight: ['KeyD', 'Yaw right / turn right', 'Flight'],
  rollLeft: ['KeyQ', 'Roll left', 'Flight'],
  rollRight: ['KeyE', 'Roll right', 'Flight'],
  throttleUp: ['ArrowUp', 'Throttle up', 'Flight'],
  throttleDown: ['ArrowDown', 'Throttle down', 'Flight'],
  throttleMax: ['KeyZ', 'Full throttle', 'Flight'],
  throttleCut: ['KeyX', 'Cut throttle', 'Flight'],
  stage: ['Space', 'Activate next stage / jump', 'Flight'],
  sas: ['KeyT', 'Toggle SAS', 'Flight'],
  rcs: ['KeyR', 'Toggle RCS', 'Flight'],
  gear: ['KeyG', 'Landing gear', 'Flight'],
  panels: ['KeyU', 'Deploy / retract solar arrays', 'Flight'],
  sasStab: ['Digit1', 'SAS: stability', 'Flight'],
  sasPro: ['Digit2', 'SAS: hold prograde', 'Flight'],
  sasRetro: ['Digit3', 'SAS: hold retrograde', 'Flight'],
  sasUp: ['Digit4', 'SAS: hold radial out (up)', 'Flight'],
  rcsFwd: ['KeyH', 'RCS translate forward', 'RCS'],
  rcsBack: ['KeyN', 'RCS translate back', 'RCS'],
  rcsLeft: ['KeyJ', 'RCS translate left', 'RCS'],
  rcsRight: ['KeyL', 'RCS translate right', 'RCS'],
  rcsUp: ['KeyI', 'RCS translate up', 'RCS'],
  rcsDown: ['KeyK', 'RCS translate down', 'RCS'],
  warpUp: ['Period', 'Time warp faster', 'Simulation'],
  warpDown: ['Comma', 'Time warp slower', 'Simulation'],
  pause: ['KeyP', 'Pause', 'Simulation'],
  map: ['KeyM', 'Toggle system map', 'View'],
  camera: ['KeyC', 'Next camera', 'View'],
  interact: ['KeyF', 'EVA or spacewalk / board / dock / rover / use (inside)', 'Surface'],
  cabin: ['Enter', 'Go inside the ship / back to the pilot seat', 'Surface'],
  sample: ['KeyV', 'Collect surface sample (on EVA)', 'Surface'],
  deploySci: ['KeyO', 'Deploy science station (on EVA)', 'Surface'],
  experiment: ['KeyY', 'Run all science instruments', 'Surface'],
  base: ['KeyB', 'Colony panel', 'Surface'],
};

export function defaultKeys() {
  const k = {};
  for (const a in ACTIONS) k[a] = ACTIONS[a][0];
  return k;
}

export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('frontier.' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem('frontier.' + key, JSON.stringify(value)); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem('frontier.' + key); } catch { /* storage unavailable */ } },
};

// Phones and tablets: a coarse primary pointer, or touch points with no hover.
export const IS_TOUCH = typeof window !== 'undefined' && !!window.matchMedia &&
  (window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches));
export const TOUCH_MODES = { auto: 'Auto', on: 'On', off: 'Off' };
export const touchEnabled = (s) => s.touch === 'on' || (s.touch !== 'off' && IS_TOUCH);

export function loadSettings() {
  const s = store.get('settings', {});
  return {
    quality: QUALITY[s.quality] ? s.quality : IS_TOUCH ? 'low' : 'medium', // phones start on Low
    keys: { ...defaultKeys(), ...(s.keys || {}) },
    touch: TOUCH_MODES[s.touch] ? s.touch : 'auto',
  };
}
export function saveSettings(s) { store.set('settings', s); }

export const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Arrow ').replace('Period', '.').replace('Comma', ',');
