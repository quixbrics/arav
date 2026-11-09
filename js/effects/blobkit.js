// Shared blob detection, tracking and "surveillance UI" drawing for
// Blob Callouts and Motion Boxes. Runs on a small CPU copy of the frame.
import { clamp } from '../util.js';

// connected components (4-neighbour) on a 0/1 mask, union-find
export function findBlobs(mask, w, h, minArea) {
  const lab = new Int32Array(w * h).fill(-1), parent = [];
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!mask[i]) continue;
    const l = x > 0 ? lab[i - 1] : -1, u = y > 0 ? lab[i - w] : -1;
    if (l < 0 && u < 0) { lab[i] = parent.length; parent.push(parent.length); }
    else if (l >= 0 && u >= 0) { const a = find(l), b = find(u); lab[i] = Math.min(a, b); parent[Math.max(a, b)] = Math.min(a, b); }
    else lab[i] = l >= 0 ? l : u;
  }
  const B = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (lab[i] < 0) continue;
    const r = find(lab[i]); let b = B.get(r);
    if (!b) { b = { x0: x, y0: y, x1: x, y1: y, sx: 0, sy: 0, n: 0 }; B.set(r, b); }
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    b.sx += x; b.sy += y; b.n++;
  }
  // to normalised top-left coordinates (probe rows are bottom-up)
  return [...B.values()].filter(b => b.n >= minArea && b.n < w * h * 0.5).map(b => ({
    x: b.x0 / w, y: 1 - (b.y1 + 1) / h, w: (b.x1 - b.x0 + 1) / w, h: (b.y1 - b.y0 + 1) / h,
    cx: (b.sx / b.n + 0.5) / w, cy: 1 - (b.sy / b.n + 0.5) / h, area: b.n,
  })).sort((a, b) => b.area - a.area);
}

// match new blobs to existing tracks (greedy nearest), smooth, keep IDs
export function track(st, blobs, max, smooth, hold) {
  st.tracks = st.tracks || []; st.nextId = st.nextId || 1;
  const T = st.tracks, used = new Set();
  for (const tr of T) tr.seen = false;
  for (const b of blobs.slice(0, max)) {
    let best = null, bd = 0.15;
    for (const tr of T) { if (used.has(tr)) continue; const d = Math.hypot(tr.cx - b.cx, tr.cy - b.cy); if (d < bd) { bd = d; best = tr; } }
    if (best) {
      used.add(best); const k = 1 - smooth * 0.9;
      for (const key of ['x', 'y', 'w', 'h', 'cx', 'cy']) best[key] += (b[key] - best[key]) * k;
      best.area = b.area; best.seen = true; best.miss = 0; best.age++;
    } else { const tr = { ...b, id: st.nextId++, seen: true, miss: 0, age: 0 }; T.push(tr); used.add(tr); }
  }
  for (const tr of T) if (!tr.seen) tr.miss++;
  st.tracks = T.filter(tr => tr.miss <= hold).sort((a, b) => b.area - a.area).slice(0, max + 4);
  return st.tracks.filter(tr => tr.miss === 0 || tr.miss <= hold).slice(0, max);
}

const fmtHz = f => f >= 1000 ? (f / 1000).toFixed(1) + 'kHz' : Math.round(f) + 'Hz';
// the analysis spectrum at time t, at the frequency for horizontal position x
function specAt(fr, x) {
  const a = fr.ana; if (!a) return null;
  const hz = 30 * Math.pow(16000 / 30, clamp(x));
  const i = Math.max(0, Math.min(a.n - 1, Math.round(fr.t * a.rate))), b = Math.min(a.specBins - 1, Math.floor(clamp(x) * a.specBins));
  return { hz, db: -60 + a.spec[i * a.specBins + b] / 255 * 60 };
}

