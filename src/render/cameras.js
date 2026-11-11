// Camera rig: chase, cockpit, orbital, surface and free cameras plus the map camera, with
// smooth blended transitions. All positions are kept as offsets from the focus object in
// double precision; the renderer then draws the world relative to the camera.
import { Vector3, Quaternion, Matrix4 } from 'three';

export const CAM_MODES = ['chase', 'cockpit', 'orbital', 'surface', 'free'];
export const CAM_LABEL = { chase: 'Chase', cockpit: 'Cockpit', orbital: 'Orbital', surface: 'Surface', free: 'Free', map: 'Map' };

const _up = new Vector3(), _n = new Vector3(), _e = new Vector3(), _off = new Vector3(), _t = new Vector3(), _f = new Vector3();
const _m = new Matrix4(), _q = new Quaternion(), ZERO = new Vector3(), Y = new Vector3(0, 1, 0);
const RX90 = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

export class CameraRig {
  constructor() {
    this.mode = 'chase'; this.map = false;
    this.yaw = Math.PI; this.pitch = 0.18;
    this.dist = { chase: 38, orbital: 3.2, surface: 7, map: 6 }; // orbital/map are in focus-body radii
    this.look = { yaw: 0, pitch: 0 };
    this.free = { off: new Vector3(30, 10, 30), yaw: -2.3, pitch: -0.2 };
    this.padPoint = null;
    this.off = new Vector3(0, 10, 40); this.quat = new Quaternion();
    this.blend = 1; this.fromOff = new Vector3(); this.fromQuat = new Quaternion();
    this.worldPos = new Vector3();
    this.mapFocus = null;
  }

  get current() { return this.map ? 'map' : this.mode; }
  startBlend() { this.fromOff.copy(this.off); this.fromQuat.copy(this.quat); this.blend = 0; }
  setMode(m) { if (m !== this.mode) { this.startBlend(); this.mode = m; this.padPoint = null; } }
  setMap(on, focusBody) { if (on !== this.map) { this.startBlend(); this.map = on; } if (focusBody) this.setMapFocus(focusBody); }
  setMapFocus(b) { if (b !== this.mapFocus) { this.startBlend(); this.mapFocus = b; this.dist.map = b.type === 'star' ? 70 : b.type === 'station' ? 4e4 : 8; } }

