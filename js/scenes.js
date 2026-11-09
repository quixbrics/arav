// Scenes: snapshots of the whole stack (on/off, mix, every knob), placed as
// cues on the timeline. While FOLLOW is on, the stack crossfades from scene to
// scene as the playhead passes each cue. Editing a knob while a scene is
// playing writes the change into that scene, so edits stick.
import { S, RT, SRC_UID, paramStore, grid } from './state.js';
import { clamp, uid } from './util.js';

export const SCENE_COLS = ['#ff7a3d', '#3de0ff', '#b98cff', '#7dffa8', '#ff3d71', '#ffe14d', '#5d8bff', '#4dffd2', '#ff6bd6', '#d9dce1'];
export const FADES = [0, 0.5, 1, 2, 4, 8, 16];

function snapshot() {
  const fx = {};
  for (const f of S.stack) fx[f.uid] = { on: f.on, mix: f.mix, params: { ...f.params } };
  return { fx, src: { ...S.source.params } };
}
export function capture(name) {
  const sc = { id: uid(), name: name || `Scene ${S.scenes.length + 1}`, c: SCENE_COLS[S.scenes.length % SCENE_COLS.length], state: snapshot() };
  S.scenes.push(sc); return sc;
}
export function updateScene(id) { const sc = S.scenes.find(s => s.id === id); if (sc) sc.state = snapshot(); }
export function recall(id) {
  const sc = S.scenes.find(s => s.id === id); if (!sc) return;
  // an effect that isn't in the snapshot didn't exist when it was captured, so it's off in this scene
  for (const f of S.stack) { const st = sc.state.fx[f.uid]; if (st) { f.on = st.on; f.mix = st.mix; Object.assign(f.params, st.params); } else f.on = false; }
  Object.assign(S.source.params, sc.state.src || {});
}
export function deleteScene(id) { S.scenes = S.scenes.filter(s => s.id !== id); S.cues = S.cues.filter(c => c.scene !== id); }
export function addCue(t, scene, fade = 2) {
  const c = { id: uid(), t, scene, fade }; S.cues.push(c); S.cues.sort((a, b) => a.t - b.t); return c;
}

// ---- playback ----
let blendT = -1, blend = null;
export const following = () => S.scenesOn && S.cues.length > 0;
// {A, B, u}: crossfading from scene A to B with progress u (A may be null)
export function sceneBlend(t) {
  if (!following()) return null;
  if (t === blendT) return blend;
  blendT = t; blend = null;
  const cues = S.cues; let i = -1;
  for (let j = 0; j < cues.length; j++) if (cues[j].t <= t + 1e-6) i = j; else break;
  if (i < 0) return null;
  const cur = cues[i], B = S.scenes.find(s => s.id === cur.scene); if (!B) return null;
  const fadeS = cur.fade * 60 / grid().bpm, u = fadeS > 0 ? clamp((t - cur.t) / fadeS) : 1;
  const prevCue = i > 0 ? cues[i - 1] : null, A = prevCue ? S.scenes.find(s => s.id === prevCue.scene) : null;
  const s = u * u * (3 - 2 * u);
  blend = { A: u < 1 ? A : null, B, u: s, cue: cur };
  return blend;
}
export function invalidateBlend() { blendT = -1; }
// scene-driven knob value, or undefined if scenes don't cover it
export function sceneValue(id, k, t) {
  const b = sceneBlend(t); if (!b) return undefined;
  const pick = sc => sc ? (id === SRC_UID ? sc.state.src?.[k] : sc.state.fx[id]?.params[k]) : undefined;
  const vb = pick(b.B); if (vb === undefined) return undefined;
  if (!b.A) return vb;
  const va = pick(b.A); return va === undefined ? vb : va + (vb - va) * b.u;
}
export function sceneOnMix(f, t) {
  const b = sceneBlend(t); if (!b) return { on: f.on, mix: f.mix };
  const st = sc => sc && sc.state.fx[f.uid];
  // effects missing from a scene are off in it (they were added after it was captured)
  const sb = st(b.B), mb = sb && sb.on ? sb.mix : 0;
  if (!b.A) return sb ? { on: sb.on, mix: sb.mix } : { on: false, mix: f.mix };
  const sa = st(b.A), ma = sa && sa.on ? sa.mix : 0;
  const mix = ma + (mb - ma) * b.u;
  return { on: mix > 0.001, mix };
}
// the scene currently playing (after any fade)
export function activeScene(t) { const b = sceneBlend(t); return b ? b.B : null; }

// Copy what the cues are showing right now into the stack itself.
export function bakeLive(t) {
  if (!following()) return;
  for (const f of S.stack) {
    const om = sceneOnMix(f, t); f.on = om.on; if (om.on) f.mix = om.mix;
    for (const k of Object.keys(f.params)) { const v = sceneValue(f.uid, k, t); if (v !== undefined) f.params[k] = v; }
  }
  for (const k of Object.keys(S.source.params)) { const v = sceneValue(SRC_UID, k, t); if (v !== undefined) S.source.params[k] = v; }
}
// Call before any edit to the stack. If cues are playing, freeze the live look
// into the stack and pause FOLLOW so the edit changes the stack, not a scene.
export const manual = { onTake: null };
export function takeManual() {
  if (!following()) return false;
  bakeLive(RT.t); S.scenesOn = false; invalidateBlend();
  if (manual.onTake) manual.onTake();
  return true;
}
export { paramStore };
