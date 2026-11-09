// Context menu, effect library, export sheet, help.
import { $, $$, esc, h1, vnoise } from '../util.js';
import { LIB, CATC, EFFECTS } from '../effects/index.js';
import { S, RT, fmt, duration } from '../state.js';
import { RECIPES, userRecipes, deleteUserRecipe } from '../presets.js';

// ---------- context menu ----------
export function menu(anchor, items, at) {
  const m = $('#ctx');
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}" ${it.disabled ? 'disabled' : ''}>${esc(it.label)}</button>`).join('');
  m.style.display = 'block';
  let x, y;
  if (at) { x = at.x; y = at.y; } else { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
  const mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.min(x, innerWidth - mw - 8) + 'px'; m.style.top = (y + mh > innerHeight - 8 ? Math.max(8, y - mh - (at ? 0 : 40)) : y) + 'px';
  m.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { m.style.display = 'none'; items[+b.dataset.i].fn(); });
  setTimeout(() => addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { m.style.display = 'none'; removeEventListener('pointerdown', off); } }), 0);
}
export const closeMenu = () => { $('#ctx').style.display = 'none'; };

export function openModal(id) { $('#' + id).classList.add('open'); }
export function closeModals() { $$('.modal').forEach(m => m.classList.remove('open')); }

