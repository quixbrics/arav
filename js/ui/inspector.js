// Inspector (knobs + mappings) and Response editor.
import { S, RT, SRC_UID, fxItem, paramDefs, paramStore, fxName, fxCat, newMap, commit, touch, autoKey, setSourceKind, duration } from '../state.js';
import { SIG, SIGS } from '../signals.js';
import { EFFECTS, CATC } from '../effects/index.js';
import { GENS, media } from '../source.js';
import { curveExp, shape, responseCurve, signalArray, baseValue } from '../mod.js';
import { $, $$, clamp, esc, toast } from '../util.js';
import { menu } from './modals.js';
import { addAutomation, snapT } from './timeline.js';
import { takeManual, activeScene } from '../scenes.js';

const A0 = -0.75 * Math.PI, A1 = 0.75 * Math.PI, ang = v => A0 + (A1 - A0) * clamp(v);
function arc(r, a0, a1) {
  if (a1 < a0) [a0, a1] = [a1, a0]; if (a1 - a0 < 0.001) a1 = a0 + 0.001;
  const p = a => [29 + r * Math.sin(a), 29 - r * Math.cos(a)], [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const mapsFor = (id, k) => S.maps.filter(m => m.fx === id && (k === undefined || m.p === k));
let knobEls = [];
export let hooks = { onSourcePick: () => {}, onAction: () => {} };
function extras(f) {
  const d = f && EFFECTS[f.type]; if (!d) return '';
  const acts = d.actions ? `<div class="row2">${d.actions.map(a => `<button class="gen" data-act="${a.id}">${esc(a.label)}</button>`).join('')}</div>` : '';
  return acts + (d.needs ? '<p class="insp-desc mono" id="mlLine" style="color:var(--accent)"></p>' : '');
}

export function renderInspector() {
  const id = RT.sel.fx, el = $('#insp');
  if (!id || (id !== SRC_UID && !fxItem(id))) { el.innerHTML = '<h3>Inspector</h3><div class="empty">Select a card in the effect stack.</div>'; knobEls = []; return; }
  const isSrc = id === SRC_UID, f = fxItem(id), cat = fxCat(id), defs = paramDefs(id), store = paramStore(id);
  const desc = isSrc ? (S.source.kind === 'gen' ? 'Built-in generator, drawn on the GPU. Its knobs are mappable too: try KICK → Pulse.' : 'Your footage. Zoom and pan to frame it; Fit shows the whole image with borders.') : EFFECTS[f.type].desc;
  let head = '';
  if (isSrc) {
    head = `<div class="row2"><select id="srcPick">
      <optgroup label="Generators">${Object.entries(GENS).map(([k, g]) => `<option value="gen:${k}" ${S.source.kind === 'gen' && S.source.gen === k ? 'selected' : ''}>${g.n}</option>`).join('')}</optgroup>
      <optgroup label="Media">${media.el ? `<option value="media" ${S.source.kind !== 'gen' ? 'selected' : ''}>${esc(media.name)}</option>` : ''}<option value="open">Open video / image…</option><option value="webcam">Webcam</option></optgroup></select>
      ${S.source.kind === 'webcam' ? `<div class="toggle ${S.source.mirror ? 'on' : ''}" id="mirrorT"><i></i>MIRROR</div>` : ''}</div>`;
  }
  el.innerHTML = `<h3>Inspector <span><span class="editing" id="scBadge" style="display:none" title="The cues are playing this scene. Touching a control takes manual control: FOLLOW CUES pauses and the scene itself is left unchanged."></span> <span style="color:${CATC[cat]}">${cat}</span></span></h3>
    <div class="insp-head"><b>${esc(fxName(id))}</b>${isSrc ? '' : `<span style="margin-left:auto" class="vinfo">MIX</span><input type="range" id="mix" min="0" max="1" step=".01" value="${f.mix}" style="width:90px">`}</div>
    <p class="insp-desc">${esc(desc)}</p>${head}${extras(f)}
    <div class="knobs" id="knobs">${defs.map(p => {
      const ms = mapsFor(id, p.k), auto = !!S.auto[autoKey(id, p.k)];
      return `<div class="knob ${ms.some(m => m.id === RT.sel.map) ? 'selmap' : ''}" data-k="${p.k}" title="${esc(p.n)}: drag to set · ⇧drag depth · double-click reset · right-click for more">
        <svg viewBox="0 0 58 58"><path d="${arc(19, A0, A1)}" stroke="#2a2f37" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path class="kb" stroke="${auto ? '#b98cff' : '#d9dce1'}" stroke-width="4" fill="none" stroke-linecap="round"/>
        ${ms.map(m => `<path class="kr" data-m="${m.id}" stroke="${SIG[m.sig].c}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".9"/>`).join('')}
        <circle cx="29" cy="29" r="12" fill="#13161a" stroke="#2e333b"/><line class="ki" x1="29" y1="29" x2="29" y2="19" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        <circle class="kd" r="2.6" fill="#fff"/></svg>
        <span class="val mono"></span><span class="lbl">${esc(p.n)}</span>
        ${auto ? '<span class="atag">AUTO</span>' : ''}<span class="mtag" style="background:${ms[0] ? SIG[ms[0].sig].c : 'transparent'}">${ms.map(m => SIG[m.sig].n).join('+')}</span></div>`;
    }).join('')}</div>
    <div class="maplist" id="maplist"></div>`;
  if (!isSrc) { const mx = $('#mix'); mx.oninput = () => { takeManual(); f.mix = +mx.value; touch('mix'); }; mx.onchange = () => commit('mix'); }
  $$('#insp [data-act]').forEach(b => b.onclick = () => hooks.onAction(b.dataset.act, id));
  const sp = $('#srcPick'); if (sp) sp.onchange = () => { const v = sp.value; hooks.onSourcePick(v); };
  const mt = $('#mirrorT'); if (mt) mt.onclick = () => { S.source.mirror = !S.source.mirror; commit('source'); };

  knobEls = $$('#knobs .knob').map(kel => {
    const k = kel.dataset.k, def = defs.find(d => d.k === k);
    kel.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/sig')) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; kel.classList.add('drop'); } });
    kel.addEventListener('dragleave', () => kel.classList.remove('drop'));
    kel.addEventListener('drop', e => {
      e.preventDefault(); kel.classList.remove('drop');
      const [sig, src = 'mix'] = e.dataTransfer.getData('text/sig').split('|'); if (!SIG[sig]) return;
      const ex = S.maps.find(m => m.fx === id && m.p === k && m.sig === sig && m.src === src);
      if (ex) RT.sel.map = ex.id;
      else {
        const m = newMap(id, k, sig, { src, depth: 0.4, mode: SIG[sig].k === 'TRIG' ? 'trig' : 'cont', rel: SIG[sig].k === 'TRIG' ? 0.2 : 0.25 });
        S.maps.push(m); RT.sel.map = m.id;
      }
      RT.sel.param = { fx: id, k };
      commit('maps');
      if (RT.stage === 'map') toast(`Mapped <b>${SIG[sig].n}</b> → ${esc(def.n)}. Shape it in <b>Response</b>, or shift-drag the knob for depth.`);
    });
    kel.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const ms = mapsFor(id, k), sm = ms.find(m => m.id === RT.sel.map) || ms[0];
      RT.sel.param = { fx: id, k };
      if (sm && sm.id !== RT.sel.map) { RT.sel.map = sm.id; renderShape(); $$('#knobs .knob').forEach(x => x.classList.toggle('selmap', x === kel)); $$('#maplist .maprow').forEach(r => r.classList.toggle('sel', r.dataset.m === sm.id)); }
      kel.setPointerCapture(e.pointerId);
      let y = e.clientY, moved = false;
      const akey = autoKey(id, k);
      const mv = ev => {
        const d = (y - ev.clientY) / (ev.altKey ? 600 : 160); y = ev.clientY; if (!d) return; moved = true;
        if (ev.shiftKey && sm) { sm.depth = clamp(sm.depth + d); syncShape(); }
        else if (S.auto[akey]) {
          const keys = S.auto[akey], t = RT.t; let kk = keys.find(q => Math.abs(q[0] - t) < 0.15);
          if (!kk) { kk = [clamp(snapT(t), 0, duration()), baseValue(id, k, t)]; keys.push(kk); keys.sort((a, b) => a[0] - b[0]); }
          kk[1] = clamp(kk[1] + d);
        } else { takeManual(); store[k] = clamp(baseValue(id, k, RT.t) + d); }
        touch('knob');
      };
      const up = () => { kel.removeEventListener('pointermove', mv); kel.removeEventListener('pointerup', up); if (moved) commit('knob'); };
      kel.addEventListener('pointermove', mv); kel.addEventListener('pointerup', up);
    });
    kel.addEventListener('dblclick', () => { if (S.auto[autoKey(id, k)]) return; takeManual(); store[k] = def.v; commit('knob'); });
    kel.addEventListener('contextmenu', e => {
      e.preventDefault(); RT.sel.param = { fx: id, k };
      const ms = mapsFor(id, k), akey = autoKey(id, k);
      menu(kel, [
        S.auto[akey] ? { label: 'Remove automation', fn: () => { delete S.auto[akey]; commit('auto'); } } : { label: 'Automate on timeline', fn: () => addAutomation(id, k) },
        { label: 'Reset to default', fn: () => { takeManual(); store[k] = def.v; commit('knob'); } },
        ...(ms.length ? ['-', ...ms.map(m => ({ label: `Unmap ${SIG[m.sig].n}${m.src !== 'mix' ? ' · ' + m.src : ''}`, fn: () => removeMap(m.id) }))] : []),
        '-', ...SIGS.slice(0, 8).map(s => ({ label: `Map ${s.n}`, fn: () => { const m = newMap(id, k, s.id, { src: RT.chipSrc || 'mix', depth: 0.4, mode: s.k === 'TRIG' ? 'trig' : 'cont' }); S.maps.push(m); RT.sel.map = m.id; commit('maps'); } })),
      ], { x: e.clientX, y: e.clientY });
    });
    return { el: kel, k, kb: kel.querySelector('.kb'), ki: kel.querySelector('.ki'), kd: kel.querySelector('.kd'), val: kel.querySelector('.val'), rings: [...kel.querySelectorAll('.kr')] };
  });
  renderMapList();
}

