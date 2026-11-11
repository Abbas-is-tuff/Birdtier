// Original procedural models: spacecraft parts, stations, astronaut, rover, base modules.
// Everything is assembled from primitive geometry in code — no external model files.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTS } from '../spacecraft/parts.js';
import { makePanelTexture } from './textures.js';

let M = null;
function mats() {
  if (M) return M;
  const panel = makePanelTexture();
  panel.repeat.set(4, 2);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M = {
    white: std({ color: 0xe8eaee, roughness: 0.5, metalness: 0.1, map: panel }),
    dark: std({ color: 0x1c1f24, roughness: 0.65, metalness: 0.35 }),
    metal: std({ color: 0x9aa3ad, roughness: 0.32, metalness: 0.9 }),
    nozzle: std({ color: 0x33353a, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide }),
    gold: std({ color: 0xc9a14c, roughness: 0.38, metalness: 1 }),
    solar: std({ color: 0x14275a, roughness: 0.25, metalness: 0.7 }),
    accent: std({ color: 0xd9622b, roughness: 0.6, metalness: 0.1 }),
    grey: std({ color: 0x7c838c, roughness: 0.7, metalness: 0.3 }),
    glass: std({ color: 0x0b1118, roughness: 0.08, metalness: 0.9 }),
    canopy: std({ color: 0xe46a2c, roughness: 0.9, side: THREE.DoubleSide }),
    green: std({ color: 0x4f9a55, roughness: 0.6, transparent: true, opacity: 0.75 }),
    concrete: std({ color: 0x8c8f93, roughness: 0.95 }),
    suit: std({ color: 0xf1f1ee, roughness: 0.8 }),
    visor: std({ color: 0xd8a23a, roughness: 0.15, metalness: 1 }),
  };
  return M;
}

const R0 = 1.1;
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
const cyl = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0);
const lathe = (pts, seg = 36) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);

function inlinePart(id, p) {
  const m = mats(), g = new THREE.Group(), h = p.h;
  if (id === 'capsule') {
    g.add(mesh(lathe([[0, 0], [R0, 0], [R0, 0.22], [0.58, 1.6], [0.42, 1.9], [0, 1.9]]), m.white));
    g.add(mesh(cyl(R0 * 0.98, R0 * 0.98, 0.1), m.dark, 0, -0.02));
    for (const a of [0, 2.1, 4.2]) {
      const w = mesh(new THREE.BoxGeometry(0.34, 0.26, 0.06), m.glass, Math.sin(a) * 0.86, 0.9, Math.cos(a) * 0.86);
      w.rotation.set(-0.33, a, 0, 'YXZ'); g.add(w);
    }
    g.add(mesh(cyl(0.6, 0.62, 0.06), m.accent, 0, 1.5));
  } else if (id === 'dock') {
    g.add(mesh(cyl(0.42, 0.5, h), m.metal)); g.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24).rotateX(Math.PI / 2), m.dark, 0, h));
  } else if (p.fuel) {
    g.add(mesh(cyl(R0, R0, h), m.white));
    g.add(mesh(cyl(R0 + 0.012, R0 + 0.012, 0.14), m.dark, 0, 0.04)); g.add(mesh(cyl(R0 + 0.012, R0 + 0.012, 0.14), m.dark, 0, h - 0.18));
    g.add(mesh(new THREE.BoxGeometry(0.12, h * 0.8, 0.1), m.grey, 0, h / 2, R0));
  } else if (p.thrust) {
    const r = id === 'engHarrier' ? 0.9 : id === 'engKestrel' ? 0.72 : 0.42;
    g.add(mesh(cyl(R0 * 0.9, 0.5, h * 0.3), m.dark, 0, h * 0.7));
    g.add(mesh(lathe([[r, 0], [r * 0.82, h * 0.25], [r * 0.5, h * 0.55], [0.22, h * 0.72]]), m.nozzle));
    g.add(mesh(new THREE.TorusGeometry(r, 0.035, 8, 32).rotateX(Math.PI / 2), m.metal, 0, 0.02));
    g.userData.nozzle = { r };
  } else if (id === 'cargo') {
    g.add(mesh(cyl(R0, R0, h, 12), m.grey)); g.add(mesh(cyl(R0 + 0.02, R0 + 0.02, 0.12, 12), m.accent, 0, 0.3)); g.add(mesh(cyl(R0 + 0.02, R0 + 0.02, 0.12, 12), m.accent, 0, h - 0.42));
  } else if (id === 'rover') {
    g.add(mesh(cyl(R0, R0, h), m.dark)); g.add(mesh(cyl(R0 + 0.015, R0 + 0.015, 0.5), m.gold, 0, h / 2 - 0.25));
  } else if (id === 'wheel') {
    g.add(mesh(cyl(R0, R0, h), m.metal)); g.add(mesh(cyl(R0 + 0.01, R0 + 0.01, 0.08), m.accent, 0, h / 2 - 0.04));
  } else {
    g.add(mesh(cyl(R0, R0, h), m.gold));
  }
  return g;
}

