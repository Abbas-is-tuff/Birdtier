import React from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App.jsx';
import { game } from './game/Game.js';

game.init(document.getElementById('view'), document.getElementById('labels'));
createRoot(document.getElementById('root')).render(<App />);
window.frontier = game; // handy for debugging from the browser console
