// Small shared helpers. No dependencies.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, u) => a + (b - a) * u;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const h1 = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
export function vnoise(x, y = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = v => v * v * (3 - 2 * v);
  const h = (a, b) => h1(a * 57.31 + b * 131.77);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1), u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// tiny event bus
const L = {};
export const on = (e, f) => (L[e] ??= []).push(f);
export const emit = (e, d) => (L[e] || []).forEach(f => f(d));

export function fmtTime(t, frac = 2) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(frac).padStart(frac ? 3 + frac : 2, '0')}`;
}
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// sample a Float32Array feature (at `rate` frames/sec) at time t, linear interp
export function sampleAt(arr, rate, t) {
  if (!arr || !arr.length) return 0;
  const x = t * rate, i = Math.floor(x);
  if (i < 0) return arr[0];
  if (i >= arr.length - 1) return arr[arr.length - 1];
  const u = x - i; return arr[i] + (arr[i + 1] - arr[i]) * u;
}
// max of a feature over [t0,t1]
export function maxOver(arr, rate, t0, t1) {
  if (!arr) return 0;
  let a = Math.max(0, Math.floor(t0 * rate)), b = Math.min(arr.length - 1, Math.ceil(t1 * rate));
  if (b < a) return sampleAt(arr, rate, t0);
  let m = 0; for (let i = a; i <= b; i++) if (arr[i] > m) m = arr[i];
  return m;
}
// count of sorted values <= t
export function countLE(sorted, t) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= t) lo = m + 1; else hi = m; }
  return lo;
}

let toastT;
export function toast(msg, ms = 2600) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.innerHTML = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}
