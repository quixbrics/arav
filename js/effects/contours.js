export default {
  type: 'contours', name: 'Contours', cat: 'STYLISE',
  desc: 'Topographic isolines traced from brightness, or from AI depth when Depth Anything is on. Lines can march with the beat. Map BASS → Spacing.',
  needs: p => (p.source > 0.5 ? ['depth'] : []),
  params: [
    { k: 'levels', n: 'Line count', v: 0.35 },
    { k: 'width', n: 'Line width', v: 0.3 },
    { k: 'source', n: 'Bright·Depth', v: 0.0 },
    { k: 'march', n: 'March', v: 0.3 },
    { k: 'fill', n: 'Terrain fill', v: 0.0 },
    { k: 'hue', n: 'Hue', v: 0.5 },
    { k: 'colour', n: 'Image colour', v: 0.0 },
    { k: 'bg', n: 'Background', v: 0.15 },
    { k: 'smooth', n: 'Smoothing', v: 0.5 },
  ],
  glsl: /* glsl */`
float field(vec2 uv){
  if (p_source > 0.5 && uHasDepth > 0.5) return texture(uDepth, uv).r;
  vec2 px = vec2(1.0) / uRes * mix(1.0, 6.0, p_smooth);
  float s = luma(src(uv).rgb) * 4.0;
  s += luma(src(uv + vec2(px.x, 0.0)).rgb) + luma(src(uv - vec2(px.x, 0.0)).rgb) + luma(src(uv + vec2(0.0, px.y)).rgb) + luma(src(uv - vec2(0.0, px.y)).rgb);
  s += luma(src(uv + px).rgb) + luma(src(uv - px).rgb) + luma(src(uv + vec2(px.x, -px.y)).rgb) + luma(src(uv + vec2(-px.x, px.y)).rgb);
  return s / 12.0;
}
vec4 effect(vec2 uv){
  float n = mix(4.0, 60.0, p_levels);
  float v = field(uv) * n + uBeats * p_march;
  float fv = fract(v), dist = min(fv, 1.0 - fv);          // distance to the nearest isoline (in levels)
  float w = max(fwidth(v), 1e-4) * mix(0.6, 4.0, p_width);
  float line = 1.0 - smoothstep(w * 0.5, w, dist);
  float level = floor(v) / n;
  vec3 base = src(uv).rgb * p_bg;
  vec3 terrain = hsv(p_hue + level * 0.6, 0.55, 0.25 + 0.6 * fract(level * 3.7));
  base = mix(base, terrain, p_fill);
  vec3 lc = mix(hsv(p_hue, 0.5, 1.0), src(uv).rgb * 1.5, p_colour);
  return vec4(mix(base, lc, line), 1.0);
}`,
};
