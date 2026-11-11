// Number formatting helpers for the interface.
export function fmtDist(m) {
  if (m === null || m === undefined || !isFinite(m)) return '—';
  const a = Math.abs(m);
  if (a < 10000) return `${m.toFixed(a < 100 ? 1 : 0)} m`;
  if (a < 1e7) return `${(m / 1e3).toFixed(a < 1e6 ? 2 : 0)} km`;
  if (a < 1e10) return `${(m / 1e6).toFixed(2)} Mm`;
  return `${(m / 1e9).toFixed(2)} Gm`;
}
export const fmtSpeed = (v) => (isFinite(v) ? `${v.toFixed(Math.abs(v) < 100 ? 1 : 0)} m/s` : '—');
export function fmtTime(s) {
  if (!isFinite(s)) return '—';
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${p(h)}:${p(m)}:${p(ss)}`;
}
export const fmtNum = (n, d = 0) => (isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
export function fmtPressure(p) { return p <= 0 ? 'vacuum' : p < 1000 ? `${p.toFixed(1)} Pa` : `${(p / 1000).toFixed(1)} kPa`; }
export function fmtSci(x) {
  if (!isFinite(x)) return '—';
  const e = Math.floor(Math.log10(Math.abs(x)));
  return `${(x / 10 ** e).toFixed(2)} × 10^${e}`;
}
