// Slit-scan / time displacement: every part of the frame shows a different
// moment from the last few seconds. Rows, columns, rings or diagonals can be
// delayed, so movement smears and bends through time.
const span = p => 0.05 + p.depth * 3.95;
export default {
  type: 'slitscan', name: 'Slit-Scan', cat: 'TIME',
  desc: 'Each slice of the frame shows a different moment from the last few seconds, so motion bends through time. Map BASS → Depth.',
  ring: true,
  ringSpan: p => span(p) * 1.02,
  uniforms: p => ({ uSpan: span(p) }),
  params: [
    { k: 'depth', n: 'Time depth', v: 0.25 },
    { k: 'dir', n: 'Rows·Cols·Rings·Diag', v: 0.0 },
    { k: 'shape', n: 'Ramp·Tri·Sine', v: 0.0 },
    { k: 'slices', n: 'Slices', v: 0.0 },
    { k: 'speed', n: 'Pattern drift', v: 0.5 },
    { k: 'reverse', n: 'Reverse', v: 0.0 },
  ],
  glsl: /* glsl */`
uniform float uSpan;
vec4 effect(vec2 uv){
  float x;
  if (p_dir < 0.25) x = 1.0 - uv.y;
  else if (p_dir < 0.5) x = uv.x;
  else if (p_dir < 0.75) x = length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)) * 1.1;
  else x = (uv.x + 1.0 - uv.y) * 0.5;
  x = fract(x + uTime * (p_speed - 0.5) * 0.4);
  if (p_slices > 0.01) { float n = floor(mix(96.0, 3.0, p_slices)); x = floor(x * n) / n; }
  float s = p_shape < 0.34 ? x : p_shape < 0.67 ? 1.0 - abs(x * 2.0 - 1.0) : 0.5 + 0.5 * sin(x * TAU * 2.0);
  if (p_reverse > 0.5) s = 1.0 - s;
  return past(uv, s * uSpan);
}`,
};
