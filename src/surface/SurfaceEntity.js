// An astronaut on foot or a rover: moves over the terrain of a body in its rotating frame.
import { Vector3, Quaternion, Matrix4 } from 'three';

const _n = new Vector3(), _e = new Vector3(), _f = new Vector3(), _t = new Vector3(), _d2 = new Vector3();
const _m = new Matrix4(), Y = new Vector3(0, 1, 0);

export class SurfaceEntity {
  constructor(kind, body, dir, heading = 0) {
    this.kind = kind; this.body = body; this.dir = dir.clone().normalize(); this.heading = heading;
    this.y = 0; this.vy = 0; this.speed = 0;
    this.ec = 200; this.ecCap = 200;
    this.ground = body.surfaceH(this.dir);
    this.normal = new Vector3().copy(this.dir);
  }

  basis() {
    _e.copy(Y).cross(this.dir);
    if (_e.lengthSq() < 1e-8) _e.set(0, 0, -1);
    _e.normalize(); _n.crossVectors(this.dir, _e);
    return _f.copy(_n).multiplyScalar(Math.cos(this.heading)).addScaledVector(_e, Math.sin(this.heading));
  }

  // input: { fwd, turn, jump }  env: { sunVis, flux }
  update(dt, input, env) {
    const b = this.body, g = b.mu / (b.radius * b.radius);
    let v;
    if (this.kind === 'rover') {
      const m = this.mods || {};
      const target = this.ec > 0 ? input.fwd * 14 * (m.drive || 1) : 0;
      this.speed += Math.max(-8 * dt, Math.min(8 * dt, target - this.speed));
      this.heading += input.turn * dt * 1.1 * Math.max(-1, Math.min(1, this.speed / 4));
      this.ec = Math.max(0, Math.min(this.ecCap, this.ec + (2.2 * env.sunVis * env.flux - Math.abs(this.speed) * 0.25) * dt));
      v = this.speed;
    } else {
      this.heading += input.turn * dt * 2.2;
      const m = this.mods || {};
      v = input.fwd * (input.fwd > 0 ? 3.4 : 1.6) * (m.walk || 1);
      this.speed = v;
      if (input.jump && this.y <= 0.001) this.vy = Math.min(3.2, Math.sqrt(2 * g * 0.6) + 1.2) * (m.jump || 1);
      // jetpack upgrade: keep holding Jump in the air to fly; it refills on the ground
      const jetMax = 3 * (m.jet || 0);
      if (this.jet === undefined || this.y <= 0.001) this.jet = jetMax;
      this.jetting = false;
      if (jetMax && input.jump && this.y > 0.25 && this.jet > 0) {
        this.vy = Math.min(this.vy + (g + 7) * dt, 9); this.jet -= dt; this.jetting = true;
      }
      if (this.y > 0.5 && jetMax) v *= 2.2;
    }
    const f = this.basis();
    if (v) {
      _d2.copy(this.dir).addScaledVector(f, (v * dt) / (b.radius + this.ground)).normalize();
      const raw = b.rawH(_d2);
      const blocked = (b.terrain.sea && raw < -0.8) || raw <= b.terrain.lethalBelow;
      const slope = (raw - b.rawH(this.dir)) / Math.max(0.05, Math.abs(v * dt));
      if (!blocked && (this.kind !== 'rover' || slope < 0.9)) this.dir.copy(_d2); else this.speed = 0;
    }
    this.ground = b.surfaceH(this.dir);
    if (this.y > 0 || this.vy > 0) { this.vy -= g * dt; this.y += this.vy * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; } }
    // terrain normal by finite differences (for rover tilt)
    const f2 = this.basis(), k = 1.2 / b.radius;
    const hf = b.surfaceH(_t.copy(this.dir).addScaledVector(f2, k).normalize());
    _t.crossVectors(f2, this.dir).normalize(); // right
    const hr = b.surfaceH(_d2.copy(this.dir).addScaledVector(_t, k).normalize());
    this.normal.copy(this.dir).addScaledVector(f2, -(hf - this.ground) / 1.2).addScaledVector(_t, -(hr - this.ground) / 1.2).normalize();
  }

  worldPos(out) {
    return out.copy(this.dir).applyQuaternion(this.body.quat).multiplyScalar(this.body.radius + this.ground + this.y).add(this.body.pos);
  }
  worldQuat(out) {
    const up = this.kind === 'rover' ? this.normal : this.dir;
    const f = this.basis();
    _t.crossVectors(up, f).normalize(); // x axis so that z = forward
    _d2.crossVectors(_t, up);
    out.setFromRotationMatrix(_m.makeBasis(_t, up, _d2));
    return out.premultiply(this.body.quat);
  }
  toJSON() { return { kind: this.kind, body: this.body.id, dir: this.dir.toArray(), heading: this.heading, ec: this.ec }; }
}
