// Pixel sort on the GPU: odd-even transposition sort. Each pass compares every
// pixel with its neighbour and swaps them if they're out of order — but only
// when BOTH are inside the brightness band, so sorting happens in "spans" like
// classic pixel sorting. More passes = longer streaks. "Persist" keeps sorting
// last frame's result, so spans keep melting over time.
// (v2.17 did an exact CPU sort; this is a GPU approximation that runs every frame.)
export default {
  type: 'pixelsort', name: 'Pixel Sort', cat: 'GLITCH',
  desc: 'Sorts pixels by brightness within bright (or dark) spans, making streaks. More steps = longer streaks. Map LOUD to Threshold.',
  history: true,
  passes: p => 4 + Math.round(p.steps * 60),
  params: [
    { k: 'lo', n: 'Threshold', v: 0.35 },
    { k: 'hi', n: 'Ceiling', v: 1.0 },
    { k: 'steps', n: 'Streak length', v: 0.4 },
    { k: 'vertical', n: 'Vertical', v: 0.0 },
    { k: 'reverse', n: 'Reverse', v: 0.0 },
    { k: 'persist', n: 'Persist (melt)', v: 0.0 },
    { k: 'keyhue', n: 'Sort by hue', v: 0.0 },
  ],
  glsl: /* glsl */`
float sortKey(vec3 c){
  if (p_keyhue < 0.5) return luma(c);
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10));
}
bool inSpan(vec3 c){ float l = luma(c); return l >= p_lo && l <= max(p_hi, p_lo + 0.01); }
vec4 startAt(vec2 uv){
  vec4 o = texture(uOrig, uv);
  if (p_persist < 0.01) return o;
  return mix(o, texture(uPrev, uv), p_persist * 0.97);
}
vec4 at(vec2 uv){ return uPass < 0.5 ? startAt(uv) : src(uv); }
vec4 effect(vec2 uv){
  bool vert = p_vertical > 0.5;
  vec2 px = 1.0 / uRes;
  vec2 dir = vert ? vec2(0.0, px.y) : vec2(px.x, 0.0);
  vec4 me = at(uv);
  float i = vert ? floor(uv.y * uRes.y) : floor(uv.x * uRes.x);
  bool lower = mod(i + uPass, 2.0) < 1.0;      // am I the lower index of my pair?
  vec2 puv = uv + (lower ? dir : -dir);
  if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) return me;
  vec4 other = at(puv);
  if (!inSpan(me.rgb) || !inSpan(other.rgb)) return me;
  float km = sortKey(me.rgb), ko = sortKey(other.rgb);
  bool asc = p_reverse < 0.5;
  bool swap = lower ? (asc ? km > ko : km < ko) : (asc ? ko > km : ko < km);
  return swap ? other : me;
}`,
};
