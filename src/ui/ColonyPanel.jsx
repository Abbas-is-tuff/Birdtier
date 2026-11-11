import React, { useState } from 'react';
import { setUI } from './store.js';
import { game } from '../game/Game.js';
import { MODULES, RESUPPLY } from '../colony/Colony.js';
import { fmtNum } from './format.js';

const RES = [['o2', 'Oxygen'], ['water', 'Water'], ['food', 'Food'], ['power', 'Stored power']];

export function ColonyPanel({ h }) {
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState(null);
  const cols = game.colonies, col = cols[Math.min(sel, cols.length - 1)];
  const site = game.siteInfo();
  const run = (err) => setMsg(err || null);
  const here = site && col && site.colony === col;
  return (
    <div className="panel float">
      <div className="h"><span>Colonies</span><span className="click" style={{ cursor: 'pointer' }} onClick={() => setUI({ panel: null })}>✕</span></div>
      <div className="pad scroll">
        {site && !site.colony && (
          <div style={{ marginBottom: 10 }}>
            <div className="dim" style={{ marginBottom: 6, lineHeight: 1.5 }}>
              You are landed on {site.body.name}. Founding a colony unloads your cargo and builds a habitat ({MODULES.habitat.cost} materials). Aboard: {fmtNum(h.cargo)} kg.
            </div>
            <button className="primary" onClick={() => run(game.foundColony())}>Found colony here</button>
          </div>
        )}
        {!site && cols.length === 0 && <div className="dim" style={{ lineHeight: 1.5 }}>No colonies yet. Land a craft carrying a cargo container (research tier 2) loaded with construction materials, then found a colony from this panel.</div>}
        {cols.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {cols.map((c, i) => <button key={i} className={`small ${c === col ? 'on' : ''}`} onClick={() => { setSel(i); setMsg(null); }}>{c.name}</button>)}
          </div>
        )}
        {col && (
          <>
            <div className="row"><span>STATUS</span><span className={col.status === 'active' ? 'good' : 'bad'}>{col.status}{here ? ' · you are here' : col.has('antenna') ? ' · remote link' : ' · no remote link'}</span></div>
            <div className="row"><span>POPULATION</span><span>{col.pop} / {col.count('habitat') * 4} beds</span></div>
            <div className="row"><span>HABITAT TEMPERATURE</span><span className={col.temp < 5 || col.temp > 40 ? 'bad' : ''}>{col.temp.toFixed(0)} °C</span></div>
            <div className="row"><span>DAYLIGHT</span><span>{Math.round(col.daylight * 100)}%</span></div>
            {RES.map(([k, label]) => (
              <div key={k}>
                <div className="row"><span>{label.toUpperCase()}</span><span className={col.res[k] < 20 ? 'bad' : ''}>{col.res[k].toFixed(0)} / {col.cap[k]} <span className={col.net[k] < 0 ? 'bad' : 'good'}>({col.net[k] >= 0 ? '+' : ''}{col.net[k].toFixed(1)}/h)</span></span></div>
                <div className="bar"><i className={col.res[k] / col.cap[k] < 0.1 ? 'low' : ''} style={{ width: `${Math.min(100, (col.res[k] / col.cap[k]) * 100)}%` }} /></div>
              </div>
            ))}
            <div className="row"><span>CONSTRUCTION MATERIALS</span><span className="amber">{fmtNum(col.res.materials)} / {col.cap.materials}</span></div>

            <div className="amber" style={{ margin: '10px 0 4px', fontSize: 11, letterSpacing: '.1em' }}>MODULES</div>
            {col.modules.map((m, i) => (
              <div className="row" key={i}><span>{MODULES[m.type].name}</span>
                <span>{m.ok ? <span className="good">operational</span> : <button className="small danger" onClick={() => run(game.repairAt(col, i))}>Damaged — repair (20)</button>}</span></div>
            ))}
            <div className="amber" style={{ margin: '10px 0 4px', fontSize: 11, letterSpacing: '.1em' }}>BUILD</div>
            {Object.entries(MODULES).map(([type, m]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '3px 0' }}>
                <div><b style={{ fontSize: 12 }}>{m.name}</b> <span className="mono amber">{m.cost}</span><div className="dim" style={{ fontSize: 11 }}>{m.info}</div></div>
                <button className="small" disabled={!!col.canBuild(type)} title={col.canBuild(type) || ''} onClick={() => run(game.buildAt(col, type))}>Build</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {here && h.cargo > 0 && <button onClick={() => { game.unloadCargo(); setMsg(null); }}>Unload {fmtNum(h.cargo)} kg cargo</button>}
              <button disabled={!col.has('pad')} title={col.has('pad') ? '' : 'Needs a landing pad'} onClick={() => run(game.resupply(col))}>Order resupply ({fmtNum(RESUPPLY.cost)} ƒ)</button>
            </div>
          </>
        )}
        {msg && <div className="problem" style={{ marginTop: 8 }}>{msg}</div>}
      </div>
    </div>
  );
}
