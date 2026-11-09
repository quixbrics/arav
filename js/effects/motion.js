import { findBlobs, track, drawCallouts, CALLOUT_PARAMS, CALLOUT_GLSL } from './blobkit.js';

// Motion boxes: compares each frame with the last and boxes whatever moved.
export default {
  type: 'motion', name: 'Motion Boxes', cat: 'TRACK',
  desc: 'Boxes whatever moved since the last frame, with tracking IDs and data labels. Works best on video or webcam.',
  probe: { w: 160, h: 90 },
  params: [
    { k: 'sens', n: 'Sensitivity', v: 0.5 },
    { k: 'hold', n: 'Hold', v: 0.3 },
    ...CALLOUT_PARAMS,
  ],
  cpu(px, w, h, p, fr, st) {
    const n = w * h, cur = new Uint8Array(n);
    for (let i = 0; i < n; i++) cur[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
    const prev = st.prev; st.prev = cur;
    if (!prev || Math.abs(fr.t - (st.lastT ?? -9)) < 1e-4) { st.lastT = fr.t; return; }
    st.lastT = fr.t;
    const thr = 6 + (1 - p.sens) * 60, raw = new Uint8Array(n), m = new Uint8Array(n);
    for (let i = 0; i < n; i++) raw[i] = Math.abs(cur[i] - prev[i]) > thr;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {           // dilate to merge nearby motion
      const i = y * w + x; m[i] = raw[i] | raw[i - 1] | raw[i + 1] | raw[i - w] | raw[i + w] | raw[i - w - 1] | raw[i + w + 1];
    }
    const blobs = findBlobs(m, w, h, 6 + p.minsize * 200);
    st.show = track(st, blobs, 1 + Math.round(p.boxes * 11), p.smooth, Math.round(p.hold * 30));
  },
  overlay(ctx, W, H, p, fr, st) { drawCallouts(ctx, W, H, st.show || [], p, fr, 'MOV'); },
  glsl: CALLOUT_GLSL,
};