function renderMapList() {
  const id = RT.sel.fx, ms = mapsFor(id), defs = paramDefs(id);
  $('#maplist').innerHTML = ms.length ? ms.map(m => `<div class="maprow ${m.id === RT.sel.map ? 'sel' : ''}" data-m="${m.id}"><i style="background:${SIG[m.sig].c}"></i>${SIG[m.sig].n}${m.src !== 'mix' ? `<span class="arrow">·${esc(m.src)}</span>` : ''}<span class="arrow">→</span>${esc(defs.find(d => d.k === m.p)?.n || m.p)}<span class="dp">${m.mode === 'trig' ? 'TRIG ' : m.mode === 'gate' ? 'GATE ' : ''}${Math.round(m.depth * 100)}%</span><span class="x" data-x title="Remove mapping">✕</span></div>`).join('')
    : `<div class="empty">No mappings yet.<br>Drag a signal chip from the left onto a knob.</div>`;
  $$('#maplist .maprow').forEach(r => r.onclick = e => {
    if (e.target.closest('[data-x]')) { removeMap(r.dataset.m); return; }
    RT.sel.map = r.dataset.m; const m = S.maps.find(x => x.id === r.dataset.m); RT.sel.param = { fx: m.fx, k: m.p };
    renderInspector(); renderShape();
  });
}
function removeMap(mid) {
  S.maps = S.maps.filter(m => m.id !== mid);
  if (RT.sel.map === mid) RT.sel.map = (S.maps.find(m => m.fx === RT.sel.fx) || {}).id || null;
  commit('maps');
}

