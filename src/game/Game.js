// Game orchestration: owns the simulation clock, the craft, surface entities, colonies,
// events and missions, and drives rendering each frame.
import * as THREE from 'three';
import { StarSystem } from '../world/StarSystem.js';
import { BELTS } from '../world/systemData.js';
import { smoothstep } from '../world/noise.js';
import { Craft } from '../spacecraft/Craft.js';
import { DEFAULT_DESIGN, designStats } from '../spacecraft/designs.js';
import { TIER_COST } from '../spacecraft/parts.js';
import { elementsFromState } from '../physics/kepler.js';
import { C_LIGHT } from '../physics/constants.js';
import { SceneRenderer } from '../render/Renderer.js';
import { PlanetView } from '../render/planetView.js';
import { Starfield, StarView, BeltView } from '../render/sky.js';
import { TerrainPatch } from '../render/terrainPatch.js';
import { Particles } from '../render/particles.js';
import { buildCraftModel, buildStation, buildAstronaut, buildRover, buildSciStation, buildLaunchPad, buildModule, buildAsteroid } from '../render/models.js';
import { CameraRig, CAM_MODES, CAM_LABEL } from '../render/cameras.js';
import { MapView } from '../render/mapView.js';
import { SurfaceEntity } from '../surface/SurfaceEntity.js';
import { Colony, MODULES, RESUPPLY } from '../colony/Colony.js';
import { EventSystem } from '../events/events.js';
import { MISSIONS, newProgress, activeMissions } from '../missions/missions.js';
import { QUALITY, loadSettings, saveSettings, store } from './settings.js';
import { Input } from './input.js';
import { setUI, getUI } from '../ui/store.js';

export const WARPS = [1, 2, 5, 10, 100, 1000, 10000, 100000];
const Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();

class AssetQueue {
  constructor() { this.jobs = []; this.total = 0; this.finished = 0; }
  add(gen) { this.jobs.push(gen); this.total++; }
  run(ms) {
    const end = performance.now() + ms;
    while (this.jobs.length && performance.now() < end) {
      if (this.jobs[0].next().done) { this.jobs.shift(); this.finished++; }
    }
  }
}

class Game {
  constructor() {
    this.t = 0; this.mode = 'boot'; this.warpIdx = 0; this.paused = false;
    this.craft = null; this.model = null; this.entity = null; this.rover = null; this.astronaut = null;
    this.colonies = []; this.deployed = []; this.debris = []; this.sciQueue = []; this.cmdQueue = [];
    this.target = null; this.orbit = null; this.eclipse = null; this.nearBody = null;
    this.toasts = []; this.toastId = 0; this.hudClock = 0; this.saveClock = 0; this.repair = 0;
    this.menuBody = null; this.basesDirty = true; this.sunVis = 1; this.menuClock = 0; this._focus = new THREE.Vector3();
  }

  // ------------------------------------------------------------------ setup
  init(canvas, labelsEl) {
    this.settings = loadSettings();
    this.q = QUALITY[this.settings.quality];
    this.system = new StarSystem();
    const sys = this.system;
    this.r = new SceneRenderer(canvas, this.q);
    const scene = this.r.scene;
    this.queue = new AssetQueue();
    this.starfield = new Starfield(this.q.stars); scene.add(this.starfield.group);
    this.starView = new StarView(sys.star); scene.add(this.starView.group);
    this.views = {};
    for (const b of sys.bodies) {
      if (!b.terrain) continue;
      const v = new PlanetView(b, this.q, this.queue);
      this.views[b.id] = v; scene.add(v.group);
      if (v.atmoGroup) scene.add(v.atmoGroup);
    }
    this.stationViews = sys.stations.map((b) => { const g = buildStation(); scene.add(g); return { body: b, group: g }; });
    this.belts = BELTS.map((d, i) => { const v = new BeltView(d, sys.star, 50 + i); scene.add(v.points); return v; });
    this.map = new MapView(sys, labelsEl, (id) => setUI({ selected: id }));
    scene.add(this.map.group); this.map.setVisible(false);
    this.patch = new TerrainPatch(this.q);
    this.fx = new Particles(this.q.particles, true);
    this.dust = new Particles(Math.floor(this.q.particles / 2), false);
    this.rig = new CameraRig();
    this.surfaceRoot = {}; // per-body groups for bases etc.
    this.padAnchor = this.anchor(sys.home, sys.launchSite, 0, -0.02);
    this.padAnchor.add(buildLaunchPad());
    this.astroMesh = buildAstronaut(); this.roverMesh = buildRover();
    this.astroMesh.visible = this.roverMesh.visible = false;
    scene.add(this.astroMesh, this.roverMesh);
    this.menuBody = sys.home;
    this.input = new Input(this.settings.keys, canvas);
    this.bindInput();
    this.progress = store.get('progress', null) || newProgress();
    setUI({ hasSave: !!store.get('save', null), progress: { ...this.progress } });
    this.mode = 'loading';
    this.last = performance.now();
    const loop = () => { requestAnimationFrame(loop); this.frame(); };
    requestAnimationFrame(loop);
  }

  // Object3D fixed to a body's surface at a body-frame direction.
  anchor(body, dir, heading = 0, lift = 0) {
    const o = new THREE.Group();
    o.position.copy(dir).multiplyScalar(body.radius + body.surfaceH(dir) + lift);
    o.quaternion.setFromUnitVectors(Y, dir).multiply(_q.setFromAxisAngle(Y, heading));
    this.views[body.id].group.add(o);
    return o;
  }

  bindInput() {
    const i = this.input, on = (a, f) => i.on(a, () => { if (this.mode === 'flight') f(); });
    on('stage', () => { if (!this.entity && !this.paused) this.craft.activateNextStage(); });
    on('sas', () => this.toggle('sas')); on('rcs', () => this.toggle('rcs')); on('gear', () => this.toggle('gear')); on('panels', () => this.toggle('panels'));
    on('sasStab', () => this.setSas('stab')); on('sasPro', () => this.setSas('pro')); on('sasRetro', () => this.setSas('retro')); on('sasUp', () => this.setSas('up'));
    on('throttleMax', () => { if (!this.entity) this.craft.throttle = 1; });
    on('throttleCut', () => { if (!this.entity) this.craft.throttle = 0; });
    on('warpUp', () => this.setWarp(this.warpIdx + 1)); on('warpDown', () => this.setWarp(this.warpIdx - 1));
    on('pause', () => this.togglePause()); on('map', () => this.toggleMap()); on('camera', () => this.cycleCamera());
    on('interact', () => this.interact()); on('sample', () => this.collectSample()); on('deploySci', () => this.deploySci());
    on('experiment', () => this.runExperiments()); on('base', () => setUI({ panel: getUI().panel === 'colony' ? null : 'colony' }));
    i.on('escape', () => {
      const u = getUI();
      if (u.panel) setUI({ panel: null }); else if (u.selected) setUI({ selected: null }); else if (this.mode === 'flight' && !u.overlay) this.togglePause();
    });
    i.onDrag = (dx, dy) => this.rig.drag(dx, dy);
    i.onWheel = (d) => this.rig.zoom(d);
  }

