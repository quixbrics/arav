// Port of v2.17 COLUMN SCAN: each vertical slice is pushed up/down by a pattern
// (linear ramp, sine, or smooth random) and leaves a stack of fading echoes.
export default {
  type: 'colscan', name: 'Column Scan', cat: 'GLITCH',
  desc: 'Vertical slices pushed up or down by a ramp, sine or smooth-random pattern, each leaving echoes. Ported from Glitch Distortion Lab.',
  params: [
    { k: 'amp', n: 'Amplitude', v: 0.15 },
    { k: 'slice', n: 'Slice width', v: 0.3 },
    { k: 'pattern', n: 'Ramp·Sine·Rand', v: 0.5 },
    { k: 'freq', n: 'Frequency', v: 0.2 },
    { k: 'repeat', n: 'Echoes', v: 0.4 },
    { k: 'mono', n: 'Mono', v: 0.0 },
    { k: 'grain', n: 'Grain', v: 0.1 },
    { k: 'hits', n: 'Reseed on hits', v: 1.0 },
  ],
  glsl: /* glsl */`
float pat(float i, float n, uint seed){
  float freq = mix(0.25, 8.0, p_freq);
  if (p_pattern < 0.34) return (i / n) * 2.0 - 1.0;
  if (p_pattern < 0.67) return sin(i / n * TAU * freq);
  float stp = max(2.0, floor(n / (freq * 4.0) + 0.5));
  float t = i / stp, i0 = floor(t), u = (1.0 - cos((t - i0) * PI)) * 0.5;
  return mix(hashu(uint(i0), seed) * 2.0 - 1.0, hashu(uint(i0) + 1u, seed) * 2.0 - 1.0, u);
}
vec4 effect(vec2 uv){
  vec2 c = vec2(uv.x, 1.0 - uv.y) * uOut;
  float slice = floor(mix(2.0, 96.0, p_slice * p_slice));
  float n = ceil(uOut.x / slice);
  uint seed = uint(p_hits > 0.5 ? uOnsets : 0.0) * 13u + 41u;
  float pv0 = pat(floor(c.x / slice), n, seed);
  float amp = p_amp * uOut.y * 0.5;
  int rep = int(mix(1.0, 8.0, p_repeat) + 0.5);
  vec3 col = src(uv).rgb;
  for (int e = 8; e >= 1; e--) {
    if (e > rep) continue;
    float off = floor(pv0 * amp * (float(e) / float(rep)) + 0.5);
    if (off == 0.0) continue;
    float sy = c.y - off;
    if (sy < 0.0 || sy >= uOut.y) continue;
    float a = e == 1 ? 1.0 : clamp(1.0 - float(e - 1) / float(rep) * 0.65, 0.2, 1.0);
    col = mix(col, src(vec2(uv.x, 1.0 - sy / uOut.y)).rgb, a);
  }
  if (p_mono > 0.5) col = vec3(luma(col));
  col += (hash(floor(uv * uRes) + fract(uTime) * 91.0) - 0.5) * p_grain * 0.5;
  return vec4(col, 1.0);
}`,
};
