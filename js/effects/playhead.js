export default {
  type: 'playhead', name: 'Scan Playhead', cat: 'PLAYHEAD',
  desc: 'A line that sweeps the frame in time with the bars. It glows, warps what it passes and leaves a trail.',
  params: [
    { k: 'bars', n: 'Bars / sweep', v: 0.3 },
    { k: 'glow', n: 'Glow', v: 0.6 },
    { k: 'displace', n: 'Displace', v: 0.3 },
    { k: 'trail', n: 'Trail', v: 0.35 },
    { k: 'vertical', n: 'Vertical', v: 0.0 },
    { k: 'hue', n: 'Colour', v: 0.14 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float bars = exp2(floor(p_bars * 3.99));
  float x = fract(max(uBeats, 0.0) / (4.0 * bars));
  bool vert = p_vertical > 0.5;
  float coord = vert ? 1.0 - uv.y : uv.x;
  float d = coord - x;
  float ad = abs(d);
  float scale = vert ? uOut.y : uOut.x;
  float near = exp(-ad * ad * 900.0);
  vec2 duv = uv;
  if (vert) duv.x += near * p_displace * 0.04 * sin(uv.x * 90.0 + uTime * 6.0);
  else      duv.y += near * p_displace * 0.06 * sin(uv.y * 110.0 + uTime * 6.0);
  vec3 c = src(duv).rgb;
  vec3 tint = hsv(p_hue, 0.65, 1.0);
  float behind = d < 0.0 ? exp(d * mix(40.0, 2.5, p_trail)) : 0.0;
  c = mix(c, c * tint * 1.6 + tint * 0.05, behind * p_trail);
  float line = exp(-ad * scale * 0.22);
  c += tint * (line * 1.4 + exp(-ad * 22.0) * 0.35) * p_glow;
  return vec4(c, 1.0);
}`,
};