  // ------------------------------------------------------------------ lifecycle
  setCraft(craft) {
    if (this.model) this.r.scene.remove(this.model.root);
    for (const d of this.debris) this.r.scene.remove(d.group);
    this.debris = [];
    this.craft = craft; this.model = null;
    this.fx.clear(); this.dust.clear();
    if (!craft) return;
    this.model = buildCraftModel(craft);
    this.model.root.add(this.fx.points, this.dust.points);
    this.r.scene.add(this.model.root);
    this.rig.dist.chase = Math.max(22, craft.length * 2.4);
  }

  resetWorld() {
    for (const c of this.colonies) if (c.group) c.group.removeFromParent();
    for (const d of this.deployed) if (d.obj) d.obj.removeFromParent();
    this.colonies = []; this.deployed = []; this.sciQueue = []; this.cmdQueue = []; this.target = null; this.eclipse = null;
    this.entity = null; this.rover = null; this.astronaut = null;
    for (const b of this.system.bodies) b.weather = null;
    this.removeRogueMesh();
    this.basesDirty = true;
  }

  newCareer() {
    this.resetWorld(); this.careerLoaded = true;
    this.t = 0; this.system.update(0);
    this.progress = newProgress();
    this.events = new EventSystem(this);
    store.remove('save');
    this.launch(DEFAULT_DESIGN, true);
  }

  // Launch a craft from the pad within the current career.
  launch(design, free = false) {
    const stats = designStats(design);
    if (!stats.valid) return 'Design is not valid.';
    const p = this.progress;
    const grant = p.funds < stats.cost && JSON.stringify(design.stages) === JSON.stringify(DEFAULT_DESIGN.stages);
    if (!free && !grant && p.funds < stats.cost) return 'Not enough funds.';
    if (!free && !grant) p.funds -= stats.cost;
    if (!this.events) this.events = new EventSystem(this);
    this.system.update(this.t);
    const c = new Craft(design);
    c.cargo = Math.min(c.cargoCap, p.materials); p.materials -= c.cargo;
    c.cost = stats.cost;
    c.placeOn(this.system.home, this.system.launchSite);
    this.entity = null; this.rover = null; this.astronaut = null;
    this.setCraft(c);
    p.launches++;
    this.beginFlight();
    this.launchSnapshot = JSON.parse(JSON.stringify(this.snapshot())); this.resume = null;
    if (grant) this.toast('Agency grant: this launch was funded for free', 'good');
    this.toast(`${design.name} is on the pad at Halden Reach. Press Space to ignite.`, 'info');
    this.save();
    return null;
  }

  beginFlight() {
    this.mode = 'flight'; this.paused = false; this.warpIdx = 0; this.repair = 0;
    this.rig.map = false; this.rig.mode = 'chase'; this.rig.yaw = Math.PI; this.rig.pitch = 0.12; this.rig.blend = 1;
    this.map.setVisible(false);
    this.craft.computeEnv(this.system);
    setUI({ screen: 'flight', paused: false, map: false, lost: null, panel: null, selected: null, overlay: null, progress: { ...this.progress } });
  }

  continueCareer() {
    const d = store.get('save', null);
    if (!d) return false;
    this.restore(d);
    if (this.craft) this.beginFlight(); else this.enterWorkshop();
    return true;
  }

  snapshot() {
    return {
      v: 1, t: this.t, progress: this.progress, craft: this.craft && !this.craft.destroyed ? { ...this.craft.toJSON(), cost: this.craft.cost } : null,
      colonies: this.colonies.map((c) => c.toJSON()), deployed: this.deployed.map((d) => ({ body: d.body.id, dir: d.dir.toArray() })),
      events: this.events ? this.events.toJSON() : null, sciQueue: this.sciQueue, target: this.target ? this.target.id : null,
      rover: this.rover ? this.rover.toJSON() : null,
      weather: this.system.bodies.filter((b) => b.weather).map((b) => [b.id, b.weather]),
    };
  }
  persist() {
    store.set('save', JSON.parse(JSON.stringify(this.snapshot()))); store.set('progress', this.progress);
    setUI({ hasSave: true });
  }
  save() { if (this.mode === 'flight') this.persist(); }
  restore(d) {
    this.resetWorld(); this.careerLoaded = true;
    this.t = d.t; this.system.update(this.t);
    this.progress = { ...newProgress(), ...JSON.parse(JSON.stringify(d.progress)) };
    this.events = new EventSystem(this); this.events.load(d.events);
    this.colonies = d.colonies.map((c) => Colony.fromJSON(c, this.system));
    for (const s of d.deployed) this.addDeployed(this.system.byId[s.body], new THREE.Vector3().fromArray(s.dir));
    this.sciQueue = d.sciQueue || [];
    this.target = d.target ? this.system.byId[d.target] : null;
    for (const [id, w] of d.weather || []) this.system.byId[id].weather = w;
    let craft = null;
    if (d.craft) { craft = Craft.fromJSON(JSON.parse(JSON.stringify(d.craft)), this.system); craft.cost = d.craft.cost || 0; }
    this.setCraft(craft);
    if (d.rover) { const r = d.rover; this.rover = new SurfaceEntity('rover', this.system.byId[r.body], new THREE.Vector3().fromArray(r.dir), r.heading); this.rover.ec = r.ec; }
    this.basesDirty = true;
  }

  revert() { if (this.launchSnapshot) { this.restore(JSON.parse(JSON.stringify(this.launchSnapshot))); this.beginFlight(); } }

  toMenu() {
    this.save();
    this.mode = 'menu'; this.paused = false;
    this.map.setVisible(false); this.rig.map = false; this.rig.startBlend(); this.rig.mode = 'orbital'; this.rig.dist.orbital = 3.2;
    if (this.model) this.model.root.visible = false;
    setUI({ screen: 'menu', paused: false, map: false, lost: null, panel: null, selected: null, overlay: null, progress: { ...this.progress } });
  }

  // The workshop previews designs on the pad. A flight in progress is kept in `resume`
  // and only replaced when a new craft is actually launched (one active vessel at a time).
  enterWorkshop() {
    this.save();
    if (!this.careerLoaded) { const d = store.get('save', null); if (d) this.restore(d); }
    this.resume = this.craft && !this.craft.destroyed && this.mode !== 'workshop' ? JSON.parse(JSON.stringify(this.snapshot())) : (this.mode === 'workshop' ? this.resume : null);
    this.mode = 'workshop'; this.paused = false; this.entity = null;
    this.map.setVisible(false); this.rig.map = false; this.rig.startBlend(); this.rig.mode = 'chase'; this.rig.pitch = 0.1;
    setUI({ screen: 'workshop', paused: false, map: false, lost: null, panel: null, overlay: null, progress: { ...this.progress }, canResume: !!this.resume });
  }
  exitWorkshop(resume) {
    if (resume && this.resume) { this.restore(this.resume); this.resume = null; this.beginFlight(); }
    else { this.setCraft(null); this.careerLoaded = false; this.toMenu(); }
  }
  setPreview(design) {
    if (this.mode !== 'workshop') return;
    try {
      if (!design.stages.length || design.stages.some((s) => !s.parts.length)) return;
      this.system.update(this.t);
      const c = new Craft(design);
      c.placeOn(this.system.home, this.system.launchSite);
      c.computeEnv(this.system);
      this.setCraft(c);
    } catch { /* incomplete design: keep the previous preview */ }
  }

