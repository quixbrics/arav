// Offline audio analysis, run once per file in a Web Worker.
// Input: {L, R, sr, rate}. Output: feature curves (0..1) at `rate` frames/sec,
// plus a spectrogram, waveform peaks, onsets, BPM/phase, sections and key.
'use strict';
const FFTN = 2048, SB = 96;

function makeFFT(n) {
  const lev = Math.log2(n), rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < lev; b++) r |= ((i >> b) & 1) << (lev - 1 - b); rev[i] = r; }
  const cs = new Float32Array(n / 2), sn = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / n); sn[i] = Math.sin(2 * Math.PI * i / n); }
  return (re, im) => {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
        const l = i + j + half, tr = re[l] * cs[k] + im[l] * sn[k], ti = -re[l] * sn[k] + im[l] * cs[k];
        re[l] = re[i + j] - tr; im[l] = im[i + j] - ti; re[i + j] += tr; im[i + j] += ti;
      }
    }
  };
}

function percentile(arr, ps) {
  const step = Math.max(1, Math.floor(arr.length / 6000)), s = [];
  for (let i = 0; i < arr.length; i += step) if (isFinite(arr[i])) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return ps.map(p => s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : 0);
}
function normalise(arr, lo = 0.05, hi = 0.99) {
  const [a, b] = percentile(arr, [lo, hi]), d = b - a || 1, out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) { const v = (arr[i] - a) / d; out[i] = v < 0 ? 0 : v > 1 ? 1 : v; }
  return out;
}
function smooth(arr, k) { // simple one-pole, forward
  const out = new Float32Array(arr.length); let v = arr[0] || 0;
  for (let i = 0; i < arr.length; i++) { v += (arr[i] - v) * k; out[i] = v; }
  return out;
}
const dB = e => 10 * Math.log10(e + 1e-12);

const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const PN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

