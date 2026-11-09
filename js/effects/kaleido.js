export default {
  type: 'kaleido', name: 'Kaleido', cat: 'STYLISE',
  desc: 'Mirror segments around a centre, with optional spiral (Droste-like) twist. Map SECTION or BEAT → Segments so the symmetry changes with the music.',
  params: [
    { k: 'segments', n: 'Segments', v: 0.3 },
    { k: 'rotate', n: 'Rotate', v: 0.0 },
    { k: 'spin', n: 'Spin speed', v: 0.5 },
    { k: 'zoom', n: 'Zoom', v: 0.5 },
    { k: 'spiral', n: 'Spiral', v: 0.0 },
    { k: 'cx', n: 'Centre X', v: 0.5 },
    { k: 'cy', n: 'Centre Y', v: 0.5 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(p), a = atan(p.y, p.x);
  float n = floor(mix(2.0, 16.0, p_segments) + 0.5);
  float seg = TAU / n;
  a += p_rotate * TAU + uTime * (p_spin - 0.5) * 1.5;
  a += log(max(r, 1e-4)) * p_spiral * 2.0;
  a = mod(a, seg); a = min(a, seg - a);                  // mirror inside each segment
  r *= mix(0.4, 2.5, 1.0 - p_zoom);
  if (p_spiral > 0.01) r = exp(mod(log(max(r, 1e-4)) - uTime * 0.2 * p_spiral, log(2.0)) - log(2.0) * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r;
  vec2 suv = q / vec2(aspect, 1.0) + vec2(p_cx, p_cy);
  suv = abs(mod(suv + 1.0, 2.0) - 1.0);                 // mirror-wrap outside the frame
  return src(suv);
}`,
};
