export default {
  type: 'chromatic', name: 'Chromatic Shift', cat: 'GLITCH',
  desc: 'Splits red and blue apart. Directional, radial (lens-like) or jittered.',
  params: [
    { k: 'amount', n: 'Amount', v: 0.15 },
    { k: 'angle', n: 'Angle', v: 0.0 },
    { k: 'radial', n: 'Radial', v: 0.3 },
    { k: 'jitter', n: 'Jitter', v: 0.0 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float amt = p_amount * 0.03;
  float a = p_angle * 6.28318;
  vec2 dir = vec2(cos(a), sin(a) * uRes.x / uRes.y);
  vec2 c = uv - 0.5;
  vec2 rad = c * 2.0;
  vec2 off = mix(dir, rad, p_radial) * amt;
  float j = (hash(vec2(floor(uTime * 24.0), 3.1)) - 0.5) * p_jitter * 0.04;
  off += vec2(j, j * 0.3);
  vec4 g = src(uv);
  return vec4(src(uv + off).r, g.g, src(uv - off).b, 1.0);
}`,
};