let badgeFor = undefined;
export function updateSceneBadge(force) {
  const sc = activeScene(RT.t), b = $('#scBadge'); if (!b) return;
  const id = sc ? sc.id : null; if (id === badgeFor && !force && b.dataset.done) return; badgeFor = id; b.dataset.done = 1;
  b.style.display = sc ? '' : 'none'; if (sc) { b.style.background = sc.c; b.textContent = '▶ ' + sc.name; }
}
export function updateKnobs() {
  const id = RT.sel.fx, live = RT.vals[id]; if (!live) return;
  for (const k of knobEls) {
    const base = baseValue(id, k.k, RT.t), lv = live[k.k] ?? base, a = ang(base), al = ang(lv);
    k.kb.setAttribute('d', arc(19, A0, a));
    k.ki.setAttribute('x2', 29 + 10 * Math.sin(al)); k.ki.setAttribute('y2', 29 - 10 * Math.cos(al));
    k.kd.setAttribute('cx', 29 + 19 * Math.sin(al)); k.kd.setAttribute('cy', 29 - 19 * Math.cos(al));
    k.rings.forEach((r, i) => { const m = S.maps.find(x => x.id === r.dataset.m); if (m) r.setAttribute('d', arc(23.5 + i * 3.5, a, ang(base + m.depth))); });
    k.val.textContent = Math.round(lv * 100);
  }
}

