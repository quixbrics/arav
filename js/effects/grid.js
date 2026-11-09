// Port of v2.17 GRID STRETCH. In v2.17 this was instanced quads drawn in order,
// with later cells overwriting earlier ones. Here it is a gather: a pixel checks
// the 5×5 neighbouring cells in the same (row-major) order and keeps the LAST
// one whose stretched rectangle covers it. Max stretch is 4×, so a cell never
// reaches further than 1.5 cells, which is why ±2 neighbours is enough.
export default {
  type: 'grid', name: 'Grid Stretch', cat: 'GLITCH',
  desc: 'Cuts the frame into a grid and stretches random cells about their centres, horizontally or vertically. Ported from Glitch Distortion Lab.',
  params: [
    { k: 'cols', n: 'Columns', v: 0.16 },
    { k: 'rows', n: 'Rows', v: 0.16 },
    { k: 'coverage', n: 'Coverage', v: 0.5 },
    { k: 'intensity', n: 'Intensity', v: 0.25 },
    { k: 'balance', n: 'H ↔ V', v: 0.5 },
    { k: 'jitter', n: 'Jitter', v: 0.3 },
    { k: 'rate', n: 'Reseed rate', v: 0.0 },
    { k: 'hits', n: 'Reseed on hits', v: 1.0 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float cols = floor(mix(1.0, 32.0, p_cols) + 0.5), rows = floor(mix(1.0, 32.0, p_rows) + 0.5);
  uint seed = uint(floor(uTime * p_rate * 20.0) + (p_hits > 0.5 ? uOnsets * 7.0 : 0.0)) + 7u;
  vec2 cs = 1.0 / vec2(cols, rows);
  vec2 q = vec2(uv.x, 1.0 - uv.y);           // row 0 at the top, like v2.17
  vec2 cell = floor(q / cs);
  vec2 res = q;
  for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
    vec2 rc = cell + vec2(dx, dy);
    if (rc.x < 0.0 || rc.y < 0.0 || rc.x >= cols || rc.y >= rows) continue;
    uint id = uint(rc.y * cols + rc.x);
    if (hashu(id, seed) >= p_coverage) continue;
    float jf = 1.0 + (hashu(id, seed + 101u) * 2.0 - 1.0) * p_jitter;
    float sX = 1.0 + p_intensity * 3.0 * (1.0 - p_balance) * max(0.0, jf);
    float sY = 1.0 + p_intensity * 3.0 * p_balance * max(0.0, jf);
    vec2 p = rc * cs, d = cs * vec2(sX, sY), dp = p + cs * 0.5 - d * 0.5;
    if (all(greaterThanEqual(q, dp)) && all(lessThan(q, dp + d))) res = p + (q - dp) / d * cs;
  }
  return src(vec2(res.x, 1.0 - res.y));
}`,
};