  research() {
    const p = this.progress, next = p.tier + 1;
    if (next >= TIER_COST.length || p.science < TIER_COST[next]) return false;
    p.science -= TIER_COST[next]; p.tier = next;
    store.set('progress', p); setUI({ progress: { ...p } });
    const d = store.get('save', null);
    if (d) { d.progress = p; store.set('save', d); }
    if (this.resume) this.resume.progress = JSON.parse(JSON.stringify(p));
    return true;
  }

  applySettings(s) {
    this.settings = s; saveSettings(s);
    this.input.keys = s.keys;
    const q = QUALITY[s.quality];
    if (q !== this.q) {
      this.q = q; this.r.applyQuality(q);
      for (const id in this.views) this.views[id].setQuality(q);
      this.patch.build(q);
    }
    setUI({ settingsVersion: getUI().settingsVersion + 1 });
  }

  // ------------------------------------------------------------------ player actions
  toggle(k) {
    const c = this.craft;
    if (!c || this.entity || c.destroyed) return;
    if (k === 'sas' && this.events.storm && !c.sas) { this.toast('SAS is offline during the solar storm', 'warn'); return; }
    c[k] = !c[k];
  }
  setSas(m) { const c = this.craft; if (!c || this.entity) return; if (this.events.storm) { this.toast('SAS is offline during the solar storm', 'warn'); return; } c.sasMode = m; c.sas = true; }
  setThrottle(v) { if (this.craft && !this.entity) this.craft.throttle = Math.max(0, Math.min(1, v)); }
  stage() { if (this.craft && !this.entity && !this.paused) this.craft.activateNextStage(); }

  maxWarpIdx() {
    const c = this.craft;
    if (this.entity) return 3;
    if (!c || c.destroyed) return 4;
    if (c.landed || c.docked) return WARPS.length - 1;
    if (c.thr.F > 0 || c.env.inAtmo || c.chuteOpen > 0) return 4;
    return WARPS.length - 1;
  }
  setWarp(i) {
    const max = this.maxWarpIdx();
    if (i > max) this.toast(max === 4 ? 'Warp is limited to 100× while under thrust or in atmosphere' : 'Warp is limited to 10× on EVA', 'warn');
    this.warpIdx = Math.max(0, Math.min(max, i));
  }
  dropWarp() { this.warpIdx = 0; }
  togglePause() { if (this.mode !== 'flight') return; this.paused = !this.paused; setUI({ paused: this.paused }); if (this.paused) this.save(); }
  toggleMap() {
    const on = !this.rig.map;
    this.rig.setMap(on, this.craft ? this.craft.env.body : this.system.home);
    this.map.setVisible(on);
    setUI({ map: on, selected: null });
  }
  focusMap(id) { const b = this.system.byId[id]; if (b) this.rig.setMapFocus(b); }
  setTarget(id) { this.target = id ? this.system.byId[id] : null; }
  cycleCamera() {
    if (this.rig.map) return;
    const i = CAM_MODES.indexOf(this.rig.mode);
    let m = CAM_MODES[(i + 1) % CAM_MODES.length];
    if (m === 'cockpit' && this.entity) m = 'orbital';
    this.rig.setMode(m);
    this.toast(`Camera: ${CAM_LABEL[m]}${m === 'free' ? ' — W/A/S/D/Q/E move the camera' : ''}`);
  }

  interact() {
    const c = this.craft;
    if (!c || c.destroyed || this.paused) return;
    if (this.entity) {
      const e = this.entity, p = e.worldPos(_a);
      if (e.kind === 'rover') {
        const a = new SurfaceEntity('astronaut', e.body, e.dir, e.heading);
        a.dir.addScaledVector(_b.crossVectors(e.basis(), e.dir), 2.5 / e.body.radius).normalize();
        e.speed = 0; this.astronaut = a; this.entity = a; this.toast('Left the rover');
      } else if (this.rover && this.rover.body === e.body && this.rover.worldPos(_b).distanceTo(p) < 6) {
        this.entity = this.rover; this.astronaut = null; this.toast('Driving the rover — W/S drive, A/D steer, F to get out');
      } else if (p.distanceTo(c.pos) < c.length + 8) {
        this.entity = null; this.astronaut = null; this.rig.startBlend(); this.toast('Back aboard');
      } else this.toast('Too far from the vehicle to board (walk within a few metres)', 'warn');
      return;
    }
    if (c.docked) { const s = c.docked; c.undock(); this.toast(`Undocked from ${s.name}`); return; }
    for (const s of this.system.stations) {
      const d = s.pos.distanceTo(c.pos);
      if (d < 150) {
        if (!c.has.dock) { this.toast('This craft has no docking port', 'warn'); return; }
        const rv = _a.subVectors(c.vel, s.vel).length();
        if (rv > 3) { this.toast(`Closing speed too high to dock (${rv.toFixed(1)} m/s, limit 3)`, 'warn'); return; }
        c.dock(s); c.refuel(); this.toast(`Docked with ${s.name} — tanks refilled`, 'good'); return;
      }
    }
    if (!c.landed) { this.toast('EVA is only possible while landed', 'warn'); return; }
    const b = c.landed.body, e = new SurfaceEntity('astronaut', b, c.landed.dir, 1.2);
    e.dir.addScaledVector(_a.copy(Y).cross(e.dir).normalize(), 4 / b.radius).normalize();
    this.entity = e; this.astronaut = e; this.warpIdx = Math.min(this.warpIdx, 3);
    this.rig.startBlend(); this.rig.pitch = 0.25;
    this.toast('EVA — W/S walk, A/D turn, Space jump, V sample, O science station, F board');
    this.discover(b, e.dir);
  }

  deployRover() {
    const c = this.craft;
    if (!c || !c.landed || !c.has.rover || c.roverDeployed) return;
    const b = c.landed.body, e = new SurfaceEntity('rover', b, c.landed.dir, 0);
    e.dir.addScaledVector(_a.copy(Y).cross(e.dir).normalize(), -9 / b.radius).normalize();
    e.ground = b.surfaceH(e.dir);
    this.rover = e; c.roverDeployed = true;
    this.toast('Rover deployed — go on EVA (F) and press F beside it to drive', 'good');
  }