function analyse({ L, R, sr, rate }) {
  const len = L.length, mono = new Float32Array(len);
  for (let i = 0; i < len; i++) mono[i] = R ? (L[i] + R[i]) * 0.5 : L[i];
  const hop = sr / rate, n = Math.max(2, Math.floor(len / hop)), half = FFTN / 2, binHz = sr / FFTN;
  const fft = makeFFT(FFTN), re = new Float32Array(FFTN), im = new Float32Array(FFTN), mag = new Float32Array(half);
  const win = new Float32Array(FFTN); for (let i = 0; i < FFTN; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFTN - 1));
  const bin = hz => Math.max(1, Math.min(half - 1, Math.round(hz / binHz)));
  const BANDS = { kick: [40, 120], bass: [60, 250], mid: [250, 2000], high: [6000, Math.min(16000, sr / 2 - 100)] };
  const bandIdx = Object.fromEntries(Object.entries(BANDS).map(([k, [a, b]]) => [k, [bin(a), bin(b)]]));
  const raw = {}; for (const k of ['kick', 'bass', 'mid', 'high', 'cent', 'flat', 'flux', 'rms', 'rmsL', 'rmsR']) raw[k] = new Float32Array(n);
  const pcOf = new Int8Array(half).fill(-1);
  for (let k = 1; k < half; k++) { const f = k * binHz; if (f >= 55 && f <= 2000) pcOf[k] = ((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12; }
  const sEdges = []; for (let b = 0; b <= SB; b++) sEdges.push(bin(30 * Math.pow(16000 / 30, b / SB)));
  const specF = new Float32Array(n * SB), chromaF = new Float32Array(n * 12);
  const prevLog = new Float32Array(half);
  const f0 = bin(100), f1 = bin(10000);

  for (let f = 0; f < n; f++) {
    const c = Math.round(f * hop), s0 = c - FFTN / 2;
    for (let i = 0; i < FFTN; i++) { const idx = s0 + i; re[i] = idx >= 0 && idx < len ? mono[idx] * win[i] : 0; im[i] = 0; }
    fft(re, im);
    let num = 0, den = 0, lg = 0, mn = 0, fl = 0;
    for (let k = 1; k < half; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]); mag[k] = m;
      num += k * binHz * m; den += m;
      if (k >= f0 && k <= f1) { lg += Math.log(m + 1e-9); mn += m; }
      const l = Math.log1p(100 * m), d = l - prevLog[k]; if (d > 0) fl += d; prevLog[k] = l;
      const pc = pcOf[k]; if (pc >= 0) chromaF[f * 12 + pc] += m * m;
    }
    for (const k in bandIdx) { const [a, b] = bandIdx[k]; let e = 0; for (let j = a; j <= b; j++) e += mag[j] * mag[j]; raw[k][f] = dB(e); }
    raw.cent[f] = den > 0 ? Math.log2(num / den + 1) : 0;
    const cnt = f1 - f0 + 1; raw.flat[f] = mn > 0 ? Math.exp(lg / cnt) / (mn / cnt) : 0;
    raw.flux[f] = fl;
    for (let b = 0; b < SB; b++) { let m = 0; for (let j = sEdges[b]; j <= Math.max(sEdges[b], sEdges[b + 1] - 1); j++) if (mag[j] > m) m = mag[j]; specF[f * SB + b] = 20 * Math.log10(m + 1e-9); }
    // time-domain RMS per channel over the hop
    let sl = 0, sr2 = 0, sm = 0; const a = Math.max(0, Math.round(c - hop / 2)), b = Math.min(len, Math.round(c + hop / 2));
    for (let i = a; i < b; i++) { sm += mono[i] * mono[i]; sl += L[i] * L[i]; if (R) sr2 += R[i] * R[i]; }
    const cntT = Math.max(1, b - a);
    raw.rms[f] = dB(sm / cntT); raw.rmsL[f] = sl / cntT; raw.rmsR[f] = R ? sr2 / cntT : sl / cntT;
    if (f % 300 === 0) postMessage({ progress: 0.85 * f / n });
  }

  // ---- normalised features ----
  const F = {};
  F.kick = normalise(raw.kick, 0.1, 0.995);
  F.bass = normalise(raw.bass, 0.08, 0.995);
  F.mid = normalise(raw.mid, 0.05, 0.995);
  F.high = normalise(raw.high, 0.05, 0.995);
  F.loud = normalise(raw.rms, 0.05, 0.995);
  F.bright = normalise(smooth(raw.cent, 0.3), 0.03, 0.98);
  F.noise = normalise(smooth(raw.flat, 0.2), 0.03, 0.98);
  F.pan = new Float32Array(n);
  for (let i = 0; i < n; i++) { const l = Math.sqrt(raw.rmsL[i]), r = Math.sqrt(raw.rmsR[i]); F.pan[i] = 0.5 + 0.5 * (r - l) / (r + l + 1e-9); }
  F.pan = smooth(F.pan, 0.2);
  // silence gating: quiet frames should not read as "bright" or "noisy"
  for (let i = 0; i < n; i++) if (F.loud[i] < 0.02) { F.bright[i] *= F.loud[i] * 50; F.noise[i] *= F.loud[i] * 50; }

  // ---- onsets: spectral flux, adaptive threshold, peak pick ----
  const fx = normalise(raw.flux, 0.0, 0.995), onset = new Float32Array(n), onsetTimes = [];
  const W = Math.round(rate * 0.25), gap = Math.round(rate * 0.07);
  let lastOn = -1e9, acc = 0; const pre = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) { acc += fx[i]; pre[i + 1] = acc; }
  for (let i = 1; i < n - 1; i++) {
    const a = Math.max(0, i - W), b = Math.min(n, i + W + 1), mean = (pre[b] - pre[a]) / (b - a);
    let isMax = true; for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) if (fx[j] > fx[i]) { isMax = false; break; }
    if (isMax && fx[i] > mean * 1.35 + 0.07 && i - lastOn >= gap && F.loud[i] > 0.05) { onset[i] = 1; onsetTimes.push(i / rate); lastOn = i; }
  }
  F.onset = onset;

  // ---- tempo: autocorrelation of the onset-strength envelope ----
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - W), b = Math.min(n, i + W + 1); env[i] = Math.max(0, fx[i] - (pre[b] - pre[a]) / (b - a)); }
  const lagMin = Math.floor(rate * 60 / 200), lagMax = Math.ceil(rate * 60 / 60);
  let best = 0, bestLag = rate * 0.5; const ac = new Float32Array(lagMax + 2);
  const N = Math.min(n, rate * 120);
  for (let l = lagMin; l <= lagMax; l++) {
    let s = 0; for (let i = 0; i + l < N; i++) s += env[i] * env[i + l];
    ac[l] = s;
    const bpm = 60 * rate / l, w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    if (s * w > best) { best = s * w; bestLag = l; }
  }
  let lag = bestLag;
  if (bestLag > lagMin && bestLag < lagMax) { const a = ac[bestLag - 1], b = ac[bestLag], c = ac[bestLag + 1], d = a - 2 * b + c; if (d !== 0) lag = bestLag + 0.5 * (a - c) / d; }
  let bpm = 60 * rate / lag;
  while (bpm < 78) bpm *= 2; while (bpm > 165) bpm /= 2;
  bpm = Math.round(bpm * 10) / 10;
  const L1 = rate * 60 / bpm;
  // phase: beat positions with the most onset energy
  let bestOff = 0, bs = -1;
  for (let off = 0; off < L1; off += 0.25) { let s = 0; for (let x = off; x < n; x += L1) s += env[Math.round(x)] || 0; if (s > bs) { bs = s; bestOff = off; } }
  // downbeat: of the 4 candidate phases, the one with most kick energy
  let down = 0, ds = -1;
  for (let j = 0; j < 4; j++) { let s = 0; for (let x = bestOff + j * L1; x < n; x += 4 * L1) s += F.kick[Math.round(x)] || 0; if (s > ds) { ds = s; down = j; } }
  let beatOffset = (bestOff + down * L1) / rate;
  const barLen = 4 * 60 / bpm; while (beatOffset > barLen) beatOffset -= barLen;
  postMessage({ progress: 0.9 });

  // ---- chroma: per-frame normalised vector + circular "hue" scalar ----
  const chroma = new Uint8Array(n * 12), F_chroma = new Float32Array(n), tot = new Float64Array(12);
  for (let i = 0; i < n; i++) {
    let mx = 0, sx = 0, sy = 0;
    for (let p = 0; p < 12; p++) { const v = chromaF[i * 12 + p]; if (v > mx) mx = v; tot[p] += v; }
    for (let p = 0; p < 12; p++) { const v = mx > 0 ? chromaF[i * 12 + p] / mx : 0; chroma[i * 12 + p] = v * 255; const a = p / 12 * 2 * Math.PI, w = v * v; sx += Math.cos(a) * w; sy += Math.sin(a) * w; }
    F_chroma[i] = ((Math.atan2(sy, sx) / (2 * Math.PI)) + 1) % 1;
  }
  // smooth circular value without wrapping artefacts
  let cs = Math.cos(F_chroma[0] * 6.283), sn = Math.sin(F_chroma[0] * 6.283);
  for (let i = 0; i < n; i++) { cs += (Math.cos(F_chroma[i] * 6.283) - cs) * 0.15; sn += (Math.sin(F_chroma[i] * 6.283) - sn) * 0.15; F_chroma[i] = ((Math.atan2(sn, cs) / 6.283) + 1) % 1; }
  F.chroma = F_chroma;
  let key = '', kb = -1e9;
  for (let r = 0; r < 12; r++) for (const [prof, q] of [[KS_MAJ, ''], [KS_MIN, 'm']]) {
    let s = 0; for (let p = 0; p < 12; p++) s += tot[(p + r) % 12] * prof[p];
    if (s > kb) { kb = s; key = PN[r] + q; }
  }

  // ---- spectrogram to bytes ----
  const [sLo, sHi] = percentile(specF, [0.2, 0.995]);
  const spec = new Uint8Array(n * SB);
  for (let i = 0; i < specF.length; i++) { const v = (specF[i] - sLo) / (sHi - sLo || 1); spec[i] = v < 0 ? 0 : v > 1 ? 255 : v * 255; }

  // ---- waveform peaks (200 / sec) ----
  const pr = 200, pn = Math.ceil(len / sr * pr), peaks = new Float32Array(pn * 2), ps = sr / pr;
  for (let i = 0; i < pn; i++) { let lo = 0, hi = 0; const a = Math.floor(i * ps), b = Math.min(len, Math.floor((i + 1) * ps)); for (let j = a; j < b; j++) { const v = mono[j]; if (v < lo) lo = v; if (v > hi) hi = v; } peaks[i * 2] = lo; peaks[i * 2 + 1] = hi; }

  // ---- sections: novelty on a self-similarity matrix of 0.5 s blocks ----
  const sections = sectionise(F, chroma, n, rate, bpm, beatOffset);

  let sum = 0; for (let i = 0; i < len; i += 4) sum += mono[i] * mono[i];
  const rmsDb = 10 * Math.log10(sum / (len / 4) + 1e-12);
  postMessage({ progress: 1 });
  return { rate, n, duration: len / sr, f: F, chroma, spec, specBins: SB, peaks, peakRate: pr, onsetTimes: Float64Array.from(onsetTimes), bpm, beatOffset, sections, key, rmsDb };
}

