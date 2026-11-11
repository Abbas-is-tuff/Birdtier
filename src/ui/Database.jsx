import React, { useState, useEffect } from 'react';
import { setUI, getUI } from './store.js';
import { game } from '../game/Game.js';
import { fmtDist, fmtTime, fmtSci, fmtNum, fmtPressure } from './format.js';

const TYPE = { star: 'Star', planet: 'Planet', moon: 'Moon', station: 'Station' };
const KIND = { ocean: 'Ocean world', desert: 'Rocky desert world', ice: 'Ice world', volcanic: 'Volcanic world', rock: 'Airless rocky body', gas: 'Gas giant' };

export function BodyInfo({ b, compact }) {
  const d = b.def, p = getUI().progress;
  const found = p ? p.discoveries.filter((k) => k.startsWith(b.id + ':')).map((k) => k.split(':')[1]) : [];
  if (b.type === 'station') {
    return (<><div style={{ lineHeight: 1.5, marginBottom: 8 }}>{d.desc}</div>
      <table className="kv"><tbody>
        <tr><td>Orbits</td><td>{b.parent.name}</td></tr>
        <tr><td>Orbital altitude</td><td>{fmtDist(b.orbit.a - b.parent.radius)}</td></tr>
        <tr><td>Orbital period</td><td>{fmtTime(b.period)}</td></tr>
        <tr><td>Orbital speed</td><td>{Math.sqrt(b.parent.mu / b.orbit.a).toFixed(0)} m/s</td></tr>
      </tbody></table></>);
  }
  return (
    <>
      {!compact && <div style={{ lineHeight: 1.55, marginBottom: 10 }}>{d.desc}</div>}
      <table className="kv"><tbody>
        <tr><td>Class</td><td>{b.type === 'star' ? 'G-class star' : KIND[d.terrain.type]}</td></tr>
        <tr><td>Mass</td><td>{fmtSci(b.mass)} kg</td></tr>
        <tr><td>Radius</td><td>{fmtDist(b.radius)}</td></tr>
        <tr><td>Surface gravity</td><td>{b.g.toFixed(2)} m/s² ({(b.g / 9.80665).toFixed(2)} g)</td></tr>
        <tr><td>Escape velocity</td><td>{fmtNum(Math.sqrt((2 * b.mu) / b.radius))} m/s</td></tr>
        <tr><td>Rotation period (day)</td><td>{fmtTime(d.rotPeriod)}</td></tr>
        {b.parent && <tr><td>Orbits</td><td>{b.parent.name} at {fmtDist(b.orbit.a)}</td></tr>}
        {b.parent && <tr><td>Orbital period</td><td>{fmtTime(b.period)}</td></tr>}
        {b.parent && <tr><td>Eccentricity / inclination</td><td>{b.orbit.e.toFixed(2)} / {(b.orbit.i * 57.2958).toFixed(1)}°</td></tr>}
        {b.parent && <tr><td>Sphere of influence</td><td>{fmtDist(b.soi)}</td></tr>}
        <tr><td>Axial tilt</td><td>{((d.tilt || 0) * 57.2958).toFixed(0)}°</td></tr>
        <tr><td>Atmosphere</td><td>{b.atmo ? `${fmtPressure(b.atmo.p0)} at datum, to ${fmtDist(b.atmo.top)}` : 'None'}</td></tr>
        {b.atmo && <tr><td>Composition</td><td style={{ fontFamily: 'var(--sans)' }}>{b.atmo.comp}</td></tr>}
        <tr><td>Mean temperature</td><td>{d.tempK} K ({(d.tempK - 273.15).toFixed(0)} °C){d.tempSwing ? `, day/night ±${d.tempSwing / 2} K` : ''}</td></tr>
        <tr><td>Terrain</td><td style={{ fontFamily: 'var(--sans)' }}>{d.terrainLabel}</td></tr>
        {b.type !== 'star' && <tr><td>Science multiplier</td><td>×{d.sciMult}</td></tr>}
        {b.children.length > 0 && <tr><td>Satellites</td><td style={{ fontFamily: 'var(--sans)' }}>{b.children.map((c) => c.name).join(', ')}</td></tr>}
        {b.landable && <tr><td>Locations discovered</td><td style={{ fontFamily: 'var(--sans)' }}>{found.length ? found.join(', ') : 'none yet'}</td></tr>}
      </tbody></table>
    </>
  );
}

export function Database() {
  const [id, setId] = useState('thalen');
  const b = game.system.byId[id];
  useEffect(() => { game.menuBody = b; game.rig.startBlend(); game.rig.dist.orbital = b.type === 'station' ? 4 : 3.2; return () => { game.menuBody = game.system.home; }; }, [b]);
  return (
    <div className="screen">
      <div className="col" style={{ width: 250 }}>
        <div className="panel col" style={{ minHeight: 0 }}>
          <div className="h"><span>Planetary database</span></div>
          <div className="scroll">
            {game.system.bodies.map((x) => (
              <div key={x.id} className={`item click ${x.id === id ? 'sel' : ''}`} style={{ paddingLeft: x.parent && x.parent.parent ? 24 : 10 }} onClick={() => setId(x.id)}>
                <div>{x.name}<small>{TYPE[x.type]}{x.def.terrain ? ` · ${KIND[x.def.terrain.type]}` : ''}</small></div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => setUI({ screen: 'menu' })}>Back to main menu</button>
      </div>
      <div style={{ flex: 1 }} />
      <div className="col" style={{ width: 400 }}>
        <div className="panel col" style={{ minHeight: 0 }}>
          <div className="h"><span>{b.name}</span><span>{TYPE[b.type]}</span></div>
          <div className="pad scroll"><BodyInfo b={b} /></div>
        </div>
      </div>
    </div>
  );
}
