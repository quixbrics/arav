// Timeline: ruler, sections + markers, waveform, spectrogram, signal lanes, automation lanes.
import { S, RT, duration, grid, commit, autoKey, paramDefs, fxName } from '../state.js';
import { SIG, SIGS } from '../signals.js';
import { autoAt, baseValue } from '../mod.js';
import { $, clamp, maxOver, esc, toast } from '../util.js';
import { menu } from './modals.js';
import { addCue, FADES } from '../scenes.js';

export const TL = { v0: 0, v1: 60, zoom: 'fit', snap: true, dirty: true, specKey: null, spec: null };
let W = 0, lanesSig = '', LANES = [];
let seekFn = () => {};

const SEC_COL = e => { const a = [[45, 111, 138], [163, 122, 42], [194, 65, 59]]; const u = clamp(e) * 2, i = Math.min(1, Math.floor(u)), f = u - i; return `rgb(${a[i].map((c, j) => Math.round(c + (a[i + 1][j] - c) * f)).join(',')})`; };
export const sectionName = (i, s) => S.sectionNames[i] || `${String.fromCharCode(65 + (i % 26))} · ${s.e > 0.66 ? 'HIGH' : s.e > 0.33 ? 'MID' : 'LOW'}`;
export const sectionColor = s => SEC_COL(s.e);

function buildLanes() {
 const L = [{ id: 'ruler', h: 18 }, { id: 'sections', h: 24, n: 'SECTIONS' }];
  if (S.scenes.length) L.push({ id: 'scenes', h: 22, n: 'SCENE CUES' + (S.scenesOn ? '' : ' (off)'), c: '#ff7a3d' });
  L.push({ id: 'wave', h: 40, n: 'WAVEFORM', c: '#d9dce1' }, { id: 'spec', h: 52, n: 'SPECTRUM' });
  S.lanes.forEach((l, i) => { if (SIG[l.sig]) L.push({ id: 'sig', i, sig: l.sig, src: l.src, h: l.sig === 'onset' ? 18 : 26, n: SIG[l.sig].n + (l.src !== 'mix' ? ' · ' + l.src.toUpperCase() : ''), c: SIG[l.sig].c, rm: true }); });
  for (const k of Object.keys(S.auto)) {
    const [id, p] = k.split(':'), def = paramDefs(id).find(d => d.k === p);
    if (!def) continue;
    L.push({ id: 'auto', key: k, fx: id, p, h: 46, n: 'A · ' + fxName(id).split(' ')[0] + ' › ' + def.n, c: '#b98cff', rm: true });
  }
  let y = 0; L.forEach(l => { l.y = y; y += l.h; });
  return L;
}
function renderLabels() {
  const sig = JSON.stringify(LANES.map(l => [l.n, l.h]));
  if (sig === lanesSig) return; lanesSig = sig;
  $('#tlLabels').innerHTML = LANES.map((l, j) => `<div style="height:${l.h}px" title="${esc(l.n || '')}"><span>${l.c ? `<i style="background:${l.c}"></i>` : ''}${esc(l.n || '')}</span>${l.rm ? `<button data-rm="${j}" title="Remove lane">✕</button>` : ''}</div>`).join('');
  $('#tlLabels').querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    const l = LANES[+b.dataset.rm];
    if (l.id === 'sig') S.lanes.splice(l.i, 1); else if (l.id === 'auto') delete S.auto[l.key];
    commit('timeline');
  });
}

const tx = t => (t - TL.v0) / (TL.v1 - TL.v0) * W;
const xt = x => TL.v0 + x / W * (TL.v1 - TL.v0);
export function snapT(t) {
  if (!TL.snap || !RT.ana.mix) return t;
  const g = grid(), spb = 60 / g.bpm; return g.offset + Math.round((t - g.offset) / spb) * spb;
}

