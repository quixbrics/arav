export default {
  type: 'film', name: 'Film', cat: 'VINTAGE',
  desc: 'Projected film at 24 fps: grain, gate weave, dust and scratches, halation round highlights, light leaks, flicker and an 8mm gate.',
  params: [
    { k: 'grain', n: 'Grain', v: 0.4 },
    { k: 'weave', n: 'Gate weave', v: 0.3 },
    { k: 'dust', n: 'Dust', v: 0.3 },
    { k: 'scratch', n: 'Scratches', v: 0.2 },
    { k: 'halation', n: 'Halation', v: 0.35 },
    { k: 'leak', n: 'Light leaks', v: 0.2 },
    { k: 'flicker', n: 'Flicker', v: 0.3 },
    { k: 'fade', n: 'Fade', v: 0.3 },
    { k: 'gate', n: '8mm gate', v: 0.0 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float ft = floor(uTime * 24.0);                    // film frames
  vec2 weave = (vec2(noise(vec2(ft * 0.37, 1.0)), noise(vec2(ft * 0.29, 9.0))) - 0.5) * p_weave * vec2(0.004, 0.008);
  vec2 suv = uv + weave;
  vec3 c = src(suv).rgb;
  // halation: blurred highlights, tinted red-orange
  if (p_halation > 0.001) {
    vec3 h = vec3(0.0); float r = 0.012;
    for (int i = 0; i < 12; i++) { float a = float(i) / 12.0 * TAU; vec3 s = src(suv + vec2(cos(a), sin(a) * uRes.x / uRes.y) * r).rgb; h += max(s - 0.6, 0.0); }
    c += h / 12.0 * vec3(1.0, 0.35, 0.12) * p_halation * 4.0;
  }
  // fade: lifted blacks, warm cast
  c = mix(c, c * vec3(1.02, 0.97, 0.88) * 0.88 + vec3(0.06, 0.045, 0.035), p_fade);
  // flicker
  c *= 1.0 + (hash(vec2(ft, 3.0)) - 0.5) * p_flicker * 0.18;
  // light leaks
  if (p_leak > 0.001) {
    float l = noise(vec2(uv.x * 1.5 + uTime * 0.15, uv.y * 1.2 - uTime * 0.05));
    float edge = smoothstep(0.35, 0.0, min(uv.x, 1.0 - uv.x));
    c += vec3(1.0, 0.45, 0.15) * smoothstep(0.45, 0.9, l) * edge * p_leak * 1.4;
  }
  // grain (per frame)
  float g = hash(floor(uv * uOut / max(1.0, uOut.y / 1080.0 * 1.5)) + ft * 1.31) - 0.5;
  c += g * p_grain * 0.25 * (1.0 - luma(c) * 0.5);
  // dust: a few specks per frame
  vec2 gcell = floor(uv * vec2(18.0, 10.0));
  float dh = hash(gcell + ft * 0.73);
  if (dh < p_dust * 0.08) {
    vec2 ctr = (gcell + vec2(hash(gcell + ft), hash(gcell - ft))) / vec2(18.0, 10.0);
    float d = length((uv - ctr) * vec2(uRes.x / uRes.y, 1.0));
    c = mix(c, vec3(hash(gcell) < 0.5 ? 0.0 : 1.0), smoothstep(0.004, 0.0015, d) * 0.85);
  }
  // scratches: thin vertical lines
  for (int i = 0; i < 3; i++) {
    float sx = hash(vec2(float(i) * 7.1, floor(ft / 6.0)));
    if (hash(vec2(float(i), ft)) < p_scratch * 0.8) c = mix(c, vec3(0.85), smoothstep(0.0012, 0.0, abs(uv.x - sx - sin(uv.y * 8.0 + ft) * 0.002)) * 0.6);
  }
  // 8mm gate: rounded frame + sprocket hole
  if (p_gate > 0.001) {
    vec2 q = abs(uv - 0.5) * 2.0;
    float corner = length(max(q - vec2(0.9, 0.86), 0.0)) - 0.08;
    float frame = smoothstep(0.0, 0.03, -max(corner, max(q.x - 0.98, q.y - 0.95)));
    vec2 sp = (uv - vec2(0.035, fract(0.5 + weave.y * 20.0))) * vec2(uRes.x / uRes.y, 1.0);
    float hole = smoothstep(0.004, 0.0, length(max(abs(sp) - vec2(0.02, 0.05), 0.0)) - 0.01);
    c = mix(c, vec3(0.02), (1.0 - frame) * p_gate);
    c = mix(c, vec3(0.9, 0.88, 0.8), hole * p_gate);
  }
  return vec4(c, 1.0);
}`,
};
