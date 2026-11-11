// Places to find on solid worlds: Space Seed caches (currency for upgrades), alien ruins (seeds and
// science) and stranded crew birds waiting to be rescued. Every site is generated from the body's
// seed, so it is always in the same spot. Each site has a glowing beacon you can see from orbit.
import * as THREE from 'three';
import { RESCUE_AT, crewById } from '../crew/crew.js';
import { buildAstronaut } from '../render/models.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashStr = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

export const SITE_TYPES = {
  treasure: { label: 'Seed cache', color: 0xffc43a, css: '#ffc43a' },
  ruins: { label: 'Alien ruins', color: 0xb36bff, css: '#b36bff' },
  bird: { label: 'Stranded bird', color: 0x4dff9a, css: '#4dff9a' },
};

function okSpot(body, d) {
  const T = body.terrain;
  if (T.sea && body.rawH(d) < 20) return false;
  if (T.lethalBelow !== undefined && body.surfaceH(d) <= T.lethalBelow + 60) return false;
  return true;
}

export function generateSites(system) {
  const out = [];
  for (const body of system.bodies) {
    if (!body.landable) continue;
    const r = rng(hashStr(body.id + ':sites'));
    const types = ['ruins', 'treasure', 'treasure'];
    if (body.radius > 1.5e5) types.push('treasure');
    const bird = Object.keys(RESCUE_AT).find((id) => RESCUE_AT[id] === body.id);
    if (bird) types.unshift('bird');
    const mult = body.def.sciMult || 1;
    types.forEach((type, i) => {
      const d = new THREE.Vector3();
      if (body === system.home && i < 2) {
        // two easy ones a short walk or drive from the launch pad
        const s = system.launchSite.clone().normalize(), side = new THREE.Vector3(0, 1, 0).cross(s).normalize(), fwd = new THREE.Vector3().crossVectors(s, side);
        const dist = i === 0 ? 160 : 900;
        d.copy(s).addScaledVector(i === 0 ? side : fwd, dist / body.radius).normalize();
      } else {
        for (let k = 0; k < 80; k++) {
          d.set(r() * 2 - 1, (r() * 2 - 1) * 0.8, r() * 2 - 1);
          if (d.lengthSq() < 0.05) continue;
          d.normalize();
          if (okSpot(body, d)) break;
        }
      }
      const id = `${body.id}:${i}`;
      const seeds = type === 'treasure' ? Math.round((30 + r() * 40) * mult) : type === 'ruins' ? Math.round(90 * mult) : 50;
      out.push({ id, body, type, dir: d, bird: type === 'bird' ? bird : null, seeds, science: type === 'ruins' ? Math.round(25 * mult) : 0, obj: null, beam: null });
    });
  }
  return out;
}

const _w = new THREE.Vector3();
function glowTex() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let GLOW = null;

// Model + beacon for a site, built in the site's local frame (y = up, origin on the ground).
export function buildSite(site) {
  const g = new THREE.Group(), col = SITE_TYPES[site.type].color;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2, ...o });
  if (site.type === 'treasure') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1), std(0x6b4a2a, { roughness: 0.85 }));
    crate.position.y = 0.45; g.add(crate);
    for (const z of [-0.51, 0.51]) { const band = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.03), std(0xc9a14c, { metalness: 1, roughness: 0.35 })); band.position.set(0, 0.55, z); g.add(band); }
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), std(0xffc43a, { emissive: 0xffa000, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.25 }));
    seed.scale.set(1, 1.35, 1); seed.position.y = 1.35; g.add(seed); g.userData.spin = seed;
  } else if (site.type === 'ruins') {
    const stone = std(0x6d6a7a, { roughness: 0.95 }), glow = std(0xb36bff, { emissive: 0x9a4dff, emissiveIntensity: 2 });
    for (const x of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), stone); p.position.set(x, 3.5, 0); p.rotation.z = x * 0.01; g.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 1.4), stone); top.position.y = 7.3; g.add(top);
    const ob = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4, 4), stone); ob.position.set(0, 2, -4); g.add(ob);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 8, 32), glow); rune.position.y = 4; g.add(rune); g.userData.spin = rune;
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + (i % 3) * 0.2), stone); b.position.set(Math.cos(i) * 5, 0.2, Math.sin(i * 1.7) * 5); g.add(b); }
  } else {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), std(0xe8eaee, { metalness: 0.3, roughness: 0.4 }));
    pod.position.set(-1.6, 0.4, 0); pod.rotation.z = 0.5; g.add(pod);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), std(0x4dff9a, { emissive: 0x22aa55, emissiveIntensity: 1, side: THREE.DoubleSide }));
    flag.position.set(-0.4, 2.0, 0.3); g.add(flag);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6), std(0x9aa3ad, { metalness: 0.9 })); pole.position.set(-0.75, 1.1, 0.3); g.add(pole);
    const bird = buildAstronaut(crewById(site.bird).look); bird.position.set(0.6, 0, 0.4); g.add(bird); g.userData.bird = bird;
  }
  if (!GLOW) GLOW = glowTex();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: col, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.renderOrder = 4; beam.frustumCulled = false; g.add(beam);
  site.beam = beam;
  return g;
}

// Keep beacons visible from far away: thicker and taller with distance; hidden once found.
export function updateBeacons(sites, camPos, t, found, hide) {
  for (const s of sites) {
    if (!s.obj) continue;
    const got = found.includes(s.id);
    s.beam.visible = !got && !hide;
    if (s.obj.userData.spin) s.obj.userData.spin.rotation.y = t * 1.5;
    if (s.obj.userData.bird) { s.obj.userData.bird.visible = !got; s.obj.userData.bird.children[0].rotation.z = Math.sin(t * 6) * 0.12; }
    if (got) continue;
    const d = s.obj.getWorldPosition(_w).distanceTo(camPos);
    const w = Math.max(1.2, d * 0.006), h = Math.max(60, Math.min(d * 0.35, 40000));
    s.beam.scale.set(w, h, w);
    s.beam.material.opacity = 0.55 + 0.25 * Math.sin(t * 3);
  }
}