// Builds the visual model for a Craft. Origin = base of the top stage; stack runs along +Y.
export function buildCraftModel(craft) {
  const m = mats(), root = new THREE.Group(), stageGroups = [], nozzles = [], legs = [], panels = [];
  let chute = null, y = craft.stages[0].h;
  craft.stages.forEach((st, si) => {
    const g = new THREE.Group(); root.add(g); stageGroups.push(g);
    const top = y;
    for (const id of st.parts) {
      const p = PARTS[id];
      if (!p.h) continue;
      const pm = inlinePart(id, p);
      y -= p.h; pm.position.y = y; g.add(pm);
      if (pm.userData.nozzle) nozzles.push({ stage: si, x: 0, y, z: 0, r: pm.userData.nozzle.r, solid: false });
    }
    const bottom = y, mid = (top + bottom) / 2, hh = Math.max(top - bottom, 0.6);
    for (const id of st.parts) {
      const p = PARTS[id];
      if (!p.radial) continue;
      if (id === 'srb') {
        const L = Math.min(Math.max(hh, 3), 6.5);
        for (const sx of [-1, 1]) {
          const x = sx * (R0 + 0.56);
          g.add(mesh(cyl(0.5, 0.5, L), m.white, x, bottom + 0.3));
          g.add(mesh(new THREE.ConeGeometry(0.5, 1.1, 24).translate(0, 0.55, 0), m.accent, x, bottom + 0.3 + L));
          g.add(mesh(lathe([[0.42, 0], [0.25, 0.45]], 20), m.nozzle, x, bottom - 0.15));
          g.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), m.dark, sx * (R0 + 0.05), bottom + 0.3 + L * 0.5));
          nozzles.push({ stage: si, x, y: bottom - 0.15, z: 0, r: 0.42, solid: true });
        }
      } else if (id === 'legs') {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4, pivot = new THREE.Group();
          pivot.position.set(Math.cos(a) * R0, bottom + 1.1, Math.sin(a) * R0);
          pivot.rotation.y = -a;
          const arm = new THREE.Group();
          arm.add(mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12).translate(0, -1.1, 0), m.metal));
          arm.add(mesh(cyl(0.28, 0.28, 0.08, 16), m.dark, 0, -2.24));
          pivot.add(arm); g.add(pivot); legs.push(arm);
        }
      } else if (id === 'chute') {
        g.add(mesh(new THREE.ConeGeometry(0.42, 0.35, 20).translate(0, 0.17, 0), m.accent, 0, top));
        chute = new THREE.Group();
        chute.position.y = top;
        const can = mesh(new THREE.SphereGeometry(7, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), m.canopy, 0, 13);
        can.castShadow = false; chute.add(can);
        const lp = [];
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; lp.push(0, 0.3, 0, Math.cos(a) * 6.75, 14.8, Math.sin(a) * 6.75); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
        chute.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xdddddd })));
        chute.visible = false; g.add(chute);
      } else if (id === 'rcs') {
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; g.add(mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), m.metal, Math.cos(a) * (R0 + 0.08), mid, Math.sin(a) * (R0 + 0.08))); }
      } else if (id === 'solar') {
        for (const sx of [-1, 1]) {
          const pv = new THREE.Group(); pv.position.set(0, Math.min(top - 0.5, mid + 0.4), sx * R0);
          const pn = mesh(new THREE.BoxGeometry(1.3, 0.04, 4.2).translate(0, 0, sx * 2.2), m.solar);
          const fr = mesh(new THREE.BoxGeometry(0.08, 0.08, 4.3).translate(0, 0, sx * 2.2), m.metal);
          pv.add(pn, fr); g.add(pv); panels.push(pv);
        }
      } else if (p.sci) {
        const a = id === 'thermo' ? 0.9 : id === 'baro' ? 2.6 : 4.4;
        const body = id === 'spectro' ? mesh(cyl(0.2, 0.2, 0.5, 16), m.gold) : mesh(new THREE.BoxGeometry(0.2, 0.3, 0.16), m.grey);
        body.position.set(Math.cos(a) * (R0 * 0.82 + 0.1), Math.min(top - 0.6, bottom + hh * 0.35), Math.sin(a) * (R0 * 0.82 + 0.1)); g.add(body);
      }
    }
  });
  const model = {
    root, stageGroups, nozzles,
    update(c) {
      for (const l of legs) l.rotation.z = THREE.MathUtils.lerp(l.rotation.z, c.gear ? 0.42 : 2.9, 0.15);
      for (const p of panels) p.scale.z = THREE.MathUtils.lerp(p.scale.z, c.panels && !c.failures.solar ? 1 : 0.06, 0.12);
      if (chute) { chute.visible = c.chuteOpen > 0.01; chute.scale.set(c.chuteOpen, 0.4 + 0.6 * c.chuteOpen, c.chuteOpen); }
    },
    dropStage() { const g = stageGroups.pop(); root.remove(g); while (nozzles.length && nozzles[nozzles.length - 1].stage >= stageGroups.length) nozzles.pop(); return g; },
  };
  return model;
}