  collectSample() {
    const e = this.entity;
    if (!e || e.kind !== 'astronaut') { this.toast('Samples are collected on EVA', 'warn'); return; }
    const biome = e.body.biomeAt(e.dir), key = `sample:${e.body.id}:${biome}`;
    if (this.progress.sciDone.includes(key)) { this.toast(`You already have a sample from ${biome}`, 'warn'); return; }
    this.progress.sciDone.push(key);
    if (e.body !== this.system.home) this.progress.flags.offworldSample = true;
    this.addScience(6 * (e.body.def.sciMult || 1), `Surface sample — ${biome}, ${e.body.name}`);
  }
  deploySci() {
    const e = this.entity;
    if (!e || e.kind !== 'astronaut') { this.toast('Science stations are deployed on EVA', 'warn'); return; }
    const biome = e.body.biomeAt(e.dir), key = `station:${e.body.id}:${biome}`;
    if (this.progress.sciDone.includes(key)) { this.toast(`A science station already covers ${biome}`, 'warn'); return; }
    this.progress.sciDone.push(key);
    const d = e.dir.clone().addScaledVector(e.basis(), 1.5 / e.body.radius).normalize();
    this.addDeployed(e.body, d);
    this.addScience(8 * (e.body.def.sciMult || 1), `Science station — ${biome}, ${e.body.name}`);
  }
  addDeployed(body, dir) { const obj = this.anchor(body, dir); obj.add(buildSciStation()); this.deployed.push({ body, dir, obj }); }

  runExperiments() {
    const c = this.craft;
    if (!c || c.destroyed) return;
    if (!c.instruments.length) { this.toast('No science instruments aboard', 'warn'); return; }
    if (c.ec < 5) { this.toast('Not enough electric charge to run instruments', 'warn'); return; }
    const e = c.env, b = e.body;
    const sit = c.landed ? ['surface', 1.5] : e.inAtmo ? ['atmosphere', 1] : e.alt < b.radius * 0.5 ? ['low orbit', 1] : ['high space', 0.6];
    let any = false;
    for (const s of c.instruments) {
      const key = `${s.id}:${b.id}:${sit[0]}`;
      if (this.progress.sciDone.includes(key)) continue;
      this.progress.sciDone.push(key); any = true;
      this.addScience(Math.round(s.base * sit[1] * (b.def.sciMult || 1)), `${s.label} — ${b.name}, ${sit[0]}`);
    }
    if (any) c.ec -= 5; else this.toast(`Nothing new to measure here (${b.name}, ${sit[0]})`, 'warn');
  }

  commDelay(pos) { return pos.distanceTo(this.system.home.pos) / C_LIGHT; }
  addScience(value, label) {
    const pos = this.entity ? this.entity.worldPos(_a) : this.craft ? this.craft.pos : this.system.home.pos;
    const delay = this.commDelay(pos);
    this.sciQueue.push({ value, label, at: this.t + delay });
    this.toast(delay > 1.5 ? `Transmitting: ${label} (signal delay ${delay.toFixed(0)} s)` : `Recorded: ${label}`);
  }
  discover(body, dir) {
    const biome = body.biomeAt(dir), key = `${body.id}:${biome}`;
    if (this.progress.discoveries.includes(key)) return;
    this.progress.discoveries.push(key);
    const bonus = 2 * (body.def.sciMult || 1);
    this.progress.science += bonus;
    this.toast(`New location discovered: ${biome}, ${body.name} (+${bonus} science)`, 'good');
  }

  // ---- colonies
  siteInfo() {
    const c = this.craft;
    if (!c || !c.landed) return null;
    const b = c.landed.body, here = this.colonies.find((k) => k.body === b && k.dir.angleTo(c.landed.dir) * b.radius < 2500);
    return { body: b, colony: here || null };
  }
  foundColony() {
    const c = this.craft, s = this.siteInfo();
    if (!s) return 'Land a craft first.';
    if (s.colony) return 'There is already a colony here.';
    if (c.cargo < MODULES.habitat.cost) return `Founding a colony needs ${MODULES.habitat.cost} materials in a cargo container (aboard: ${Math.floor(c.cargo)}).`;
    const dir = c.landed.dir.clone().addScaledVector(_a.copy(Y).cross(c.landed.dir).normalize(), 45 / s.body.radius).normalize();
    const col = new Colony(`${s.body.name} Base ${this.colonies.filter((k) => k.body === s.body).length + 1}`, s.body, dir, this.t);
    col.res.materials = c.cargo; c.cargo = 0;
    col.build('habitat');
    this.colonies.push(col); this.basesDirty = true;
    this.toast(`${col.name} founded — habitat built, 2 colonists moved in`, 'good');
    return null;
  }
  unloadCargo() {
    const c = this.craft, s = this.siteInfo();
    if (!s || !s.colony || c.cargo <= 0) return;
    const n = Math.min(c.cargo, s.colony.cap.materials - s.colony.res.materials);
    s.colony.res.materials += n; c.cargo -= n;
    this.toast(`Unloaded ${Math.floor(n)} materials at ${s.colony.name}`, 'good');
  }
  // Orders to a colony the player is not standing at travel at light speed and need an antenna.
  colonyOrder(col, label, fn) {
    const s = this.siteInfo();
    if (s && s.colony === col) { fn(); return null; }
    if (!col.has('antenna')) return 'Remote orders need a working antenna at the colony.';
    if (this.events.storm) return 'Communications are blacked out by the solar storm.';
    const pos = _a.copy(col.dir).applyQuaternion(col.body.quat).multiplyScalar(col.body.radius).add(col.body.pos);
    const from = this.craft ? this.craft.pos : this.system.home.pos;
    const delay = pos.distanceTo(from) / C_LIGHT;
    this.cmdQueue.push({ at: this.t + delay, fn, label });
    this.toast(`Order sent to ${col.name}: ${label} (arrives in ${delay.toFixed(1)} s)`);
    return null;
  }
  buildAt(col, type) {
    const err = col.canBuild(type);
    if (err) return err;
    return this.colonyOrder(col, `build ${MODULES[type].name}`, () => {
      if (col.canBuild(type)) return;
      col.build(type); this.basesDirty = true; this.toast(`${col.name}: ${MODULES[type].name} built`, 'good');
    });
  }
  repairAt(col, i) { return this.colonyOrder(col, 'repair module', () => { if (col.repair(i)) { this.basesDirty = true; this.toast(`${col.name}: module repaired`, 'good'); } }); }
  resupply(col) {
    if (!col.has('pad')) return 'Resupply flights need a landing pad.';
    if (this.progress.funds < RESUPPLY.cost) return 'Not enough funds.';
    const err = this.colonyOrder(col, 'request resupply', () => {
      this.cmdQueue.push({ at: this.t + 6 * 3600, label: 'resupply', fn: () => {
        for (const k of ['o2', 'water', 'food', 'materials']) col.res[k] = Math.min(col.cap[k], col.res[k] + RESUPPLY[k]);
        this.toast(`${col.name}: resupply flight has landed`, 'good');
      } });
    });
    if (!err) this.progress.funds -= RESUPPLY.cost;
    return err;
  }

