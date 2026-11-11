import React, { useState, useEffect } from 'react';
import { game } from '../game/Game.js';
import { PARTS, CATEGORIES, TIER_COST, TIER_NAMES } from '../spacecraft/parts.js';
import { DEFAULT_DESIGN, designStats, sortParts } from '../spacecraft/designs.js';
import { store } from '../game/settings.js';
import { fmtNum } from './format.js';
import { CrewPicker } from './BirdPortrait.jsx';

const clone = (d) => JSON.parse(JSON.stringify(d));

export function Workshop({ ui }) {
  const p = ui.progress;
  const [design, setDesign] = useState(() => clone(store.get('design', null) || DEFAULT_DESIGN));
  const [sel, setSel] = useState(0);
  const [err, setErr] = useState(null);
  const stats = designStats(design);
  useEffect(() => { game.setPreview(design); store.set('design', design); }, [design]);
  const update = (fn) => { const d = clone(design); fn(d); d.stages.forEach((s) => { s.parts = sortParts(s.parts); }); setDesign(d); setErr(null); };
  const selIdx = Math.min(sel, design.stages.length - 1);
  const isDefault = JSON.stringify(design.stages) === JSON.stringify(DEFAULT_DESIGN.stages);
  const cost = game.launchCost(stats), discount = cost < stats.cost;
  const affordable = p.funds >= cost || isDefault;
  const nextTier = p.tier + 1;
  return (
    <div className="screen">
      <div className="col" style={{ width: 300 }}>
        <div className="panel col" style={{ minHeight: 0, flex: 1 }}>
          <div className="h"><span>Components</span><span>add to stage {selIdx + 1}</span></div>
          <div className="scroll">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <div className="dim" style={{ padding: '8px 10px 3px', fontSize: 10, letterSpacing: '.14em' }}>{cat.toUpperCase()}</div>
                {Object.entries(PARTS).filter(([, x]) => x.cat === cat).map(([id, x]) => {
                  const locked = x.tier > p.tier;
                  return (
                    <div key={id} className={`item click ${locked ? 'locked' : ''}`} title={locked ? `Unlocks with research tier ${x.tier}` : 'Click to add'}
                      onClick={() => { if (!locked) update((d) => d.stages[selIdx].parts.push(id)); }}>
                      <div>{x.name}<small>{x.info}</small><small className="mono">{fmtNum(x.mass + (x.fuel || 0) + (x.solid || 0))} kg{x.thrust ? ` · ${x.thrust / 1000} kN · Isp ${x.ispVac} s` : ''}</small></div>
                      <span className="mono amber" style={{ whiteSpace: 'nowrap' }}>{locked ? `T${x.tier}` : `${fmtNum(x.cost)} ƒ`}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col" style={{ width: 300 }}>
        <div className="panel col" style={{ minHeight: 0 }}>
          <div className="h"><span>Stack — top to bottom</span><span>fires bottom first</span></div>
          <div className="pad scroll">
            {design.stages.map((st, i) => (
              <div key={i} className={`stagebox click ${i === selIdx ? 'sel' : ''}`} onClick={() => setSel(i)}>
                <div className="sh">
                  <span>Stage {i + 1}{i === 0 ? ' (payload)' : ''} · <span className="mono">{fmtNum(stats.stages[i].dv)} m/s</span></span>
                  {i > 0 && <button className="small danger" onClick={(e) => { e.stopPropagation(); update((d) => d.stages.splice(i, 1)); setSel(0); }}>Remove</button>}
                </div>
                <div className="pad">
                  {st.parts.length === 0 && <span className="dim">empty — click components to add</span>}
                  {st.parts.map((id, k) => (
                    <span className="chip" key={k}>{PARTS[id].name}
                      <button title="Remove" onClick={(e) => { e.stopPropagation(); update((d) => d.stages[i].parts.splice(d.stages[i].parts.indexOf(id), 1)); }}>×</button></span>
                  ))}
                  {stats.stages[i].thrust > 0 && <div className="dim mono" style={{ fontSize: 11, marginTop: 4 }}>TWR {stats.stages[i].twr.toFixed(2)} (Thalen) · {fmtNum(stats.stages[i].wet)} kg at ignition</div>}
                </div>
              </div>
            ))}
            <button disabled={design.stages.length >= 6} onClick={() => { update((d) => d.stages.push({ parts: [] })); setSel(design.stages.length); }}>Add stage below</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="col" style={{ width: 300 }}>
        <div className="panel">
          <div className="h"><span>Pilot</span><span>{game.pilot.name}</span></div>
          <div className="pad"><CrewPicker pilotId={p.pilot} onPick={(id) => game.setPilot(id)} size={30} compact /></div>
        </div>
        <div className="panel">
          <div className="h"><span>Vessel</span><span className="mono">{fmtNum(p.funds)} ƒ available</span></div>
          <div className="pad">
            <input type="text" value={design.name} maxLength={28} style={{ width: '100%', marginBottom: 8 }} onChange={(e) => { const d = clone(design); d.name = e.target.value; setDesign(d); }} />
            <div className="row"><span>LAUNCH MASS</span><span>{fmtNum(stats.mass)} kg</span></div>
            <div className="row"><span>TOTAL Δv (VACUUM)</span><span>{fmtNum(stats.totalDv)} m/s</span></div>
            <div className="row"><span>LIFT-OFF TWR</span><span className={stats.stages.length && stats.stages[stats.stages.length - 1].twr < 1.05 ? 'bad' : 'good'}>{stats.stages.length ? stats.stages[stats.stages.length - 1].twr.toFixed(2) : '—'}</span></div>
            <div className="row"><span>COST</span><span className={affordable ? 'amber' : 'bad'}>{fmtNum(cost)} ƒ{discount ? ` (−${Math.round((1 - cost / stats.cost) * 100)}%)` : ''}</span></div>
            <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, margin: '6px 0' }}>Reaching low Thalen orbit takes roughly 3,600 m/s. Δv figures use the ideal rocket equation.</div>
            {stats.problems.map((x, i) => <div className="problem" key={i}>{x}</div>)}
            {stats.valid && stats.stages[stats.stages.length - 1].twr < 1 && <div className="problem">Lift-off TWR is below 1 — this will not leave the pad.</div>}
            {!affordable && <div className="problem">Not enough funds for this design.</div>}
            {ui.canResume && <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>You have a vessel in flight. Launching replaces it — only one vessel is active at a time.</div>}
            {err && <div className="problem">{err}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button className="primary" disabled={!stats.valid || !affordable} onClick={() => setErr(game.launch(design))}>Launch</button>
              <button onClick={() => { setDesign(clone(DEFAULT_DESIGN)); setSel(0); }}>Load Wayfarer I</button>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="h"><span>Research</span><span className="mono">{p.science} science</span></div>
          <div className="pad">
            {TIER_NAMES.map((n, i) => <div className="row" key={i}><span>TIER {i} · {n.toUpperCase()}</span><span className={i <= p.tier ? 'good' : 'dim'}>{i <= p.tier ? 'unlocked' : `${TIER_COST[i]} sci`}</span></div>)}
            {nextTier < TIER_COST.length
              ? <button style={{ marginTop: 6 }} disabled={p.science < TIER_COST[nextTier]} onClick={() => game.research()}>Unlock tier {nextTier} ({TIER_COST[nextTier]} science)</button>
              : <div className="good" style={{ marginTop: 6 }}>All tiers unlocked.</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ui.canResume && <button onClick={() => game.exitWorkshop(true)}>Resume flight</button>}
          <button onClick={() => game.exitWorkshop(false)}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
