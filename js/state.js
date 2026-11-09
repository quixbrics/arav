// Project state (S, serialisable) and runtime state (RT, not saved).
import { uid, emit, clamp } from './util.js';
import { EFFECTS } from './effects/index.js';
import { SRC_PARAMS, GENS } from './source.js';

export const FORMATS = [
  { id: 'hd', n: '16:9 · 1920×1080', w: 1920, h: 1080, proj: 'flat' },
  { id: '720', n: '16:9 · 1280×720', w: 1280, h: 720, proj: 'flat' },
  { id: '4k', n: '16:9 · 3840×2160', w: 3840, h: 2160, proj: 'flat' },
  { id: 'vert', n: '9:16 · 1080×1920', w: 1080, h: 1920, proj: 'flat' },
  { id: 'sq', n: '1:1 · 1080×1080', w: 1080, h: 1080, proj: 'flat' },
  { id: 'eq2', n: '360° · 2048×1024', w: 2048, h: 1024, proj: 'equirect' },
  { id: 'eq4', n: '360° · 3840×1920', w: 3840, h: 1920, proj: 'equirect' },
  { id: 'dome', n: 'Dome · 2048×2048', w: 2048, h: 2048, proj: 'dome' },
];
export const fmt = () => FORMATS.find(f => f.id === S.format) || FORMATS[0];

export const SRC_UID = 'src';

export function newFx(type) {
  const d = EFFECTS[type];
  return { uid: uid(), type, on: true, mix: 1, params: Object.fromEntries(d.params.map(p => [p.k, p.v])) };
}
export function newMap(fx, p, sig, o = {}) {
  return Object.assign({ id: uid(), fx, p, sig, src: 'mix', depth: 0.5, curve: 0.5, atk: 0.01, rel: 0.25, lo: 0, hi: 1, thr: 0.5, mode: 'cont', inv: false }, o);
}

function defaultProject() {
  const fb = newFx('feedback'), blk = newFx('block'), chr = newFx('chromatic'), crt = newFx('crt'), ph = newFx('playhead'), cam = newFx('handycam'), wav = newFx('wave');
  ph.on = false; cam.on = false; wav.on = false;
  blk.params.amount = 0;
  const S = {
    v: 1, name: 'untitled',
    format: 'hd', preview: 0.5, fps: 30,
    source: { kind: 'gen', gen: 'testcard', params: Object.fromEntries(SRC_PARAMS.gen.map(p => [p.k, p.v])), mirror: false },
    stack: [fb, blk, chr, wav, ph, cam, crt],
    maps: [
      newMap(fb.uid, 'decay', 'loud', { depth: 0.35, rel: 0.5 }),
      newMap(blk.uid, 'amount', 'onset', { depth: 0.45, mode: 'trig', rel: 0.18 }),
      newMap(chr.uid, 'amount', 'kick', { depth: 0.5, curve: 0.65, rel: 0.12 }),
      newMap(crt.uid, 'bloom', 'kick', { depth: 0.4, rel: 0.15 }),
      newMap(SRC_UID, 'pulse', 'kick', { depth: 0.8, rel: 0.15 }),
    ],
    auto: {},                // "uid:param" -> [[t, v], ...]
    lanes: [{ sig: 'kick', src: 'mix' }, { sig: 'bright', src: 'mix' }, { sig: 'onset', src: 'mix' }],
    markers: [],             // [{t, name}]
    sectionNames: {},        // index -> name
    grid: null,              // {bpm, offset} override; null = detected
    scenes: [],              // [{id, name, c, state:{fx:{uid:{on,mix,params}}, src:{}}}]
    cues: [],                // [{id, t, scene, fade(beats)}]
    scenesOn: true,          // follow cues during playback
    lyrics: [],              // [{text, t0, t1}] word timings (Whisper or typed)
    media: {},               // names of loaded files (reminder only)
  };
  return S;
}

export let S = defaultProject();

export const RT = {
  t: 0, playing: false, loop: true,
  stage: 'map', guide: true,
  sel: { fx: null, map: null, param: null },
  ana: {},            // src ('mix' | stem name) -> analysis result
  audio: null,        // { name, buffer, duration, sr, ch }
  stems: [],          // [{ name, key, buffer }]
  analysing: null,    // {label, p}
  abSplit: 0,
  recording: false,
  vals: {},           // live param values: uid -> {k: v}
};

