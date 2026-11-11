// System map overlay: orbit lines for every body, the craft's predicted conic trajectory,
// and clickable HTML labels projected from 3D positions.
import * as THREE from 'three';
import { orbitState, sampleConic } from '../physics/kepler.js';

const _v = new THREE.Vector3();
const COLORS = { planet: 0x5fa8d8, moon: 0x7b8794, station: 0x6fd08c };

export class MapView {
  constructor(system, labelsEl, onPick) {
    this.system = system; this.group = new THREE.Group(); this.group.visible = false;
    this.lines = [];
    const p = new THREE.Vector3();
    for (const b of system.bodies) {
      if (!b.parent) continue;
      const N = 256, pts = new Float32Array(N * 3);
      const T = b.period;
      for (let i = 0; i < N; i++) { orbitState(b.orbit, b.parent.mu, (i / N) * T, p); pts.set([p.x, p.y, p.z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: COLORS[b.type], transparent: true, opacity: b.type === 'planet' ? 0.55 : 0.4, depthWrite: false, fog: false }));
      line.frustumCulled = false;
      this.group.add(line); this.lines.push({ line, body: b });
    }
    this.trajPts = new Float32Array(360 * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.trajPts, 3));
    this.traj = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffb347, depthTest: false, fog: false }));
    this.traj.frustumCulled = false; this.traj.renderOrder = 8;
    this.group.add(this.traj);
    // labels
    this.el = labelsEl; this.labels = [];
    const mk = (id, text, cls) => {
      const d = document.createElement('div');
      d.className = 'maplabel ' + cls; d.textContent = text;
      d.addEventListener('click', (ev) => { ev.stopPropagation(); onPick(id); });
      labelsEl.appendChild(d);
      return d;
    };
    for (const b of system.bodies) this.labels.push({ el: mk(b.id, b.name, b.type), body: b });
    this.craftLabel = mk('craft', '▲ Vessel', 'craft');
  }

  setVisible(on) { this.group.visible = on; this.el.style.display = on ? 'block' : 'none'; }

  updateTrajectory(el, rel, body) {
    if (!el) { this.traj.visible = false; return; }
    this.traj.visible = true; this.trajBody = body;
    sampleConic(el, rel, Math.min(body.soi, 1e12), 360, this.trajPts);
    this.traj.geometry.attributes.position.needsUpdate = true;
  }

  sync(origin, camera, craftPos, targetId, w, h) {
    for (const l of this.lines) l.line.position.subVectors(l.body.parent.pos, origin);
    if (this.trajBody) this.traj.position.subVectors(this.trajBody.pos, origin);
    const place = (el, pos, hideBehind) => {
      _v.subVectors(pos, origin).applyMatrix4(camera.matrixWorldInverse);
      if (_v.z > 0) { el.style.display = 'none'; return; }
      _v.applyMatrix4(camera.projectionMatrix);
      el.style.display = 'block';
      el.style.transform = `translate(${((_v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    };
    for (const l of this.labels) { place(l.el, l.body.pos); l.el.classList.toggle('target', l.body.id === targetId); }
    place(this.craftLabel, craftPos);
  }
}