function sectionise(F, chroma, n, rate, bpm, off) {
  const dur = n / rate, bl = Math.round(rate * 0.5), B = Math.floor(n / bl);
  if (B < 24) return [{ a: 0, b: dur, e: 0.5 }];
  const keys = ['kick', 'bass', 'mid', 'high', 'loud', 'bright', 'noise'], D = keys.length + 12;
  const X = new Float32Array(B * D);
  for (let i = 0; i < B; i++) {
    for (let k = 0; k < keys.length; k++) { let s = 0; for (let j = 0; j < bl; j++) s += F[keys[k]][i * bl + j]; X[i * D + k] = s / bl; }
    for (let p = 0; p < 12; p++) { let s = 0; for (let j = 0; j < bl; j++) s += chroma[(i * bl + j) * 12 + p]; X[i * D + keys.length + p] = s / bl / 255 * 0.5; }
  }
  const Lk = Math.min(16, Math.floor(B / 4)), nov = new Float32Array(B);
  const dist = (i, j) => { let s = 0; for (let d = 0; d < D; d++) { const v = X[i * D + d] - X[j * D + d]; s += v * v; } return Math.sqrt(s); };
  for (let i = Lk; i < B - Lk; i++) {
    let s = 0;
    for (let a = -Lk; a < Lk; a++) for (let b = -Lk; b < Lk; b++) {
      const sign = (a < 0) === (b < 0) ? 1 : -1, g = Math.exp(-((a + 0.5) ** 2 + (b + 0.5) ** 2) / (2 * (Lk * 0.5) ** 2));
      s += sign * g * -dist(i + a, i + b);
    }
    nov[i] = s;
  }
  let mean = 0, sd = 0; for (let i = 0; i < B; i++) mean += nov[i]; mean /= B; for (let i = 0; i < B; i++) sd += (nov[i] - mean) ** 2; sd = Math.sqrt(sd / B);
  const peaks = [];
  for (let i = Lk; i < B - Lk; i++) {
    let mx = true; for (let j = Math.max(0, i - 8); j <= Math.min(B - 1, i + 8); j++) if (nov[j] > nov[i]) { mx = false; break; }
    if (mx && nov[i] > mean + 0.4 * sd) peaks.push(i);
  }
  const bar = 4 * 60 / bpm;
  let bounds = peaks.map(i => { const t = i * 0.5; const s = Math.round((t - off) / bar) * bar + off; return Math.abs(s - t) < bar ? s : t; });
  bounds = bounds.filter((t, i) => t > 4 && t < dur - 4 && (i === 0 || t - bounds[i - 1] >= 7.5));
  const edges = [0, ...bounds, dur], out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], b = edges[i + 1]; let s = 0, c = 0;
    for (let j = Math.floor(a * rate); j < Math.min(n, Math.floor(b * rate)); j++) { s += F.loud[j] + F.kick[j] * 0.5; c++; }
    out.push({ a, b, e: c ? s / c : 0 });
  }
  const es = out.map(s => s.e), lo = Math.min(...es), hi = Math.max(...es);
  out.forEach(s => s.e = hi > lo ? (s.e - lo) / (hi - lo) : 0.5);
  return out;
}

self.onmessage = e => {
  try {
    const r = analyse(e.data);
    const tr = [r.chroma.buffer, r.spec.buffer, r.peaks.buffer, r.onsetTimes.buffer, ...Object.values(r.f).map(a => a.buffer)];
    postMessage({ result: r }, tr);
  } catch (err) { postMessage({ error: String(err && err.stack || err) }); }
};
