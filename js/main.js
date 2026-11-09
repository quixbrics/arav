// ARAV: app wiring, the render loop, media loading and recording.
import { S, RT, FORMATS, fmt, SRC_UID, fxItem, newFx, commit, restore, undoStep, redoStep, loadProject, resetProject, grid, beatsAt, duration, setSourceKind, autoKey, paramDefs } from './state.js';
import { STAGES, COACH, PITCH } from './signals.js';
import { EFFECTS } from './effects/index.js';
import { media, loadVisualFile, startWebcam, stopMedia, syncVideo, seekVideoTo, SRC_PARAMS } from './source.js';
import { player, decodeFile, analyseBuffer, deriveGrid, synthDemo, addSpatial, ambiToStereo } from './audio/audio.js';
import { Engine } from './engine/engine.js';
import { evalAll, dropCache, remapTime } from './mod.js';
import { $, $$, on, clamp, uid, toast, esc, fmtTime, countLE, sampleAt } from './util.js';
import { renderMedia, renderChips, updateChips, renderStack, setActions, renderScenes, updateLiveScene, updateStackLive } from './ui/panels.js';
import { renderInspector, renderShape, syncShape, updateKnobs, drawShapePlots, hooks, updateSceneBadge } from './ui/inspector.js';
import { initTimeline, drawTimeline, updatePlayhead, setZoom, TL, sectionName, sectionColor, snapT } from './ui/timeline.js';
import { togglePopout, popoutFrame, onPopoutChange } from './popout.js';
import { capture, recall, updateScene, deleteScene, addCue, following, sceneOnMix, activeScene, takeManual, manual, bakeLive, invalidateBlend, SCENE_COLS } from './scenes.js';
import { applyRecipe, saveUserRecipe } from './presets.js';
import { openLibrary, openExport, openHelp, closeModals, menu } from './ui/modals.js';
import { startRecorder, saveStill, exportData, exportMarkers, saveProjectFile } from './export.js';
import * as idb from './idb.js';
import { renderMP4, canRender } from './render.js';
import { openLyrics as openLyricsP4 } from './phase4.js';
import { initPhase4, afterRenderML, mlForOffline, mlNeeded, lookFor, tickPhase4 } from './phase4.js';

// ---------------- engine ----------------
const view = $('#view');
let engine;
try { engine = new Engine(view); }
catch (e) { document.body.innerHTML = `<div style="padding:40px;font:14px system-ui;color:#ddd">ARAV needs WebGL2, which isn't available here.<br><br>${esc(e.message)}<br><br>Try a current Chrome, Edge, Firefox or Safari.</div>`; throw e; }

window.__aravEngine = engine;
restore();
RT.chipSrc = 'mix';
RT.gridV = 0;
let gridKey = '';

// ---------------- stages / guide ----------------
const NUM = ['①', '②', '③', '④', '⑤', '⑥'];
$('#stepper').innerHTML = STAGES.map(([k, n], i) => `<button class="step" data-s="${k}" title="${n} (${i + 1})"><span class="n">${i + 1}</span>${n}</button>`).join('');
function setStage(s) {
  if (s === 'export') { openExport(exportActions); return; }
  RT.stage = s; document.body.dataset.stage = s;
  const i = STAGES.findIndex(x => x[0] === s);
  $$('.step').forEach((b, j) => { b.classList.toggle('on', b.dataset.s === s); b.classList.toggle('done', j < i); });
  $('#coachN').textContent = NUM[i] + ' ' + STAGES[i][1]; $('#coachT').textContent = COACH[s];
}
$$('.step').forEach(b => b.onclick = () => setStage(b.dataset.s));
function setGuide(v) { RT.guide = v; document.body.dataset.guide = v ? 'on' : 'off'; $('#guideT').classList.toggle('on', v); try { localStorage.setItem('arav.guide', v ? '1' : '0'); } catch (e) {} }
$('#guideT').onclick = () => setGuide(!RT.guide);
try { if (localStorage.getItem('arav.guide') === '0') setGuide(false); } catch (e) {}

// ---------------- transport ----------------
function setPlayUI() { $('#bPlay').textContent = RT.recording ? '■' : player.playing ? '❚❚' : '▶'; }
function togglePlay() { if (RT.recording) { stopRecording(); return; } if (player.playing) player.pause(); else player.play(); setPlayUI(); }
function seek(t) { if (RT.recording) return; player.seek(t); RT.t = player.time(); }
$('#bPlay').onclick = togglePlay;
$('#bHome').onclick = () => seek(0);
$('#bLoop').onclick = () => { RT.loop = !RT.loop; $('#bLoop').classList.toggle('on', RT.loop); };
const stepBeats = n => { const g = grid(), spb = 60 / g.bpm, b = Math.round((RT.t - g.offset) / spb) + n; seek(clamp(g.offset + b * spb, 0, duration())); };