// ---------------- Response editor ----------------
export function renderShape() {
  const m = S.maps.find(x => x.id === RT.sel.map), body = $('#shapeBody');
  if (!m) { body.innerHTML = '<div class="empty">Select a mapping (click a coloured knob or a row in the Inspector) to shape how the sound moves it.</div>'; return; }
  const s = SIG[m.sig], def = paramDefs(m.fx).find(d => d.k === m.p);
  const srcs = ['mix', ...RT.stems.map(x => x.key)];
  const SL = (k, n, min, max, step, f) => `<div class="sl" data-sl="${k}"><label>${n}<span data-o="${k}"></span></label><input type="range" data-k="${k}" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${m[k]}"></div>`;
  body.innerHTML = `<div class="shape-title"><span class="sig" style="background:${s.c}">${s.n}</span><span class="ar">→</span>${esc(fxName(m.fx))} <span class="ar">›</span> ${esc(def ? def.n : m.p)}</div>
   <div class="row2"><select id="mSig">${SIGS.map(x => `<option value="${x.id}" ${x.id === m.sig ? 'selected' : ''}>${x.n}</option>`).join('')}</select>
     <select id="mSrc" title="Which audio this mapping listens to">${srcs.map(x => `<option value="${x}" ${x === m.src ? 'selected' : ''}>${x === 'mix' ? 'Full mix' : 'Stem: ' + esc(x)}</option>`).join('')}</select></div>
   <div class="row2"><div class="seg" id="modeSeg"><button data-v="cont">CONTINUOUS</button><button data-v="trig">TRIGGER</button><button data-v="gate">GATE</button></div>
     <div class="toggle ${m.inv ? 'on' : ''}" id="invT" title="Flip the signal: loud becomes quiet"><i></i>INVERT</div></div>
   <div class="plots"><div class="plot"><small>CURVE</small><canvas id="cvT" width="236" height="236"></canvas></div>
     <div class="plot"><small>IN <span style="color:#777">━</span> OUT <span style="color:${s.c}">━</span> · −3 s … +1 s</small><canvas id="cvS" width="440" height="236"></canvas></div></div>
   <div class="sliders">${SL('depth', 'Depth', 0, 1, .01, 'pct')}${SL('curve', 'Curve', 0, 1, .01, 'curve')}${SL('atk', 'Attack', 0, .5, .005, 'ms')}${SL('rel', 'Release', 0, 2, .01, 'ms')}${SL('lo', 'Range low', 0, 1, .01, 'pct')}${SL('hi', 'Range high', 0, 1, .01, 'pct')}${SL('thr', 'Threshold', 0, 1, .01, 'pct')}</div>
   <div class="row2"><button class="gen" id="mPreset1" title="Fast attack, short release">Punchy</button><button class="gen" id="mPreset2" title="Slow attack and release">Smooth</button><button class="gen" id="mPreset3" title="Trigger on hits">Hit</button><span style="flex:1"></span><button class="gen" id="mDel" style="color:var(--rec)">Remove</button></div>`;
  $$('#modeSeg button').forEach(b => { b.classList.toggle('on', b.dataset.v === m.mode); b.onclick = () => { m.mode = b.dataset.v; commit('maps'); }; });
  $('#invT').onclick = () => { m.inv = !m.inv; commit('maps'); };
  $('#mSig').onchange = e => { m.sig = e.target.value; commit('maps'); };
  $('#mSrc').onchange = e => { m.src = e.target.value; commit('maps'); };
  $('#mDel').onclick = () => removeMap(m.id);
  $('#mPreset1').onclick = () => { Object.assign(m, { mode: 'cont', atk: 0.005, rel: 0.12, curve: 0.65 }); commit('maps'); };
  $('#mPreset2').onclick = () => { Object.assign(m, { mode: 'cont', atk: 0.25, rel: 1.2, curve: 0.45 }); commit('maps'); };
  $('#mPreset3').onclick = () => { Object.assign(m, { mode: 'trig', rel: 0.2, thr: m.sig === 'onset' ? 0.5 : 0.6 }); commit('maps'); };
  $$('#shapeBody input[type=range]').forEach(i => { i.oninput = () => { m[i.dataset.k] = +i.value; syncShape(true); touch('shape'); }; i.onchange = () => commit('shape'); });
  syncShape();
}
export function syncShape(fromSlider) {
  const m = S.maps.find(x => x.id === RT.sel.map); if (!m) return;
  $$('#shapeBody input[type=range]').forEach(i => {
    const k = i.dataset.k, v = m[k], f = i.dataset.f; if (!fromSlider) i.value = v;
    const o = $(`[data-o="${k}"]`); if (o) o.textContent = f === 'pct' ? Math.round(v * 100) + '%' : f === 'ms' ? Math.round(v * 1000) + ' ms' : (curveExp(v) < 0.97 ? 'soft ' : curveExp(v) > 1.03 ? 'hard ' : 'linear ') + curveExp(v).toFixed(2);
  });
  const thr = $('[data-sl="thr"]'); if (thr) thr.classList.toggle('dis', m.mode === 'cont');
  const atk = $('[data-sl="atk"]'); if (atk) atk.classList.toggle('dis', m.mode === 'trig');
  const dp = $(`.maprow[data-m="${m.id}"] .dp`); if (dp) dp.textContent = `${m.mode === 'trig' ? 'TRIG ' : m.mode === 'gate' ? 'GATE ' : ''}${Math.round(m.depth * 100)}%`;
}
export function drawShapePlots() {
  const m = S.maps.find(x => x.id === RT.sel.map), cT = $('#cvT'), cS = $('#cvS'); if (!m || !cT || !cS) return;
  const col = SIG[m.sig].c, a = RT.ana[m.src] || RT.ana.mix;
  let x = cT.getContext('2d'), W = cT.width, H = cT.height;
  x.clearRect(0, 0, W, H); x.strokeStyle = '#1d2127'; x.lineWidth = 1;
  for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, H); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke(); }
  x.strokeStyle = col; x.lineWidth = 4; x.beginPath();
  for (let i = 0; i <= 60; i++) { const u = i / 60, v = shape(m, u); x[i ? 'lineTo' : 'moveTo'](u * W, H - 4 - v * (H - 8)); }
  x.stroke();
  if (m.mode !== 'cont') { x.strokeStyle = 'rgba(255,61,113,.6)'; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(m.thr * W, 0); x.lineTo(m.thr * W, H); x.stroke(); x.setLineDash([]); }
  const rc = responseCurve(m);
  x = cS.getContext('2d'); W = cS.width; H = cS.height; x.clearRect(0, 0, W, H);
  if (!a || !rc) { x.fillStyle = '#4b515a'; x.font = '22px JetBrains Mono'; x.fillText('load audio to see the response', 20, H / 2); return; }
  const inp = a.f[m.sig], t0 = RT.t - 3, t1 = RT.t + 1, N = 220;
  const at = (arr, t) => { const i = Math.round(t * a.rate); return i < 0 || i >= arr.length ? 0 : arr[i]; };
  x.lineWidth = 2.5; x.strokeStyle = '#5a606a'; x.beginPath();
  for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; let v = at(inp, t); if (m.inv) v = 1 - v; x[i ? 'lineTo' : 'moveTo'](i / N * W, H - 6 - v * (H - 12)); }
  x.stroke();
  x.lineWidth = 4; x.strokeStyle = col; x.beginPath();
  for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; x[i ? 'lineTo' : 'moveTo'](i / N * W, H - 6 - at(rc, t) * (H - 12)); }
  x.stroke();
  const px = 3 / 4 * W; x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(px, 0, 2, H);
  // live dot on the curve graph
  let iv = at(inp, RT.t); if (m.inv) iv = 1 - iv;
  const c2 = cT.getContext('2d'), ov = at(rc, RT.t);
  c2.fillStyle = '#fff'; c2.beginPath(); c2.arc(iv * cT.width, cT.height - 4 - ov * (cT.height - 8), 7, 0, 7); c2.fill();
}
