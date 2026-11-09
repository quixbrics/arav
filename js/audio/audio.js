// Audio: decoding, analysis (via worker), playback clock, and a synthesised demo track.
import { clamp } from '../util.js';

let ctx = null;
export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export async function decodeFile(file) {
  const c = audioCtx();
  const bytes = await file.arrayBuffer();
  return await c.decodeAudioData(bytes);
}

export function analyseBuffer(buffer, onProgress) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./analysis-worker.js', import.meta.url));
    const L = buffer.getChannelData(0).slice();
    const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : null;
    w.onmessage = e => {
      const d = e.data;
      if (d.progress !== undefined) onProgress && onProgress(d.progress);
      if (d.result) { w.terminate(); resolve(d.result); }
      if (d.error) { w.terminate(); reject(new Error(d.error)); }
    };
    w.onerror = e => { w.terminate(); reject(new Error(e.message || 'analysis worker failed')); };
    w.postMessage({ L, R, sr: buffer.sampleRate, rate: 60 }, R ? [L.buffer, R.buffer] : [L.buffer]);
  });
}

// Build the curves that depend on the (editable) beat grid and section list.
export function deriveGrid(ana, bpm, offset, sections) {
  const n = ana.n, rate = ana.rate, beat = new Float32Array(n), sec = new Float32Array(n);
  const spb = 60 / bpm;
  for (let i = 0; i < n; i++) { const b = (i / rate - offset) / spb; beat[i] = b - Math.floor(b); }
  const S = sections && sections.length ? sections : [{ a: 0, b: ana.duration }];
  const k = Math.max(1, S.length - 1);
  for (let i = 0, j = 0; i < n; i++) { const t = i / rate; while (j < S.length - 1 && t >= S[j].b) j++; sec[i] = j / k; }
  ana.f.beat = beat; ana.f.section = sec;
}

// ---------------- playback clock ----------------
export const player = {
  buf: null, src: null, gain: null, dest: null, t0: 0, off: 0, playing: false, onEnd: null,
  init() {
    const c = audioCtx();
    if (!this.gain) {
      this.gain = c.createGain(); this.gain.connect(c.destination);
      this.dest = c.createMediaStreamDestination(); this.gain.connect(this.dest);
    }
  },
  setBuffer(b) { const was = this.playing; this.stopSrc(); this.buf = b; this.off = 0; this.playing = false; if (was) this.play(); },
  duration() { return this.buf ? this.buf.duration : 60; },
  time() { return this.playing ? audioCtx().currentTime - this.t0 : this.off; },
  stopSrc() { if (this.src) { this.src.onended = null; try { this.src.stop(); } catch (e) {} this.src.disconnect(); this.src = null; } },
  play() {
    this.init(); const c = audioCtx(); c.resume();
    this.stopSrc();
    if (this.off >= this.duration() - 0.01) this.off = 0;
    if (this.buf) {
      this.src = c.createBufferSource(); this.src.buffer = this.buf; this.src.connect(this.gain);
      this.src.start(0, this.off);
    }
    this.t0 = c.currentTime - this.off; this.playing = true;
  },
  pause() { if (!this.playing) return; this.off = clamp(this.time(), 0, this.duration()); this.stopSrc(); this.playing = false; },
  seek(t) { t = clamp(t, 0, this.duration()); if (this.playing) { this.off = t; this.play(); } else this.off = t; },
};

