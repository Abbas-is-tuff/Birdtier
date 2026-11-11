// Tiny external store bridging the game loop and the React interface.
import { useSyncExternalStore } from 'react';

let state = {
  screen: 'loading', loading: 0, paused: false, hud: null, toasts: [], panel: null, map: false, selected: null,
  progress: null, hasSave: false, lost: null, overlay: null, settingsVersion: 0,
};
const subs = new Set();
export const getUI = () => state;
export function setUI(patch) { state = { ...state, ...patch }; subs.forEach((f) => f()); }
export function useUI() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}