  startRepair() {
    const c = this.craft;
    if (!c || !Object.keys(c.failures).length || this.repair > 0) return;
    if (c.thr.F > 0) { this.toast('Shut down engines before repairs', 'warn'); return; }
    this.repair = 45; this.toast('Crew is repairing the fault (45 s)…');
  }
  recover() {
    const c = this.craft;
    if (!c || !c.landed || c.landed.body !== this.system.home) return;
    const refund = Math.round((c.cost || 0) * 0.5);
    this.progress.funds += refund; this.progress.materials += c.cargo;
    this.completeMissions();
    this.setCraft(null); this.entity = null; this.rover = null;
    this.persist(); this.mode = 'menu';
    this.toMenu();
    this.toast(`Vessel recovered: +${refund.toLocaleString()} funds`, 'good');
  }

  toast(msg, kind = 'info') {
    this.toasts.push({ id: ++this.toastId, msg, kind, until: performance.now() + (kind === 'bad' ? 9000 : 6000) });
    if (this.toasts.length > 6) this.toasts.shift();
    setUI({ toasts: [...this.toasts] });
  }

  // ---- visuals triggered by events
  spawnRogueMesh(r) { this.removeRogueMesh(); this.rogueMesh = buildAsteroid(r.radius, r.seed); this.r.scene.add(this.rogueMesh); }
  removeRogueMesh() { if (this.rogueMesh) { this.r.scene.remove(this.rogueMesh); this.rogueMesh.geometry.dispose(); this.rogueMesh = null; } }
  meteorImpact(dist, ang) {
    const c = this.craft, d = c.landed.body.terrain.dust, y = -c.bottomOffset;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, s = 4 + Math.random() * 22;
      this.dust.spawn(Math.cos(ang) * dist, y, Math.sin(ang) * dist, Math.cos(a) * s, 6 + Math.random() * 25, Math.sin(a) * s, 2.5, 3, 26, [d[0], d[1], d[2], 0.7], [d[0], d[1], d[2], 0]);
    }
    this.fx.spawn(Math.cos(ang) * dist, y + 1, Math.sin(ang) * dist, 0, 2, 0, 0.35, 30, 4, [1, 0.9, 0.7, 1], [1, 0.4, 0.1, 0]);
  }

  // ------------------------------------------------------------------ main loop
  frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.queue.run(this.mode === 'loading' ? 14 : 5);
    if (this.mode === 'loading') {
      setUI({ loading: this.queue.finished / Math.max(1, this.queue.total) });
      if (!this.queue.jobs.length) { this.mode = 'menu'; this.rig.mode = 'orbital'; setUI({ screen: 'menu' }); }
    }
    if (this.mode === 'flight') { if (!this.paused) this.simulate(dt); }
    else {
      if (this.mode === 'menu' || this.mode === 'loading') this.menuClock += dt * 40;
      this.system.update(this.t + (this.mode === 'workshop' ? 0 : this.menuClock));
      if (this.mode === 'workshop' && this.craft && this.craft.landed) this.craft.syncLanded();
      if (this.mode === 'workshop') this.rig.yaw += dt * 0.12; else this.rig.yaw += dt * 0.02;
    }
    this.updateCamera(dt);
    this.syncScene(dt);
    this.r.render();
    this.hudClock += dt;
    if (this.hudClock > 0.1) { this.hudClock = 0; this.updateHud(); }
    this.saveClock += dt;
    if (this.saveClock > 20) { this.saveClock = 0; if (this.mode === 'flight' && !this.paused && this.craft && !this.craft.destroyed) this.save(); }
  }

  simulate(dtReal) {
    const c = this.craft, sys = this.system, inp = this.input;
    if (this.warpIdx > this.maxWarpIdx()) this.warpIdx = this.maxWarpIdx();
    const dtGame = dtReal * WARPS[this.warpIdx];
    // controls
    const piloting = !this.entity && this.rig.current !== 'free' && !c.destroyed;
    const k = c.ctrl;
    k.pitch = piloting ? inp.axis('pitchDown', 'pitchUp') : 0;
    k.yaw = piloting ? inp.axis('yawRight', 'yawLeft') : 0;
    k.roll = piloting ? inp.axis('rollRight', 'rollLeft') : 0;
    k.tx = piloting ? inp.axis('rcsRight', 'rcsLeft') : 0;
    k.ty = piloting ? inp.axis('rcsFwd', 'rcsBack') : 0;
    k.tz = piloting ? inp.axis('rcsDown', 'rcsUp') : 0;
    if (piloting) c.throttle = Math.max(0, Math.min(1, c.throttle + inp.axis('throttleUp', 'throttleDown') * dtReal * 0.8));
    // environment inputs for power generation
    this.updateEnvironment();
    // integrate
    if (c.destroyed) { this.t += dtGame; sys.update(this.t); }
    else if (c.docked) { this.t += dtGame; sys.update(this.t); c.syncDocked(); c.computeEnv(sys); c.stepSystems(dtGame); c.met += dtGame; }
    else if (c.landed) { this.t += dtGame; sys.update(this.t); c.stepLanded(dtGame, sys); }
    else {
      let remaining = dtGame, n = 0;
      while (remaining > 1e-9 && n < 900) {
        const dt = Math.min(remaining, c.suggestDt());
        c.step(dt, sys, this.t);
        if (c.landed || c.destroyed) { sys.update(this.t); break; }
        this.t += dt; remaining -= dt; n++;
      }
      if (n >= 900 && this.warpIdx > 0) { this.warpIdx--; this.toast('Time warp reduced to keep the integration stable', 'warn'); }
      if (c.landed) c.syncLanded();
    }
    // craft messages and visual events
    for (const m of c.log) this.toast(m.msg, m.kind);
    c.log.length = 0;
    for (const f of c.fx) this.craftFx(f);
    c.fx.length = 0;
    // debris coasts on its own trajectory
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dtGame;
      if (d.life <= 0 || this.warpIdx > 3) { this.r.scene.remove(d.group); this.debris.splice(i, 1); continue; }
      sys.gravity(d.pos, _a, c.env.body);
      d.vel.addScaledVector(_a, dtGame); d.pos.addScaledVector(d.vel, dtGame);
      d.quat.multiply(_q.setFromAxisAngle(d.axis, d.spin * dtGame));
    }
    if (this.repair > 0) {
      this.repair -= dtGame;
      if (this.repair <= 0) { c.failures = {}; this.toast('Repairs complete — all systems nominal', 'good'); }
    }
    this.updateEntities(Math.min(dtGame, 0.25), dtReal);
    // world systems
    const env = { flux: 1, sunVis: 1, storm: !!this.events.storm, weather: false };
    const out = [];
    for (const col of this.colonies) {
      let left = dtGame;
      const pos = _a.copy(col.dir).applyQuaternion(col.body.quat).multiplyScalar(col.body.radius + 10).add(col.body.pos);
      env.flux = sys.flux(pos); env.weather = !!col.body.weather;
      env.sunVis = 1; // night is handled inside tick from the sun angle; eclipses by other bodies:
      const info = {}; const v = sys.sunVisibility(pos, info);
      if (info.occluder && info.occluder !== col.body) env.sunVis = v;
      while (left > 0) { const s = Math.min(left, 900); col.tick(s, this.t, sys, env, out); left -= s; }
    }
    for (const e of out) { if (e.type === 'science') { this.progress.science += e.value; } else this.toast(e.msg, e.kind); }
    this.events.update(dtGame);
    // delayed transmissions and orders (stalled by solar storms)
    if (!this.events.storm) {
      for (let i = this.sciQueue.length - 1; i >= 0; i--) if (this.t >= this.sciQueue[i].at) {
        const s = this.sciQueue.splice(i, 1)[0];
        this.progress.science += s.value; this.toast(`+${s.value} science — ${s.label}`, 'good');
      }
      for (let i = this.cmdQueue.length - 1; i >= 0; i--) if (this.t >= this.cmdQueue[i].at) this.cmdQueue.splice(i, 1)[0].fn();
    } else { for (const s of this.sciQueue) s.at += dtGame; for (const s of this.cmdQueue) s.at += dtGame; }
    if (!c.destroyed) this.completeMissions();
    if (c.destroyed && !getUI().lost) { this.dropWarp(); this.persist(); setUI({ lost: c.destroyReason }); }
  }

  updateEnvironment() {
    const c = this.craft, sys = this.system, info = {};
    c.sunVis = sys.sunVisibility(c.pos, info);
    c.flux = sys.flux(c.pos);
    const occ = info.occluder;
    if (occ && c.env.body && occ !== c.env.body && c.sunVis < 0.3) {
      if (!this.eclipse) { this.eclipse = occ; this.toast(`ECLIPSE — ${occ.name} is passing in front of Kaelis. Solar arrays produce no power.`, 'warn'); }
    } else if (this.eclipse && c.sunVis > 0.9) { this.eclipse = null; this.toast('The eclipse has ended', 'good'); }
  }

  updateEntities(dt, dtReal) {
    const inp = this.input, e = this.entity;
    const env = { sunVis: this.sunVis, flux: this.craft.flux };
    if (this.rover && this.rover !== e) this.rover.update(dt, { fwd: 0, turn: 0, jump: false }, env);
    if (!e) return;
    const free = this.rig.current === 'free';
    e.update(dt, { fwd: free ? 0 : inp.axis('pitchDown', 'pitchUp'), turn: free ? 0 : inp.axis('yawRight', 'yawLeft'), jump: !free && inp.is('stage') }, env);
    this.discoverClock = (this.discoverClock || 0) + dtReal;
    if (this.discoverClock > 1) { this.discoverClock = 0; this.discover(e.body, e.dir); }
  }

  completeMissions() {
    const p = this.progress;
    for (const m of activeMissions(p)) {
      let ok = false;
      try { ok = m.check(this); } catch { ok = false; }
      if (!ok) continue;
      p.done.push(m.id);
      p.funds += m.reward.funds || 0; p.science += m.reward.science || 0; p.materials += m.reward.materials || 0;
      const r = m.reward;
      this.toast(`MISSION COMPLETE: ${m.title} — +${(r.funds || 0).toLocaleString()} funds, +${r.science || 0} science${r.materials ? `, +${r.materials} materials` : ''}`, 'good');
    }
    if (this.craft.landed && !this.craft.wasLanded) this.discover(this.craft.landed.body, this.craft.landed.dir);
    this.craft.wasLanded = !!this.craft.landed;
  }

  craftFx(f) {
    const c = this.craft, m = this.model;
    if (f === 'jettison' && m.stageGroups.length > c.stages.length) {
      const g = m.dropStage();
      this.r.scene.add(g);
      const nose = _a.set(0, 1, 0).applyQuaternion(c.quat);
      this.debris.push({ group: g, pos: c.pos.clone(), vel: c.vel.clone().addScaledVector(nose, -2.5), quat: c.quat.clone(),
        axis: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), spin: 0.08 + Math.random() * 0.1, life: 60 });
    } else if (f === 'explode') {
      for (const g of m.stageGroups) g.visible = false;
      for (let i = 0; i < 160; i++) {
        const v = _a.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 38);
        this.fx.spawn(0, 0, 0, v.x, v.y, v.z, 0.8 + Math.random() * 1.4, 4, 16, [1, 0.8, 0.4, 1], [0.6, 0.12, 0.02, 0]);
        if (i % 2) this.dust.spawn(0, 0, 0, v.x * 0.5, v.y * 0.5, v.z * 0.5, 2 + Math.random() * 2, 5, 30, [0.2, 0.2, 0.2, 0.7], [0.1, 0.1, 0.1, 0]);
      }
    } else if (f === 'landed') {
      const d = c.env.body.terrain.dust;
      for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 6; this.dust.spawn(0, -c.bottomOffset, 0, Math.cos(a) * s, 0.5, Math.sin(a) * s, 1.6, 2, 9, [d[0], d[1], d[2], 0.5], [d[0], d[1], d[2], 0]); }
    }
  }

  // ------------------------------------------------------------------ camera & scene
  focusBody() {
    if (this.mode !== 'flight' && this.mode !== 'workshop') return this.menuBody;
    return this.entity ? this.entity.body : this.craft.env.body || this.system.home;
  }

  updateCamera(dt) {
    const rig = this.rig, inp = this.input;
    if ((this.mode === 'flight' || this.mode === 'workshop') && this.craft) {
      const c = this.craft, e = this.entity;
      const focus = e ? e.worldPos(_c) : c.pos;
      const free = rig.current === 'free';
      rig.update(dt, {
        focus, body: this.focusBody(), craft: c, entity: e,
        craftMid: (c.stages[0].h - c.belowOrigin) / 2,
        groundClear: e ? e.y : c.env.terrainKnown ? c.env.radarAlt + c.bottomOffset : undefined,
        move: free ? { x: inp.axis('yawRight', 'yawLeft'), z: inp.axis('pitchDown', 'pitchUp'), y: inp.axis('rollRight', 'rollLeft'), fast: inp.down.has('ShiftLeft') } : null,
      });
    } else {
      const b = this.menuBody;
      rig.mode = 'orbital'; rig.map = false;
      rig.update(dt, { focus: b.pos, body: b, craft: null, entity: null });
    }
  }

  syncScene(dt) {
    const sys = this.system, r = this.r, rig = this.rig, o = rig.worldPos, flight = (this.mode === 'flight' || this.mode === 'workshop') && this.craft;
    const cam = r.camera;
    cam.position.set(0, 0, 0); cam.quaternion.copy(rig.quat); cam.updateMatrixWorld(true);
    const mapOn = rig.map;
    this.starView.sync(o, this.t, this.events && this.events.storm);
    for (const id in this.views) this.views[id].sync(o, sys.star, this.t);
    for (const s of this.stationViews) { s.group.position.subVectors(s.body.pos, o); s.group.quaternion.setFromUnitVectors(Y, _a.subVectors(s.body.pos, s.body.parent.pos).normalize()); }
    for (const b of this.belts) b.sync(o, this.t, mapOn);

    const c = this.craft, e = this.entity;
    const focus = this._focus.copy(flight ? (e ? e.worldPos(_c) : c.pos) : this.menuBody.pos);
    const body = this.focusBody();
    this.nearBody = body;
    if (c && this.model) {
      const m = this.model;
      m.root.visible = !!flight;
      m.root.position.subVectors(c.pos, o); m.root.quaternion.copy(c.quat);
      m.update(c);
      const cockpit = rig.current === 'cockpit' && !e && rig.blend > 0.6;
      for (const g of m.stageGroups) if (!c.destroyed) g.visible = !cockpit;
      if (flight) this.updateFx(dt);
    }
    for (const d of this.debris) { d.group.position.subVectors(d.pos, o); d.group.quaternion.copy(d.quat); }
    // surface entities
    const showAstro = flight && this.astronaut && this.mode === 'flight';
    this.astroMesh.visible = !!showAstro;
    if (showAstro) { this.astroMesh.position.copy(this.astronaut.worldPos(_a)).sub(o); this.astronaut.worldQuat(this.astroMesh.quaternion); }
    const showRover = flight && this.rover && this.mode === 'flight';
    this.roverMesh.visible = !!showRover;
    if (showRover) { this.roverMesh.position.copy(this.rover.worldPos(_a)).sub(o); this.rover.worldQuat(this.roverMesh.quaternion); }
    if (this.rogueMesh && this.events.rogue) { this.rogueMesh.position.subVectors(this.events.rogue.pos, o); this.rogueMesh.rotation.x += dt * 0.2; this.rogueMesh.rotation.y += dt * 0.13; }
    if (this.basesDirty) this.rebuildBases();

    // sunlight at the focus
    const focusRel = _a.subVectors(focus, o), sunDir = _b.subVectors(sys.star.pos, focus).normalize();
    this.sunVis = sys.sunVisibility(focus, null);
    r.setSun(focusRel, sunDir, _c.subVectors(sys.star.pos, o), this.sunVis, mapOn || !flight);

    // close-range terrain, sky brightness and haze
    const view = this.views[body.id];
    const camDist = o.distanceTo(body.pos);
    let skyK = 0, fogD = 0;
    if (view && body.landable) {
      const dl = body.localDir(focus, _a);
      const camAlt = camDist - body.radius - body.surfaceH(dl);
      this.patch.update(view, dl, mapOn || !flight ? Infinity : Math.max(0, camAlt), this.t);
    } else if (this.patch.active && this.patch.view) this.patch.update(this.patch.view, Y, Infinity, this.t);
    if (body.atmo) {
      const a = body.atmo, alt = camDist - body.radius;
      const dens = alt < a.top ? Math.exp(-Math.max(0, alt) / a.H) : 0;
      const upDot = _a.subVectors(o, body.pos).normalize().dot(sunDir);
      const day = smoothstep(-0.12, 0.12, upDot) * this.sunVis;
      const thick = Math.min(1, (a.p0 / 101325) * 3 + 0.25);
      skyK = dens * day * thick;
      fogD = 2.4e-5 * dens * Math.min(1.5, a.p0 / 101325 + 0.15) * (body.weather ? 9 : 1);
      r.scene.fog.color.setRGB(a.color[0] * 0.55 + 0.4, a.color[1] * 0.55 + 0.4, a.color[2] * 0.55 + 0.4).multiplyScalar(0.15 + 0.85 * day);
      r.hemi.color.setRGB(a.color[0] * 0.6 + 0.4, a.color[1] * 0.6 + 0.4, a.color[2] * 0.6 + 0.4);
    }
    r.scene.fog.density = mapOn ? 0 : fogD;
    r.hemi.intensity = skyK * 0.9;
    this.starfield.setBrightness(1 - Math.min(1, skyK * 1.6));

    if (mapOn && c) this.map.sync(o, cam, c.pos, this.target ? this.target.id : null, r.w, r.h);
  }

  rebuildBases() {
    this.basesDirty = false;
    for (const col of this.colonies) {
      if (col.group) col.group.removeFromParent();
      const b = col.body, g = new THREE.Group();
      this.views[b.id].group.add(g);
      col.group = g;
      const e1 = _a.copy(Y).cross(col.dir).normalize().clone(), e2 = new THREE.Vector3().crossVectors(col.dir, e1);
      col.modules.forEach((m, i) => {
        // hexagonal spiral layout, 18 m spacing
        let x = 0, z = 0;
        if (i > 0) { const ring = i <= 6 ? 1 : 2, n = ring * 6, k = ring === 1 ? i - 1 : i - 7, a = (k / n) * Math.PI * 2; x = Math.cos(a) * 18 * ring; z = Math.sin(a) * 18 * ring; }
        const d = col.dir.clone().addScaledVector(e1, x / b.radius).addScaledVector(e2, z / b.radius).normalize();
        const o = new THREE.Group();
        o.position.copy(d).multiplyScalar(b.radius + b.surfaceH(d) - 0.05);
        o.quaternion.setFromUnitVectors(Y, d);
        const mesh = buildModule(m.type);
        if (!m.ok) { mesh.rotation.z = 0.12; mesh.scale.y = 0.8; }
        o.add(mesh); g.add(o);
      });
    }
  }

  updateFx(dt) {
    const c = this.craft, m = this.model, fx = this.fx, dust = this.dust, r = this.r;
    const scale = r.renderer.domElement.height / (2 * Math.tan((r.camera.fov * Math.PI) / 360));
    fx.uniforms.uScale.value = dust.uniforms.uScale.value = scale;
    const running = this.mode === 'flight' && !this.paused && this.warpIdx < 5;
    if (running && !c.destroyed) {
      const st = c.stage, pr = Math.min(1, c.env.pressure / 101325);
      if (st && st.ignited) {
        for (const nz of m.nozzles) {
          if (nz.stage !== c.activeStage) continue;
          const on = nz.solid ? st.solid > 0 : st.fuel > 0 && c.throttle > 0;
          if (!on) continue;
          const pw = nz.solid ? 1 : c.throttle, count = Math.min(40, Math.ceil(pw * 320 * dt));
          const spread = (2 + 22 * (1 - pr)) * nz.r;
          for (let i = 0; i < count; i++) {
            const a = Math.random() * 6.28, rr = Math.random() * nz.r * 0.6, sv = Math.random() * spread, vy = -(30 + Math.random() * 28), pre = Math.random() * dt;
            fx.spawn(nz.x + Math.cos(a) * (rr + sv * pre), nz.y + vy * pre, nz.z + Math.sin(a) * (rr + sv * pre), Math.cos(a) * sv, vy, Math.sin(a) * sv,
              (0.18 + Math.random() * 0.2) * (0.6 + 0.4 * pw), nz.r * 2.4, nz.r * (4 + 6 * (1 - pr)),
              nz.solid ? [1, 0.82, 0.5, 0.8] : [0.62, 0.78, 1, 0.75], nz.solid ? [0.5, 0.25, 0.1, 0] : [1, 0.45, 0.1, 0]);
          }
        }
        if (c.thr.F > 0 && c.env.terrainKnown && c.env.radarAlt < 30) {
          const d = c.env.body.terrain.dust, y = -c.bottomOffset - Math.max(0, c.env.radarAlt), k = 1 - c.env.radarAlt / 30;
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * 6.28, s = 6 + Math.random() * 16;
            dust.spawn(Math.cos(a) * 1.5, y + 0.3, Math.sin(a) * 1.5, Math.cos(a) * s, 0.5 + Math.random() * 2, Math.sin(a) * s, 1.4, 2.5, 11, [d[0], d[1], d[2], 0.45 * k], [d[0], d[1], d[2], 0]);
          }
        }
      }
    }
    if (!this.paused) { fx.update(dt); dust.update(dt, 1.2); }
  }

  // ------------------------------------------------------------------ HUD snapshot (10 Hz)
  updateHud() {
    const now = performance.now();
    if (this.toasts.length && this.toasts[0].until < now) { this.toasts = this.toasts.filter((t) => t.until > now); setUI({ toasts: [...this.toasts] }); }
    if (this.mode !== 'flight' || !this.craft) return;
    const c = this.craft, e = c.env, b = e.body, st = c.stage || c.stages[c.stages.length - 1], ent = this.entity;
    const rel = _a.subVectors(c.pos, b.pos);
    this.orbit = elementsFromState(rel, e.vOrb, b.mu);
    const el = this.orbit;
    if (this.rig.map) this.map.updateTrajectory(c.landed || c.docked ? null : el, rel, b);
    const surfMode = e.inAtmo || (e.terrainKnown && e.radarAlt < 20000) || !!c.landed;
    const nose = _b.set(0, 1, 0).applyQuaternion(c.quat);
    const east = _c.copy(b.axis).cross(e.up).normalize(), north = new THREE.Vector3().crossVectors(e.up, east);
    const pitch = Math.asin(Math.max(-1, Math.min(1, nose.dot(e.up)))) * 57.2958;
    let hdg = Math.atan2(nose.dot(east), nose.dot(north)) * 57.2958; if (hdg < 0) hdg += 360;
    const sunDot = e.up.dot(_b.subVectors(this.system.star.pos, c.pos).normalize());
    const tempK = e.inAtmo || c.landed ? b.temperature(e.terrainKnown ? e.dirLocal : Y, e.alt, sunDot * c.sunVis)
      : c.sunVis > 0.5 ? 279 * Math.pow(c.flux, 0.25) : 45;
    const m = c.mass(), g = b.mu / (e.r * e.r);
    const situation = c.destroyed ? 'Destroyed' : c.docked ? `Docked at ${c.docked.name}` : c.landed ? (b.terrain.sea && b.rawH(c.landed.dir) < 0 ? 'Splashed down' : 'Landed')
      : e.inAtmo ? 'Flying' : el.e >= 1 ? 'Escape trajectory' : el.pe > b.radius + (b.atmo ? b.atmo.top : 0) ? 'Orbiting' : 'Sub-orbital';
    let target = null;
    if (this.target) { const tg = this.target; target = { name: tg.name, dist: tg.pos.distanceTo(c.pos) - tg.radius, rel: _b.subVectors(c.vel, tg.vel).length() }; }
    const site = this.siteInfo();
    let eva = null;
    if (ent) {
      const p = ent.worldPos(_b);
      eva = { kind: ent.kind, biome: ent.body.biomeAt(ent.dir), dist: p.distanceTo(c.pos), speed: Math.abs(ent.speed), ec: ent.ec, ecCap: ent.ecCap,
        roverDist: this.rover && this.rover !== ent ? this.rover.worldPos(_c).distanceTo(p) : null };
    }
    let station = null;
    for (const s of this.system.stations) { const d = s.pos.distanceTo(c.pos); if (d < 5000) station = { name: s.name, dist: d, rel: _b.subVectors(c.vel, s.vel).length() }; }
    setUI({
      progress: { ...this.progress },
      hud: {
        t: this.t, met: c.met, body: b.name, bodyId: b.id, situation,
        alt: e.alt, radar: e.terrainKnown ? Math.max(0, e.radarAlt) : null,
        speed: surfMode ? e.vRelSurf.length() : e.vOrb.length(), speedMode: surfMode ? 'Surface' : 'Orbital',
        vs: (surfMode ? e.vRelSurf : e.vOrb).dot(e.up),
        hs: Math.sqrt(Math.max(0, e.vRelSurf.lengthSq() - e.vRelSurf.dot(e.up) ** 2)),
        fuel: st ? st.fuel : 0, fuelCap: st ? st.fuelCap : 0, solid: st ? st.solid : 0, solidCap: st ? st.solidCap : 0,
        ec: c.ec, ecCap: c.ecCap, gen: c.gen, mono: c.mono, monoCap: c.monoCap, cargo: c.cargo, cargoCap: c.cargoCap,
        pressure: e.pressure, tempK, q: c.q, g: c.gForce, mass: m, twr: c.thr.F / (m * g), thrust: c.thr.F, dv: c.stageDv(),
        ap: el.ap - b.radius, pe: el.pe - b.radius, period: el.period, inc: el.inc * 57.2958, ecc: el.e,
        vCirc: Math.sqrt(b.mu / e.r), vEsc: Math.sqrt((2 * b.mu) / e.r),
        throttle: c.throttle, sas: c.sas, sasMode: c.sasMode, rcs: c.rcs, gear: c.gear, panels: c.panels, chute: c.chute,
        hasLegs: c.has.legs, hasChute: c.has.chute, hasSolar: c.solar > 0, hasRcs: c.rcsThrust > 0, hasRover: c.has.rover && !c.roverDeployed, instruments: c.instruments.length,
        stage: c.activeStage, stages: c.stages.length, ignited: !!(st && st.ignited),
        warp: WARPS[this.warpIdx], cam: CAM_LABEL[this.rig.current], pitch, hdg,
        landed: !!c.landed, docked: !!c.docked, home: !!c.landed && b === this.system.home,
        failures: Object.keys(c.failures), repair: this.repair,
        storm: !!this.events.storm, shower: !!this.events.shower, eclipse: this.eclipse ? this.eclipse.name : null, weather: b.weather ? b.weather.type : null,
        sunVis: c.sunVis, pending: this.sciQueue.length, target, eva, station,
        site: site ? { body: site.body.name, colony: site.colony ? site.colony.name : null } : null,
        biome: c.landed ? b.biomeAt(c.landed.dir) : null,
        missions: activeMissions(this.progress).map((x) => ({ id: x.id, title: x.title, text: x.text })),
        missionsDone: this.progress.done.length, missionsTotal: MISSIONS.length,
      },
    });
  }
}

export const game = new Game();
