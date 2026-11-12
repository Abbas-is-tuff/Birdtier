import React from 'react';
import { setUI } from './store.js';
import { game } from '../game/Game.js';
import { ACTIONS, keyName } from '../game/settings.js';
import { fmtDist, fmtSpeed, fmtTime, fmtNum, fmtPressure } from './format.js';
import { ColonyPanel } from './ColonyPanel.jsx';
import { Settings } from './Settings.jsx';
import { BodyInfo } from './Database.jsx';
import { BirdPortrait } from './BirdPortrait.jsx';
import { TouchControls } from './TouchControls.jsx';
import { RadioBubble, SitePointer, AutopilotButtons, BodyActions, Upgrades } from './Explore.jsx';

const K = ({ a }) => <kbd>{keyName(game.settings.keys[a])}</kbd>;
const Row = ({ k, v, cls }) => <div className="row"><span>{k}</span><span className={cls}>{v}</span></div>;
const Bar = ({ v, max, cls }) => <div className="bar"><i className={`${cls} ${max > 0 && v / max < 0.1 ? 'low' : ''}`} style={{ width: `${max > 0 ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;

function Controls() {
  const groups = {};
  for (const a in ACTIONS) (groups[ACTIONS[a][2]] ||= []).push(a);
  return (
    <div className="overlay" onClick={() => setUI({ overlay: 'pause' })}>
      <div className="panel dialog wide" onClick={(e) => e.stopPropagation()}>
        <div className="h"><span>Controls</span><span>Mouse: drag to look, wheel to zoom</span></div>
        <div className="pad scroll grid2">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}><div className="amber" style={{ margin: '6px 0 4px', fontSize: 11, letterSpacing: '.1em' }}>{g.toUpperCase()}</div>
              {list.map((a) => <div className="row" key={a}><span>{ACTIONS[a][1]}</span><span>{keyName(game.settings.keys[a])}</span></div>)}</div>
          ))}
        </div>
        <div className="pad"><button onClick={() => setUI({ overlay: 'pause' })}>Back</button></div>
      </div>
    </div>
  );
}

function PauseMenu({ ui }) {
  if (ui.overlay === 'settings') return <div className="overlay"><Settings onClose={() => setUI({ overlay: 'pause' })} /></div>;
  if (ui.overlay === 'controls') return <Controls />;
  if (ui.overlay === 'upgrades') return <Upgrades onClose={() => setUI({ overlay: 'pause' })} />;
  return (
    <div className="overlay">
      <div className="panel dialog">
        <div className="h"><span>Simulation paused</span></div>
        <div className="stack">
          <button className="primary" onClick={() => game.togglePause()}>Resume</button>
          <button onClick={() => { game.persist(); game.toast('Career saved', 'good'); }}>Save now</button>
          <button onClick={() => game.revert()}>Revert to launch</button>
          {ui.touch && <button onClick={() => game.fullscreen()}>Full screen</button>}
          {!ui.touch && <button onClick={() => setUI({ overlay: 'controls' })}>Controls</button>}
          <button onClick={() => setUI({ overlay: 'upgrades' })}>Upgrades (🌰 {game.progress.seeds})</button>
          <button onClick={() => setUI({ overlay: 'settings' })}>Settings</button>
          <button onClick={() => game.enterWorkshop()}>Spacecraft Workshop</button>
          <button onClick={() => game.toMenu()}>Save and exit to main menu</button>
        </div>
      </div>
    </div>
  );
}

function MapInfo({ id }) {
  const b = game.system.byId[id];
  if (id === 'craft' || !b) {
    return (
      <div className="panel mapinfo"><div className="h"><span>Vessel</span></div>
        <div className="pad"><button onClick={() => { game.rig.setMapFocus(game.craft.env.body); setUI({ selected: null }); }}>Centre map on current body</button></div></div>
    );
  }
  return (
    <div className="panel mapinfo">
      <div className="h"><span>{b.name}</span><span className="click" style={{ cursor: 'pointer' }} onClick={() => setUI({ selected: null })}>✕</span></div>
      <div className="pad scroll" style={{ maxHeight: '60vh' }}><BodyActions b={b} /><BodyInfo b={b} compact /></div>
      <div className="pad" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="primary" onClick={() => game.setTarget(b.id)}>Set as target</button>
        <button onClick={() => game.focusMap(b.id)}>Focus view</button>
        {game.target === b && <button onClick={() => game.setTarget(null)}>Clear target</button>}
      </div>
    </div>
  );
}

export function Hud({ ui }) {
  const h = ui.hud, p = ui.progress;
  if (!h) return null;
  const eva = h.eva;
  const lowAlt = h.radar !== null && h.radar < 50000;
  const compact = ui.compact, touch = ui.touch;
  // On small screens the colony panel and map info open as full sheets that hide the flight controls.
  const sheet = compact && (ui.panel === 'colony' || (ui.map && ui.selected));
  return (
    <div className={`hud ${compact ? 'compact' : ''}`}>
      <div className="panel topbar">
        <div><span className="k">Mission time</span><span className="v">T+ {fmtTime(h.met)}</span></div>
        <div><span className="k">{h.body}</span><span className="v" style={{ fontSize: 12 }}>{h.situation}</span></div>
        <div className="warp">
          <button className="small" onClick={() => game.setWarp(game.warpIdx - 1)}>◀</button>
          <div style={{ textAlign: 'center', minWidth: 74 }}><div className="k">Time warp</div><div className="v amber">{fmtNum(h.warp)}×</div></div>
          <button className="small" onClick={() => game.setWarp(game.warpIdx + 1)}>▶</button>
          <button className="small" onClick={() => game.togglePause()}>Pause</button>
        </div>
        <div><span className="k">Seeds</span><span className="v amber">🌰 {p.seeds}</span></div>
        <div className="camcell"><span className="k">Camera</span><span className="v" style={{ fontSize: 12 }}>{h.cam}</span></div>
        {compact && <div className="infocell"><button className={`small ${ui.drawer ? 'on' : ''}`} onClick={() => setUI({ drawer: !ui.drawer })}>Info</button></div>}
      </div>

      <div className="alerts">
        {h.storm && <span className="alert bad">Solar storm · comms blackout</span>}
        {h.shower && <span className="alert bad">Meteor shower</span>}
        {h.eclipse && <span className="alert warn">Eclipse by {h.eclipse}</span>}
        {h.weather && <span className="alert warn">{h.weather}</span>}
        {h.failures.map((f) => <span key={f} className="alert bad">Fault: {f}</span>)}
        {h.failures.length > 0 && (h.repair > 0 ? <span className="alert warn">Repairing… {Math.ceil(h.repair)} s</span> : <button className="small" onClick={() => game.startRepair()}>Repair</button>)}
        {h.pending > 0 && <span className="alert" style={{ color: 'var(--label)' }}>{h.pending} transmission{h.pending > 1 ? 's' : ''} in transit</span>}
      </div>

      {!compact && <div className="left">
        <div className="panel pilotbadge">
          <BirdPortrait bird={game.pilot} size={34} />
          <div><div className="k">{h.eva ? 'On EVA' : 'Pilot'} · {game.pilot.role}</div><b>{game.pilot.name}</b></div>
        </div>
        <div className="panel">
          <div className="h"><span>Flight data</span><span>{h.speedMode}</span></div>
          <div className="pad">
            <Row k="ALTITUDE" v={fmtDist(h.alt)} />
            <Row k="RADAR ALT" v={lowAlt ? fmtDist(h.radar) : '—'} cls={lowAlt && h.radar < 500 && !h.landed ? 'amber' : ''} />
            <Row k="VELOCITY" v={fmtSpeed(h.speed)} />
            <Row k="VERTICAL SPD" v={fmtSpeed(h.vs)} cls={h.vs < -h.radar / 8 && lowAlt && !h.landed ? 'bad' : ''} />
            <Row k="HORIZONTAL SPD" v={fmtSpeed(h.hs)} />
            <Row k="HEADING / PITCH" v={`${h.hdg.toFixed(0)}° / ${h.pitch.toFixed(0)}°`} />
          </div>
          <div className="h"><span>Orbit · {h.body}</span></div>
          <div className="pad">
            <Row k="APOAPSIS" v={fmtDist(h.ap)} />
            <Row k="PERIAPSIS" v={fmtDist(h.pe)} cls={h.pe < 0 ? 'dim' : 'good'} />
            <Row k="PERIOD" v={fmtTime(h.period)} />
            <Row k="INCLINATION" v={`${h.inc.toFixed(1)}°`} />
            <Row k="ECCENTRICITY" v={h.ecc.toFixed(4)} />
            <Row k="CIRCULAR / ESCAPE" v={`${h.vCirc.toFixed(0)} / ${h.vEsc.toFixed(0)} m/s`} />
          </div>
          <div className="h"><span>Environment</span></div>
          <div className="pad">
            <Row k="PRESSURE" v={fmtPressure(h.pressure)} />
            <Row k="TEMPERATURE" v={`${(h.tempK - 273.15).toFixed(0)} °C`} />
            <Row k="DYNAMIC PRESSURE" v={`${(h.q / 1000).toFixed(1)} kPa`} />
            <Row k="ACCELERATION" v={`${h.g.toFixed(2)} g`} />
            <Row k="SUNLIGHT" v={`${Math.round(h.sunVis * 100)}%`} />
          </div>
        </div>
        <div className="panel">
          <div className="h"><span>Missions {h.missionsDone}/{h.missionsTotal}</span><span className="mono">{fmtNum(p.funds)} ƒ · {p.science} sci</span></div>
          {h.missions.length === 0 && <div className="pad dim">All missions complete.</div>}
          {h.missions.slice(0, 3).map((m) => <div className="mission" key={m.id}><b>{m.title}</b><span>{m.text}</span></div>)}
        </div>
      </div>}
      {!compact && <div className="right">
        <div className="panel">
          <div className="h"><span>Vessel</span><span>Stage {h.stages - h.stage > 0 && h.ignited ? h.stage + 1 : '—'} of {h.stages}</span></div>
          <div className="pad">
            <Row k="LIQUID FUEL" v={`${fmtNum(h.fuel)} kg`} /><Bar v={h.fuel} max={h.fuelCap} cls="fuel" />
            {h.solidCap > 0 && <><Row k="SOLID FUEL" v={`${fmtNum(h.solid)} kg`} /><Bar v={h.solid} max={h.solidCap} cls="fuel" /></>}
            <Row k="ELECTRIC CHARGE" v={`${h.ec.toFixed(0)} / ${h.ecCap}${h.gen > 0 ? ` (+${h.gen.toFixed(1)}/s)` : ''}`} /><Bar v={h.ec} max={h.ecCap} cls="ec" />
            {h.monoCap > 0 && <><Row k="MONOPROPELLANT" v={`${h.mono.toFixed(0)} kg`} /><Bar v={h.mono} max={h.monoCap} cls="mono" /></>}
            {h.cargoCap > 0 && <Row k="CARGO (MATERIALS)" v={`${fmtNum(h.cargo)} / ${h.cargoCap} kg`} />}
            <Row k="MASS" v={`${fmtNum(h.mass)} kg`} />
            <Row k="THRUST / TWR" v={`${(h.thrust / 1000).toFixed(0)} kN / ${h.twr.toFixed(2)}`} />
            <Row k="STAGE Δv" v={`${fmtNum(h.dv)} m/s`} />
            {h.hasChute && <Row k="PARACHUTE" v={h.chute} />}
          </div>
        </div>
        {h.target && (
          <div className="panel"><div className="h"><span>Target · {h.target.name}</span><span className="click" style={{ cursor: 'pointer' }} onClick={() => game.setTarget(null)}>✕</span></div>
            <div className="pad"><Row k="DISTANCE" v={fmtDist(h.target.dist)} /><Row k="RELATIVE SPEED" v={fmtSpeed(h.target.rel)} /></div></div>
        )}
        {h.station && (
          <div className="panel"><div className="h"><span>{h.station.name}</span></div>
            <div className="pad"><Row k="RANGE" v={fmtDist(h.station.dist)} /><Row k="CLOSING SPEED" v={fmtSpeed(h.station.rel)} cls={h.station.rel > 3 ? 'bad' : 'good'} />
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Within 150 m and under 3 m/s, press <K a="interact" /> to dock.</div></div></div>
        )}
        {eva && (
          <div className="panel"><div className="h"><span>{eva.kind === 'rover' ? 'Rover' : 'EVA'}</span><span>{eva.biome}</span></div>
            <div className="pad"><Row k="TO VESSEL" v={fmtDist(eva.dist)} /><Row k="SPEED" v={fmtSpeed(eva.speed)} />
              {eva.kind === 'rover' && <><Row k="ROVER CHARGE" v={`${eva.ec.toFixed(0)} / ${eva.ecCap}`} /><Bar v={eva.ec} max={eva.ecCap} cls="ec" /></>}
              {eva.roverDist !== null && <Row k="TO ROVER" v={fmtDist(eva.roverDist)} />}
            </div></div>
        )}
      </div>}

      {compact && !sheet && (
        <>
          <div className="panel mini minil">
            <div className="minibadge"><BirdPortrait bird={game.pilot} size={26} /><b>{game.pilot.name}</b></div>
            <Row k="ALT" v={fmtDist(h.alt)} />
            {lowAlt && !eva && <Row k="RADAR" v={fmtDist(h.radar)} cls={h.radar < 500 && !h.landed ? 'amber' : ''} />}
            <Row k="SPEED" v={fmtSpeed(h.speed)} />
            <Row k="V.SPD" v={fmtSpeed(h.vs)} cls={h.vs < -h.radar / 8 && lowAlt && !h.landed ? 'bad' : ''} />
            {!eva && <><Row k="AP" v={fmtDist(h.ap)} /><Row k="PE" v={fmtDist(h.pe)} cls={h.pe < 0 ? 'dim' : 'good'} /></>}
          </div>
          <div className="panel mini minir">
            {eva ? <>
              <Row k={eva.kind === 'rover' ? 'ROVER' : 'EVA'} v={eva.biome} />
              <Row k="TO VESSEL" v={fmtDist(eva.dist)} />
              {eva.kind === 'rover' && <><Row k="CHARGE" v={`${eva.ec.toFixed(0)}`} /><Bar v={eva.ec} max={eva.ecCap} cls="ec" /></>}
            </> : <>
              <Row k="FUEL" v={`${fmtNum(h.fuel + (h.solid || 0))} kg`} /><Bar v={h.fuel + (h.solid || 0)} max={h.fuelCap + (h.solidCap || 0)} cls="fuel" />
              <Row k="CHARGE" v={`${h.ec.toFixed(0)}`} /><Bar v={h.ec} max={h.ecCap} cls="ec" />
              <Row k="STAGE Δv" v={`${fmtNum(h.dv)} m/s`} />
              <Row k="TWR" v={h.twr.toFixed(2)} />
            </>}
          </div>
        </>
      )}
      {compact && ui.drawer && (
        <div className="panel drawer">
          <div className="h"><span>Flight info</span><span className="click" onClick={() => setUI({ drawer: false })}>✕ Close</span></div>
          <div className="scroll drawerbody">
            <div>
              <div className="panel pilotbadge">
          <BirdPortrait bird={game.pilot} size={34} />
          <div><div className="k">{h.eva ? 'On EVA' : 'Pilot'} · {game.pilot.role}</div><b>{game.pilot.name}</b></div>
        </div>
        <div className="panel">
          <div className="h"><span>Flight data</span><span>{h.speedMode}</span></div>
          <div className="pad">
            <Row k="ALTITUDE" v={fmtDist(h.alt)} />
            <Row k="RADAR ALT" v={lowAlt ? fmtDist(h.radar) : '—'} cls={lowAlt && h.radar < 500 && !h.landed ? 'amber' : ''} />
            <Row k="VELOCITY" v={fmtSpeed(h.speed)} />
            <Row k="VERTICAL SPD" v={fmtSpeed(h.vs)} cls={h.vs < -h.radar / 8 && lowAlt && !h.landed ? 'bad' : ''} />
            <Row k="HORIZONTAL SPD" v={fmtSpeed(h.hs)} />
            <Row k="HEADING / PITCH" v={`${h.hdg.toFixed(0)}° / ${h.pitch.toFixed(0)}°`} />
          </div>
          <div className="h"><span>Orbit · {h.body}</span></div>
          <div className="pad">
            <Row k="APOAPSIS" v={fmtDist(h.ap)} />
            <Row k="PERIAPSIS" v={fmtDist(h.pe)} cls={h.pe < 0 ? 'dim' : 'good'} />
            <Row k="PERIOD" v={fmtTime(h.period)} />
            <Row k="INCLINATION" v={`${h.inc.toFixed(1)}°`} />
            <Row k="ECCENTRICITY" v={h.ecc.toFixed(4)} />
            <Row k="CIRCULAR / ESCAPE" v={`${h.vCirc.toFixed(0)} / ${h.vEsc.toFixed(0)} m/s`} />
          </div>
          <div className="h"><span>Environment</span></div>
          <div className="pad">
            <Row k="PRESSURE" v={fmtPressure(h.pressure)} />
            <Row k="TEMPERATURE" v={`${(h.tempK - 273.15).toFixed(0)} °C`} />
            <Row k="DYNAMIC PRESSURE" v={`${(h.q / 1000).toFixed(1)} kPa`} />
            <Row k="ACCELERATION" v={`${h.g.toFixed(2)} g`} />
            <Row k="SUNLIGHT" v={`${Math.round(h.sunVis * 100)}%`} />
          </div>
        </div>
        <div className="panel">
          <div className="h"><span>Missions {h.missionsDone}/{h.missionsTotal}</span><span className="mono">{fmtNum(p.funds)} ƒ · {p.science} sci</span></div>
          {h.missions.length === 0 && <div className="pad dim">All missions complete.</div>}
          {h.missions.slice(0, 3).map((m) => <div className="mission" key={m.id}><b>{m.title}</b><span>{m.text}</span></div>)}
        </div>
            </div>
            <div>
        <div className="panel">
          <div className="h"><span>Vessel</span><span>Stage {h.stages - h.stage > 0 && h.ignited ? h.stage + 1 : '—'} of {h.stages}</span></div>
          <div className="pad">
            <Row k="LIQUID FUEL" v={`${fmtNum(h.fuel)} kg`} /><Bar v={h.fuel} max={h.fuelCap} cls="fuel" />
            {h.solidCap > 0 && <><Row k="SOLID FUEL" v={`${fmtNum(h.solid)} kg`} /><Bar v={h.solid} max={h.solidCap} cls="fuel" /></>}
            <Row k="ELECTRIC CHARGE" v={`${h.ec.toFixed(0)} / ${h.ecCap}${h.gen > 0 ? ` (+${h.gen.toFixed(1)}/s)` : ''}`} /><Bar v={h.ec} max={h.ecCap} cls="ec" />
            {h.monoCap > 0 && <><Row k="MONOPROPELLANT" v={`${h.mono.toFixed(0)} kg`} /><Bar v={h.mono} max={h.monoCap} cls="mono" /></>}
            {h.cargoCap > 0 && <Row k="CARGO (MATERIALS)" v={`${fmtNum(h.cargo)} / ${h.cargoCap} kg`} />}
            <Row k="MASS" v={`${fmtNum(h.mass)} kg`} />
            <Row k="THRUST / TWR" v={`${(h.thrust / 1000).toFixed(0)} kN / ${h.twr.toFixed(2)}`} />
            <Row k="STAGE Δv" v={`${fmtNum(h.dv)} m/s`} />
            {h.hasChute && <Row k="PARACHUTE" v={h.chute} />}
          </div>
        </div>
        {h.target && (
          <div className="panel"><div className="h"><span>Target · {h.target.name}</span><span className="click" style={{ cursor: 'pointer' }} onClick={() => game.setTarget(null)}>✕</span></div>
            <div className="pad"><Row k="DISTANCE" v={fmtDist(h.target.dist)} /><Row k="RELATIVE SPEED" v={fmtSpeed(h.target.rel)} /></div></div>
        )}
        {h.station && (
          <div className="panel"><div className="h"><span>{h.station.name}</span></div>
            <div className="pad"><Row k="RANGE" v={fmtDist(h.station.dist)} /><Row k="CLOSING SPEED" v={fmtSpeed(h.station.rel)} cls={h.station.rel > 3 ? 'bad' : 'good'} />
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Within 150 m and under 3 m/s, press <K a="interact" /> to dock.</div></div></div>
        )}
        {eva && (
          <div className="panel"><div className="h"><span>{eva.kind === 'rover' ? 'Rover' : 'EVA'}</span><span>{eva.biome}</span></div>
            <div className="pad"><Row k="TO VESSEL" v={fmtDist(eva.dist)} /><Row k="SPEED" v={fmtSpeed(eva.speed)} />
              {eva.kind === 'rover' && <><Row k="ROVER CHARGE" v={`${eva.ec.toFixed(0)} / ${eva.ecCap}`} /><Bar v={eva.ec} max={eva.ecCap} cls="ec" /></>}
              {eva.roverDist !== null && <Row k="TO ROVER" v={fmtDist(eva.roverDist)} />}
            </div></div>
        )}
            </div>
          </div>
        </div>
      )}

      {ui.map && ui.selected && <MapInfo id={ui.selected} />}
      {ui.panel === 'colony' && <ColonyPanel h={h} />}
      {ui.map && !ui.selected && <div className="hint">{touch ? 'System map — tap a label to inspect a body or set a target. Drag to rotate, pinch to zoom.' : 'System map — click a label to inspect a body, set it as target or centre the view on it. Drag to rotate, wheel to zoom.'}</div>}
      {sheet && <button className="sheetclose" onClick={() => setUI(ui.panel === 'colony' ? { panel: null } : { selected: null })}>✕ Close</button>}

      {!sheet && <div className="bottom">
        <div className={`panel controls ${compact ? 'row1' : ''}`}>
          {eva && eva.kind === 'cabin' ? (
            <>
              <button className={eva.prompt && !eva.nearId?.startsWith('crew') && eva.nearId !== 'bowl' ? 'primary' : ''} onClick={() => game.interact()}>{eva.prompt && !eva.nearId?.startsWith('crew') && eva.nearId !== 'bowl' ? eva.prompt : 'Use'}<K a="interact" /></button>
              <button className={eva.nearId === 'bowl' || eva.nearId?.startsWith('crew') ? 'primary' : ''} onClick={() => game.collectSample()}>{eva.nearId === 'bowl' ? 'Eat seeds' : eva.nearId?.startsWith('crew') ? eva.prompt : 'Talk / eat'}<K a="sample" /></button>
              <button onClick={() => game.toggleCabin()}>Back to seat<K a="cabin" /></button>
            </>
          ) : eva && eva.kind === 'spacewalk' ? (
            <>
              <button className={eva.dist < 12 ? 'primary' : ''} onClick={() => game.interact()}>Come back in ({Math.round(eva.dist)} m)<K a="interact" /></button>
            </>
          ) : eva ? (
            <>
              <button onClick={() => game.interact()}>{eva.kind === 'rover' ? 'Leave rover' : eva.roverDist !== null && eva.roverDist < 6 ? 'Drive rover' : 'Board vessel'}<K a="interact" /></button>
              {eva.kind === 'astronaut' && <><button onClick={() => game.collectSample()}>Collect sample<K a="sample" /></button>
                <button onClick={() => game.deploySci()}>Deploy science station<K a="deploySci" /></button></>}
            </>
          ) : (
            <>
              <AutopilotButtons h={h} />
              {!touch && <button className="primary" onClick={() => game.stage()}>Stage<K a="stage" /></button>}
              <span className="sep" />
              <button className={h.sas ? 'on' : ''} onClick={() => game.toggle('sas')}>SAS<K a="sas" /></button>
              {[['stab', 'Hold', 'sasStab'], ['pro', 'Prograde', 'sasPro'], ['retro', 'Retro', 'sasRetro'], ['up', 'Radial', 'sasUp']].map(([m, l, a]) => (
                <button key={m} className={`small ${h.sas && h.sasMode === m ? 'on' : ''}`} onClick={() => game.setSas(m)}>{l}<K a={a} /></button>
              ))}
              <span className="sep" />
              {h.hasRcs && <button className={h.rcs ? 'on' : ''} onClick={() => game.toggle('rcs')}>RCS<K a="rcs" /></button>}
              {h.hasLegs && <button className={h.gear ? 'on' : ''} onClick={() => game.toggle('gear')}>Gear<K a="gear" /></button>}
              {h.hasSolar && <button className={h.panels ? 'on' : ''} onClick={() => game.toggle('panels')}>Solar<K a="panels" /></button>}
              {h.instruments > 0 && <button onClick={() => game.runExperiments()}>Science<K a="experiment" /></button>}
              {(h.landed || h.docked || h.station) && <button onClick={() => game.interact()}>{h.docked ? 'Undock' : h.landed ? 'EVA outside' : 'Dock'}<K a="interact" /></button>}
              {!h.landed && !h.docked && !h.station && h.pressure === 0 && <button onClick={() => game.interact()}>Spacewalk<K a="interact" /></button>}
              <button onClick={() => game.toggleCabin()}>Go inside<K a="cabin" /></button>
              {h.landed && h.hasRover && <button onClick={() => game.deployRover()}>Deploy rover</button>}
              {h.home && <button onClick={() => game.recover()}>Recover vessel</button>}
            </>
          )}
          <span className="sep" />
          <button className={ui.panel === 'colony' ? 'on' : ''} onClick={() => setUI({ panel: ui.panel === 'colony' ? null : 'colony' })}>Colony<K a="base" /></button>
          <button className={ui.map ? 'on' : ''} onClick={() => game.toggleMap()}>Map<K a="map" /></button>
          <button onClick={() => game.cycleCamera()}>Camera<K a="camera" /></button>
        </div>
        {!eva && !touch && (
          <div className="panel throttle">
            <span className="dim" style={{ fontSize: 10, letterSpacing: '.12em' }}>THROTTLE</span>
            <input type="range" min="0" max="100" value={Math.round(h.throttle * 100)} onChange={(e) => game.setThrottle(e.target.value / 100)} />
            <span className="mono amber" style={{ width: 40, textAlign: 'right' }}>{Math.round(h.throttle * 100)}%</span>
            <K a="throttleUp" /><K a="throttleDown" /><K a="throttleMax" /><K a="throttleCut" />
          </div>
        )}
      </div>}
      {touch && !sheet && !ui.paused && <TouchControls h={h} />}
      {!sheet && !ui.drawer && <RadioBubble radio={ui.radio} />}
      {!sheet && !ui.map && <SitePointer site={h.find} />}
      {eva && eva.kind === 'cabin' && eva.prompt && !sheet && <div className="panel cabinprompt">{eva.nearId === 'bowl' || eva.nearId?.startsWith('crew') ? <><K a="sample" /> {eva.prompt}</> : <><K a="interact" /> {eva.prompt}</>}</div>}
      {eva && eva.kind === 'spacewalk' && !sheet && <div className="panel cabinprompt">Tether {Math.round(eva.dist)} / 40 m{eva.dist < 12 ? ' — press F to come back in' : ''}</div>}
      {ui.portrait && !ui.portraitOk && !sheet && (
        <div className="panel rotatetip">Turn your phone sideways for the best view <span className="click" onClick={() => setUI({ portraitOk: true })}>✕</span></div>
      )}

      <div className="toasts">{(compact ? ui.toasts.slice(-2) : ui.toasts).map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>

      {ui.paused && !ui.lost && <PauseMenu ui={ui} />}
      {ui.lost && (
        <div className="overlay">
          <div className="panel dialog">
            <div className="h"><span className="bad">Vehicle lost</span></div>
            <div className="stack">
              <div style={{ lineHeight: 1.5 }}>{ui.lost}</div>
              <button className="primary" onClick={() => game.revert()}>Revert to launch</button>
              <button onClick={() => game.enterWorkshop()}>Spacecraft Workshop</button>
              <button onClick={() => game.toMenu()}>Main menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