// ---------------- demo track ----------------
// A 52-bar, 124 BPM electronic sketch synthesised in plain JS (fast, deterministic),
// with clear sections — intro / build / drop / break / drop / outro — so every
// signal has something to show.
export async function synthDemo() {
  const sr = 44100, bpm = 124, spb = 60 / bpm, bar = spb * 4, bars = 52, dur = bars * bar + 1.5, N = Math.ceil(dur * sr);
  const L = new Float32Array(N), R = new Float32Array(N);
  let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const lpA = fc => 1 - Math.exp(-2 * Math.PI * Math.min(fc, sr * 0.45) / sr);
  const gains = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
  const voice = (t, len, pan, fn) => { const i0 = Math.round(t * sr), n = Math.min(N - i0, Math.round(len * sr)), [gl, gr] = gains(pan); for (let j = 0; j < n; j++) { const v = fn(j, j / sr); L[i0 + j] += v * gl; R[i0 + j] += v * gr; } };
  const sec = b => (b < 8 ? 'intro' : b < 16 ? 'build' : b < 32 ? 'drop' : b < 40 ? 'break' : b < 48 ? 'drop2' : 'outro');
  const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], ROOT = [45, 41, 36, 43];

  const kick = t => { let ph = 0; voice(t, 0.45, 0, (j, x) => { ph += 2 * Math.PI * (42 + 118 * Math.exp(-x / 0.035)) / sr; return Math.sin(ph) * Math.exp(-x / 0.13) * 0.95; }); };
  const hat = (t, open, pan) => { let lp = 0; const d = open ? 0.07 : 0.014; voice(t, open ? 0.3 : 0.08, pan, (j, x) => { const n = rnd(); lp += (n - lp) * 0.55; return (n - lp) * Math.exp(-x / d) * 0.3; }); };
  const snare = t => { let lp = 0, lp2 = 0; voice(t, 0.3, 0.05, (j, x) => { const n = rnd(); lp += (n - lp) * lpA(5000); lp2 += (lp - lp2) * lpA(900); return ((lp - lp2) * 1.4 * Math.exp(-x / 0.07) + Math.sin(2 * Math.PI * 190 * x) * 0.35 * Math.exp(-x / 0.035)); }); };
  const bass = (t, m, len) => { let ph = 0, y1 = 0, y2 = 0; const f = mtof(m); voice(t, len, 0, (j, x) => { ph = (ph + f / sr) % 1; const s = 2 * ph - 1, a = lpA(220 + 900 * Math.exp(-x / (len * 0.35))); y1 += (s - y1) * a; y2 += (y1 - y2) * a; return y2 * Math.min(1, x / 0.005) * Math.exp(-x / (len * 0.8)) * 0.42; }); };
  const pad = (t, notes, len, cut, duck) => {
    const fs = []; notes.forEach(m => [0.996, 1.004].forEach(d => fs.push(mtof(m) * d))); const ph = fs.map(() => Math.random());
    let y1 = 0, y2 = 0; const a = lpA(cut);
    voice(t, len, 0, (j, x) => {
      let s = 0; for (let k = 0; k < fs.length; k++) { ph[k] = (ph[k] + fs[k] / sr) % 1; s += 2 * ph[k] - 1; }
      y1 += (s - y1) * a; y2 += (y1 - y2) * a;
      let env = Math.min(1, x / 0.6) * Math.min(1, (len - x) / 0.3);
      if (duck) { const bp = (x / spb) % 1; env *= 1 - 0.75 * Math.exp(-bp * spb / 0.12); }
      return y2 * env * 0.05;
    });
  };
  const pluck = (t, m, pan, bright) => { let ph = 0, y = 0; const f = mtof(m); voice(t, 0.25, pan, (j, x) => { ph = (ph + f / sr) % 1; const s = ph < 0.5 ? 1 : -1; y += (s - y) * lpA(400 + (800 + bright * 5000) * Math.exp(-x / 0.05)); return y * Math.exp(-x / 0.06) * 0.14; }); };
  const riser = (t0, t1) => { let lp = 0, lp2 = 0; const len = t1 - t0; voice(t0, len, 0, (j, x) => { const u = x / len, fc = 300 * Math.pow(30, u); const n = rnd(); lp += (n - lp) * lpA(fc * 1.5); lp2 += (lp - lp2) * lpA(fc * 0.6); return (lp - lp2) * u * u * 0.6; }); };
  const crash = t => { let lp = 0; voice(t, 1.8, -0.2, (j, x) => { const n = rnd(); lp += (n - lp) * 0.4; return (n - lp) * Math.exp(-x / 0.45) * 0.22; }); };

  for (let b = 0; b < bars; b++) {
    const t = b * bar, s = sec(b), ci = Math.floor(b / 2) % 4, drop = s === 'drop' || s === 'drop2';
    if (b % 2 === 0) pad(t, CH[ci], bar * 2, drop ? 2600 : s === 'build' ? 700 + (b - 8) * 220 : 650, drop);
    if (b === 16 || b === 40) crash(t);
    if (b === 14 || b === 38) riser(t, t + bar * 2);
    for (let q = 0; q < 16; q++) {
      const tq = t + q * spb / 4, beat = q % 4 === 0;
      const kickOn = drop || s === 'build' || (s === 'outro' && b < 50);
      if (beat && kickOn && !(s === 'build' && b === 15 && q >= 8)) kick(tq);
      if (s === 'build' && b === 15 && q >= 8) kick(tq);
      if (drop && (q === 4 || q === 12)) snare(tq);
      if (s !== 'intro' || b >= 4) { if (q % 4 === 2) hat(tq, drop, 0.3); else if (q % 2 === 1 && s !== 'break' && s !== 'outro') hat(tq, false, -0.35); }
      if (drop && q % 2 === 1) bass(tq, ROOT[ci] + (q === 7 || q === 15 ? 12 : 0), spb / 2 * 0.9);
      if (s === 'build' && q % 4 === 2) bass(tq, ROOT[ci], spb * 0.4);
      if (s === 'drop2' || (s === 'drop' && b >= 24) || (s === 'break' && q % 2 === 0)) {
        const m = CH[ci][q % 3] + (q % 8 >= 4 ? 12 : 0);
        pluck(tq, m, Math.sin(q / 16 * Math.PI * 2) * 0.8, s === 'break' ? (b - 32) / 8 : 0.8);
      }
    }
  }
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 1.1 / (peak || 1);
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * g); R[i] = Math.tanh(R[i] * g); }
  const buf = audioCtx().createBuffer(2, N, sr);
  buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
  return buf;
}