// ---------- library ----------
let libCat = 'ALL', onAdd = () => {}, recipeAct = null;
export function openLibrary(add, recipes, cat) { onAdd = add; recipeAct = recipes; if (cat) libCat = cat; renderLib(); openModal('libModal'); setTimeout(() => $('#libSearch').focus(), 50); }
function renderRecipes(q) {
  const all = [...RECIPES, ...userRecipes()].filter(r => !q || (r.name + ' ' + r.desc + ' ' + r.stack.map(s => s.type).join(' ')).toLowerCase().includes(q));
  const chip = s => `<span class="badge" style="color:${CATC[EFFECTS[s.type]?.cat] || '#aaa'}">${esc(EFFECTS[s.type]?.name || s.type)}</span>`;
  $('#libGrid').innerHTML = `<div class="lcard"><div class="pv" style="display:grid;place-items:center;background:linear-gradient(135deg,#ff7a3d22,#b98cff22)"><b style="font:600 30px var(--sans);color:var(--dim)">＋</b></div><div class="bd"><b>Save current stack</b><p>Keep your patch (effects and mappings) as a recipe in this browser.</p><div class="ft"><button class="btn" id="rcSave">Save…</button></div></div></div>`
    + all.map((r, i) => `<div class="lcard"><div class="pv"><canvas data-r="${i}" width="420" height="184"></canvas></div><div class="bd"><b>${esc(r.name)}</b><p>${esc(r.desc)}</p>
    <div class="recipe-fx">${r.stack.map(chip).join('')}</div>
    <div class="ft">${r.user ? `<button class="gen" data-rdel="${esc(r.name)}">Delete</button>` : `<span class="badge">${r.maps.length} MAPPINGS</span>`}<button class="btn" data-rapp="${i}" style="margin-left:auto" title="Add these effects (switched off) to the end of your stack, ready for scenes">Append</button><button class="btn primary" data-rload="${i}" style="margin-left:4px" title="Replace the stack (undo with ⌘Z)">Load</button></div></div></div>`).join('');
  $$('#libGrid canvas[data-r]').forEach(c => { const r = all[+c.dataset.r]; drawPreview(c, [EFFECTS[r.stack[0].type]?.cat || 'GLITCH', r.name]); });
  $$('[data-rload]').forEach(b => b.onclick = () => { closeModals(); recipeAct.load(all[+b.dataset.rload]); });
  $$('[data-rapp]').forEach(b => b.onclick = () => { closeModals(); recipeAct.append(all[+b.dataset.rapp]); });
  $$('[data-rdel]').forEach(b => b.onclick = () => { deleteUserRecipe(b.dataset.rdel); renderLib(); });
  $('#rcSave').onclick = () => { const n = prompt('Recipe name', S.name); if (n) { recipeAct.save(n.slice(0, 40)); renderLib(); } };
}
function renderLib() {
  const q = $('#libSearch').value.toLowerCase().trim();
  const cats = ['RECIPES', 'ALL', ...Object.keys(CATC).filter(c => c !== 'SOURCE' && LIB.some(l => l[0] === c))];
  const count = c => c === 'RECIPES' ? RECIPES.length + userRecipes().length : c === 'ALL' ? LIB.length : LIB.filter(l => l[0] === c).length;
  $('#cats').innerHTML = cats.map(c => `<button class="${c === libCat ? 'on' : ''}" data-c="${c}"><i style="background:${c === 'RECIPES' ? 'linear-gradient(135deg,#ff7a3d,#3de0ff)' : CATC[c] || '#fff'}"></i>${c}<em>${count(c)}</em></button>`).join('');
  $$('#cats button').forEach(b => b.onclick = () => { libCat = b.dataset.c; renderLib(); });
  if (libCat === 'RECIPES') { $('#libCount').textContent = 'ready-made patches to start from'; renderRecipes(q); return; }
  const items = LIB.filter(l => (libCat === 'ALL' || l[0] === libCat) && (!q || (l[1] + ' ' + l[2] + ' ' + l[0]).toLowerCase().includes(q)))
    .sort((a, b) => (a[3].type ? 0 : 1) - (b[3].type ? 0 : 1));
  $('#libCount').textContent = `${LIB.filter(l => l[3].type).length} ready · ${LIB.filter(l => !l[3].type).length} on the roadmap`;
  $('#libGrid').innerHTML = items.map(l => {
    const i = LIB.indexOf(l), ready = !!l[3].type;
    return `<div class="lcard ${ready ? '' : 'soon'}"><div class="pv"><canvas data-i="${i}" width="420" height="184"></canvas></div><div class="bd"><b>${esc(l[1])}</b><p>${esc(l[2])}</p>
    <div class="ft"><span class="badge" style="color:${CATC[l[0]]}">${l[0]}</span>${ready ? '' : `<span class="badge">PHASE ${l[3].phase}</span>`}${ready ? `<button class="btn" data-add="${l[3].type}">Add</button>` : ''}</div></div></div>`;
  }).join('') || '<p class="vinfo">Nothing matches.</p>';
  $$('#libGrid canvas').forEach(c => drawPreview(c, LIB[+c.dataset.i]));
  $$('[data-add]').forEach(b => b.onclick = () => { closeModals(); onAdd(b.dataset.add); });
}
function drawPreview(c, l) {
  const x = c.getContext('2d'), W = c.width, H = c.height, col = CATC[l[0]], seed = l[1].length * 7.3;
  x.fillStyle = '#08090c'; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, col + '40'); g.addColorStop(1, '#08090c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2;
  const k = l[0];
  if (k === 'GLITCH') { for (let i = 0; i < 26; i++) { x.globalAlpha = .2 + h1(i + seed) * .7; x.fillRect(h1(i * 3 + seed) * W, h1(i * 5 + seed) * H, 20 + h1(i * 7 + seed) * 120, 4 + h1(i * 9 + seed) * 26); } }
  else if (k === 'TRAILS') { for (let i = 0; i < 14; i++) { x.globalAlpha = 1 - i / 14; x.beginPath(); x.arc(W / 2 + i * 9, H / 2 - i * 3, 38 - i * 1.5, 0, 7); x.stroke(); } }
  else if (k === 'VINTAGE') { x.globalAlpha = .5; for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1); x.globalAlpha = 1; x.font = '600 22px JetBrains Mono'; x.fillText(seed > 40 ? '● REC' : '▤ CRT', 18, 36); }
  else if (k === 'SPATIAL') { for (let r = 0; r < 12; r++) for (let i = 0; i < 60; i++) { x.globalAlpha = .3 + r / 16; const u = i / 59; x.fillRect(u * W, H * .25 + r * 11 - Math.pow(vnoise(u * 6 + seed, r * .5), 2) * 50 * Math.exp(-(((u - .5) / .25) ** 2)), 2, 2); } }
  else if (k === 'TRACK') { [[.3, .45], [.65, .6]].forEach(([a, b]) => { x.strokeRect(a * W - 34, b * H - 26, 68, 52); x.font = '500 13px JetBrains Mono'; x.fillText('TRK_0' + (a > .5 ? 2 : 1), a * W + 44, b * H - 26); }); }
  else if (k === 'TIME') { for (let i = 0; i < 20; i++) { x.globalAlpha = .25 + .75 * (i / 20); x.fillRect(0, i * H / 20, W * (.3 + .6 * Math.abs(Math.sin(i * .4 + seed))), H / 20 - 2); } }
  else if (k === 'PLAYHEAD') { x.globalAlpha = .4; x.beginPath(); for (let i = 0; i < W; i++) x.lineTo(i, H / 2 + Math.sin(i * .07 + seed) * 28 * Math.sin(i * .013)); x.stroke(); x.globalAlpha = 1; x.fillRect(W * .62, 0, 3, H); }
  else if (k === 'STYLISE') { x.font = '500 12px JetBrains Mono'; for (let y = 14; y < H; y += 14) for (let i = 0; i < W; i += 10) { const v = vnoise(i * .02 + seed, y * .03); x.globalAlpha = v; x.fillText(' .:-=+*#%@'[Math.floor(v * 10)], i, y); } }
  else if (k === 'SIM') { for (let i = 0; i < 500; i++) { const a = h1(i) * 6.28, r = h1(i + seed) * 80; x.globalAlpha = .6; x.fillRect(W / 2 + Math.cos(a + r * .05) * r * 1.8, H / 2 + Math.sin(a + r * .05) * r, 2, 2); } }
  else if (k === 'ML') { const gr = x.createRadialGradient(W / 2, H * .6, 10, W / 2, H * .6, 120); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; }
  else { x.globalAlpha = .6; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * W / 8, 0); x.lineTo(i * W / 8, H); x.stroke(); } }
  x.globalAlpha = 1;
}
$('#libSearch').addEventListener('input', renderLib);

