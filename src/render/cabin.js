// The inside of the spacecraft: a round cabin with windows, a control console, seats with the
// rest of the crew, a seed bowl and the hatch. Built in the craft's frame (y = towards the nose).
import * as THREE from 'three';
import { buildAstronaut } from './models.js';
import { ROOM, CREW_SEATS } from '../surface/Walkers.js';

function screenTex(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#04121c'; x.fillRect(0, 0, 256, 160);
  x.strokeStyle = kind === 'orbit' ? '#4fd1ff' : '#5cff9a'; x.lineWidth = 2; x.fillStyle = x.strokeStyle;
  if (kind === 'orbit') {
    x.beginPath(); x.arc(128, 80, 26, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(128, 80, 92, 52, -0.2, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(208, 60, 5, 0, Math.PI * 2); x.fillStyle = '#ffc43a'; x.fill();
  } else if (kind === 'graph') {
    x.beginPath(); for (let i = 0; i <= 256; i += 8) x.lineTo(i, 80 + Math.sin(i * 0.06) * 30 + Math.sin(i * 0.17) * 10); x.stroke();
    for (let i = 0; i < 6; i++) x.fillRect(16 + i * 40, 130, 24, -10 - i * 4);
  } else {
    x.font = 'bold 22px monospace'; x.fillText('BIRDTIER', 70, 50); x.font = '14px monospace';
    ['O2  ok', 'H2O ok', 'SEEDS ok', 'BEAKS 100%'].forEach((t, i) => x.fillText(t, 30, 82 + i * 18));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildCabin(crewLooks) {
  const g = new THREE.Group(), { R, floor, ceil } = ROOM, H = ceil - floor;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2, envMapIntensity: 0, ...o });
  const wallM = std({ color: 0xd9dee5, side: THREE.DoubleSide, roughness: 0.5 }), trimM = std({ color: 0x4a5561, metalness: 0.6, roughness: 0.4 });
  const accent = std({ color: 0xe9a23b, emissive: 0x6a3c00, emissiveIntensity: 0.6 }), glow = (c) => std({ color: c, emissive: c, emissiveIntensity: 1.4 });
  // floor and ceiling
  const fl = new THREE.Mesh(new THREE.CircleGeometry(R, 40), std({ color: 0x39424d, metalness: 0.5, roughness: 0.55 }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = floor; g.add(fl);
  for (let i = 1; i <= 2; i++) { const ring = new THREE.Mesh(new THREE.RingGeometry(R * i / 3 - 0.02, R * i / 3, 48), trimM); ring.rotation.x = -Math.PI / 2; ring.position.y = floor + 0.002; g.add(ring); }
  const ce = new THREE.Mesh(new THREE.CircleGeometry(R, 40), wallM); ce.rotation.x = Math.PI / 2; ce.position.y = ceil; g.add(ce);
  const lamp = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 40), glow(0xfff3d6)); lamp.rotation.x = Math.PI / 2; lamp.position.y = ceil - 0.01; g.add(lamp);
  const strip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.025, 6, 64), glow(0x4fd1ff)); strip.rotation.x = Math.PI / 2; strip.position.y = floor + 0.05; g.add(strip);
  // curved wall from vertical strips; some strips have a window gap
  const N = 34, w = 2 * R * Math.sin(Math.PI / N) + 0.02, winLow = floor + 1.05, winHigh = floor + 2.05;
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x9fd2ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  const windows = new Set([31, 32, 33, 0, 1, 2, 3, 8, 9, 25, 26]); // big front view (+z, index 0) and a window on each side
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R;
    const strip = new THREE.Group(); strip.position.set(x, 0, z); strip.rotation.y = a; g.add(strip);
    const isWin = windows.has(i);
    const piece = (y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, 0.08), wallM); m.position.y = (y0 + y1) / 2; strip.add(m); };
    if (!isWin) piece(floor, ceil);
    else {
      piece(floor, winLow); piece(winHigh, ceil);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, winHigh - winLow), glassM); gl.position.y = (winLow + winHigh) / 2; gl.renderOrder = 6; strip.add(gl);
      for (const y of [winLow, winHigh]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.14), trimM); t.position.y = y; strip.add(t); }
    }
    if (i % 2 === 0) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, H, 0.12), trimM); rib.position.set(w / 2, (floor + ceil) / 2, -0.02); strip.add(rib); }
  }
  // control console at the front (+z) under the big window
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.7), trimM); desk.position.set(0, floor + 0.45, R - 0.55); g.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 0.8), std({ color: 0x20262e, metalness: 0.4 })); top.position.set(0, floor + 0.92, R - 0.55); top.rotation.x = -0.25; g.add(top);
  ['orbit', 'graph', 'status'].forEach((k, i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: screenTex(k), toneMapped: false }));
    s.position.set((i - 1) * 0.8, floor + 0.98, R - 0.6); s.rotation.x = -Math.PI / 2 + 0.55; s.rotation.y = Math.PI; g.add(s);
  });
  for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.07), glow([0xff5a3c, 0x5cff9a, 0xffc43a, 0x4fd1ff][i % 4])); b.position.set(-1.1 + i * 0.17, floor + 0.93, R - 0.28); b.rotation.x = -0.25; g.add(b); }
  // pilot seat and crew seats
  const seat = (x, z, h) => {
    const s = new THREE.Group(); s.position.set(x, floor, z); s.rotation.y = h;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.7), accent); base.position.y = 0.21; s.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.12), accent); back.position.set(0, 0.75, -0.32); back.rotation.x = -0.12; s.add(back);
    g.add(s); return s;
  };
  seat(0, R - 1.4, Math.PI);
  g.userData.crewBirds = [];
  CREW_SEATS.forEach((p, i) => {
    seat(p.x, p.z, p.h);
    if (!crewLooks[i]) return;
    const b = buildAstronaut(crewLooks[i]); b.position.set(p.x, floor + 0.42, p.z); b.rotation.y = p.h + Math.PI; b.scale.setScalar(0.85);
    g.add(b); g.userData.crewBirds.push(b);
  });
  // seed bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.16, 24, 1, true), std({ color: 0x3f86d6, side: THREE.DoubleSide }));
  bowl.position.set(R - 0.55, floor + 0.62, 0.25); g.add(bowl);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.55, 8), trimM); stand.position.set(R - 0.55, floor + 0.27, 0.25); g.add(stand);
  const seedM = std({ color: 0xd8b56a, roughness: 0.8 });
  for (let i = 0; i < 26; i++) { const sd = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), seedM); const a = i * 2.4, r = 0.24 * Math.sqrt((i + 0.5) / 26); sd.position.set(R - 0.55 + Math.cos(a) * r, floor + 0.67 + (i % 3) * 0.015, 0.25 + Math.sin(a) * r); sd.scale.set(1, 0.6, 1.4); g.add(sd); }
  // hatch at the back (-z)
  const hatch = new THREE.Group(); hatch.position.set(0, floor + 1.1, -R + 0.08); g.add(hatch);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 32), std({ color: 0xb8c0c9, metalness: 0.7, roughness: 0.3 })); door.rotation.x = Math.PI / 2; hatch.add(door);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.05, 8, 40), accent); hatch.add(rim);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 24), trimM); wheel.position.z = 0.06; hatch.add(wheel); g.userData.hatchWheel = wheel;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), glow(0x5cff9a)); sign.position.set(0, 0.8, 0.05); hatch.add(sign);
  // where the cabin lamps go (the lights themselves stay in the scene permanently; see Game.cabinLights)
  g.userData.lampPos = [new THREE.Vector3(0, ceil - 0.3, 0), new THREE.Vector3(0, floor + 0.6, -1)];
  g.visible = false;
  return g;
}