export function drawCallouts(ctx, W, H, tr, p, fr, prefix) {
  ctx.clearRect(0, 0, W, H);
  const k = H / 1080, fs = Math.round(15 * k * (0.8 + p.text * 0.8));
  const lock = p.lock > 0.3, hue = Math.round(p.hue * 360);
  const col = lock ? `hsla(350,100%,62%,${0.75 + p.lock * 0.25})` : `hsla(${hue},100%,70%,0.95)`;
  const dim = `hsla(${hue},100%,70%,0.3)`;
  ctx.font = `500 ${fs}px "JetBrains Mono", monospace`; ctx.textBaseline = 'middle';
  // constellation links
  if (p.links > 0.01 && tr.length > 1) {
    ctx.strokeStyle = `hsla(${hue},100%,70%,${p.links * 0.5})`; ctx.lineWidth = 1 * k; ctx.setLineDash([4 * k, 6 * k]);
    ctx.beginPath(); tr.forEach((b, i) => { const x = b.cx * W, y = b.cy * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
  }
  tr.forEach((b, i) => {
    const pad = 0.006 + p.pad * 0.03, jit = p.jitter * 0.01;
    const jx = (Math.sin(fr.t * 37 + b.id * 3.1) * jit), jy = (Math.cos(fr.t * 31 + b.id * 1.7) * jit);
    const pulse = lock ? 1 + p.lock * 0.15 : 1;
    let x0 = (b.x - pad + jx) * W, y0 = (b.y - pad + jy) * H, bw = (b.w + pad * 2) * W, bh = (b.h + pad * 2) * H;
    const cxp = x0 + bw / 2, cyp = y0 + bh / 2; bw *= pulse; bh *= pulse; x0 = cxp - bw / 2; y0 = cyp - bh / 2;
    const L = Math.min(bw, bh) * 0.25 + 6 * k;
    ctx.lineWidth = (1.5 + p.lock * 2) * k; ctx.strokeStyle = col;
    ctx.beginPath();
    [[x0, y0, 1, 1], [x0 + bw, y0, -1, 1], [x0, y0 + bh, 1, -1], [x0 + bw, y0 + bh, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); });
    ctx.stroke();
    if (p.frame > 0.01) { ctx.strokeStyle = dim; ctx.lineWidth = k; ctx.strokeRect(x0, y0, bw, bh); }
    const c = 7 * k; ctx.strokeStyle = col; ctx.lineWidth = 1.2 * k;
    ctx.beginPath(); ctx.moveTo(b.cx * W - c, b.cy * H); ctx.lineTo(b.cx * W + c, b.cy * H); ctx.moveTo(b.cx * W, b.cy * H - c); ctx.lineTo(b.cx * W, b.cy * H + c); ctx.stroke();
    // label
    const mode = p.labels < 0.34 ? 'data' : p.labels < 0.67 ? 'coords' : 'id';
    const id = `${prefix}_${String(b.id).padStart(2, '0')}`;
    let txt = id;
    if (mode === 'data') { const s = specAt(fr, b.cx); txt = s ? `${id}  ${fmtHz(s.hz)}  ${s.db.toFixed(0)}dB` : id; }
    else if (mode === 'coords') txt = `${id}  X${b.cx.toFixed(2)} Y${(1 - b.cy).toFixed(2)}  A${b.area}`;
    const tw = ctx.measureText(txt).width, right = b.cx < 0.7;
    const lx = right ? x0 + bw + 22 * k : x0 - 22 * k - tw - 12 * k, ly = y0 - 14 * k - (i % 2) * fs * 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = k;
    ctx.beginPath(); ctx.moveTo(right ? x0 + bw : x0, y0); ctx.lineTo(right ? lx : lx + tw + 12 * k, ly); ctx.lineTo(right ? lx + 6 * k : lx + tw + 6 * k, ly); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(lx, ly - fs * 0.75, tw + 12 * k, fs * 1.5);
    ctx.fillStyle = col; ctx.fillText(txt, lx + 6 * k, ly);
    if (lock) { ctx.fillStyle = col; ctx.fillText('LOCK', x0, y0 + bh + fs); }
  });
}

export const CALLOUT_PARAMS = [
  { k: 'boxes', n: 'Max boxes', v: 0.4 },
  { k: 'minsize', n: 'Min size', v: 0.2 },
  { k: 'smooth', n: 'Smoothing', v: 0.5 },
  { k: 'lock', n: 'Lock-on', v: 0.0 },
  { k: 'labels', n: 'Data·XY·ID', v: 0.0 },
  { k: 'links', n: 'Links', v: 0.4 },
  { k: 'pad', n: 'Padding', v: 0.3 },
  { k: 'jitter', n: 'Jitter', v: 0.1 },
  { k: 'text', n: 'Text size', v: 0.3 },
  { k: 'frame', n: 'Full frame', v: 0.0 },
  { k: 'hue', n: 'Colour', v: 0.38 },
  { k: 'mono', n: 'Mono image', v: 0.0 },
];
export const CALLOUT_GLSL = /* glsl */`
vec4 effect(vec2 uv){
  vec3 c = src(uv).rgb;
  c = mix(c, vec3(luma(c)) * vec3(0.85, 1.0, 0.9), p_mono);
  vec4 ov = texture(uOverlay, uv);
  return vec4(mix(c, ov.rgb, ov.a), 1.0);
}`;
