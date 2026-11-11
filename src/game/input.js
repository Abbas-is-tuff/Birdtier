// Keyboard, mouse and touch input with rebindable actions.
// On-screen touch controls feed the same actions as the keyboard: `hold(action, on)` for buttons
// held down, `setAnalog(action, 0..1)` for the joystick, and `fire(action)` for one-shot presses.
// On the canvas, one finger (or the mouse) drags the camera; two fingers pinch to zoom.
export class Input {
  constructor(keys, canvas) {
    this.keys = keys; this.down = new Set(); this.held = new Set(); this.analog = {};
    this.handlers = {}; this.enabled = true; this.capture = null;
    this.onDrag = null; this.onWheel = null;
    window.addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const c = this.capture; this.capture = null; c(e.code); return; }
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const action = this.actionFor(e.code);
      if (e.code === 'Escape') { this.fire('escape'); return; }
      if (!action) return;
      e.preventDefault();
      if (!e.repeat && !this.down.has(e.code)) this.fire(action);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.held.clear(); this.analog = {}; });

    // pointers on the canvas: drag to look, pinch to zoom
    const pts = new Map();
    let pinch = 0;
    const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    canvas.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      if (pts.size === 2) pinch = spread();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { if (this.onDrag) this.onDrag(dx, dy); }
      else if (pts.size === 2) {
        const d = spread();
        if (pinch > 0 && this.onWheel) this.onWheel((pinch - d) * 4); // fingers apart = zoom in
        pinch = d;
      }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = pts.size === 2 ? spread() : 0; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (this.onWheel) this.onWheel(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  actionFor(code) { for (const a in this.keys) if (this.keys[a] === code) return a; return null; }
  is(action) { return this.enabled && (this.down.has(this.keys[action]) || this.held.has(action)); }
  axis(pos, neg) {
    if (!this.enabled) return 0;
    const v = (this.is(pos) ? 1 : 0) - (this.is(neg) ? 1 : 0) + (this.analog[pos] || 0) - (this.analog[neg] || 0);
    return Math.max(-1, Math.min(1, v));
  }
  hold(action, on) { if (on) this.held.add(action); else this.held.delete(action); }
  setAnalog(action, v) { if (v > 0) this.analog[action] = Math.min(1, v); else delete this.analog[action]; }
  on(action, fn) { this.handlers[action] = fn; }
  fire(action) { if (this.enabled || action === 'escape') { const h = this.handlers[action]; if (h) h(); } }
}
