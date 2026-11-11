import React, { useState } from 'react';
import { game } from '../game/Game.js';
import { QUALITY, ACTIONS, defaultKeys, keyName, TOUCH_MODES, IS_TOUCH } from '../game/settings.js';

export function Settings({ onClose }) {
  const [s, setS] = useState(() => ({ quality: game.settings.quality, keys: { ...game.settings.keys }, touch: game.settings.touch || 'auto' }));
  const [capturing, setCapturing] = useState(null);
  const apply = (next) => { setS(next); game.applySettings(next); };
  const rebind = (action) => {
    setCapturing(action);
    game.input.capture = (code) => {
      setCapturing(null);
      if (code === 'Escape') return;
      const keys = { ...s.keys };
      for (const a in keys) if (keys[a] === code && a !== action) keys[a] = keys[action]; // swap to avoid duplicates
      keys[action] = code;
      apply({ ...s, keys });
    };
  };
  const groups = {};
  for (const a in ACTIONS) (groups[ACTIONS[a][2]] ||= []).push(a);
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  return (
    <div className="panel dialog wide" style={{ pointerEvents: 'auto' }}>
      <div className="h"><span>Settings</span></div>
      <div className="pad scroll">
        <div className="amber" style={{ fontSize: 11, letterSpacing: '.1em', marginBottom: 6 }}>GRAPHICS QUALITY</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(QUALITY).map(([k, q]) => <button key={k} className={s.quality === k ? 'on' : ''} onClick={() => apply({ ...s, quality: k })}>{q.label}</button>)}
        </div>
        <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5, margin: '8px 0 14px' }}>
          Quality changes texture resolution, terrain mesh density, shadows, particle count, star count and render resolution, and applies immediately
          (anti-aliasing changes take effect after reloading the page). Renderer: WebGL2. WebGPU {gpu ? 'is available in this browser but is not used by this version' : 'is not available in this browser'}.
        </div>
        <div className="amber" style={{ fontSize: 11, letterSpacing: '.1em', marginBottom: 6 }}>TOUCH CONTROLS</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(TOUCH_MODES).map(([k, l]) => <button key={k} className={s.touch === k ? 'on' : ''} onClick={() => apply({ ...s, touch: k })}>{l}</button>)}
        </div>
        <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5, margin: '8px 0 14px' }}>
          On-screen joystick, throttle and buttons. Auto turns them on for phones and tablets ({IS_TOUCH ? 'this device has a touch screen' : 'no touch screen detected'}).
          On phones, Low quality runs smoothest.
        </div>
        <div className="amber" style={{ fontSize: 11, letterSpacing: '.1em', marginBottom: 6 }}>KEY BINDINGS — click a key, then press the new one (Esc cancels)</div>
        <div className="grid2">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <div className="dim" style={{ margin: '8px 0 4px', fontSize: 10, letterSpacing: '.14em' }}>{g.toUpperCase()}</div>
              <div className="keys">
                {list.map((a) => (
                  <React.Fragment key={a}>
                    <span style={{ fontSize: 12 }}>{ACTIONS[a][1]}</span>
                    <button className={`small ${capturing === a ? 'primary' : ''}`} style={{ minWidth: 76 }} onClick={() => rebind(a)}>{capturing === a ? 'press a key…' : keyName(s.keys[a])}</button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pad" style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={onClose}>Done</button>
        <button onClick={() => apply({ ...s, keys: defaultKeys() })}>Reset keys to defaults</button>
      </div>
    </div>
  );
}