export function buildStation() {
  const m = mats(), g = new THREE.Group();
  g.add(mesh(cyl(3, 3, 22).translate(0, -11, 0), m.white));
  g.add(mesh(new THREE.TorusGeometry(15, 1.6, 12, 48).rotateX(Math.PI / 2), m.white));
  for (let i = 0; i < 4; i++) { const s = mesh(new THREE.BoxGeometry(30, 0.6, 0.6), m.metal); s.rotation.y = (i / 4) * Math.PI; g.add(s); }
  for (const sy of [-1, 1]) { g.add(mesh(new THREE.BoxGeometry(34, 0.1, 7), m.solar, 0, sy * 9, 0)); g.add(mesh(cyl(1.2, 1.6, 1.2), m.dark, 0, sy * 11 - 0.6)); }
  g.add(mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0x66ff88 }), 0, 12, 0));
  return g;
}

export function buildAstronaut() {
  const m = mats(), g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(0.26, 0.55, 6, 12), m.suit, 0, 1.0));
  g.add(mesh(new THREE.SphereGeometry(0.24, 16, 12), m.suit, 0, 1.62));
  g.add(mesh(new THREE.SphereGeometry(0.19, 16, 12), m.visor, 0, 1.63, 0.1));
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.6, 0.22), m.grey, 0, 1.1, -0.28));
  for (const sx of [-1, 1]) { g.add(mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 8), m.suit, sx * 0.14, 0.38)); g.add(mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), m.suit, sx * 0.38, 1.05)); }
  return g;
}

export function buildRover() {
  const m = mats(), g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.45, 2.6), m.white, 0, 0.75));
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.05, 1.6), m.solar, 0, 1.02, -0.3));
  g.add(mesh(cyl(0.04, 0.04, 1.0, 8), m.metal, 0.5, 1.0, 0.9)); g.add(mesh(new THREE.BoxGeometry(0.3, 0.16, 0.16), m.dark, 0.5, 2.0, 0.9));
  const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18).rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const z of [-1, 0, 1]) g.add(mesh(wg, m.dark, sx * 0.95, 0.38, z));
  return g;
}

export function buildSciStation() {
  const m = mats(), g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const l = mesh(cyl(0.02, 0.02, 1.1, 6), m.metal); l.rotation.set(0.35, (i / 3) * Math.PI * 2, 0, 'YXZ'); g.add(l); }
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), m.gold, 0, 1.05)); g.add(mesh(new THREE.BoxGeometry(0.9, 0.03, 0.5), m.solar, 0, 1.3));
  return g;
}

