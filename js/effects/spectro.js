// The spectrogram of the track, scrolling past "now" at the right edge.
// Use it as a glowing overlay, as a displacement map, or as a mask.
let cache = { id: null, canvas: null };
function specCanvas(a) {
  if (cache.id === a.id) return cache.canvas;
  const cols = Math.min(a.n, 12000), c = document.createElement('canvas'); c.width = cols; c.height = a.specBins;
  const x = c.getContext('2d'), img = x.createImageData(cols, a.specBins);
  for (let i = 0; i < cols; i++) {
    const fi = Math.floor(i / cols * a.n);
    for (let b = 0; b < a.specBins; b++) { const v = a.spec[fi * a.specBins + b], o = ((a.specBins - 1 - b) * cols + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  cache = { id: a.id, canvas: c }; return c;
}
export default {
  type: 'spectro', name: 'Spectro Scroll', cat: 'PLAYHEAD',
  desc: 'The track\'s spectrogram scrolling through the frame (low notes at the bottom). Use it as a glowing overlay, a displacement map or a mask.',
  params: [
    { k: 'mode', n: 'Glow · Displace · Mask', v: 0.0 },
    { k: 'amount', n: 'Amount', v: 0.6 },
    { k: 'window', n: 'Seconds shown', v: 0.3 },
    { k: 'strip', n: 'Strip height', v: 1.0 },
    { k: 'hue', n: 'Colour', v: 0.8 },
    { k: 'contrast', n: 'Contrast', v: 0.5 },
  ],
  overlay(ctx, W, H, p, fr) {
    ctx.clearRect(0, 0, W, H);
    const a = fr.ana; if (!a) return;
    const c = specCanvas(a), win = 1 + p.window * 15, t1 = fr.t, t0 = t1 - win;
    const h = H * (0.1 + 0.9 * p.strip), y = H - h;
    const sx0 = t0 / a.duration * c.width, sw = win / a.duration * c.width;
    const cut = Math.max(0, -sx0);       // before the start of the track
    const dx = cut / sw * W;
    if (sw - cut > 0) ctx.drawImage(c, Math.max(0, sx0), 0, sw - cut, c.height, dx, y, W - dx, h);
  },
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float s = texture(uOverlay, uv).r;
  s = clamp((s - 0.5) * mix(0.6, 3.0, p_contrast) + 0.5, 0.0, 1.0) * texture(uOverlay, uv).a;
  if (p_mode < 0.34) {
    vec3 c = src(uv).rgb;
    return vec4(c + hsv(p_hue + s * 0.25, 0.8, 1.0) * s * s * p_amount * 1.5, 1.0);
  } else if (p_mode < 0.67) {
    vec2 d = vec2(s - 0.3, (s - 0.3) * 0.5) * p_amount * 0.12;
    return src(uv + d);
  }
  vec3 c = src(uv).rgb;
  return vec4(c * mix(1.0, s * 1.8, p_amount), 1.0);
}`,
};
