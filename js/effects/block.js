export default {
  type: 'block', name: 'Block Displace', cat: 'GLITCH',
  desc: 'Cuts the frame into a grid and throws random cells out of place. Map ONSET (trigger) to Amount for hits.',
  params: [
    { k: 'amount', n: 'Amount', v: 0.2 },
    { k: 'size', n: 'Block size', v: 0.45 },
    { k: 'density', n: 'Density', v: 0.35 },
    { k: 'rate', n: 'Reseed rate', v: 0.15 },
    { k: 'hits', n: 'Reseed on hits', v: 1.0 },
    { k: 'split', n: 'RGB split', v: 0.3 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float aspect = uRes.x / uRes.y;
  float cols = floor(mix(48.0, 3.0, p_size));
  vec2 grid = vec2(cols, max(2.0, floor(cols / aspect * 1.6)));
  float seed = floor(uTime * p_rate * 30.0) + (p_hits > 0.5 ? uOnsets * 17.0 : 0.0);
  vec2 cell = floor(uv * grid);
  float h = hash(cell + seed * 1.37);
  if (h > p_density || p_amount < 0.001) return src(uv);
  vec2 off = (vec2(hash(cell * 1.7 + seed * 0.71), hash(cell * 2.3 + seed * 0.29)) - 0.5) * p_amount * 0.6;
  off.y *= 0.5;
  vec2 suv = uv + off;
  vec4 c = src(suv);
  float s = p_split * 0.02 * p_amount * 4.0;
  c.r = src(suv + vec2(s, 0.0)).r;
  c.b = src(suv - vec2(s, 0.0)).b;
  return c;
}`,
};
