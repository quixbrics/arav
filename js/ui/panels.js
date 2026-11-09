// Left panel (media + signal chips) and the effect stack.
import { S, RT, SRC_UID, fxItem, fxName, fxCat, commit } from '../state.js';
import { SIGS, SIG, PITCH } from '../signals.js';
import { EFFECTS, CATC } from '../effects/index.js';
import { GENS, media } from '../source.js';
import { signalAt } from '../mod.js';
import { $, $$, esc, fmtTime } from '../util.js';
import { menu } from './modals.js';

export let act = {};
export function setActions(a) { act = a; }

// ---------------- media ----------------
export function renderMedia() {
  const A = RT.audio, an = RT.analysing;
  const audioCard = A ? `<div class="card"><button class="rm" id="rmAudio" title="Remove">✕</button><div class="media-row"><canvas class="thumb" id="audThumb" width="108" height="68"></canvas>
      <div style="min-width:0"><div class="fname" title="${esc(A.name)}">${esc(A.name)}</div><div class="fmeta">${fmtTime(A.duration, 0)} · ${(A.sr / 1000).toFixed(1)} kHz · ${A.ch >= 4 ? 'AmbiX 4ch' : A.ch > 1 ? 'stereo' : 'mono'}${RT.ana.mix ? ` · ${RT.ana.mix.rmsDb.toFixed(1)} dB RMS` : ''}</div></div></div>
      ${an ? `<div class="prog"><u style="width:${Math.round(an.p * 100)}%"></u></div><div class="fmeta" style="margin-top:4px">Analysing ${esc(an.label)}…</div>` : ''}
      <div class="stems">${RT.stems.map(s => `<span class="stem">${esc(s.key.toUpperCase())}<button data-rmstem="${esc(s.key)}" title="Remove stem">✕</button></span>`).join('')}<button class="gen" id="addStem" title="Add a stem (drums, bass, vox…) for cleaner signals">+ Stem</button></div></div>`
    : `<div class="card"><div class="fname">No audio</div><div class="fmeta">Drop a track, or try the demo.</div>${an ? `<div class="prog"><u style="width:${Math.round(an.p * 100)}%"></u></div><div class="fmeta" style="margin-top:4px">${esc(an.label)}…</div>` : ''}<button class="btn demo" id="bDemo" ${an ? 'disabled' : ''}>♫ Load demo track</button></div>`;
  const vis = S.source.kind === 'gen'
    ? `<div class="card"><div class="media-row"><div class="thumb" style="background:linear-gradient(135deg,#ff7a3d,#b98cff,#3de0ff)"></div><div style="min-width:0"><div class="fname">${esc(GENS[S.source.gen].n)}</div><div class="fmeta">generator · GPU</div></div></div></div>`
    : `<div class="card"><button class="rm" id="rmVis" title="Back to generator">✕</button><div class="media-row"><div class="thumb" id="visThumb"></div><div style="min-width:0"><div class="fname" title="${esc(media.name)}">${esc(media.name || S.media.visual || 'Missing media')}</div><div class="fmeta">${media.el ? `${media.w}×${media.h}${media.video ? ' · video · ' + (isFinite(media.el.duration) ? fmtTime(media.el.duration, 0) : '—') : S.source.kind === 'webcam' ? ' · live' : ' · image'}` : 'reload the file'}</div></div></div></div>`;
  $('#mediaPanel').innerHTML = `<h3>Media ${RT.ana.mix ? '<span class="tag" style="color:var(--ok)">ANALYSED</span>' : ''}</h3>${audioCard}${vis}
    <div class="gens">${Object.entries(GENS).map(([k, g]) => `<button class="gen ${S.source.kind === 'gen' && S.source.gen === k ? 'on' : ''}" data-gen="${k}">${g.n}</button>`).join('')}<button class="gen ${S.source.kind === 'webcam' ? 'on' : ''}" id="bCam">Webcam</button></div>
    <div class="drop" id="dropZone"><b>Drop or click to add files</b><br>audio · stems · video · images</div>`;
  if (A) drawAudioThumb();
  const vt = $('#visThumb'); if (vt && media.el) { const c = document.createElement('canvas'); c.width = 108; c.height = 68; c.className = 'thumb'; try { c.getContext('2d').drawImage(media.el, 0, 0, 108, 68); } catch (e) {} vt.replaceWith(c); }
  $('#bDemo') && ($('#bDemo').onclick = () => act.loadDemo());
  $('#rmAudio') && ($('#rmAudio').onclick = () => act.removeAudio());
  $('#rmVis') && ($('#rmVis').onclick = () => act.pickSource('gen:' + (S.source.gen || 'testcard')));
  $('#addStem') && ($('#addStem').onclick = () => $('#fileStem').click());
  $$('[data-rmstem]').forEach(b => b.onclick = () => act.removeStem(b.dataset.rmstem));
  $$('[data-gen]').forEach(b => b.onclick = () => act.pickSource('gen:' + b.dataset.gen));
  $('#bCam').onclick = () => act.pickSource('webcam');
  $('#dropZone').onclick = () => $('#fileAny').click();
}
function drawAudioThumb() {
  const c = $('#audThumb'), a = RT.ana.mix; if (!c) return;
  const x = c.getContext('2d'), W = c.width, H = c.height; x.fillStyle = '#0a0b0d'; x.fillRect(0, 0, W, H);
  if (!a) return; const pk = a.peaks, n = pk.length / 2;
  for (let i = 0; i < W; i++) { let hi = 0; const j0 = Math.floor(i / W * n), j1 = Math.floor((i + 1) / W * n); for (let j = j0; j < j1; j++) hi = Math.max(hi, -pk[j * 2], pk[j * 2 + 1]); x.fillStyle = '#ff7a3d'; x.fillRect(i, H / 2 - hi * H * .45, 1, Math.max(1, hi * H * .9)); }
}

