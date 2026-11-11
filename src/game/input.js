// Keyboard and mouse input with rebindable actions.
export class Input {
  constructor(keys, canvas) {
    this.keys = keys; this.down = new Set(); this.handlers = {}; this.enabled = true; this.capture = null;
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
    window.addEventListener('blur', () => this.down.clear());
    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!dragging) return; if (this.onDrag) this.onDrag(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (this.onWheel) this.onWheel(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  actionFor(code) { for (const a in this.keys) if (this.keys[a] === code) return a; return null; }
  is(action) { return this.enabled && this.down.has(this.keys[action]); }
  axis(pos, neg) { return (this.is(pos) ? 1 : 0) - (this.is(neg) ? 1 : 0); }
  on(action, fn) { this.handlers[action] = fn; }
  fire(action) { if (this.enabled || action === 'escape') { const h = this.handlers[action]; if (h) h(); } }
}
