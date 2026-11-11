import React from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App.jsx';
import { game } from './game/Game.js';
import { store } from './game/settings.js';

const stage = (m) => { if (window.__bt) window.__bt.stage = m; };
stage('Starting interface');
// Anything that goes wrong is shown on screen (instead of a blank page) so it can be reported.
let shown = false;
function showError(title, detail) {
  if (shown) return; shown = true;
  const box = document.createElement('div');
  box.id = 'fatal';
  box.innerHTML = `<div class="fatalbox"><b></b><p></p><pre></pre>
    <div class="fatalbtns"><button id="fatal-reload">Reload</button><button id="fatal-low">Reload on Low graphics</button><button id="fatal-close">Dismiss</button></div></div>`;
  box.querySelector('b').textContent = title;
  box.querySelector('p').textContent = 'If this keeps happening, take a screenshot of this message and send it to the developer.';
  box.querySelector('pre').textContent = `${detail}\n\n${navigator.userAgent}`;
  document.body.appendChild(box);
  box.querySelector('#fatal-reload').onclick = () => location.reload();
  box.querySelector('#fatal-low').onclick = () => { const s = store.get('settings', {}); store.set('settings', { ...s, quality: 'low' }); location.reload(); };
  box.querySelector('#fatal-close').onclick = () => box.remove();
}
const describe = (e) => (e && (e.stack || e.message)) || String(e);
// Harmless browser noise that is not a game failure.
const benign = (m) => /ResizeObserver loop|^Script error\.?$/.test(String(m || ''));
window.addEventListener('error', (e) => { if (!benign(e.message)) showError('Birdtier hit an error', describe(e.error || e.message)); });
window.addEventListener('unhandledrejection', (e) => showError('Birdtier hit an error', describe(e.reason)));

const canvas = document.getElementById('view');
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showError('The graphics chip stopped the game', 'WebGL context lost. This usually means the device ran short of graphics memory. Reload, or try Low graphics.');
});

// Show the loading screen first, then build the world once it has been painted.
createRoot(document.getElementById('root')).render(<App />);
stage('Starting 3D engine');
window.frontier = game; // handy for debugging from the browser console
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
  try {
    game.init(canvas, document.getElementById('labels'));
  } catch (e) {
    showError('Birdtier could not start', describe(e));
  }
}, 0)));