function specCanvas(a) {
  if (TL.specKey === a.id) return TL.spec;
  const cols = Math.min(a.n, 16000), c = document.createElement('canvas'); c.width = cols; c.height = a.specBins;
  const x = c.getContext('2d'), img = x.createImageData(cols, a.specBins);
  const lut = []; const st = [[0, [6, 7, 12]], [.25, [48, 18, 82]], [.5, [170, 40, 90]], [.75, [250, 120, 40]], [1, [255, 240, 160]]];
  for (let v = 0; v < 256; v++) { const u = v / 255; let k = 1; while (k < 4 && u > st[k][0]) k++; const [a0, ca] = st[k - 1], [b0, cb] = st[k], f = (u - a0) / (b0 - a0); lut.push(ca.map((c, j) => c + (cb[j] - c) * f)); }
  for (let i = 0; i < cols; i++) {
    const fi = Math.floor(i / cols * a.n);
    for (let b = 0; b < a.specBins; b++) { const v = a.spec[fi * a.specBins + b], o = ((a.specBins - 1 - b) * cols + i) * 4, c = lut[v]; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  TL.specKey = a.id; TL.spec = c; return c;
}

export function drawTimeline() {
  const lanes = $('#lanes'), cv = $('#tlc'), dpr = devicePixelRatio || 1;
  LANES = buildLanes(); renderLabels();
  W = lanes.clientWidth; if (!W) return;
  const Ht = LANES.reduce((s, l) => s + l.h, 0);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Ht * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Ht * dpr); cv.style.height = Ht + 'px'; lanes.style.height = Ht + 'px'; }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Ht);
  const a = RT.ana.mix, dur = duration();
  $('#tlEmpty').innerHTML = a ? '' : `<div>${RT.analysing ? `${esc(RT.analysing.label)}… ${Math.round(RT.analysing.p * 100)}%` : 'No audio yet. Drop a track on the window, or press <b>Load demo track</b> in the Media panel.'}</div>`;
  const g = grid(), spb = 60 / g.bpm, bar = spb * 4;
  for (const L of LANES) {
    const y = L.y, h = L.h;
    x.fillStyle = '#15181c'; x.fillRect(0, y + h - 1, W, 1);
    if (L.id === 'ruler') {
      x.fillStyle = '#0b0c0f'; x.fillRect(0, y, W, h - 1);
      x.font = '500 8.5px JetBrains Mono';
      const pxBar = W / ((TL.v1 - TL.v0) / bar); let every = 1; while (pxBar * every < 28) every *= 2;
      const b0 = Math.floor((TL.v0 - g.offset) / bar) - 1, b1 = Math.ceil((TL.v1 - g.offset) / bar) + 1;
      for (let b = b0; b <= b1; b++) {
        const t = g.offset + b * bar, px = tx(t); if (px < -2 || px > W + 2) continue;
        if (b % every === 0) { x.fillStyle = '#4b515a'; x.fillRect(px, y + 6, 1, 12); x.fillStyle = '#7a818c'; if (b >= 0) x.fillText(b + 1, px + 3, y + 12); }
        else if (pxBar > 6) { x.fillStyle = '#262a31'; x.fillRect(px, y + 13, 1, 5); }
        if (pxBar > 60) for (let q = 1; q < 4; q++) { x.fillStyle = '#1d2026'; x.fillRect(tx(t + q * spb), y + 15, 1, 3); }
      }
    } else if (L.id === 'sections') {
      if (a) a.sections.forEach((s, i) => {
        const p0 = tx(s.a), p1 = tx(s.b); if (p1 < 0 || p0 > W) return;
        const col = sectionColor(s); x.globalAlpha = .35; x.fillStyle = col; x.fillRect(p0 + 1, y + 3, p1 - p0 - 2, h - 7); x.globalAlpha = 1;
        x.fillStyle = col; x.fillRect(p0 + 1, y + 3, 2, h - 7);
        x.save(); x.beginPath(); x.rect(p0, y, p1 - p0, h); x.clip();
        x.fillStyle = '#e8eaee'; x.font = '600 9px JetBrains Mono'; x.fillText(sectionName(i, s), Math.max(p0, 0) + 7, y + 15); x.restore();
      });
      S.markers.forEach(m => { const p = tx(m.t); if (p < -40 || p > W) return; x.fillStyle = '#fff'; x.fillRect(p, y, 1, Ht - y); x.fillRect(p, y + 2, 6, 6); x.font = '500 8.5px JetBrains Mono'; x.fillText(m.name, p + 8, y + 9); });
    } else if (L.id === 'scenes') {
      x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(0, y, W, h - 1);
      const spb2 = 60 / g.bpm;
      S.cues.forEach((c, i) => {
        const sc = S.scenes.find(q => q.id === c.scene); if (!sc) return;
        const t1 = i < S.cues.length - 1 ? S.cues[i + 1].t : dur, p0 = tx(c.t), p1 = tx(t1); if (p1 < 0 || p0 > W) return;
        const pf = tx(c.t + c.fade * spb2);
        const gr = x.createLinearGradient(p0, 0, Math.max(p0 + 1, pf), 0); gr.addColorStop(0, sc.c + '10'); gr.addColorStop(1, sc.c + (S.scenesOn ? '66' : '30'));
        x.fillStyle = gr; x.fillRect(p0, y + 3, p1 - p0 - 1, h - 7);
        x.fillStyle = sc.c; x.fillRect(p0, y + 1, 2, h - 3);
        x.save(); x.beginPath(); x.rect(p0, y, p1 - p0, h); x.clip();
        x.fillStyle = '#fff'; x.font = '600 9px JetBrains Mono'; x.fillText(sc.name + (c.fade ? `  ⟋${c.fade}` : ''), Math.max(p0, 0) + 6, y + 14); x.restore();
      });
      if (!S.cues.length) { x.fillStyle = '#4b515a'; x.font = '500 9px JetBrains Mono'; x.fillText('click here to cue a scene · or right-click a section', 8, y + 14); }
    } else if (L.id === 'wave') {
      if (a) {
        const mid = y + h / 2, pr = a.peakRate, pk = a.peaks, n = pk.length / 2;
        for (let i = 0; i < W; i++) {
          const t0 = xt(i), t1 = xt(i + 1); let i0 = Math.floor(t0 * pr), i1 = Math.max(i0 + 1, Math.floor(t1 * pr)); if (i1 <= 0 || i0 >= n) continue;
          let lo = 0, hi = 0; for (let j = Math.max(0, i0); j < Math.min(n, i1); j++) { if (pk[j * 2] < lo) lo = pk[j * 2]; if (pk[j * 2 + 1] > hi) hi = pk[j * 2 + 1]; }
          const sec = a.sections.find(s => t0 < s.b) || a.sections[a.sections.length - 1];
          x.fillStyle = sec ? sectionColor(sec) : '#888'; x.fillRect(i, mid - hi * h * .48, 1, Math.max(1, (hi - lo) * h * .48));
        }
      }
    } else if (L.id === 'spec') {
      if (a) { const c = specCanvas(a), sx = TL.v0 / a.duration * c.width, sw = (TL.v1 - TL.v0) / a.duration * c.width; x.imageSmoothingEnabled = true; x.drawImage(c, sx, 0, sw, c.height, 0, y, W, h - 1); }
    } else if (L.id === 'sig') {
      const an = RT.ana[L.src] || a; if (!an) continue; const arr = an.f[L.sig];
      if (L.sig === 'onset') { x.fillStyle = L.c; for (let i = 0; i < W; i++) if (maxOver(arr, an.rate, xt(i), xt(i + 1)) > 0.5) x.fillRect(i, y + 3, 1, h - 7); }
      else {
        x.fillStyle = L.c + '30'; x.strokeStyle = L.c; x.lineWidth = 1; x.beginPath(); x.moveTo(0, y + h - 2);
        const vals = new Float32Array(W); for (let i = 0; i < W; i++) vals[i] = L.sig === 'chroma' || L.sig === 'beat' || L.sig === 'pan' || L.sig === 'section' ? (arr[Math.min(arr.length - 1, Math.max(0, Math.floor(xt(i) * an.rate)))] || 0) : maxOver(arr, an.rate, xt(i), xt(i + 1));
        for (let i = 0; i < W; i++) x.lineTo(i, y + h - 3 - vals[i] * (h - 6)); x.lineTo(W, y + h - 2); x.closePath(); x.fill();
        x.beginPath(); for (let i = 0; i < W; i++) x[i ? 'lineTo' : 'moveTo'](i, y + h - 3 - vals[i] * (h - 6)); x.stroke();
      }
    } else if (L.id === 'auto') {
      const keys = S.auto[L.key], ty = v => y + h - 5 - v * (h - 10);
      x.fillStyle = '#b98cff14'; x.fillRect(0, y, W, h - 1);
      x.strokeStyle = '#b98cff'; x.lineWidth = 1.5; x.beginPath();
      for (let i = 0; i <= W; i += 2) x[i ? 'lineTo' : 'moveTo'](i, ty(autoAt(keys, xt(i))));
      x.stroke();
      keys.forEach(([t, v]) => { const p = tx(t); if (p < -5 || p > W + 5) return; x.fillStyle = '#0e1013'; x.strokeStyle = '#fff'; x.beginPath(); x.arc(p, ty(v), 3.5, 0, 7); x.fill(); x.stroke(); });
    }
  }
  // loop / end shade
  const pe = tx(dur); if (pe < W) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(pe, 0, W - pe, Ht); }
  TL.dirty = false;
}

