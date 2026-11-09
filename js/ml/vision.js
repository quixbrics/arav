// In-browser ML for the picture:
//   • Depth Anything V2 (small) via transformers.js — WebGPU when available, else WASM
//   • MediaPipe selfie segmentation — person mask
// Models download on first use (≈25–50 MB for depth, ≈250 KB for the mask) and are
// cached by the browser. Results are uploaded as global textures (uDepth, uMask)
// that any effect can read.
import { toast } from '../util.js';

const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';
const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const SELFIE = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export const ML = {
  depth: { state: 'off', p: 0, msg: '', busy: false, last: -1, pipe: null, rawCtor: null, ms: 0 },
  mask: { state: 'off', p: 0, msg: '', busy: false, last: -1, seg: null, ms: 0 },
};
let engine = null, onChange = () => {};
export function initML(e, cb) { engine = e; onChange = cb || onChange; }

// grab the current SOURCE frame (before effects) as a top-down canvas
function grabSource(w, h) {
  const px = engine.probe('__ml_' + w, engine.tSrc.tex, w, h);
  const c = grabSource.c || (grabSource.c = document.createElement('canvas'));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  x.putImageData(img, 0, 0);
  return { canvas: c, img };
}

// ---------------- depth ----------------
export async function loadDepth() {
  const D = ML.depth; if (D.state === 'ready' || D.state === 'loading') return;
  D.state = 'loading'; D.p = 0; D.msg = 'loading library'; onChange();
  try {
    const { pipeline, env, RawImage } = await import(TF_URL);
    env.allowLocalModels = false;
    const device = navigator.gpu ? 'webgpu' : 'wasm';
    const files = {};
    D.pipe = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', {
      device, dtype: device === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: e => { if (e.status === 'progress' && e.total) { files[e.file] = [e.loaded, e.total]; const a = Object.values(files).reduce((s, [l, t]) => [s[0] + l, s[1] + t], [0, 0]); D.p = a[0] / a[1]; D.msg = `downloading model ${Math.round(D.p * 100)}%`; onChange(); } },
    });
    D.rawCtor = RawImage; D.device = device; D.state = 'ready'; D.msg = device === 'webgpu' ? 'ready (GPU)' : 'ready (CPU, slower)'; onChange();
  } catch (e) { console.error(e); D.state = 'error'; D.msg = 'failed: ' + (e.message || e); onChange(); toast('Depth model failed to load: ' + (e.message || e), 6000); }
}
export async function runDepth() {
  const D = ML.depth; if (D.state !== 'ready' || D.busy) return false;
  D.busy = true; const t0 = performance.now();
  try {
    const w = 448, h = Math.max(16, Math.round(w * engine.H / engine.W / 14) * 14);
    const { img } = grabSource(w, h);
    const raw = new D.rawCtor(img.data, w, h, 4);
    const out = await D.pipe(raw);
    engine.setGlobal('depth', out.depth.toCanvas());
    D.ms = performance.now() - t0; D.frames = (D.frames || 0) + 1;
  } catch (e) { console.warn('depth', e); }
  D.busy = false; return true;
}

// ---------------- person mask ----------------
export async function loadMask() {
  const M = ML.mask; if (M.state === 'ready' || M.state === 'loading') return;
  M.state = 'loading'; M.msg = 'loading'; onChange();
  try {
    const { FilesetResolver, ImageSegmenter } = await import(MP_URL + '/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(MP_URL + '/wasm');
    const make = delegate => ImageSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: SELFIE, delegate }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
    try { M.seg = await make('GPU'); } catch (e) { M.seg = await make('CPU'); }
    M.state = 'ready'; M.msg = 'ready'; onChange();
  } catch (e) { console.error(e); M.state = 'error'; M.msg = 'failed: ' + (e.message || e); onChange(); toast('Person mask failed to load: ' + (e.message || e), 6000); }
}
export function runMask() {
  const M = ML.mask; if (M.state !== 'ready') return false;
  const t0 = performance.now();
  try {
    const w = 256, h = Math.max(16, Math.round(w * engine.H / engine.W));
    const { canvas } = grabSource(w, h);
    const r = M.seg.segment(canvas);
    const m = r.confidenceMasks && r.confidenceMasks[0];
    if (m) {
      const f = m.getAsFloat32Array(), mw = m.width, mh = m.height;
      const c = runMask.c || (runMask.c = document.createElement('canvas'));
      if (c.width !== mw || c.height !== mh) { c.width = mw; c.height = mh; }
      const x = c.getContext('2d'), img = x.createImageData(mw, mh);
      for (let i = 0; i < f.length; i++) { const v = f[i] * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      x.putImageData(img, 0, 0);
      engine.setGlobal('mask', c);
    }
    r.close && r.close();
    M.ms = performance.now() - t0;
  } catch (e) { console.warn('mask', e); }
  return true;
}

export function mlStatusText() {
  const parts = [];
  for (const [k, n] of [['depth', 'DEPTH'], ['mask', 'MASK']]) { const s = ML[k]; if (s.state !== 'off') parts.push(`${n} ${s.state === 'ready' ? (s.ms ? Math.round(s.ms) + 'ms' : 'ready') : s.msg}`); }
  return parts.join(' · ');
}