// ---------------- signal chips ----------------
let chipMeters = {};
export function renderChips() {
  const srcs = ['mix', ...RT.stems.map(s => s.key)];
  if (!srcs.includes(RT.chipSrc)) RT.chipSrc = 'mix';
  $('#srcsel').innerHTML = srcs.map(s => `<button class="${s === RT.chipSrc ? 'on' : ''}" data-s="${esc(s)}">${esc(s === 'mix' ? 'MIX' : s.slice(0, 5))}</button>`).join('');
  $$('#srcsel button').forEach(b => b.onclick = () => { RT.chipSrc = b.dataset.s; renderChips(); });
  $('#chips').innerHTML = SIGS.map(s => `<div class="chip ${s.id === 'chroma' ? 'chroma' : ''}" draggable="true" data-sig="${s.id}" style="--c:${s.c}" title="${s.n}: ${s.d}. Drag onto a knob.">
    <span class="kind">${s.k}</span><div class="nm">${s.n}</div><div class="ds">${s.d}</div>
    <div class="meter">${s.id === 'chroma' ? PITCH.map((_, i) => `<u style="background:hsl(${i * 30},90%,60%)"></u>`).join('') : '<u></u>'}</div></div>`).join('');
  $$('.chip').forEach(c => {
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/sig', c.dataset.sig + '|' + RT.chipSrc); e.dataTransfer.effectAllowed = 'link'; document.body.classList.add('mapping'); });
    c.addEventListener('dragend', () => document.body.classList.remove('mapping'));
  });
  chipMeters = Object.fromEntries(SIGS.map(s => [s.id, $(`.chip[data-sig="${s.id}"] .meter`)]));
}
const onsetHold = { v: 0 };
export function updateChips(t, dt) {
  const src = RT.chipSrc || 'mix', a = RT.ana[src] || RT.ana.mix;
  for (const s of SIGS) {
    const el = chipMeters[s.id]; if (!el) continue;
    if (s.id === 'chroma') {
      if (!a) continue; const i = Math.max(0, Math.min(a.n - 1, Math.round(t * a.rate)));
      [...el.children].forEach((u, p) => u.style.opacity = (0.12 + 0.88 * a.chroma[i * 12 + p] / 255).toFixed(2));
      continue;
    }
    let v = signalAt(s.id, src, t);
    if (s.id === 'onset') { const a2 = a; const near = a2 ? Math.max(...[-1, 0, 1].map(o => signalAt('onset', src, t + o / a2.rate))) : 0; onsetHold.v = Math.max(near, onsetHold.v * Math.exp(-dt / 0.15)); v = onsetHold.v; }
    el.firstChild.style.width = (v * 100).toFixed(1) + '%';
  }
}

