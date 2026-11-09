// Run Whisper on the track (or the vocal stem) and store word timings in the project.
import { S, RT, commit } from '../state.js';
import { toast, esc } from '../util.js';

export const ASR = { state: 'off', p: 0, msg: '' };
let onChange = () => {};
export function initASR(cb) { onChange = cb || onChange; }

async function to16k(buffer) {
  const n = Math.ceil(buffer.duration * 16000), oc = new OfflineAudioContext(1, n, 16000), src = oc.createBufferSource();
  src.buffer = buffer; src.connect(oc.destination); src.start();
  const r = await oc.startRendering(); return r.getChannelData(0).slice();
}

export async function transcribe({ model = 'onnx-community/whisper-base_timestamped', useStem = true } = {}) {
  if (ASR.state === 'loading' || ASR.state === 'transcribing') return;
  const vox = useStem && RT.stems.find(s => /vox|vocal/i.test(s.key));
  const buf = vox ? vox.buffer : RT.audio?.buffer;
  if (!buf) { toast('Load a track first.'); return; }
  ASR.state = 'loading'; ASR.p = 0; ASR.msg = 'preparing audio'; onChange();
  const audio = await to16k(buf);
  const w = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  return new Promise(res => {
    w.onmessage = e => {
      const d = e.data;
      if (d.status === 'download') { ASR.p = d.p; ASR.msg = `downloading model ${Math.round(d.p * 100)}%`; onChange(); }
      else if (d.status === 'transcribing') { ASR.state = 'transcribing'; ASR.msg = `transcribing ${vox ? 'vocal stem' : 'mix'}… (≈ ${Math.ceil(buf.duration / 8)} s+)`; onChange(); }
      else if (d.status === 'done') {
        w.terminate(); S.lyrics = d.words; commit('lyrics');
        ASR.state = 'ready'; ASR.msg = `${d.words.length} words`; onChange();
        toast(d.words.length ? `Transcribed <b>${d.words.length}</b> words. Edit them under Project → Lyrics.` : 'No words were found. Try a vocal stem, or type lyrics in Project → Lyrics.', 5000);
        res(d.words);
      } else if (d.status === 'error') {
        w.terminate(); ASR.state = 'error'; ASR.msg = d.message; onChange();
        toast('Transcription failed: ' + esc(d.message), 6000); res(null);
      }
    };
    w.onerror = e => { w.terminate(); ASR.state = 'error'; ASR.msg = e.message; onChange(); toast('Transcription worker failed: ' + esc(e.message || ''), 6000); res(null); };
    w.postMessage({ audio, model }, [audio.buffer]);
  });
}

// "0.52 hello" per line  ⇄  [{text, t0, t1}]
export function lyricsToText(words) { return (words || []).map(w => `${w.t0.toFixed(2)}\t${w.text}`).join('\n'); }
export function textToLyrics(txt) {
  const out = [];
  for (const line of txt.split('\n')) {
    const m = line.trim().match(/^(\d+(?:\.\d+)?)\s+(.+)$/); if (!m) continue;
    for (const [i, word] of m[2].split(/\s+/).entries()) out.push({ text: word, t0: +m[1] + i * 0.25, t1: 0 });
  }
  out.sort((a, b) => a.t0 - b.t0);
  out.forEach((w, i) => { w.t1 = Math.min(out[i + 1] ? out[i + 1].t0 : w.t0 + 0.6, w.t0 + 1.2); });
  return out;
}