// ---------------- format / preview ----------------
$('#format').innerHTML = FORMATS.map(f => `<option value="${f.id}">${f.n}</option>`).join('');
$('#format').onchange = e => { S.format = e.target.value; commit('format'); };
$$('#vres button').forEach(b => b.onclick = () => { S.preview = +b.dataset.s; commit('format'); });
function syncFormatUI() {
  $('#format').value = S.format;
  $$('#vres button').forEach(b => b.classList.toggle('on', +b.dataset.s === S.preview));
  const f = fmt(); $('#screen').dataset.proj = f.proj;
  $('#vinfo').textContent = `${f.w}×${f.h}${f.proj === 'equirect' ? ' · seam wraps' : ''} · preview ${S.preview === 1 ? 'full' : S.preview === 0.5 ? '½' : '¼'}`;
  fitScreen();
}
function fitScreen() {
  const st = $('#stage').getBoundingClientRect(), f = fmt(), ar = f.w / f.h;
  let w = st.width - 32, h = w / ar; if (h > st.height - 32) { h = st.height - 32; w = h * ar; }
  const s = $('#screen'); s.style.width = Math.max(10, w) + 'px'; s.style.height = Math.max(10, h) + 'px';
}
new ResizeObserver(fitScreen).observe($('#stage'));
onPopoutChange((open, why) => { $('#bPop').classList.toggle('on', open); $('#bPop').textContent = open ? '⧉ CLOSE OUTPUT' : '⧉ POP OUT'; if (why === 'blocked') toast('The browser blocked the pop-out window. Allow pop-ups for this site and try again.', 5000); else if (open) toast('Output window open. Drag it to the projector or second screen, then double-click it (or press <b>F</b> in it) for full screen.', 5000); });
$('#bPop').onclick = () => togglePopout();
$('#bFull').onclick = () => { const s = $('#screen'); if (document.fullscreenElement) document.exitFullscreen(); else s.requestFullscreen?.(); };
const abStyle = document.createElement('style'); abStyle.textContent = '.screen:fullscreen canvas{object-fit:contain}'; document.head.appendChild(abStyle);
$('#bAB').onclick = () => { RT.abSplit = RT.abSplit ? 0 : 0.5; $('#bAB').classList.toggle('on', !!RT.abSplit); $('#screen').classList.toggle('ab', !!RT.abSplit); };
(() => {
  const h = $('#abHandle');
  h.addEventListener('pointerdown', e => {
    h.setPointerCapture(e.pointerId);
    const mv = ev => { const r = $('#screen').getBoundingClientRect(); RT.abSplit = clamp((ev.clientX - r.left) / r.width, 0.02, 0.98); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', () => h.removeEventListener('pointermove', mv), { once: true });
  });
})();

// ---------------- grid (BPM) ----------------
function rederive(force) {
  const a = RT.ana.mix; if (!a) return;
  const g = grid(), k = `${g.bpm}|${g.offset}|${a.id}|${Object.keys(RT.ana).join()}`;
  if (k === gridKey && !force) return; gridKey = k;
  for (const src in RT.ana) deriveGrid(RT.ana[src], g.bpm, g.offset, a.sections);
  RT.gridV++; TL.dirty = true;
}
$('#bpmIn').onchange = e => { const v = clamp(+e.target.value || 120, 40, 240); S.grid = { bpm: v, offset: grid().offset }; commit('grid'); };
$('#bpmHalf').onclick = () => { const g = grid(); S.grid = { bpm: Math.max(40, g.bpm / 2), offset: g.offset }; commit('grid'); };
$('#bpmDbl').onclick = () => { const g = grid(); S.grid = { bpm: Math.min(240, g.bpm * 2), offset: g.offset }; commit('grid'); };
$('#bDown').onclick = () => { const g = grid(), bar = 240 / g.bpm; let o = RT.t % bar; S.grid = { bpm: g.bpm, offset: o }; commit('grid'); toast('Beat 1 is now at the playhead.'); };
$('#bGridReset').onclick = () => { S.grid = null; commit('grid'); };

// ---------------- media loading ----------------
const STEM_RX = [[/drum|perc|kick|snare|hat|beat/i, 'drums'], [/bass|sub\b|808/i, 'bass'], [/vox|vocal|voice|acap|lead.?vox|sing/i, 'vox'], [/other|synth|inst|music|melod|keys|guitar|piano|pad/i, 'other']];
const stemKeyOf = name => { for (const [rx, k] of STEM_RX) if (rx.test(name)) return k; return null; };
function uniqueKey(k) { let key = k, i = 2; while (RT.stems.some(s => s.key === key) || key === 'mix') key = k + i++; return key; }

async function analyse(buffer, src, label) {
  RT.analysing = { label, p: 0 }; renderMedia(); TL.dirty = true;
  let lastR = 0;
  try {
    const res = await analyseBuffer(buffer, p => { RT.analysing.p = p; const n = performance.now(); if (n - lastR > 120) { lastR = n; renderMedia(); TL.dirty = true; } });
    res.id = uid(); addSpatial(res, src === 'mix' ? RT.ambi : null); RT.ana[src] = res;
    dropCache(); rederive(true);
    return res;
  } finally { RT.analysing = null; }
}

async function loadMasterBuffer(buffer, name, file) {
  RT.ambi = null;
  if (buffer.numberOfChannels >= 4) {         // treat 4+ channels as first-order AmbiX
    RT.ambi = buffer; buffer = ambiToStereo(buffer);
    toast('4-channel file: treated as <b>AmbiX</b> ambisonics. AZIM / ELEV follow the sound direction; you hear a stereo fold-down.', 5000);
  }
  player.setBuffer(buffer);
  RT.audio = { name, buffer, duration: buffer.duration, sr: buffer.sampleRate, ch: RT.ambi ? RT.ambi.numberOfChannels : buffer.numberOfChannels };
  RT.ana = {}; RT.stems.forEach(s => {}); // stems are re-analysed below if present
  S.media.audio = name;
  setZoom('fit');
  renderMedia(); renderChips();
  const res = await analyse(buffer, 'mix', name);
  for (const s of RT.stems) await analyse(s.buffer, s.key, s.name);
  $('#bpmLbl').textContent = grid().bpm.toFixed(1);
  setZoom('fit'); afterChange('all');
  if (RT.stage === 'load') setStage('listen');
  toast(`Analysed <b>${esc(name)}</b>: ${res.bpm.toFixed(1)} BPM · key ${res.key} · ${res.onsetTimes.length} onsets · ${res.sections.length} sections`, 4200);
  if (file) { idb.putFile('audio', file); try { localStorage.removeItem('arav.demo'); } catch (e) {} }
}
async function addStem(buffer, name, file, key) {
  key = uniqueKey(key || stemKeyOf(name) || name.replace(/\.[^.]+$/, '').replace(/[^\w]/g, '').slice(0, 8).toLowerCase() || 'stem');
  const s = { name, key, buffer }; RT.stems.push(s);
  renderMedia(); renderChips();
  if (RT.audio) {
    if (Math.abs(buffer.duration - RT.audio.duration) > 1) toast(`Heads up: ${esc(name)} is a different length from the main track. Stems should be exported from the same session.`, 4500);
    await analyse(buffer, key, name); rederive(true);
  }
  afterChange('all');
  if (file) idb.putFile('stem:' + key, file);
  toast(`Stem <b>${esc(key)}</b> ready. Pick it in the Signals selector.`);
}

async function handleFiles(files, asStems = false) {
  files = [...files];
  const proj = files.find(f => /\.json$|\.arav$/i.test(f.name)); if (proj) { openProjectFile(proj); return; }
  const vis = files.filter(f => /^(video|image)\//.test(f.type) || /\.(mp4|mov|webm|m4v|png|jpe?g|gif|webp)$/i.test(f.name));
  const aud = files.filter(f => !vis.includes(f) && (/^audio\//.test(f.type) || /\.(wav|mp3|flac|m4a|aac|ogg|oga|aif|aiff|opus)$/i.test(f.name)));
  if (vis.length) await loadVisual(vis[0]);
  if (!aud.length) { if (!vis.length) toast('That file type isn\'t supported. Use audio (wav/mp3/flac/m4a), video (mp4/webm/mov) or images.'); return; }
  let master = null, stems = [];
  if (asStems) stems = aud;
  else {
    const plain = aud.filter(f => !stemKeyOf(f.name));
    if (plain.length) { master = plain[0]; stems = aud.filter(f => f !== master); }
    else if (!RT.audio) { master = aud[0]; stems = aud.slice(1); }
    else stems = aud;
  }
  try {
    if (master) {
      RT.analysing = { label: 'decoding ' + master.name, p: 0 }; renderMedia();
      const buf = await decodeFile(master);
      if (stems.length) { RT.stems = []; }
      await loadMasterBuffer(buf, master.name, master);
    }
    for (const f of stems) { RT.analysing = { label: 'decoding ' + f.name, p: 0 }; renderMedia(); const b = await decodeFile(f); RT.analysing = null; await addStem(b, f.name, f); }
  } catch (e) { console.error(e); RT.analysing = null; renderMedia(); toast('Could not decode that audio: ' + esc(e.message || e), 5000); }
}

async function loadVisual(file) {
  try {
    await loadVisualFile(file);
    setSourceKind('media'); S.media.visual = file.name; engine.clearHistory();
    RT.sel.fx = SRC_UID; commit('source');
    idb.putFile('visual', file);
    toast(`Loaded <b>${esc(file.name)}</b> (${media.w}×${media.h}) as the source.`);
  } catch (e) { toast(esc(e.message || 'Could not load that file.'), 5000); }
}

async function pickSource(v) {
  if (v.startsWith('gen:')) { stopMedia(); setSourceKind('gen'); S.source.gen = v.slice(4); commit('source'); return; }
  if (v === 'open') { $('#fileAny').click(); renderInspector(); return; }
  if (v === 'webcam') {
    try { await startWebcam(); setSourceKind('webcam'); S.source.mirror = true; S.media.visual = 'Webcam'; RT.sel.fx = SRC_UID; commit('source'); }
    catch (e) { toast('Webcam unavailable: ' + esc(e.message || e.name), 4500); renderInspector(); }
  }
}
hooks.onSourcePick = pickSource;

async function loadDemo() {
  RT.analysing = { label: 'loading demo', p: 0 }; renderMedia(); TL.dirty = true;
  try {
    let buf, name = 'ARAV demo track.m4a';
    try { const r = await fetch('assets/demo.m4a'); if (!r.ok) throw new Error(r.status); buf = await decodeFile(await r.blob()); }
    catch (e) { console.warn('demo track unavailable, synthesising instead', e); buf = await synthDemo(); name = 'ARAV demo · 124 BPM (synth).wav'; }
    RT.analysing = null; RT.stems = []; await loadMasterBuffer(buf, name, null); idb.delFile('audio'); try { localStorage.setItem('arav.demo', '1'); } catch (e) {} }
  catch (e) { console.error(e); RT.analysing = null; renderMedia(); toast('Demo failed: ' + esc(e.message)); }
}

function removeAudio() {
  try { localStorage.removeItem('arav.demo'); } catch (e) {}
  player.pause(); player.setBuffer(null); RT.audio = null; RT.ana = {}; RT.stems = []; S.media.audio = null;
  idb.keys().then(ks => (ks || []).forEach(k => (k === 'audio' || String(k).startsWith('stem:')) && idb.delFile(k)));
  setZoom('fit'); setPlayUI(); afterChange('all');
}
function removeStem(key) {
  RT.stems = RT.stems.filter(s => s.key !== key); delete RT.ana[key]; idb.delFile('stem:' + key);
  S.maps.forEach(m => { if (m.src === key) m.src = 'mix'; }); S.lanes = S.lanes.filter(l => l.src !== key);
  if (RT.chipSrc === key) RT.chipSrc = 'mix';
  commit('all');
}

// ---------------- stack actions ----------------
function addFx(type) {
  takeManual();
  const f = newFx(type), i = S.stack.findIndex(x => x.uid === RT.sel.fx);
  S.stack.splice(i >= 0 ? i + 1 : S.stack.length, 0, f);
  RT.sel.fx = f.uid; RT.sel.map = null; RT.sel.param = null;
  commit('stack');
  if (RT.stage === 'build' || RT.stage === 'load' || RT.stage === 'listen') setStage('map');
  toast(`Added <b>${EFFECTS[type].name}</b>. Drag signals onto its knobs.`);
}
function removeFx(id) {
  const i = S.stack.findIndex(f => f.uid === id); if (i < 0) return;
  S.stack.splice(i, 1); S.maps = S.maps.filter(m => m.fx !== id);
  for (const k of Object.keys(S.auto)) if (k.startsWith(id + ':')) delete S.auto[k];
  if (RT.sel.fx === id) { RT.sel.fx = (S.stack[i] || S.stack[i - 1] || { uid: SRC_UID }).uid; RT.sel.map = null; }
  commit('stack');
}
function duplicateFx(id) {
  takeManual();
  const f = fxItem(id), c = JSON.parse(JSON.stringify(f)); c.uid = uid();
  S.stack.splice(S.stack.indexOf(f) + 1, 0, c);
  S.maps.filter(m => m.fx === id).forEach(m => S.maps.push({ ...m, id: uid(), fx: c.uid }));
  RT.sel.fx = c.uid; commit('stack');
}
// ---------------- scenes ----------------
function toggleFx(id) {
  const f = fxItem(id); if (!f) return;
  takeManual(); f.on = !f.on; commit('stack');
}
manual.onTake = () => { $('#followT').classList.remove('on'); toast('Manual control: <b>FOLLOW CUES</b> is paused so your edit changes the stack, not a scene. Capture or right-click → Update to keep this look, then switch FOLLOW CUES back on.', 5500); };
function captureScene() {
  // capture what's on screen: if cues are playing, that's the scene blend, not the raw knobs
  if (following()) { bakeLive(RT.t); invalidateBlend(); }
  const sc = capture(); commit('scenes');
  toast(`Captured <b>${esc(sc.name)}</b>. Change the stack and capture more, then cue them on the timeline (right-click a section).`, 4000);
}
function recallScene(id) {
  const sc = S.scenes.find(s => s.id === id); if (!sc) return;
  recall(id);
  if (following()) { S.scenesOn = false; toast(`Recalled <b>${esc(sc.name)}</b>. Cue following is paused; switch <b>FOLLOW CUES</b> back on to play the cue list.`, 4000); }
  else toast(`Recalled <b>${esc(sc.name)}</b>.`);
  commit('scenes');
}
function sceneMenu(id, at) {
  const sc = S.scenes.find(s => s.id === id); if (!sc) return;
  const a = RT.ana.mix, tier = s => s.e > 0.66 ? 'HIGH' : s.e > 0.33 ? 'MID' : 'LOW';
  menu(null, [
    { label: 'Recall into knobs', fn: () => recallScene(id) },
    { label: 'Update from current stack', fn: () => { updateScene(id); commit('scenes'); toast(`Updated <b>${esc(sc.name)}</b>.`); } },
    { label: 'Rename…', fn: () => { const n = prompt('Scene name', sc.name); if (n) { sc.name = n.slice(0, 24); commit('scenes'); } } },
    { label: 'Colour', fn: () => { sc.c = SCENE_COLS[(SCENE_COLS.indexOf(sc.c) + 1) % SCENE_COLS.length]; commit('scenes'); } },
    '-',
    { label: 'Cue at playhead', fn: () => { addCue(snapT(RT.t), id, 2); S.scenesOn = true; commit('scenes'); } },
    ...(a ? ['HIGH', 'MID', 'LOW'].map(tr => ({ label: `Cue at every ${tr} section`, disabled: !a.sections.some(s => tier(s) === tr), fn: () => { a.sections.forEach(s => { if (tier(s) === tr) { S.cues = S.cues.filter(c => Math.abs(c.t - s.a) > 0.01); addCue(s.a, id, 2); } }); S.scenesOn = true; commit('scenes'); } })) : []),
    { label: 'Remove its cues', fn: () => { S.cues = S.cues.filter(c => c.scene !== id); commit('scenes'); } },
    '-',
    { label: 'Delete scene', fn: () => { deleteScene(id); commit('scenes'); } },
  ], at);
}
function toggleFollow() {
  S.scenesOn = !S.scenesOn;
  if (S.scenesOn && !S.cues.length) toast('No cues yet. Right-click a section on the timeline, or a scene → Cue at playhead.');
  commit('scenes');
}
const recipeActs = {
  load: r => {
    // scenes are snapshots of the old stack's effects, so they can't apply to the new one
    const hadScenes = S.scenes.length; S.scenes = []; S.cues = [];
    applyRecipe(r, 'load'); engine.clearHistory(); RT.sel.fx = S.stack[0]?.uid; RT.sel.map = null; commit('all');
    toast(`Loaded recipe <b>${esc(r.name)}</b>${hadScenes ? '. Your scenes and cues were cleared, because they belonged to the old stack' : ''}. Undo with ⌘/Ctrl+Z.`, hadScenes ? 5000 : 3000);
  },
  append: r => { takeManual(); const first = applyRecipe(r, 'append'); RT.sel.fx = first; RT.sel.map = null; commit('all'); toast(`Appended <b>${esc(r.name)}</b> (switched off). Turn its effects on in a scene.`); },
  save: n => { saveUserRecipe(n); toast(`Saved recipe <b>${esc(n)}</b> in this browser.`); },
};

setActions({ loadDemo, removeAudio, removeStem, pickSource, removeFx, duplicateFx, toggleFx, captureScene, recallScene, sceneMenu, toggleFollow });
$('#addfx').onclick = () => openLibrary(addFx, recipeActs);

// ---------------- project ----------------
function openProjectFile(file) {
  file.text().then(txt => {
    const obj = JSON.parse(txt);
    if (!obj || !Array.isArray(obj.stack)) throw new Error('not an ARAV project');
    const mediaNames = obj.media || {};
    loadProject(obj);
    if (S.source.kind !== 'gen' && !media.el) { setSourceKind('gen'); commit('source'); }
    engine.clearHistory();
    const need = [mediaNames.audio && (!RT.audio || RT.audio.name !== mediaNames.audio) ? mediaNames.audio : null, ...(mediaNames.stems || []).filter(n => !RT.stems.some(s => s.name === n)), mediaNames.visual && media.name !== mediaNames.visual ? mediaNames.visual : null].filter(Boolean);
    toast(`Opened <b>${esc(S.name)}</b>.` + (need.length ? `<br>Now drop in its media: ${need.map(esc).join(', ')}` : ''), need.length ? 7000 : 2600);
  }).catch(e => toast('Could not open project: ' + esc(e.message)));
}
$('#fileProj').onchange = e => { if (e.target.files[0]) openProjectFile(e.target.files[0]); e.target.value = ''; };
$('#fileAny').onchange = e => { handleFiles(e.target.files); e.target.value = ''; };
$('#fileStem').onchange = e => { handleFiles(e.target.files, true); e.target.value = ''; };
$('#bProject').onclick = e => menu(e.currentTarget, [
  { label: 'New project', fn: () => { if (confirm('Start a new project? Unsaved changes to the patch will be lost (media stays loaded).')) { resetProject(); engine.clearHistory(); RT.sel.fx = S.stack[0]?.uid; afterChange('all'); } } },
  { label: 'Open project…', fn: () => $('#fileProj').click() },
  { label: 'Save project (.arav.json)', fn: () => saveProjectFile() },
  { label: 'Rename…', fn: () => { const n = prompt('Project name', S.name); if (n) { S.name = n.replace(/[^\w\- ]+/g, '').slice(0, 60) || 'untitled'; commit('name'); } } },
  '-', { label: 'Recipes…', fn: () => openLibrary(addFx, recipeActs, 'RECIPES') },
  { label: 'Lyrics…', fn: () => openLyricsP4() },
  { label: 'Save stack as recipe…', fn: () => { const n = prompt('Recipe name', S.name); if (n) recipeActs.save(n.slice(0, 40)); } },
  '-', { label: 'Export…', fn: () => setStage('export') },
]);
$('#bUndo').onclick = () => { if (undoStep()) afterUndo(); };
$('#bRedo').onclick = () => { if (redoStep()) afterUndo(); };
function afterUndo() { if (S.source.kind !== 'gen' && !media.el) setSourceKind('gen'); if (!RT.sel.fx) RT.sel.fx = S.stack[0]?.uid || SRC_UID; afterChange('all'); }
$('#bHelp').onclick = openHelp;

// ---------------- recording ----------------
let recorder = null;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
async function record(opts) {
  if (RT.recording) return;
  if (opts.fromStart) seek(0);
  player.pause();
  RT.recording = true; RT.recFps = opts.fps; document.body.classList.add('recording'); setPlayUI();
  const split = RT.abSplit; RT.abSplit = 0; RT._split = split;
  await nextFrame(); await nextFrame();
  player.init();
  try { recorder = startRecorder(view, opts.audio && RT.audio ? player.dest.stream : null, opts); }
  catch (e) { RT.recording = false; document.body.classList.remove('recording'); toast('Recording failed: ' + esc(e.message)); setPlayUI(); return; }
  player.play(); setPlayUI();
  toast('Recording… press <b>Space</b> or ■ to stop early. Keep this tab visible.', 3500);
}
async function stopRecording() {
  if (!RT.recording || !recorder) return;
  const r = recorder; recorder = null;
  player.pause(); r.rec.stop();
  RT.recording = false; document.body.classList.remove('recording'); RT.abSplit = RT._split || 0; setPlayUI();
  const blob = await r.done;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${S.name}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${r.ext}`; a.click();
  toast(`Saved <b>${esc(a.download)}</b> (${(blob.size / 1e6).toFixed(1)} MB)`, 4000);
}
// ---------------- frame-accurate render ----------------
let cancelRender = false;
async function renderOffline(opts) {
  if (!canRender()) { toast('Frame-accurate render needs WebCodecs (Chrome, Edge or Safari 17+). Use real-time capture instead.', 5000); return; }
  if (S.source.kind === 'webcam') { toast('A live webcam can\'t be rendered frame by frame. Use real-time capture, or switch to a file.', 5000); return; }
  if (RT.rendering || RT.recording) return;
  player.pause(); setPlayUI();
  const from = opts.fromStart ? 0 : player.time(), to = duration();
  RT.rendering = true; cancelRender = false; document.body.classList.add('rendering');
  $('#rbInfo').textContent = 'preparing…'; $('#rbBar').style.width = '0%'; $('#rbEta').textContent = '';
  const t0 = performance.now();
  try {
    const r = await renderMP4({
      canvas: view, engine, video: media.video ? media.el : null, from, to, fps: opts.fps, mbps: opts.mbps,
      audioBuffer: opts.audio && RT.audio ? RT.audio.buffer : null,
      buildFrame: t => { RT.t = t; return buildFrame(t, 1, true); },
      ml: mlForOffline, mlNeeded,
      onProgress: (i, n, eta) => { $('#rbInfo').textContent = `frame ${i} / ${n} · ${fmtTime(from + i / opts.fps)}`; $('#rbBar').style.width = (i / n * 100).toFixed(1) + '%'; $('#rbEta').textContent = `about ${Math.ceil(eta)} s left`; },
      cancelled: () => cancelRender,
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob);
    a.download = `${S.name}_${r.w}x${r.h}_${opts.fps}fps.mp4`; a.click();
    toast(`Rendered <b>${esc(a.download)}</b>: ${r.frames} frames in ${((performance.now() - t0) / 1000).toFixed(0)} s, ${(r.blob.size / 1e6).toFixed(1)} MB (${r.codec}${r.audio ? ' + ' + r.audio : ', no audio'}).`, 6000);
  } catch (e) {
    if (String(e.message) === 'cancelled') toast('Render cancelled.');
    else { console.error(e); toast('Render failed: ' + esc(e.message || e), 6000); }
  } finally {
    RT.rendering = false; document.body.classList.remove('rendering'); engine.clearHistory();
    player.seek(from); RT.t = from;
  }
}
$('#rbCancel').onclick = () => { cancelRender = true; };

const exportActions = {
  record, render: renderOffline, still: () => { RT.fullOnce = () => saveStill(view); }, data: exportData, markers: exportMarkers,
  save: () => { commit('name'); saveProjectFile(); }, open: () => $('#fileProj').click(),
};

// ---------------- drag & drop files ----------------
let dragDepth = 0;
const isFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', e => { if (isFiles(e)) { dragDepth++; document.body.classList.add('dragging'); } });
addEventListener('dragleave', e => { if (isFiles(e) && --dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
addEventListener('dragover', e => { if (isFiles(e)) e.preventDefault(); });
addEventListener('drop', e => { if (!isFiles(e)) return; e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); handleFiles(e.dataTransfer.files); });

// ---------------- keyboard ----------------
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (RT.rendering) { if (e.key === 'Escape') cancelRender = true; return; }
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey ? redoStep() : undoStep()) afterUndo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProjectFile(); return; }
  if (mod) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'Home') seek(0);
  else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBeats(e.shiftKey ? -4 : -1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); stepBeats(e.shiftKey ? 4 : 1); }
  else if (e.shiftKey && /^Digit[1-9]$/.test(e.code)) { const sc = S.scenes[+e.code.slice(5) - 1]; if (sc) recallScene(sc.id); }
  else if (e.key >= '1' && e.key <= '6') setStage(STAGES[+e.key - 1][0]);
  else if (e.key === 'g' || e.key === 'G') setGuide(!RT.guide);
  else if (e.key === 'f' || e.key === 'F') $('#bFull').click();
  else if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) $('#bPop').click();
  else if (e.key === '?') openHelp();
  else if (e.key === 'Escape') { closeModals(); if (RT.recording) stopRecording(); if (RT.rendering) cancelRender = true; }
});

// ---------------- change handling ----------------
function afterChange(what) {
  RT.rev = (RT.rev || 0) + 1;
  if (what === 'knob' || what === 'shape' || what === 'mix') { syncShape(true); TL.dirty = true; return; }
  if (!RT.sel.fx || (RT.sel.fx !== SRC_UID && !fxItem(RT.sel.fx))) RT.sel.fx = S.stack[0]?.uid || SRC_UID;
  if (RT.sel.map && !S.maps.some(m => m.id === RT.sel.map)) RT.sel.map = null;
  if (!RT.sel.map) { const m = S.maps.find(m => m.fx === RT.sel.fx); if (m) RT.sel.map = m.id; }
  rederive(); invalidateBlend(); RT.rev = (RT.rev || 0) + 1;
  renderScenes(); renderStack(); renderInspector(); renderShape();
  if (what === 'all' || what === 'source') { renderMedia(); renderChips(); }
  syncFormatUI();
  const g = grid(); $('#bpmIn').value = g.bpm.toFixed(1); $('#bpmLbl').textContent = RT.ana.mix ? g.bpm.toFixed(1) : '—';
  $('#keyLbl').textContent = RT.ana.mix ? RT.ana.mix.key : '—';
  $('#projMeta').textContent = `${S.name} · autosaved${S.grid ? ' · grid edited' : ''}`;
  TL.dirty = true;
}
on('change', afterChange);

// raw samples for effects that draw the waveform
let audioCache = { buf: null };
function audioData() {
  const b = RT.audio && RT.audio.buffer; if (!b) return null;
  if (audioCache.buf !== b) audioCache = { buf: b, L: b.getChannelData(0), R: b.numberOfChannels > 1 ? b.getChannelData(1) : null, sr: b.sampleRate };
  return audioCache;
}

// One frame's worth of everything the engine needs, at time t.
// Used by the live loop and by the frame-accurate renderer.
function buildFrame(t, scale, exactVideo) {
  const vals = evalAll(t);
  const tr = S.stack.find(x => x.type === 'timeremap' && sceneOnMix(x, t).on);
  const srcT = tr ? remapTime(tr.uid, t) : t;
  if (!exactVideo) { if (tr && media.video) seekVideoTo(srcT); else syncVideo(t, player.playing); }
  const f = fmt();
  engine.resize(f.w * scale, f.h * scale, f.proj === 'equirect');
  const a = RT.ana.mix;
  return {
    t, beats: beatsAt(t), onsets: a ? countLE(a.onsetTimes, t) : 0, outW: f.w, outH: f.h, srcT,
    source: { kind: S.source.kind, gen: S.source.gen, defs: SRC_PARAMS[S.source.kind === 'gen' ? 'gen' : 'media'], params: vals[SRC_UID], el: media.el, mw: media.w || media.el?.videoWidth, mh: media.h || media.el?.videoHeight, mirror: S.source.mirror, time: srcT },
    stack: S.stack.map(x => { const om = sceneOnMix(x, t); return { uid: x.uid, type: x.type, on: om.on, mix: om.mix, params: vals[x.uid] }; }),
    split: exactVideo ? 0 : RT.abSplit, dome: f.proj === 'dome',
    spb: 60 / grid().bpm, ana: a, audio: audioData(),
    look: exactVideo ? null : lookFor(), lyrics: S.lyrics,
  };
}

// ---------------- render loop ----------------
let last = performance.now(), fpsN = 0, fpsT = 0, fpsAcc = 0, msAvg = 0, errShown = '';
function frame(now) {
  requestAnimationFrame(frame);
  if (RT.rendering) return;                     // the offline renderer owns the engine
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  let t = player.time(); const dur = duration();
  if (player.playing && t >= dur) {
    if (RT.recording) { stopRecording(); t = dur; }
    else if (RT.loop) { player.seek(0); t = 0; }
    else { player.pause(); player.off = dur; t = dur; setPlayUI(); }
  }
  RT.t = t; RT.playing = player.playing;
  const fr = buildFrame(t, RT.recording || RT.fullOnce ? 1 : S.preview);
  const a = fr.ana;
  const t0 = performance.now();
  engine.render(fr);
  popoutFrame(view);
  msAvg += (performance.now() - t0 - msAvg) * 0.1;
  afterRenderML(fr); tickPhase4();
  if (RT.fullOnce) { const fn = RT.fullOnce; RT.fullOnce = null; fn(); }
  if (engine.errors.size) { const s = [...engine.errors].map(([k, v]) => `${k}: ${v}`).join('\n'); if (s !== errShown) { errShown = s; $('#glerr').style.display = 'block'; $('#glerr').textContent = 'Shader error (that effect is skipped):\n' + s; } }
  if (RT.abSplit) $('#abline').style.left = (RT.abSplit * 100) + '%';

  updateKnobs(); updateChips(t, dt); drawShapePlots();
  if (following()) { const onMap = {}; fr.stack.forEach(x => onMap[x.uid] = x.on); updateStackLive(onMap); }
  const live = activeScene(t); updateLiveScene(live ? live.id : null); updateSceneBadge();
  if (TL.dirty) drawTimeline();
  updatePlayhead(t);
  const g = grid(), beats = beatsAt(t), bar = Math.floor(beats / 4) + 1, bt = Math.floor(((beats % 4) + 4) % 4) + 1;
  $('#clock').innerHTML = `${fmtTime(t)} <small>/ ${fmtTime(dur, 0)}</small>`;
  $('#bar').textContent = a ? `${bar}.${bt}` : '—';
  if (a) {
    const si = a.sections.findIndex(s => t >= s.a && t < s.b), s = a.sections[Math.max(0, si)];
    $('#scName').textContent = s ? sectionName(Math.max(0, si), s) : '—'; $('#scDot').style.background = s ? sectionColor(s) : '';
    $('#roKick').textContent = sampleAt(a.f.kick, a.rate, t).toFixed(2); $('#roBright').textContent = sampleAt(a.f.bright, a.rate, t).toFixed(2);
    const i = Math.max(0, Math.min(a.n - 1, Math.round(t * a.rate))); let bp = 0; for (let p = 1; p < 12; p++) if (a.chroma[i * 12 + p] > a.chroma[i * 12 + bp]) bp = p;
    $('#roNote').textContent = PITCH[bp]; $('#roOn').textContent = fr.onsets;
  }
  fpsN++; fpsAcc += dt; if (now - fpsT > 500) { $('#roFps').textContent = Math.round(fpsN / fpsAcc); $('#roMs').textContent = msAvg.toFixed(1); fpsN = 0; fpsAcc = 0; fpsT = now; }
  if (player.playing !== frame.wasPlaying) { frame.wasPlaying = player.playing; setPlayUI(); }
}

// ---------------- boot ----------------
async function boot() {
  initTimeline(seek);
  initPhase4();
  if (S.source.kind !== 'gen') { /* media restored below */ }
  RT.sel.fx = S.stack[0]?.uid || SRC_UID;
  afterChange('all');
  setStage('load');
  requestAnimationFrame(frame);
  // restore media from last session
  try {
    const ks = (await idb.keys()) || [];
    if (S.source.kind === 'media' && ks.includes('visual')) { const f = await idb.getFile('visual'); if (f) { await loadVisualFile(f); S.media.visual = f.name; } }
    if (S.source.kind !== 'gen' && !media.el) { setSourceKind('gen'); }
    const stemKeys = ks.filter(k => String(k).startsWith('stem:'));
    if (ks.includes('audio')) {
      const f = await idb.getFile('audio');
      if (f) {
        for (const k of stemKeys) { const sf = await idb.getFile(k); if (sf) { try { RT.stems.push({ name: sf.name, key: k.slice(5), buffer: await decodeFile(sf) }); } catch (e) {} } }
        RT.analysing = { label: 'decoding ' + f.name, p: 0 }; renderMedia();
        await loadMasterBuffer(await decodeFile(f), f.name, null);
        setStage('map');
      }
    } else if (localStorage.getItem('arav.demo') === '1') { await loadDemo(); setStage('map'); }
  } catch (e) { console.warn('media restore failed', e); RT.analysing = null; }
  afterChange('all');
}
boot();