// ---------------- effect stack ----------------
export function renderStack() {
  const card = (id, i) => {
    const isSrc = id === SRC_UID, f = fxItem(id), cat = fxCat(id), mods = S.maps.filter(m => m.fx === id);
    return `<div class="fx ${!isSrc && !f.on ? 'off' : ''} ${RT.sel.fx === id ? 'sel' : ''}" data-id="${id}" ${isSrc ? '' : 'draggable="true"'} style="--cc:${CATC[cat]}">
      <span class="grip">${isSrc ? '' : '⋮⋮'}</span><span class="ix">${isSrc ? '◉' : i}</span>
      <div class="nm"><span class="cat">${cat}</span><b>${esc(fxName(id))}</b></div>
      <div class="mods">${mods.map(m => `<i style="background:${SIG[m.sig].c}" title="${SIG[m.sig].n}"></i>`).join('')}</div>
      ${isSrc ? '' : '<button class="del" data-del title="Remove effect">✕</button><span class="pow" data-pow title="On / off"></span>'}</div>`;
  };
  $('#stack').innerHTML = card(SRC_UID, 0) + S.stack.map((f, i) => card(f.uid, i + 1)).join('');
  $$('#stack .fx').forEach(el => {
    const id = el.dataset.id;
    el.onclick = e => {
      if (e.target.closest('[data-pow]')) { act.toggleFx(id); return; }
      if (e.target.closest('[data-del]')) { act.removeFx(id); return; }
      RT.sel.fx = id; const m = S.maps.find(m => m.fx === id); RT.sel.map = m ? m.id : null; RT.sel.param = null;
      commit('select');
    };
    el.oncontextmenu = e => {
      if (id === SRC_UID) return; e.preventDefault();
      const i = S.stack.findIndex(f => f.uid === id);
      menu(el, [
        { label: 'Duplicate', fn: () => act.duplicateFx(id) },
        { label: 'Move up', disabled: i === 0, fn: () => { S.stack.splice(i - 1, 0, S.stack.splice(i, 1)[0]); commit('stack'); } },
        { label: 'Move down', disabled: i === S.stack.length - 1, fn: () => { S.stack.splice(i + 1, 0, S.stack.splice(i, 1)[0]); commit('stack'); } },
        '-', { label: 'Remove', fn: () => act.removeFx(id) },
      ], { x: e.clientX, y: e.clientY });
    };
    if (id === SRC_UID) return;
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/fx', id); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/fx')) { e.preventDefault(); el.classList.add('dragover'); } });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      el.classList.remove('dragover'); const src = e.dataTransfer.getData('text/fx'); if (!src || src === id) return; e.preventDefault();
      const r = el.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
      const a = S.stack.findIndex(f => f.uid === src), item = S.stack.splice(a, 1)[0];
      S.stack.splice(S.stack.findIndex(f => f.uid === id) + (after ? 1 : 0), 0, item); commit('stack');
    });
  });
}

// ---------------- scenes ----------------
export function renderScenes() {
  const cueCount = id => S.cues.filter(c => c.scene === id).length;
  $('#followT').classList.toggle('on', !!S.scenesOn);
  $('#scenes').innerHTML = S.scenes.map((s, i) => `<div class="scene" data-sc="${s.id}" style="--sc:${s.c}" title="Click: recall into the knobs · right-click: update, rename, cue, delete${i < 9 ? ` · ⇧${i + 1}` : ''}"><i></i>${esc(s.name)}<em>${cueCount(s.id) ? '×' + cueCount(s.id) : ''}</em></div>`).join('')
    + `<div class="scene capture" id="scCapture" title="Save the current stack (on/off, mix, every knob) as a scene">＋ Capture</div>`
    + (S.scenes.length ? '' : `<p class="scene-note">A scene is a snapshot of the whole stack. Capture a few looks, then cue them on the timeline (right-click a section → Cue scene). The stack crossfades between them as the music plays.</p>`);
  $('#scCapture').onclick = () => act.captureScene();
  $$('#scenes .scene[data-sc]').forEach(el => {
    const id = el.dataset.sc;
    el.onclick = () => act.recallScene(id);
    el.oncontextmenu = e => { e.preventDefault(); act.sceneMenu(id, { x: e.clientX, y: e.clientY }); };
  });
  $('#followT').onclick = () => act.toggleFollow();
}
let liveScene = null;
export function updateLiveScene(id) {
  if (id === liveScene) return; liveScene = id;
  $$('#scenes .scene[data-sc]').forEach(el => el.classList.toggle('live', el.dataset.sc === id));
}
// keep stack cards in sync when scenes switch effects on/off
export function updateStackLive(onMap) {
  $$('#stack .fx[data-id]').forEach(el => { const v = onMap[el.dataset.id]; if (v !== undefined && el.classList.contains('off') === v) el.classList.toggle('off', !v); });
}
