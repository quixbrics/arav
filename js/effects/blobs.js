import { findBlobs, track, drawCallouts, CALLOUT_PARAMS, CALLOUT_GLSL } from './blobkit.js';

export default {
  type: 'blobs', name: 'Blob Callouts', cat: 'TRACK',
  desc: 'Finds bright (or dark) shapes and tracks them with boxes, crosshairs and live data labels. Map ONSET (trigger) → Lock-on.',
  probe: { w: 160, h: 90 },
  params: [
    { k: 'thresh', n: 'Threshold', v: 0.6 },
    { k: 'invert', n: 'Track dark', v: 0.0 },
    ...CALLOUT_PARAMS,
  ],
  cpu(px, w, h, p, fr, st) {
    const m = new Uint8Array(w * h), t = p.thresh * 255, inv = p.invert > 0.5;
    for (let i = 0; i < w * h; i++) { const l = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114; m[i] = inv ? l < 255 - t : l > t; }
    const blobs = findBlobs(m, w, h, 4 + p.minsize * 200);
    st.show = track(st, blobs, 1 + Math.round(p.boxes * 11), p.smooth, 3);
  },
  overlay(ctx, W, H, p, fr, st) { drawCallouts(ctx, W, H, st.show || [], p, fr, 'TRK'); },
  glsl: CALLOUT_GLSL,
};