// ---------- export ----------
export function openExport(act) {
  const f = fmt(), dur = duration();
  $('#expInfo').textContent = `${S.name} · ${f.n} · ${dur.toFixed(1)} s`;
  const recOK = typeof MediaRecorder !== 'undefined', renderOK = typeof VideoEncoder !== 'undefined';
  $('#expBody').innerHTML = `
  <div><h4>VIDEO</h4>
    <div class="opt"><div class="row2" style="margin-top:0"><span class="vinfo">FPS</span><div class="seg" id="xFps"><button data-v="24" class="${S.fps === 24 ? 'on' : ''}">24</button><button data-v="30" class="${S.fps === 30 ? 'on' : ''}">30</button><button data-v="60" class="${S.fps === 60 ? 'on' : ''}">60</button></div>
      <span class="vinfo">MBPS</span><div class="seg" id="xBr"><button data-v="8">8</button><button data-v="20" class="on">20</button><button data-v="50">50</button></div></div>
      <div class="row2"><label class="chk"><input type="checkbox" id="xFromStart" checked> From the start</label><label class="chk"><input type="checkbox" id="xAudio" checked ${RT.audio ? '' : 'disabled'}> Include audio</label></div>
      <div class="spec">${f.n} · full resolution</div></div>
    <div class="opt ${renderOK ? 'on' : 'soon'}"><b>Frame-accurate render <span class="badge new">BEST</span></b><p>Renders every frame offline from the analysis, so it never drops a frame however heavy the stack is. It may run slower than real time. Video sources are stepped frame by frame.</p>
      <div class="row2"><button class="btn primary sm" id="xRender" ${renderOK ? '' : 'disabled'}>Render MP4</button></div><div class="spec">${renderOK ? 'MP4 · H.264 + AAC · WEBCODECS' : 'Needs WebCodecs (Chrome, Edge or Safari 17+)'}</div></div>
    <div class="opt"><b>Real-time capture</b><p>Plays the track and records the screen output with sound. It's quick, but slow machines can drop frames, and the tab must stay visible.</p>
      <div class="row2"><button class="btn rec sm" id="xRec" ${recOK ? '' : 'disabled'}>● Record</button></div><div class="spec">WEBM (Chrome / Firefox) · MP4 (Safari)</div></div>
    <div class="opt"><b>Still frame</b><p>Saves the current frame as a full-resolution PNG.</p><div class="row2"><button class="btn sm" id="xStill">Save PNG</button></div></div>
  </div>
  <div><h4>ANALYSIS DATA</h4>
    <div class="opt"><b>Feature curves</b><p>Every signal at 60 values/sec plus onsets, beat grid, sections and markers. Load it into TouchDesigner (Table DAT), Unreal, Blender, After Effects or Python.</p>
      <div class="row2"><button class="btn sm" id="xJson" ${RT.ana.mix ? '' : 'disabled'}>JSON</button><button class="btn sm" id="xCsv" ${RT.ana.mix ? '' : 'disabled'}>CSV</button>
      <select id="xRate"><option value="60">60 / sec</option><option value="30">30 / sec</option><option value="25">25 / sec</option><option value="24">24 / sec</option></select></div></div>
    <div class="opt"><b>Markers</b><p>Onsets, bars, sections and your markers as a CSV list of times.</p><div class="row2"><button class="btn sm" id="xMarks" ${RT.ana.mix ? '' : 'disabled'}>Markers CSV</button></div></div>
  </div>
  <div><h4>PROJECT</h4>
    <div class="opt"><b>Save project</b><p>Saves the stack, mappings, automation, markers and grid as a <code>.arav.json</code> file. Media files are <b>not</b> included, so keep them alongside it.</p><div class="row2"><input type="text" id="xName" value="${esc(S.name)}" style="flex:1"><button class="btn sm" id="xSave">Save</button></div></div>
    <div class="opt"><b>Open project</b><p>Loads a <code>.arav.json</code> file. You'll be reminded which media it used.</p><div class="row2"><button class="btn sm" id="xOpen">Open…</button></div></div>
  </div>`;
  $('#expFoot').innerHTML = `<span id="xStatus">${RT.audio ? '' : 'No audio loaded: the video will be 60 s of silence.'}</span>`;
  $$('#xFps button').forEach(b => b.onclick = () => { S.fps = +b.dataset.v; $$('#xFps button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#xBr button').forEach(b => b.onclick = () => $$('#xBr button').forEach(x => x.classList.toggle('on', x === b)));
  const vopts = () => ({ fps: S.fps, mbps: +$('#xBr button.on').dataset.v, fromStart: $('#xFromStart').checked, audio: $('#xAudio').checked });
  $('#xRec').onclick = () => { closeModals(); act.record(vopts()); };
  $('#xRender').onclick = () => { closeModals(); act.render(vopts()); };
  $('#xStill').onclick = () => act.still();
  $('#xJson').onclick = () => act.data('json', +$('#xRate').value);
  $('#xCsv').onclick = () => act.data('csv', +$('#xRate').value);
  $('#xMarks').onclick = () => act.markers();
  $('#xSave').onclick = () => { S.name = ($('#xName').value || 'untitled').replace(/[^\w\- ]+/g, '').slice(0, 60) || 'untitled'; act.save(); };
  $('#xOpen').onclick = () => { closeModals(); act.open(); };
  openModal('expModal');
}

// ---------- help ----------
export function openHelp() {
  $('#helpBody').innerHTML = `
  <h4>THE IDEA</h4>
  <p>ARAV listens to a track <b>once</b> and turns it into curves: kick, bass, brightness, onsets, beat position and more. You connect those curves to effect knobs. Because the analysis is precomputed, scrubbing, looping and recording always look the same.</p>
  <p>A knob's live value = <b>its base value</b> (or its automation curve) <b>+ depth × response</b> for every signal mapped to it. The <b>Response</b> panel shapes how a signal turns into movement.</p>
  <h4>THE SIX STEPS</h4>
  <p><b>Load</b> a track plus a video, image, webcam or generator. Files with drums / bass / vox in the name load as stems.</p>
  <p><b>Listen</b>: read the timeline. If the bar numbers drift, fix the BPM or press <b>Downbeat here</b> on a downbeat.</p>
  <p><b>Build</b> an effect stack. Order matters, and every card has a Mix control.</p>
  <p><b>Map</b>: drag signal chips onto knobs. Shift-drag a knob to change its depth.</p>
  <p><b>Shape</b>: Continuous follows the signal; Trigger fires a decaying pulse when it crosses the threshold; Gate is on/off. Attack and release smooth it, and the curve bends it.</p>
  <p><b>Export</b> a real-time recording, a still, the analysis data or the project.</p>
  <h4>SIGNALS</h4>
  <p><b>KICK / BASS / MID / HIGH</b>: energy in those frequency bands. <b>LOUD</b>: overall level. <b>BRIGHT</b>: spectral centroid, where the sound's "centre of mass" sits.</p>
  <p><b>NOISE</b>: spectral flatness (hiss and cymbals vs. notes). <b>ONSET</b>: a 1-frame spike at each new hit. <b>BEAT φ</b>: a 0→1 ramp every beat. <b>PAN</b>: stereo balance. <b>CHROMA</b>: harmony as a hue wheel. <b>SECTION</b>: steps through song sections.</p>
  <h4>SHORTCUTS</h4>
  <p><kbd>Space</kbd> play / pause · <kbd>Home</kbd> to start · <kbd>←</kbd><kbd>→</kbd> one beat (<kbd>⇧</kbd> one bar)</p>
  <p><kbd>1</kbd>–<kbd>6</kbd> steps · <kbd>G</kbd> guide · <kbd>F</kbd> fullscreen · <kbd>P</kbd> pop out · <kbd>⌘/Ctrl Z</kbd> undo</p>
  <p><b>⧉ POP OUT</b> opens the output in its own window for a projector or second screen (on its own screen automatically in Chrome/Edge, once you allow it). Double-click it, or press <kbd>F</kbd> in it, for full screen; keep editing in this window. It mirrors the preview exactly, so set the preview to FULL resolution and switch off A | B for a show.</p>
  <p>Knob: drag = value · <kbd>⇧</kbd> drag = depth · double-click = reset · right-click = automate / unmap</p>
  <p>Timeline: click = seek · <kbd>⌘/Ctrl</kbd> + wheel = zoom · <kbd>⇧</kbd> + wheel = scroll · double-click a section to rename it</p>
  <p>Scenes: <kbd>⇧1</kbd>–<kbd>⇧9</kbd> recall a scene · right-click a section = cue a scene · <kbd>⌥</kbd>-click a cue = delete</p>
  <h4>SCENES & RECIPES</h4>
  <p><b>Recipes</b> (Library → RECIPES) are ready-made patches. <b>Load</b> replaces your stack; <b>Append</b> adds the effects switched off, ready to be turned on in a scene. You can also save your own.</p>
  <p>A <b>scene</b> is a snapshot of the whole stack: which effects are on, their mix, and every knob. <b>＋ Capture</b> makes one. Click a scene to recall it.</p>
  <p><b>Cues</b> place scenes on the timeline (click the SCENE CUES lane, or right-click a section). With <b>FOLLOW CUES</b> on, the stack crossfades from scene to scene over the cue's fade (in beats). Mappings stay active the whole time, so audio still moves whatever the scene has set.</p>
  <p>Scenes only change when you <b>Capture</b> them or right-click → <b>Update from current stack</b>. Touching any control while cues are playing takes <b>manual control</b>: the current look stays on screen, FOLLOW CUES pauses, and your edits change the stack, not a scene. An effect added after a scene was captured is off in that scene. Automation lanes override scenes.</p>
  <h4>SPACE & TIME (PHASE 3)</h4>
  <p><b>Point Cloud</b> and <b>Ridge Lines</b> rebuild the image as 3D geometry with an orbiting camera; depth comes from brightness. <b>Plexus</b>, <b>Blob Callouts</b> and <b>Motion Boxes</b> analyse a small copy of each frame on the CPU, so they track what is actually in the picture.</p>
  <p><b>Slit-Scan</b>, <b>Echo Frames</b> and <b>Beat Repeat</b> keep the last few seconds of frames and show different moments at once. <b>Time Remap</b> changes the source's own clock (speed, reverse on hits, jumps), wherever it sits in the stack.</p>
  <p><b>Frame-accurate render</b> (Export) steps through the track one frame at a time and encodes an MP4 with sound, so it never drops frames however heavy the stack is.</p>
  <h4>AI, SIMULATIONS & 360 (PHASE 4)</h4>
  <p><b>Depth FX</b>, <b>Person Mask</b> and <b>Kinetic Lyrics</b> run AI models in your browser; nothing is uploaded. The models download the first time an effect needs them, and the status shows bottom right. <b>Person Mask</b> limits the effects <b>above</b> it to the figure or the background.</p>
  <p><b>Kinetic Lyrics</b>: press <b>Transcribe (Whisper)</b> or open <b>Project → Lyrics…</b> to type or correct words. A vocal stem gives far better results.</p>
  <p><b>Fluid</b>, <b>Reaction-Diffusion</b> and <b>Datamosh</b> are simulations that keep evolving from frame to frame. <b>Datamosh</b> needs moving footage; map ONSET to Keyframe to snap back on hits.</p>
  <p><b>360°</b>: pick a 360 format, then use <b>◎ LOOK</b> to drag around inside the sphere. A 4-channel AmbiX file drives <b>AZIM / ELEV</b>, and <b>Ambisonic Focus</b> puts the visual emphasis where the sound is.</p>
  <h4>WRITE YOUR OWN EFFECT</h4>
  <p>Copy <code>js/effects/TEMPLATE.js</code>, write a GLSL <code>effect(uv)</code> function, and register it in <code>js/effects/index.js</code>. Every param automatically becomes a mappable knob.</p>
  <p>The browser console shows shader errors, and the viewer shows them in red.</p>`;
  openModal('helpModal');
}

$$('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.remove('open'));
$$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) m.classList.remove('open'); }));
export { EFFECTS };
