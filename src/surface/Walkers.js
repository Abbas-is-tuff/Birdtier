// Two more ways to get out of the pilot's seat:
//  - CabinWalker: walk (or float, in zero gravity) around the inside of the spacecraft.
//  - SpaceWalker: a spacewalk outside the craft in flight, on a 40 m safety tether, with a jet pack.
// Both expose the same small interface as SurfaceEntity (kind, body, speed, y, update, worldPos,
// worldQuat), so the camera, HUD and bird model treat them the same way.
import { Vector3, Quaternion, Matrix4 } from 'three';

const Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const _q = new Quaternion(), _q2 = new Quaternion(), _m = new Matrix4(), _a = new Vector3(), _b = new Vector3(), _c = new Vector3();

// Cabin layout in the craft's frame (y = along the rocket's nose).
export const ROOM = { R: 3.1, floor: -1.2, ceil: 1.75 };
const R = ROOM.R;
export const SPOTS = [
  { id: 'seat', x: 0, z: R - 1.35, label: 'Sit at the controls' },
  { id: 'hatch', x: 0, z: -(R - 0.45), label: 'Open the hatch and go outside' },
  { id: 'bowl', x: R - 0.85, z: 0.25, label: 'Eat some seeds' },
  { id: 'window', x: -(R - 0.55), z: 0.2, label: 'Look out of the window' },
];
// Where the other crew birds sit.
export const CREW_SEATS = [{ x: -1.6, z: 1.2, h: 2.6 }, { x: 1.6, z: 1.2, h: -2.6 }, { x: -1.9, z: -1.1, h: 1.2 }];

export class CabinWalker {
  constructor(craft, crew) {
    this.kind = 'cabin'; this.craft = craft; this.crew = crew; // ids of the other birds aboard
    this.local = new Vector3(0, 0, 0.6); this.heading = Math.PI; this.y = 0; this.vy = 0; this.speed = 0;
    this.zeroG = false; this.spin = 0; this.ec = 0; this.ecCap = 0;
  }
  get body() { return this.craft.env.body; }
  // Felt gravity along the floor direction: the planet's pull when landed, otherwise engine thrust.
  gravity() {
    const c = this.craft;
    if (c.landed) return c.env.body.mu / (c.env.r * c.env.r);
    return c.thr.F / c.mass();
  }
  update(dt, input) {
    const g = this.gravity(), wasZero = this.zeroG;
    this.zeroG = g < 0.3;
    this.justFloated = this.zeroG && !wasZero;
    this.heading += input.turn * dt * 2.4;
    const v = input.fwd * (input.fwd > 0 ? 1.5 : 0.9) * (this.zeroG ? 0.8 : 1);
    this.speed = v;
    this.local.x += Math.sin(this.heading) * v * dt;
    this.local.z += Math.cos(this.heading) * v * dt;
    const r = Math.hypot(this.local.x, this.local.z), max = ROOM.R - 0.55;
    if (r > max) { this.local.x *= max / r; this.local.z *= max / r; }
    const top = ROOM.ceil - ROOM.floor - 1.35;
    if (this.zeroG) {
      if (input.jump) this.vy += 2.2 * dt;
      if (input.down) this.vy -= 2.2 * dt;
      if (!input.jump && !input.down && this.y < 0.05) this.vy += 0.25 * dt; // drift up off the floor
      this.vy *= 1 - Math.min(1, 0.35 * dt);
      this.y += this.vy * dt;
      if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.5; }
      if (this.y > top) { this.y = top; this.vy = -Math.abs(this.vy) * 0.5; }
      this.spin += dt * (0.5 + Math.abs(v));
    } else {
      const gg = Math.min(g, 25);
      if (input.jump && this.y <= 0.001) this.vy = Math.sqrt(2 * Math.max(1, gg) * 0.45);
      this.vy -= gg * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
      if (this.y > top) { this.y = top; this.vy = 0; }
      this.spin *= 1 - Math.min(1, 3 * dt);
    }
  }
  // Bird position in the craft frame (feet).
  localPos(out) { return out.set(this.local.x, ROOM.floor + this.y, this.local.z); }
  worldPos(out) { return this.localPos(out).applyQuaternion(this.craft.quat).add(this.craft.pos); }
  worldQuat(out) {
    out.copy(this.craft.quat).multiply(_q.setFromAxisAngle(Y, this.heading));
    if (this.spin) out.multiply(_q2.setFromAxisAngle(Z, Math.sin(this.spin) * 0.5));
    return out;
  }
  // The thing within reach, if any (for the F / V prompts).
  nearby() {
    let best = null, bd = 1.05;
    const spots = SPOTS.concat(this.crew.map((id, i) => ({ id: 'crew:' + id, bird: id, x: CREW_SEATS[i].x, z: CREW_SEATS[i].z, label: 'Talk' })));
    for (const s of spots) { const d = Math.hypot(s.x - this.local.x, s.z - this.local.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
}

export class SpaceWalker {
  constructor(craft) {
    this.kind = 'spacewalk'; this.craft = craft;
    this.rel = new Vector3(); this.vel = new Vector3(); this.speed = 0; this.y = 1e6; this.ec = 0; this.ecCap = 0;
    this.face = new Quaternion();
    // step out of the side hatch
    const side = _a.set(1, 0, 0).applyQuaternion(craft.quat);
    this.rel.copy(side).multiplyScalar(3.2);
    this.vel.copy(side).multiplyScalar(0.4);
    this.face.copy(craft.quat);
    this.tetherMax = 40;
  }
  get body() { return this.craft.env.body; }
  // input: { fwd, turn (strafe), jump (up), down }; env.camQuat: camera orientation (thrust is camera-relative)
  update(dt, input, env) {
    const cq = env.camQuat;
    const fwd = _a.set(0, 0, -1).applyQuaternion(cq), right = _b.set(1, 0, 0).applyQuaternion(cq), up = _c.set(0, 1, 0).applyQuaternion(cq);
    const ax = input.fwd, ay = (input.jump ? 1 : 0) - (input.down ? 1 : 0), az = input.turn;
    const thrusting = ax || ay || az;
    this.vel.addScaledVector(fwd, ax * 1.4 * dt).addScaledVector(right, az * 1.4 * dt).addScaledVector(up, ay * 1.4 * dt);
    if (!thrusting) this.vel.multiplyScalar(1 - Math.min(1, 0.9 * dt)); // the pack's stabiliser slowly stops you
    if (this.vel.length() > 6) this.vel.setLength(6);
    this.rel.addScaledVector(this.vel, dt);
    const d = this.rel.length();
    this.tight = d > this.tetherMax - 0.5;
    if (d > this.tetherMax) { // the tether pulls you back
      this.rel.setLength(this.tetherMax);
      const out = this.rel.clone().normalize(), vr = this.vel.dot(out);
      if (vr > 0) this.vel.addScaledVector(out, -vr * 1.3);
    }
    this.speed = this.vel.length();
    // face where the camera looks, upright to the camera
    _m.lookAt(fwd, new Vector3(), up);
    _q.setFromRotationMatrix(_m);
    this.face.slerp(_q, Math.min(1, dt * 4));
  }
  worldPos(out) { return out.copy(this.craft.pos).add(this.rel); }
  worldQuat(out) { return out.copy(this.face); }
  distToCraft() { return this.rel.length(); }
}