export function buildLaunchPad() {
  const m = mats(), g = new THREE.Group();
  g.add(mesh(cyl(14, 15, 1.2, 8).translate(0, -1.2, 0), m.concrete));
  // Open lattice service tower: four legs, horizontal frames and alternating diagonal braces.
  const tower = new THREE.Group(), H = 26, w = 0.9, beam = 0.12;
  for (const [x, z] of [[-w, -w], [w, -w], [w, w], [-w, w]]) tower.add(mesh(new THREE.BoxGeometry(beam * 1.6, H, beam * 1.6).translate(0, H / 2, 0), m.grey, x, 0, z));
  const diag = Math.hypot(2 * w, 2.6), ang = Math.atan2(2 * w, 2.6);
  for (let y = 0; y <= H; y += 2.6) {
    for (const [x, z, ry] of [[0, -w, 0], [0, w, 0], [-w, 0, Math.PI / 2], [w, 0, Math.PI / 2]]) {
      const hb = mesh(new THREE.BoxGeometry(2 * w, beam, beam), m.grey, x, y, z); hb.rotation.y = ry; tower.add(hb);
      if (y + 2.6 <= H) {
        const d = mesh(new THREE.BoxGeometry(beam, diag, beam), m.grey, x, y + 1.3, z);
        d.rotation.order = 'YXZ'; d.rotation.y = ry; d.rotation.z = ((y / 2.6) % 2 ? 1 : -1) * ang; tower.add(d);
      }
    }
  }
  tower.updateMatrixWorld(true);
  const parts = tower.children.map((c) => c.geometry.clone().applyMatrix4(c.matrix));
  const lattice = mesh(mergeGeometries(parts), m.grey, -6.5, 0, 0); g.add(lattice);
  g.add(mesh(new THREE.BoxGeometry(4.6, 0.4, 0.8), m.accent, -4.2, 20, 0));
  g.add(mesh(new THREE.BoxGeometry(4.6, 0.25, 0.6), m.accent, -4.2, 12, 0));
  return g;
}

export const MODULE_BUILDERS = {
  habitat: (m) => { const g = new THREE.Group(); g.add(mesh(cyl(3.2, 3.2, 2.6), m.white)); g.add(mesh(new THREE.SphereGeometry(3.2, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), m.white, 0, 2.6)); g.add(mesh(new THREE.BoxGeometry(1.2, 1.8, 0.8), m.dark, 0, 0.9, 3.2)); return g; },
  lab: (m) => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(6, 2.6, 4).translate(0, 1.3, 0), m.white)); g.add(mesh(new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.gold, 1.4, 2.6)); return g; },
  solar: (m) => { const g = new THREE.Group(); for (let i = -1; i <= 1; i++) { const p = mesh(new THREE.BoxGeometry(2.6, 0.08, 4.4), m.solar, i * 3, 1.3); p.rotation.z = 0.45; g.add(p); g.add(mesh(cyl(0.08, 0.08, 1.3, 8), m.metal, i * 3)); } return g; },
  storage: (m) => { const g = new THREE.Group(); for (const x of [-1.6, 1.6]) g.add(mesh(cyl(1.4, 1.4, 3.4), m.grey, x)); g.add(mesh(new THREE.BoxGeometry(5.6, 0.3, 2.4), m.accent, 0, 1.7)); return g; },
  greenhouse: (m) => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(2.6, 2.6, 8, 24, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), m.green, 0, 0.1)); g.add(mesh(new THREE.BoxGeometry(5.2, 0.2, 8).translate(0, 0.1, 0), m.dark)); return g; },
  pad: (m) => { const g = new THREE.Group(); g.add(mesh(cyl(7, 7.4, 0.3, 8), m.concrete)); g.add(mesh(new THREE.RingGeometry(3, 3.5, 32).rotateX(-Math.PI / 2), m.accent, 0, 0.32)); return g; },
  antenna: (m) => { const g = new THREE.Group(); g.add(mesh(cyl(0.12, 0.2, 5, 8), m.metal)); const d = mesh(new THREE.SphereGeometry(1.8, 20, 8, 0, Math.PI * 2, 0, Math.PI / 3), m.white, 0, 6.6); d.rotation.x = Math.PI * 0.8; g.add(d); return g; },
};
export function buildModule(type) { return MODULE_BUILDERS[type](mats()); }

export function buildAsteroid(radius, seed) {
  const g = new THREE.IcosahedronGeometry(radius, 3), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.25 * Math.sin(v.x * 0.9 / radius * 4 + seed) * Math.cos(v.y / radius * 5 + seed * 2) + 0.12 * Math.sin(v.z / radius * 11 + seed * 3);
    p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
  }
  g.computeVertexNormals();
  return mesh(g, new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 0.95, flatShading: true }));
}
