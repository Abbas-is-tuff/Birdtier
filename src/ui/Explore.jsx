import React from 'react';
import { game } from '../game/Game.js';
import { setUI } from './store.js';
import { BirdPortrait } from './BirdPortrait.jsx';
import { crewById, CREW, RESCUE_AT } from '../crew/crew.js';
import { UPGRADES, level, nextCost } from '../explore/upgrades.js';
import { SITE_TYPES } from '../explore/sites.js';

const fmtD = (m) => (m < 1000 ? `${Math.round(m)} m` : m < 1e5 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000).toLocaleString()} km`);
const fmtT = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 86400)} days`);

// A bird talking on the radio.
export function RadioBubble({ radio }) {
  if (!radio || performance.now() > radio.until) return null;
  const b = crewById(radio.bird);
  return (
    <div className="panel radio" key={radio.n}>
      <BirdPortrait bird={b} size={44} />
      <div><div className="k">{b.name} · radio</div><div className="said">{radio.text}</div></div>
    </div>
  );
}

// Arrow and distance to the nearest unfound site on this world.
export function SitePointer({ site }) {
  if (!site || !SITE_TYPES[site.type]) return null;
  const col = SITE_TYPES[site.type].css;
  return (
    <div className="panel sitepointer" title="Nearest thing to find on this world">
      <span className="arrow" style={{ transform: `rotate(${site.rel}deg)`, color: col }}>➤</span>
      <div><div className="k" style={{ color: col }}>{site.label}</div><b>{fmtD(site.d)}</b> <span className="dim">· {site.left} left here</span></div>
    </div>
  );
}

export function AutopilotButtons({ h }) {
  if (h.auto) return <button className="on primary" onClick={() => game.autopilot()}>Autopilot: {h.auto} — stop</button>;
  return (
    <>
      {!h.orbiting && <button className="primary" onClick={() => game.autopilot('orbit')}>Auto → Orbit</button>}
      {h.landable && !h.landed && <button className="primary" onClick={() => game.autopilot('land')}>Auto → Land</button>}
    </>
  );
}

// Extra rows for the map panel of a body: travel there, and the sites to find on it.
export function BodyActions({ b }) {
  const c = game.craft, here = c && c.env.body === b;
  const plan = c && !c.landed && !c.destroyed ? game.travelPlan(b.id) : null;
  const sites = b.landable ? game.sitesOn(b.id) : [];
  const orbiting = here && game.orbit && game.orbit.e < 1 && !c.landed;
  return (
    <>
      {plan && (
        <div className="pad travel">
          <div className="k">Fast travel</div>
          <div>Needs <b className={plan.have >= plan.dv ? 'good' : 'bad'}>{Math.round(plan.dv).toLocaleString()} m/s</b> of Δv (you have {Math.round(plan.have).toLocaleString()}) · {fmtT(plan.time)}</div>
          <button className="primary" disabled={plan.have < plan.dv} onClick={() => { game.travelTo(b.id); setUI({ selected: null }); game.toggleMap(); }}>Travel to {b.name}</button>
        </div>
      )}
      {sites.length > 0 && (
        <div className="pad sites">
          <div className="k">Things to find ({sites.filter((s) => s.found).length}/{sites.length})</div>
          {sites.map((s) => (
            <div key={s.id} className="siteRow">
              <span style={{ color: SITE_TYPES[s.type].css }}>◆</span>
              <span className={s.found ? 'dim' : ''}>{s.label}{s.found ? ' ✓' : ''}</span>
              {!s.found && orbiting && <button className="small" onClick={() => { game.landAtSite(s.id); setUI({ selected: null }); if (game.rig.map) game.toggleMap(); }}>Land here</button>}
            </div>
          ))}
          {!orbiting && sites.some((s) => !s.found) && <div className="dim" style={{ fontSize: 11 }}>Get into orbit around {b.name} to land next to these.</div>}
        </div>
      )}
    </>
  );
}

export function Upgrades({ onClose }) {
  const p = game.progress;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel dialog wide" onClick={(e) => e.stopPropagation()}>
        <div className="h"><span>Upgrades</span><span className="amber">🌰 {p.seeds} Space Seeds</span></div>
        <div className="pad dim" style={{ fontSize: 12 }}>Find Space Seeds in glowing seed caches and alien ruins on planets and moons. Follow the beacons!</div>
        <div className="pad scroll upgrades">
          {UPGRADES.map((u) => {
            const l = level(p, u.id), cost = nextCost(p, u.id);
            return (
              <div key={u.id} className="upg">
                <div className="ic">{u.icon}</div>
                <div className="tx"><b>{u.name}</b> <span className="dim">level {l}/{u.cost.length}</span><div className="dim">{u.desc}</div></div>
                {cost === null ? <span className="good">MAX</span>
                  : <button className={p.seeds >= cost ? 'primary' : ''} disabled={p.seeds < cost} onClick={() => game.buyUpgrade(u.id)}>🌰 {cost}</button>}
              </div>
            );
          })}
        </div>
        <div className="pad"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// Who still needs rescuing.
export function rescueHint(id) {
  const where = RESCUE_AT[id];
  return where ? `Lost on ${game.system.byId[where].name} — land there and follow the green beacon` : '';
}
export const crewCount = (p) => `${p.crew.length}/${CREW.length}`;
