// Uses the AI depth map (Depth Anything V2, run in the browser) to treat near
// and far differently: fog, a glowing slice sweeping through depth on the bar,
// depth-of-field blur, 2.5D parallax wobble, or the raw depth map.
export default {
  type: 'depthfx', name: 'Depth FX', cat: 'ML',
  desc: 'AI depth from ordinary footage (Depth Anything, runs in your browser). Fog, a slice that sweeps through depth on the bar, focus blur, or 2.5D parallax. The model downloads on first use (~50 MB).',
  needs: () => ['depth'],
  params: [
    { k: 'mode', n: 'Fog·Slice·Focus·2.5D·View', v: 0.2 },
    { k: 'amount', n: 'Amount', v: 0.6 },
    { k: 'focus', n: 'Focus depth', v: 0.5 },
    { k: 'range', n: 'Range', v: 0.3 },
    { k: 'bars', n: 'Slice bars', v: 0.3 },
    { k: 'glow', n: 'Slice glow', v: 0.6 },
    { k: 'parallax', n: 'Parallax', v: 0.4 },
    { k: 'hue', n: 'Colour', v: 0.55 },
  ],
  glsl: /* glsl */`
float depthAt(vec2 uv){ return uHasDepth > 0.5 ? texture(uDepth, uv).r : 1.0 - uv.y * 0.6; }
vec4 effect(vec2 uv){
  float m = floor(p_mode * 4.99);
  float d = depthAt(uv);                                    // 1 = near, 0 = far
  vec3 c = src(uv).rgb, tint = hsv(p_hue, 0.5, 1.0);
  if (m < 0.5) {                                            // fog
    float f = smoothstep(p_focus + p_range * 0.5, p_focus - p_range * 0.5, d);
    return vec4(mix(c, tint * 0.6, f * p_amount), 1.0);
  }
  if (m < 1.5) {                                            // slice through depth, once per N bars
    float bars = exp2(floor(p_bars * 3.99));
    float z = 1.0 - fract(max(uBeats, 0.0) / (4.0 * bars));
    float w = mix(0.005, 0.08, p_range);
    float band = exp(-pow((d - z) / w, 2.0));
    vec3 o = mix(c * (1.0 - p_amount * 0.85), c, step(z, d));   // darken what the slice hasn't reached
    return vec4(o + tint * band * p_glow * 1.5, 1.0);
  }
  if (m < 2.5) {                                            // focus blur
    float blur = clamp(abs(d - p_focus) / max(p_range, 0.02), 0.0, 1.0) * p_amount * 12.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996; vec2 o = vec2(cos(a), sin(a)) * sqrt(float(i) / 12.0) * blur / uRes; acc += src(uv + o).rgb; }
    return vec4(acc / 12.0, 1.0);
  }
  if (m < 3.5) {                                            // 2.5D parallax wobble
    vec2 cam = vec2(sin(uTime * 0.7), cos(uTime * 0.53)) * p_parallax * 0.03 * p_amount;
    return src(uv + cam * (d - p_focus));
  }
  return vec4(mix(c, vec3(d), p_amount), 1.0);              // view the depth map
}`,
};