// ---- lookup helpers ----
export const fxItem = id => (id === SRC_UID ? null : S.stack.find(f => f.uid === id));
export function paramDefs(id) {
  if (id === SRC_UID) return SRC_PARAMS[S.source.kind === 'gen' ? 'gen' : 'media'];
  const f = fxItem(id); return f ? EFFECTS[f.type].params : [];
}
export function paramStore(id) { return id === SRC_UID ? S.source.params : fxItem(id)?.params; }
export function fxName(id) {
  if (id === SRC_UID) return S.source.kind === 'gen' ? GENS[S.source.gen].n : (S.media.visual || 'Media');
  const f = fxItem(id); return f ? EFFECTS[f.type].name : '?';
}
export function fxCat(id) { return id === SRC_UID ? 'SOURCE' : EFFECTS[fxItem(id)?.type]?.cat; }
export const autoKey = (id, k) => id + ':' + k;

export function setSourceKind(kind) {
  const was = S.source.kind === 'gen' ? 'gen' : 'media', now = kind === 'gen' ? 'gen' : 'media';
  S.source.kind = kind;
  if (was !== now) {
    S.source.params = Object.fromEntries(SRC_PARAMS[now].map(p => [p.k, p.v]));
    S.maps = S.maps.filter(m => m.fx !== SRC_UID || S.source.params[m.p] !== undefined);
  }
}

// ---- grid (BPM) ----
export function grid() {
  const a = RT.ana.mix;
  if (S.grid) return S.grid;
  if (a) return { bpm: a.bpm, offset: a.beatOffset };
  return { bpm: 120, offset: 0 };
}
export const beatsAt = t => { const g = grid(); return (t - g.offset) * g.bpm / 60; };
export function duration() { return RT.audio ? RT.audio.duration : 60; }

// ---- persistence: autosave + undo ----
const KEY = 'arav.project.v1';
const undo = [], redo = [];
let lastSnap = null, saveT;
export function serialise() { return JSON.stringify(S); }
export function commit(what = 'change') {
  const snap = serialise();
  if (snap !== lastSnap) { if (lastSnap) undo.push(lastSnap); if (undo.length > 80) undo.shift(); redo.length = 0; lastSnap = snap; }
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, snap); } catch (e) {} }, 400);
  emit('change', what);
}
export function touch(what) { emit('change', what); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, serialise()); } catch (e) {} }, 600); }
function replace(obj) {
  const d = defaultProject();
  S = Object.assign(d, obj);
  // sanity: drop unknown effects and dangling maps
  S.stack = S.stack.filter(f => EFFECTS[f.type]).map(f => ({ ...f, params: { ...Object.fromEntries(EFFECTS[f.type].params.map(p => [p.k, p.v])), ...f.params } }));
  if (!GENS[S.source.gen]) S.source.gen = 'testcard';
  const ids = new Set([SRC_UID, ...S.stack.map(f => f.uid)]);
  S.maps = S.maps.filter(m => ids.has(m.fx)).map(m => ({ ...newMap(m.fx, m.p, m.sig), ...m }));
  S.lanes = (S.lanes || []).filter(l => l && l.sig);
  S.lyrics = Array.isArray(S.lyrics) ? S.lyrics : [];
  S.scenes = Array.isArray(S.scenes) ? S.scenes : []; S.cues = (Array.isArray(S.cues) ? S.cues : []).filter(c => S.scenes.some(s => s.id === c.scene));
  RT.sel = { fx: null, map: null, param: null };
}
export function undoStep() { if (!undo.length) return false; redo.push(lastSnap); lastSnap = undo.pop(); replace(JSON.parse(lastSnap)); emit('change', 'all'); return true; }
export function redoStep() { if (!redo.length) return false; undo.push(lastSnap); lastSnap = redo.pop(); replace(JSON.parse(lastSnap)); emit('change', 'all'); return true; }
export function loadProject(obj) { replace(obj); commit('all'); }
export function resetProject() { replace(defaultProject()); commit('all'); }
export function restore() {
  try { const s = localStorage.getItem(KEY); if (s) { replace(JSON.parse(s)); } } catch (e) { console.warn('restore failed', e); }
  if (S.source.kind === 'webcam' || S.source.kind === 'media') S.source.kind = S.source.kind; // media reattached later
  lastSnap = serialise();
}
export { clamp };
