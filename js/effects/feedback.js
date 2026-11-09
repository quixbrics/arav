export default {
  type: 'feedback', name: 'Feedback', cat: 'TRAILS',
  desc: 'Feeds the previous frame back in, slightly zoomed, rotated and hue-shifted. Decay sets how long trails last.',
  history: true,
  params: [
    { k: 'decay', n: 'Decay', v: 0.6 },
    { k: 'zoom', n: 'Zoom', v: 0.55 },
    { k: 'rotate', n: 'Rotate', v: 0.5 },
    { k: 'hue', n: 'Hue drift', v: 0.1 },
    { k: 'shiftx', n: 'Drift X', v: 0.5 },
    { k: 'shifty', n: 'Drift Y', v: 0.5 },
    { k: 'key', n: 'Luma key', v: 0.0 },
  ],
  glsl: /* glsl */`
vec3 hueShift(vec3 c, float h){
  vec3 k = vec3(0.57735);
  float ca = cos(h);
  return c * ca + cross(k, c) * sin(h) + k * dot(k, c) * (1.0 - ca);
}
vec4 effect(vec2 uv){
  float aspect = uRes.x / uRes.y;
  vec2 c = uv - 0.5; c.x *= aspect;
  float z = 1.0 + (p_zoom - 0.5) * 0.08;
  float r = (p_rotate - 0.5) * 0.1;
  c = mat2(cos(r), -sin(r), sin(r), cos(r)) * c / z;
  c.x /= aspect;
  vec2 puv = c + 0.5 - (vec2(p_shiftx, p_shifty) - 0.5) * 0.02;
  vec3 p = texture(uPrev, puv).rgb;
  p = clamp(hueShift(p, p_hue * 0.35), 0.0, 1.0);
  p *= mix(0.5, 0.992, p_decay);
  vec3 s = src(uv).rgb;
  vec3 lighten = max(s, p);
  // luma key: trails show only where the incoming image is dark
  float k = smoothstep(p_key - 0.08, p_key + 0.08, luma(s));
  vec3 keyed = mix(p, s, k);
  return vec4(p_key > 0.001 ? keyed : lighten, 1.0);
}`,
};
