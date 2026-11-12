import React, { useRef, useState, useEffect } from 'react';
import { game } from '../game/Game.js';

// On-screen controls for phones and tablets. They drive the same input actions as the keyboard,
// so flight, walking, driving and the free camera all work through them unchanged.

const STICK_ACTIONS = {
  rotate: { up: 'pitchDown', down: 'pitchUp', left: 'yawLeft', right: 'yawRight' }, // W/S/A/D
  translate: { up: 'rcsFwd', down: 'rcsBack', left: 'rcsLeft', right: 'rcsRight' }, // RCS sliding for docking
};

function clearStick() { for (const m of Object.values(STICK_ACTIONS)) for (const a of Object.values(m)) game.input.setAnalog(a, 0); }

function Joystick({ mode, label }) {
  const base = useRef(null), active = useRef(null);
  const [knob, setKnob] = useState([0, 0]);
  const map = STICK_ACTIONS[mode];
  useEffect(() => () => clearStick(), []);
  useEffect(() => { clearStick(); setKnob([0, 0]); }, [mode]);
  const move = (e) => {
    const r = base.current.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    setKnob([dx, dy]);
    // dead zone, then a gentle curve so small deflections give fine control
    const shape = (v) => { const a = Math.abs(v); return a < 0.12 ? 0 : Math.pow((a - 0.12) / 0.88, 1.35); };
    game.input.setAnalog(map.up, dy < 0 ? shape(dy) : 0);
    game.input.setAnalog(map.down, dy > 0 ? shape(dy) : 0);
    game.input.setAnalog(map.left, dx < 0 ? shape(dx) : 0);
    game.input.setAnalog(map.right, dx > 0 ? shape(dx) : 0);
  };
  const end = () => { active.current = null; setKnob([0, 0]); clearStick(); };
  return (
    <div ref={base} className="stick" aria-label={label}
      onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) move(e); }}
      onPointerUp={end} onPointerCancel={end}>
      <div className="knob" style={{ transform: `translate(${knob[0] * 42}px, ${knob[1] * 42}px)` }} />
      <span className="sticklabel">{label}</span>
    </div>
  );
}

// A button that holds an action down while pressed (roll, jump).
function Hold({ action, children, className = '' }) {
  const on = (v) => (e) => { e.preventDefault(); game.input.hold(action, v); };
  useEffect(() => () => game.input.hold(action, false), [action]);
  return (
    <button className={`tbtn ${className}`} onPointerDown={on(true)} onPointerUp={on(false)} onPointerCancel={on(false)} onPointerLeave={on(false)}>{children}</button>
  );
}

function Throttle({ value }) {
  const track = useRef(null), active = useRef(null);
  const set = (e) => {
    const r = track.current.getBoundingClientRect();
    game.setThrottle(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)));
  };
  return (
    <div className="tthrottle">
      <button className="tbtn small" onClick={() => game.setThrottle(1)}>Max</button>
      <div ref={track} className="ttrack" role="slider" aria-label="Throttle" aria-valuenow={Math.round(value * 100)}
        onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
        onPointerMove={(e) => { if (active.current === e.pointerId) set(e); }}
        onPointerUp={() => { active.current = null; }} onPointerCancel={() => { active.current = null; }}>
        <i style={{ height: `${value * 100}%` }} />
        <span>{Math.round(value * 100)}%</span>
      </div>
      <button className="tbtn small" onClick={() => game.setThrottle(0)}>Cut</button>
    </div>
  );
}

export function TouchControls({ h }) {
  const eva = h.eva;
  const [mode, setMode] = useState('rotate');
  const translate = mode === 'translate' && h.hasRcs && h.rcs && !eva;
  return (
    <>
      <div className="tleft">
        {!eva && (
          <div className="trow">
            <Hold action="rollLeft">⟲ Roll</Hold>
            <Hold action="rollRight">Roll ⟳</Hold>
            {h.hasRcs && h.rcs && <button className={`tbtn ${translate ? 'on' : ''}`} onClick={() => setMode(translate ? 'rotate' : 'translate')}>{translate ? 'Slide' : 'Turn'}</button>}
          </div>
        )}
        <Joystick mode={translate ? 'translate' : 'rotate'} label={eva ? (eva.kind === 'rover' ? 'Drive' : eva.kind === 'spacewalk' ? 'Fly' : 'Walk') : translate ? 'RCS slide' : 'Steer'} />
      </div>
      <div className="tright">
        {eva
          ? <>{(eva.kind === 'spacewalk' || eva.zeroG) && <Hold action="rollLeft" className="big">Down</Hold>}<Hold action="stage" className="big">{eva.kind === 'spacewalk' || eva.zeroG ? 'Up' : 'Jump'}</Hold></>
          : <>
              <Throttle value={h.throttle} />
              <button className="tbtn big primary" onClick={() => game.stage()}>Stage</button>
            </>}
      </div>
    </>
  );
}
