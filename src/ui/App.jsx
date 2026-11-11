import React, { useState } from 'react';
import { useUI, setUI } from './store.js';
import { game } from '../game/Game.js';
import { Hud } from './Hud.jsx';
import { Workshop } from './Workshop.jsx';
import { Database } from './Database.jsx';
import { Settings } from './Settings.jsx';
import { CrewPicker } from './BirdPortrait.jsx';
import logoUrl from '../assets/icon.svg';

function Loading({ p }) {
  return (
    <div className="loading">
      <img className="logo big" src={logoUrl} alt="" />
      <h1 className="brand">BIRDTIER</h1>
      <div className="brand-sub">Beyond the Solar System</div>
      <div className="bar"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
      <div className="dim" style={{ marginTop: 10, fontSize: 11 }}>Generating the Kaelis system… {Math.round(p * 100)}%</div>
    </div>
  );
}

function MainMenu({ ui }) {
  const [confirm, setConfirm] = useState(false);
  const p = ui.progress;
  return (
    <div className="menu">
      <div className="menubrand">
        <img className="logo" src={logoUrl} alt="Birdtier logo" />
        <div>
          <h1 className="brand" style={{ fontSize: 44 }}>BIRDTIER</h1>
          <div className="brand-sub">Beyond the Solar System</div>
        </div>
      </div>
      <nav>
        <button onClick={() => (ui.hasSave ? setConfirm(true) : game.newCareer())}>New Mission <span>start a new career</span></button>
        {confirm && (
          <div className="confirm">
            Starting a new career replaces your saved one (funds, research, colonies).
            <div><button className="primary" onClick={() => { setConfirm(false); game.newCareer(); }}>Start new career</button><button onClick={() => setConfirm(false)}>Cancel</button></div>
          </div>
        )}
        <button disabled={!ui.hasSave} onClick={() => game.continueCareer()}>Continue Mission <span>{ui.hasSave ? 'resume saved career' : 'no saved career'}</span></button>
        <button disabled={!ui.hasSave && !(p && p.launches)} onClick={() => game.enterWorkshop()}>Spacecraft Workshop <span>{ui.hasSave || (p && p.launches) ? 'build and launch' : 'start a career first'}</span></button>
        <button onClick={() => setUI({ screen: 'database' })}>Planetary Database <span>the Kaelis system</span></button>
        <button onClick={() => setUI({ screen: 'settings' })}>Settings <span>graphics and controls</span></button>
      </nav>
      <div className="menucrew">
        <div className="label">Choose your astronaut</div>
        <CrewPicker pilotId={(p && p.pilot) || 'abbas'} onPick={(id) => game.setPilot(id)} size={ui.compact ? 34 : 40} />
      </div>
      <div className="foot">
        {p && p.launches > 0 && <div className="mono">Career: {p.funds.toLocaleString()} funds · {p.science} science · {p.done.length} missions complete</div>}
        {ui.touch
          ? <div>Touch controls: joystick to steer, slider for throttle, drag to look, pinch to zoom. Best played sideways. <span className="click amber" onClick={() => game.fullscreen()}>Full screen</span></div>
          : <div>Keyboard and mouse, or a touch screen. Everything you see is generated procedurally on your machine.</div>}
      </div>
    </div>
  );
}

export function App() {
  const ui = useUI();
  if (ui.screen === 'loading') return <Loading p={ui.loading} />;
  return (
    <>
      {ui.screen === 'menu' && <MainMenu ui={ui} />}
      {ui.screen === 'database' && <Database />}
      {ui.screen === 'settings' && <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><Settings onClose={() => setUI({ screen: 'menu' })} /></div>}
      {ui.screen === 'workshop' && <Workshop ui={ui} />}
      {ui.screen === 'flight' && <Hud ui={ui} />}
      {ui.screen !== 'flight' && ui.toasts.length > 0 && (
        <div className="toasts" style={{ left: 'auto', right: 10 }}>{ui.toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
      )}
    </>
  );
}
