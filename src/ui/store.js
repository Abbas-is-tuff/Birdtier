// Tiny external store bridging the game loop and the React interface.
import { useSyncExternalStore } from 'react';

let state = {
  screen: 'loading', loading: 0, paused: false, hud: null, toasts: [], panel: null, map: false, selected: null,
  progress: null, hasSave: false, lost: null, overlay: null, settingsVersion: 0,
  touch: false, compact: false, portrait: false, drawer: false,
};
const subs = new Set();
export const getUI = () => state;
export function setUI(patch) { state = { ...state, ...patch }; subs.forEach((f) => f()); }
export function useUI() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}

// Layout flags: `touch` shows on-screen controls, `compact` switches to the small-screen layout,
// `portrait` rearranges it for a phone held upright. Mirrored as classes on <html> for CSS.
export function updateLayout(touch) {
  const w = window.innerWidth, h = window.innerHeight;
  const compact = touch || w < 900 || h < 560, portrait = compact && h > w;
  const c = document.documentElement.classList;
  c.toggle('touch', touch); c.toggle('compact', compact); c.toggle('portrait', portrait);
  if (touch !== state.touch || compact !== state.compact || portrait !== state.portrait) setUI({ touch, compact, portrait });
}