// ---------------- spatial (ambisonic) ----------------
// AZIM / ELEV curves. With a first-order AmbiX buffer (ACN: W Y Z X, SN3D) they
// come from the sound field's intensity vector; otherwise AZIM follows stereo pan.
export function addSpatial(ana, ambi) {
  const n = ana.n, rate = ana.rate, azim = new Float32Array(n), elev = new Float32Array(n).fill(0.5);
  if (ambi && ambi.numberOfChannels >= 4) {
    const W = ambi.getChannelData(0), Y = ambi.getChannelData(1), Z = ambi.getChannelData(2), X = ambi.getChannelData(3), hop = ambi.sampleRate / rate;
    let sx = 0, sy = 0, sz = 0;
    for (let f = 0; f < n; f++) {
      let ix = 0, iy = 0, iz = 0; const a = Math.floor(f * hop), b = Math.min(W.length, Math.floor((f + 1) * hop));
      for (let i = a; i < b; i++) { ix += W[i] * X[i]; iy += W[i] * Y[i]; iz += W[i] * Z[i]; }
      sx += (ix - sx) * 0.25; sy += (iy - sy) * 0.25; sz += (iz - sz) * 0.25;
      azim[f] = 0.5 + Math.atan2(sy, sx) / (2 * Math.PI);
      elev[f] = 0.5 + Math.atan2(sz, Math.hypot(sx, sy)) / Math.PI;
    }
    ana.ambisonic = true;
  } else {
    for (let f = 0; f < n; f++) azim[f] = 0.5 - (ana.f.pan[f] - 0.5) * 0.5;   // pan right → azimuth −90°
  }
  ana.f.azim = azim; ana.f.elev = elev;
}
// stereo monitor mix of an AmbiX buffer (for listening and for the regular analysis)
export function ambiToStereo(b) {
  const W = b.getChannelData(0), Y = b.getChannelData(1), out = audioCtx().createBuffer(2, b.length, b.sampleRate);
  const L = new Float32Array(b.length), R = new Float32Array(b.length);
  for (let i = 0; i < b.length; i++) { L[i] = W[i] * 0.7 + Y[i] * 0.5; R[i] = W[i] * 0.7 - Y[i] * 0.5; }
  out.copyToChannel(L, 0); out.copyToChannel(R, 1); return out;
}
