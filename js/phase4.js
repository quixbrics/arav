// Phase 4 glue: runs the in-browser ML models when effects need them, the
// lyrics editor / Whisper transcription, and the 360° look-around preview.
import { S, RT, commit, fmt } from './state.js';
import { EFFECTS } from './effects/index.js';
import { ML, initML, loadDepth, runDepth, loadMask, runMask, mlStatusText } from './ml/vision.js';
import { ASR, initASR, transcribe, lyricsToText, textToLyrics } from './ml/whisper.js';
import { $, toast, clamp } from './util.js';
import { openModal, closeModals } from './ui/modals.js';
import { hooks } from './ui/inspector.js';

export function needsOf(stack) {
  const n = new Set();
  for (const x of stack) { if (!x.on) continue; const d = EFFECTS[x.type]; if (d && d.needs) for (const k of d.needs(x.params)) n.add(k); }
  return n;
}

function aiText() {
  const parts = [mlStatusText()];
  if (ASR.state !== 'off') parts.push(`WHISPER ${ASR.msg}`);
  return parts.filter(Boolean).join(' · ');
}
function updateAI() {
  const s = aiText(); $('#aiStatus').textContent = s ? 'AI ' + s : '';
  const line = $('#mlLine'); if (line) line.textContent = s;
  const ls = $('#lyrStatus'); if (ls) ls.textContent = ASR.state === 'off' ? '' : ASR.msg;
}

// ---- after each live frame: feed the models the source frame that was just drawn ----
let lastDepth = 0;
export function afterRenderML(fr) {
  const n = needsOf(fr.stack);
  if (n.has('depth')) {
    if (ML.depth.state === 'off') loadDepth();
    else if (ML.depth.state === 'ready' && !ML.depth.busy && performance.now() - lastDepth > 30) { lastDepth = performance.now(); runDepth().then(updateAI); }
  }
  if (n.has('mask')) { if (ML.mask.state === 'off') loadMask(); else if (ML.mask.state === 'ready') runMask(); }
  if (n.has('lyrics') && !(S.lyrics && S.lyrics.length) && !afterRenderML.hinted) { afterRenderML.hinted = true; toast('Kinetic Lyrics has no words yet: press <b>Transcribe (Whisper)</b> or <b>Edit lyrics…</b> in the Inspector.', 5000); }
}
// ---- offline render: compute ML for exactly this frame before drawing it ----
const yieldNow = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
export function mlNeeded(stack) { const n = needsOf(stack); return n.has('depth') || n.has('mask'); }
export async function mlForOffline(fr) {
  const n = needsOf(fr.stack);
  if (n.has('depth')) {
    if (ML.depth.state === 'off') loadDepth();
    while (ML.depth.state === 'loading') await new Promise(r => setTimeout(r, 200));
    if (ML.depth.state === 'ready') { while (ML.depth.busy) await yieldNow(); await runDepth(); }
  }
  if (n.has('mask')) {
    if (ML.mask.state === 'off') loadMask();
    while (ML.mask.state === 'loading') await new Promise(r => setTimeout(r, 200));
    runMask();
  }
}

// ---- lyrics editor ----
export function openLyrics() {
  $('#lyrText').value = lyricsToText(S.lyrics);
  $('#lyrInfo').textContent = `${(S.lyrics || []).length} words`;
  updateAI(); openModal('lyrModal');
}
function bindLyrics() {
  $('#lyrApply').onclick = () => { S.lyrics = textToLyrics($('#lyrText').value); commit('lyrics'); $('#lyrInfo').textContent = `${S.lyrics.length} words`; closeModals(); toast(`Lyrics updated: ${S.lyrics.length} words.`); };
  $('#lyrClear').onclick = () => { $('#lyrText').value = ''; };
  $('#lyrRun').onclick = async () => {
    const words = await transcribe({ model: $('#lyrModel').value });
    if (words) { $('#lyrText').value = lyricsToText(S.lyrics); $('#lyrInfo').textContent = `${S.lyrics.length} words`; }
  };
  $('#lyrText').addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault(); const ta = e.target, ins = (ta.selectionStart && ta.value[ta.selectionStart - 1] !== '\n' ? '\n' : '') + RT.t.toFixed(2) + '\t';
      ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, 'end');
    }
  });
}

// ---- 360 look-around preview ----
export function lookFor() { return RT.look && !RT.recording && !RT.rendering && fmt().proj === 'equirect' ? RT.look : null; }
function bindLook() {
  const btn = $('#bLook'), scr = $('#screen');
  btn.onclick = () => { RT.look = RT.look ? null : { yaw: 0, pitch: 0, fov: 1.7 }; btn.classList.toggle('on', !!RT.look); scr.style.cursor = RT.look ? 'grab' : ''; };
  let drag = null;
  scr.addEventListener('pointerdown', e => { if (!RT.look || e.target.closest('#abHandle')) return; drag = { x: e.clientX, y: e.clientY }; scr.setPointerCapture(e.pointerId); scr.style.cursor = 'grabbing'; });
  scr.addEventListener('pointermove', e => {
    if (!drag || !RT.look) return; const r = scr.getBoundingClientRect(), k = RT.look.fov / r.height;
    RT.look.yaw -= (e.clientX - drag.x) * k; RT.look.pitch = clamp(RT.look.pitch + (e.clientY - drag.y) * k, -1.5, 1.5); drag = { x: e.clientX, y: e.clientY };
  });
  scr.addEventListener('pointerup', () => { drag = null; if (RT.look) scr.style.cursor = 'grab'; });
  scr.addEventListener('wheel', e => { if (!RT.look) return; e.preventDefault(); RT.look.fov = clamp(RT.look.fov * Math.exp(e.deltaY * 0.001), 0.4, 2.8); }, { passive: false });
}
export function tickPhase4() {
  const eq = fmt().proj === 'equirect', b = $('#bLook');
  if (b.style.display === 'none' && eq) b.style.display = ''; else if (b.style.display !== 'none' && !eq) { b.style.display = 'none'; RT.look = null; b.classList.remove('on'); }
}

export function initPhase4() {
  initML(window.__aravEngine, updateAI); initASR(updateAI);
  bindLyrics(); bindLook();
  hooks.onAction = (id) => { if (id === 'transcribe') { openLyrics(); $('#lyrRun').click(); } else if (id === 'edit') openLyrics(); };
}