export function updatePlayhead(t) {
  const p = tx(t);
  $('#tlPlay').style.left = p + 'px';
  $('#tlPlay').style.display = p < 0 || p > W ? 'none' : '';
  if (TL.zoom !== 'fit' && RT.playing && (t > TL.v1 - (TL.v1 - TL.v0) * 0.05 || t < TL.v0)) { const span = TL.v1 - TL.v0; TL.v0 = Math.max(0, t - span * 0.1); TL.v1 = TL.v0 + span; TL.dirty = true; }
}

export function setZoom(z) {
  TL.zoom = z; const dur = duration();
  if (z === 'fit') { TL.v0 = 0; TL.v1 = dur; }
  else { const span = +z * 4 * 60 / grid().bpm; TL.v0 = clamp(RT.t - span * 0.25, 0, Math.max(0, dur - span)); TL.v1 = TL.v0 + span; }
  document.querySelectorAll('#tlZoom button').forEach(b => b.classList.toggle('on', b.dataset.z === z));
  TL.dirty = true;
}

export function initTimeline(seek) {
  seekFn = seek;
  const lanes = $('#lanes'); let drag = null;
  const loc = e => { const r = lanes.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const laneAt = y => LANES.find(l => y >= l.y && y < l.y + l.h);
  const keyHit = (L, p) => S.auto[L.key].findIndex(([t, v]) => Math.hypot(tx(t) - p.x, L.y + L.h - 5 - v * (L.h - 10) - p.y) < 7);
  lanes.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const p = loc(e), L = laneAt(p.y);
    if (L && L.id === 'auto') {
      const keys = S.auto[L.key]; let k = keyHit(L, p);
      if (e.altKey && k >= 0) { keys.splice(k, 1); if (!keys.length) delete S.auto[L.key]; commit('auto'); return; }
      if (k < 0) { const t = clamp(snapT(xt(p.x)), 0, duration()), v = clamp((L.y + L.h - 5 - p.y) / (L.h - 10)); keys.push([t, v]); keys.sort((a, b) => a[0] - b[0]); k = keys.findIndex(q => q[0] === t && q[1] === v); }
      drag = { auto: L, k, key: keys[k] }; lanes.setPointerCapture(e.pointerId); TL.dirty = true; return;
    }
    if (L && L.id === 'scenes') {
      const ci = S.cues.findIndex(c => Math.abs(tx(c.t) - p.x) < 6);
      if (ci >= 0 && e.altKey) { S.cues.splice(ci, 1); commit('scenes'); return; }
      if (ci >= 0) { drag = { cue: S.cues[ci] }; lanes.setPointerCapture(e.pointerId); return; }
      const t = clamp(snapT(xt(p.x)), 0, duration());
      menu(null, S.scenes.map(sc => ({ label: `Cue “${sc.name}” here`, fn: () => { addCue(t, sc.id, 2); commit('scenes'); } })), { x: e.clientX, y: e.clientY });
      return;
    }
    if (L && L.id === 'sections') {
      const mi = S.markers.findIndex(m => Math.abs(tx(m.t) - p.x) < 5);
      if (mi >= 0 && e.altKey) { S.markers.splice(mi, 1); commit('timeline'); return; }
    }
    drag = { seek: true }; seekFn(clamp(xt(p.x), 0, duration())); lanes.setPointerCapture(e.pointerId);
  });
  lanes.addEventListener('pointermove', e => {
    if (!drag) return; const p = loc(e);
    if (drag.seek) { seekFn(clamp(xt(p.x), 0, duration())); return; }
    if (drag.cue) { drag.cue.t = clamp(snapT(xt(p.x)), 0, duration()); drag.moved = true; TL.dirty = true; return; }
    const L = drag.auto, keys = S.auto[L.key], i = keys.indexOf(drag.key);
    const lo = i > 0 ? keys[i - 1][0] + 0.01 : 0, hi = i < keys.length - 1 ? keys[i + 1][0] - 0.01 : duration();
    drag.key[0] = clamp(snapT(xt(p.x)), lo, hi); drag.key[1] = clamp((L.y + L.h - 5 - p.y) / (L.h - 10));
    TL.dirty = true;
  });
  lanes.addEventListener('pointerup', () => { if (drag && drag.auto) commit('auto'); if (drag && drag.cue && drag.moved) { S.cues.sort((a, b) => a.t - b.t); commit('scenes'); } drag = null; });
  lanes.addEventListener('dblclick', e => {
    const p = loc(e), L = laneAt(p.y); if (!L) return;
    if (L.id === 'auto') { const k = keyHit(L, p); if (k >= 0) { S.auto[L.key].splice(k, 1); if (!S.auto[L.key].length) delete S.auto[L.key]; commit('auto'); } return; }
    if (L.id === 'sections') {
      const mi = S.markers.findIndex(m => Math.abs(tx(m.t) - p.x) < 6);
      if (mi >= 0) { const n = prompt('Marker name', S.markers[mi].name); if (n !== null) { S.markers[mi].name = n.slice(0, 24); commit('timeline'); } return; }
      const a = RT.ana.mix; if (!a) return; const t = xt(p.x), i = a.sections.findIndex(s => t >= s.a && t < s.b); if (i < 0) return;
      const n = prompt('Section name', sectionName(i, a.sections[i])); if (n !== null) { if (n.trim()) S.sectionNames[i] = n.slice(0, 24); else delete S.sectionNames[i]; commit('timeline'); }
    }
  });
  lanes.addEventListener('contextmenu', e => {
    const p = loc(e), L = laneAt(p.y); if (!L) return;
    if (L.id === 'scenes') {
      e.preventDefault(); const t = xt(p.x); let ci = -1; S.cues.forEach((c, i) => { if (c.t <= t) ci = i; }); if (ci < 0) return;
      const c = S.cues[ci];
      menu(null, [...S.scenes.map(sc => ({ label: (sc.id === c.scene ? '● ' : '○ ') + sc.name, fn: () => { c.scene = sc.id; commit('scenes'); } })), '-',
        ...FADES.map(f => ({ label: `${c.fade === f ? '● ' : '○ '}Fade ${f === 0 ? 'cut' : f + (f === 1 ? ' beat' : ' beats')}`, fn: () => { c.fade = f; commit('scenes'); } })), '-',
        { label: 'Delete cue', fn: () => { S.cues.splice(ci, 1); commit('scenes'); } }], { x: e.clientX, y: e.clientY });
      return;
    }
    if (L.id === 'sections') {
      const a = RT.ana.mix; if (!a) return; e.preventDefault();
      const t = xt(p.x), i = a.sections.findIndex(s => t >= s.a && t < s.b); if (i < 0) return;
      const sec = a.sections[i], tier = s => s.e > 0.66 ? 'HIGH' : s.e > 0.33 ? 'MID' : 'LOW', tr = tier(sec);
      if (!S.scenes.length) { toast('Capture a scene first (Scenes panel → ＋ Capture), then cue it on sections.'); return; }
      menu(null, [...S.scenes.map(sc => ({ label: `Cue “${sc.name}” at ${sectionName(i, sec)}`, fn: () => { S.cues = S.cues.filter(c => Math.abs(c.t - sec.a) > 0.01); addCue(sec.a, sc.id, 2); commit('scenes'); } })), '-',
        ...S.scenes.map(sc => ({ label: `Cue “${sc.name}” at every ${tr} section`, fn: () => { a.sections.forEach(s => { if (tier(s) === tr) { S.cues = S.cues.filter(c => Math.abs(c.t - s.a) > 0.01); addCue(s.a, sc.id, 2); } }); commit('scenes'); } }))], { x: e.clientX, y: e.clientY });
      return;
    }
    if (L.id !== 'auto') return;
    const k = keyHit(L, p); if (k < 0) return; e.preventDefault();
    S.auto[L.key].splice(k, 1); if (!S.auto[L.key].length) delete S.auto[L.key]; commit('auto');
  });
  lanes.addEventListener('wheel', e => {
    const dur = duration();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); const p = loc(e), tc = xt(p.x), f = Math.exp(e.deltaY * 0.01), span = clamp((TL.v1 - TL.v0) * f, 1, dur);
      TL.v0 = clamp(tc - (p.x / W) * span, 0, Math.max(0, dur - span)); TL.v1 = TL.v0 + span; TL.zoom = 'custom';
      document.querySelectorAll('#tlZoom button').forEach(b => b.classList.remove('on')); TL.dirty = true;
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault(); const span = TL.v1 - TL.v0, d = (e.shiftKey ? e.deltaY : e.deltaX) / W * span;
      TL.v0 = clamp(TL.v0 + d, 0, Math.max(0, dur - span)); TL.v1 = TL.v0 + span; TL.dirty = true;
    }
  }, { passive: false });
  document.querySelectorAll('#tlZoom button').forEach(b => b.onclick = () => setZoom(b.dataset.z));
  document.querySelectorAll('#tlSnap button').forEach(b => b.onclick = () => { TL.snap = b.dataset.s === 'beat'; document.querySelectorAll('#tlSnap button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#bAddLane').onclick = e => {
    const src = RT.chipSrc || 'mix';
    menu(e.currentTarget, SIGS.map(s => ({ label: `${s.n}${src !== 'mix' ? ' · ' + src : ''}`, fn: () => { S.lanes.push({ sig: s.id, src }); commit('timeline'); } })));
  };
  $('#bAddAuto').onclick = () => {
    const sp = RT.sel.param;
    if (!sp) { toast('Click a knob in the Inspector first, then press <b>+ Automation</b> to draw its curve here.'); return; }
    addAutomation(sp.fx, sp.k);
  };
  $('#bAddMarker').onclick = () => { S.markers.push({ t: snapT(RT.t), name: 'M' + (S.markers.length + 1) }); S.markers.sort((a, b) => a.t - b.t); commit('timeline'); };
  new ResizeObserver(() => { TL.dirty = true; }).observe(lanes.parentElement);
}

export function addAutomation(fx, k) {
  const key = autoKey(fx, k);
  if (S.auto[key]) { toast('That parameter already has an automation lane.'); return; }
  const v = baseValue(fx, k, RT.t);
  S.auto[key] = [[0, v], [duration(), v]];
  commit('auto');
  toast('Automation lane added. Click in the lane to add points, drag to move, double-click to delete.');
}