  drag(dx, dy) {
    const m = this.current;
    if (m === 'free') { this.free.yaw -= dx * 0.004; this.free.pitch = Math.max(-1.5, Math.min(1.5, this.free.pitch - dy * 0.004)); }
    else if (m === 'cockpit') { this.look.yaw = Math.max(-1.3, Math.min(1.3, this.look.yaw - dx * 0.004)); this.look.pitch = Math.max(-1, Math.min(1, this.look.pitch - dy * 0.004)); }
    else { this.yaw -= dx * 0.005; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.005)); }
  }
  zoom(delta) {
    const m = this.current, k = Math.exp(delta * 0.0012);
    if (m === 'chase') this.dist.chase = Math.max(6, Math.min(4000, this.dist.chase * k));
    else if (m === 'surface') this.dist.surface = Math.max(2.5, Math.min(300, this.dist.surface * k));
    else if (m === 'orbital') this.dist.orbital = Math.max(1.15, Math.min(60, this.dist.orbital * k));
    else if (m === 'map') this.dist.map = Math.max(2.2, Math.min(4e11 / this.mapFocus.radius, this.dist.map * k));
    else if (m === 'free') this.free.off.multiplyScalar(k);
  }

  // ctx: { focus: Vector3 (double), body, craft, entity, move: {x,y,z} for the free camera, hasEntity }
  update(dt, ctx) {
    const { focus, body } = ctx, m = this.current;
    _up.subVectors(focus, body.pos).normalize();
    if (body.type === 'star') _up.copy(Y);
    _n.copy(body.axis).addScaledVector(_up, -body.axis.dot(_up));
    if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0).addScaledVector(_up, -_up.x);
    _n.normalize(); _e.crossVectors(_n, _up); // east
    const orbitOff = (dist, up, n, e) => {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      return _off.copy(n).multiplyScalar(Math.cos(this.yaw) * cp).addScaledVector(e, Math.sin(this.yaw) * cp).addScaledVector(up, sp).multiplyScalar(dist);
    };
    const lookAt = (eye, target, up) => _q.setFromRotationMatrix(_m.lookAt(eye, target, up));
    let off = _off, quat = _q;

    if (m === 'map') {
      const fb = this.mapFocus || body;
      _t.subVectors(fb.pos, focus);
      orbitOff(this.dist.map * fb.radius, Y, _n.set(1, 0, 0), _e.set(0, 0, 1));
      lookAt(_off, ZERO, Y); off.add(_t);
    } else if (m === 'orbital') {
      _t.subVectors(body.pos, focus);
      orbitOff(this.dist.orbital * body.radius, Y, _n.set(1, 0, 0), _e.set(0, 0, 1));
      lookAt(_off, ZERO, Y); off.add(_t);
    } else if (m === 'cockpit' && !ctx.entity) {
      const c = ctx.craft;
      off.set(0, c.stages[0].h + 0.3, 0).applyQuaternion(c.quat);
      quat.copy(c.quat).multiply(RX90);
      quat.multiply(new Quaternion().setFromAxisAngle(Y, this.look.yaw)).multiply(new Quaternion().setFromAxisAngle(_t.set(1, 0, 0), this.look.pitch));
    } else if (m === 'free') {
      const f = this.free, cp = Math.cos(f.pitch);
      _f.copy(_n).multiplyScalar(Math.cos(f.yaw) * cp).addScaledVector(_e, Math.sin(f.yaw) * cp).addScaledVector(_up, Math.sin(f.pitch));
      const mv = ctx.move;
      if (mv && (mv.x || mv.y || mv.z)) {
        const sp = Math.max(4, f.off.length() * 0.6) * dt * (mv.fast ? 6 : 1);
        _t.crossVectors(_f, _up).normalize();
        f.off.addScaledVector(_f, mv.z * sp).addScaledVector(_t, mv.x * sp).addScaledVector(_up, mv.y * sp);
      }
      off.copy(f.off);
      lookAt(ZERO, _f, _up);
    } else if (m === 'surface' && !ctx.entity) {
      // fixed ground camera near the craft
      if (!this.padPoint || this.padBody !== body) {
        this.padBody = body;
        this.padPoint = body.localDir(_t.copy(focus).addScaledVector(_e, 45).addScaledVector(_n, -25), new Vector3());
      }
      const h = body.landable ? body.surfaceH(this.padPoint) : focus.distanceTo(body.pos) - body.radius - 30;
      _t.copy(this.padPoint).applyQuaternion(body.quat).multiplyScalar(body.radius + h + 2.2).add(body.pos).sub(focus);
      off.copy(_t);
      if (off.length() > 6000) this.padPoint = null;
      lookAt(off, ZERO, _up);
    } else {
      const d = ctx.entity ? this.dist.surface : this.dist.chase;
      const pitchSave = this.pitch;
      if (ctx.entity) this.pitch = Math.max(0.03, this.pitch);
      orbitOff(d, _up, _n, _e);
      this.pitch = pitchSave;
      _t.copy(_up).multiplyScalar(ctx.entity ? 0.9 : ctx.craftMid || 0); // bird astronauts stand ~1.4 m tall
      lookAt(_off, _t, _up);
      // keep the camera above the terrain
      if (body.landable && ctx.groundClear !== undefined) {
        const below = ctx.groundClear + off.dot(_up);
        if (below < 1.5) off.addScaledVector(_up, 1.5 - below);
      }
    }

    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 0.9);
      const s = this.blend * this.blend * (3 - 2 * this.blend);
      this.off.lerpVectors(this.fromOff, off, s);
      this.quat.slerpQuaternions(this.fromQuat, quat, s);
    } else { this.off.copy(off); this.quat.copy(quat); }
    this.worldPos.copy(focus).add(this.off);
  }
}
