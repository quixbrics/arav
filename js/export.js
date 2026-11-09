// Exports: real-time recording, stills, analysis data, markers, project file.
import { S, RT, grid, duration, serialise } from './state.js';
import { SIGS } from './signals.js';
import { sectionName } from './ui/timeline.js';
import { download, sampleAt } from './util.js';

export function pickMime(audio) {
  const c = audio
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  // prefer webm on Chrome/Firefox (more reliable), mp4 where webm isn't supported (Safari)
  const webmFirst = c.filter(m => m.includes('webm')).concat(c.filter(m => !m.includes('webm')));
  return webmFirst.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

export function startRecorder(canvas, audioStream, { fps, mbps }) {
  const vs = canvas.captureStream(fps);
  const stream = new MediaStream([...vs.getVideoTracks(), ...(audioStream ? audioStream.getAudioTracks() : [])]);
  const mime = pickMime(!!audioStream);
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: mbps * 1e6, audioBitsPerSecond: 256000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => { rec.onstop = () => { vs.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' })); }; });
  rec.start(1000);
  return { rec, done, ext: (rec.mimeType || mime).includes('mp4') ? 'mp4' : 'webm' };
}

export function saveStill(canvas) {
  canvas.toBlob(b => download(b, `${S.name}_${RT.t.toFixed(2)}s.png`), 'image/png');
}

function frames(rate) {
  const a = RT.ana.mix, n = Math.floor(a.duration * rate), out = [];
  const srcs = Object.keys(RT.ana);
  for (let i = 0; i < n; i++) {
    const t = i / rate, row = { t: +t.toFixed(4) };
    for (const src of srcs) {
      const an = RT.ana[src], pre = src === 'mix' ? '' : src + '_';
      for (const s of SIGS) {
        let v;
        if (s.id === 'onset') { const j0 = Math.floor(t * an.rate), j1 = Math.floor((t + 1 / rate) * an.rate); v = 0; for (let j = j0; j < j1; j++) if (an.f.onset[j]) v = 1; }
        else v = sampleAt(an.f[s.id], an.rate, t);
        row[pre + s.id] = +v.toFixed(4);
      }
    }
    out.push(row);
  }
  return out;
}

export function exportData(kind, rate) {
  const a = RT.ana.mix; if (!a) return;
  const g = grid(), rows = frames(rate);
  if (kind === 'csv') {
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => r[c]).join(','))].join('\n');
    download(new Blob([csv], { type: 'text/csv' }), `${S.name}_analysis_${rate}fps.csv`);
  } else {
    const json = {
      generator: 'ARAV', version: 1, audio: RT.audio?.name, duration: a.duration, rate, bpm: g.bpm, beatOffset: g.offset, key: a.key,
      signals: Object.fromEntries(SIGS.map(s => [s.id, s.d])),
      sections: a.sections.map((s, i) => ({ name: sectionName(i, s), start: +s.a.toFixed(3), end: +s.b.toFixed(3), energy: +s.e.toFixed(3) })),
      onsets: [...a.onsetTimes].map(t => +t.toFixed(4)), markers: S.markers,
      sceneCues: S.cues.map(c => ({ t: +c.t.toFixed(4), scene: S.scenes.find(s => s.id === c.scene)?.name, fadeBeats: c.fade })), frames: rows,
    };
    download(new Blob([JSON.stringify(json)], { type: 'application/json' }), `${S.name}_analysis_${rate}fps.json`);
  }
}

export function exportMarkers() {
  const a = RT.ana.mix; if (!a) return;
  const g = grid(), bar = 4 * 60 / g.bpm, lines = ['time_s,type,name'];
  a.sections.forEach((s, i) => lines.push(`${s.a.toFixed(4)},section,"${sectionName(i, s)}"`));
  S.markers.forEach(m => lines.push(`${m.t.toFixed(4)},marker,"${m.name}"`));
  S.cues.forEach(c => { const sc = S.scenes.find(s => s.id === c.scene); if (sc) lines.push(`${c.t.toFixed(4)},scene,"${sc.name}"`); });
  for (let t = g.offset, b = 1; t < a.duration; t += bar, b++) if (t >= 0) lines.push(`${t.toFixed(4)},bar,${b}`);
  a.onsetTimes.forEach(t => lines.push(`${t.toFixed(4)},onset,`));
  const sorted = [lines[0], ...lines.slice(1).sort((x, y) => parseFloat(x) - parseFloat(y))];
  download(new Blob([sorted.join('\n')], { type: 'text/csv' }), `${S.name}_markers.csv`);
}

export function saveProjectFile() {
  const obj = JSON.parse(serialise());
  obj.media = { audio: RT.audio?.name || null, stems: RT.stems.map(s => s.name), visual: S.source.kind === 'gen' ? null : S.media.visual || null };
  download(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), `${S.name}.arav.json`);
}
export { duration };
