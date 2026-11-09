// Modulation: how audio features become parameter values.
//
// live value = clamp( base + Σ depth × response(signal) )
//   base     = the knob value, or the automation curve if the param is automated
//   response = attack/release smoothing → (trigger | gate | continuous) → curve → range
//
// The response curve for each mapping is computed for the WHOLE track at once
// (it's a cheap loop over ~60 values/sec), so scrubbing, looping and export
// always give the same result as playback.
import { S, RT, SRC_UID, paramDefs, paramStore, autoKey } from './state.js';
import { clamp, sampleAt } from './util.js';
import { sceneValue } from './scenes.js';

export const curveExp = c => Math.pow(4, (c - 0.5) * 2);
export const shape = (m, x) => m.lo + (m.hi - m.lo) * Math.pow(clamp(x), curveExp(m.curve));

const cache = new Map(); // map id -> {key, out}

export function signalArray(sig, src = 'mix') {
  const a = RT.ana[src] || RT.ana.mix;
  return a ? a.f[sig] : null;
}
export function signalAt(sig, src, t) {
  const a = RT.ana[src] || RT.ana.mix;
  return a ? sampleAt(a.f[sig], a.rate, t) : 0;
}

export function responseCurve(m) {
  const a = RT.ana[m.src] || RT.ana.mix;
  if (!a) return null;
  const x = a.f[m.sig];
  const key = [a.id, m.sig, m.src, m.mode, m.atk, m.rel, m.curve, m.lo, m.hi, m.thr, m.inv, (m.sig === 'beat' || m.sig === 'section') ? RT.gridV : 0].join('|');
  const c = cache.get(m.id);
  if (c && c.key === key) return c.out;
  const n = x.length, out = new Float32Array(n), dt = 1 / a.rate;
  const ka = m.atk > 0 ? 1 - Math.exp(-dt / m.atk) : 1, kr = m.rel > 0 ? 1 - Math.exp(-dt / m.rel) : 1;
  const dec = m.rel > 0 ? Math.exp(-dt / m.rel) : 0;
  let env = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    let v = x[i]; if (m.inv) v = 1 - v;
    if (m.mode === 'trig') {
      if (v >= m.thr && prev < m.thr) env = 1; else env *= dec;
    } else {
      const target = m.mode === 'gate' ? (v >= m.thr ? 1 : 0) : v;
      env += (target - env) * (target > env ? ka : kr);
    }
    prev = v;
    out[i] = shape(m, env);
  }
  cache.set(m.id, { key, out });
  return out;
}
export function responseAt(m, t) {
  const a = RT.ana[m.src] || RT.ana.mix;
  const c = responseCurve(m);
  return c ? sampleAt(c, a.rate, t) : 0;
}

export function autoAt(keys, t) {
  if (!keys || !keys.length) return null;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [a, va] = keys[i - 1], [b, vb] = keys[i], u = (t - a) / (b - a || 1), s = u * u * (3 - 2 * u);
    return va + (vb - va) * s;
  }
  return keys[keys.length - 1][1];
}
export function baseValue(id, k, t) {
  const keys = S.auto[autoKey(id, k)];
  if (keys && keys.length) return autoAt(keys, t);
  const sv = sceneValue(id, k, t);
  if (sv !== undefined) return sv;
  return paramStore(id)?.[k] ?? 0;
}

// Evaluate every parameter at time t → RT.vals[uid][k]
export function evalAll(t) {
  const vals = {};
  const ids = [SRC_UID, ...S.stack.map(f => f.uid)];
  for (const id of ids) {
    const o = {}; for (const p of paramDefs(id)) o[p.k] = baseValue(id, p.k, t);
    vals[id] = o;
  }
  for (const m of S.maps) {
    const o = vals[m.fx]; if (!o || o[m.p] === undefined) continue;
    o[m.p] += responseAt(m, t) * m.depth;
  }
  for (const id in vals) for (const k in vals[id]) vals[id][k] = clamp(vals[id][k]);
  RT.vals = vals;
  return vals;
}
export function dropCache(id) { if (id) cache.delete(id); else cache.clear(); }

// live value of one parameter at time t (base + mappings), without evaluating everything
export function liveParam(id, k, t) {
  let v = baseValue(id, k, t);
  for (const m of S.maps) if (m.fx === id && m.p === k) v += responseAt(m, t) * m.depth;
  return clamp(v);
}

// Time Remap: integrate the speed curve over the whole track once, so the
// source clock at any time t is a lookup (scrub / loop / render all agree).
const remapCache = new Map();
export function remapTime(id, t) {
  const a = RT.ana.mix, R = 30, dur = a ? a.duration : 60;
  const key = `${RT.rev}|${a ? a.id : 0}|${RT.gridV}`;
  let c = remapCache.get(id);
  if (!c || c.key !== key) {
    const n = Math.ceil(dur * R) + 2, out = new Float32Array(n), on = a ? a.onsetTimes : [];
    let x = 0, dir = 1, oi = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / R;
      while (oi < on.length && on[oi] <= tt) {
        if (liveParam(id, 'flip', on[oi]) > 0.5) dir = -dir;
        x += liveParam(id, 'jump', on[oi]) * 4;
        oi++;
      }
      out[i] = x;
      const rate = (-1 + 4 * liveParam(id, 'speed', tt)) * (1 - liveParam(id, 'freeze', tt)) * dir;
      x += rate / R;
    }
    c = { key, out }; remapCache.set(id, c);
  }
  return sampleAt(c.out, R, t);
}
