// Echo frames: up to four delayed copies of the image, spaced by a musical
// subdivision of the beat (so the echoes lock to tempo).
const DIV = [0.25, 0.5, 1, 2, 4];
const delayOf = (p, fr) => DIV[Math.min(4, Math.floor(p.delay * 4.99))] * fr.spb;
export default {
  type: 'echo', name: 'Echo Frames', cat: 'TRAILS',
  desc: 'Delayed copies of the image, spaced by beats (1/16 note up to a bar), blended as lighten, add or difference.',
  ring: true,
  ringSpan: (p, fr) => delayOf(p, fr) * 4.3,
  uniforms: (p, fr) => ({ uDelay: delayOf(p, fr) }),
  params: [
    { k: 'delay', n: '¼·½·1·2·4 beats', v: 0.3 },
    { k: 'count', n: 'Echoes', v: 0.67 },
    { k: 'decay', n: 'Fade', v: 0.6 },
    { k: 'mode', n: 'Light·Add·Diff', v: 0.0 },
    { k: 'zoom', n: 'Zoom', v: 0.3 },
    { k: 'drift', n: 'Drift', v: 0.5 },
    { k: 'hue', n: 'Colour shift', v: 0.3 },
  ],
  glsl: /* glsl */`
uniform float uDelay;
vec4 effect(vec2 uv){
  int n = int(mix(1.0, 4.0, p_count) + 0.5);
  vec3 acc = src(uv).rgb;
  float g = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    g *= mix(0.3, 0.95, p_decay);
    float k = float(i + 1);
    vec2 euv = (uv - 0.5) / (1.0 + p_zoom * 0.08 * k) + 0.5 + vec2(p_drift - 0.5, 0.0) * 0.04 * k;
    vec3 e = past(euv, uDelay * k).rgb;
    e = mix(e, e.gbr, clamp(p_hue * k / 3.0, 0.0, 1.0)) * g;
    if (p_mode < 0.34) acc = max(acc, e);
    else if (p_mode < 0.67) acc += e * 0.6;
    else acc = abs(acc - e);
  }
  return vec4(acc, 1.0);
}`,
};
