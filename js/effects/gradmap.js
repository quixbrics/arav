// Gradient map: brightness is replaced by a colour palette. Map CHROMA to Shift
// and the palette turns with the harmony of the music.
export default {
  type: 'gradmap', name: 'Gradient Map', cat: 'STYLISE',
  desc: 'Replaces brightness with a colour palette (thermal, ocean, neon, sunset, duotone). Map CHROMA → Shift and the colours follow the harmony.',
  params: [
    { k: 'palette', n: 'Palette', v: 0.0 },
    { k: 'shift', n: 'Shift', v: 0.0 },
    { k: 'contrast', n: 'Contrast', v: 0.5 },
    { k: 'cycles', n: 'Cycles', v: 0.0 },
    { k: 'keep', n: 'Keep colour', v: 0.0 },
  ],
  glsl: /* glsl */`
vec3 cospal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b * cos(TAU * (c * t + d)); }
vec3 palette(float t){
  float p = floor(p_palette * 4.99);
  if (p < 0.5) return clamp(vec3(smoothstep(0.0, 0.5, t), smoothstep(0.3, 0.8, t), smoothstep(0.65, 1.0, t)) * vec3(1.0, 0.9, 1.0) + vec3(0.1, 0.0, 0.25) * (1.0 - t), 0.0, 1.0); // thermal
  if (p < 1.5) return cospal(t, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 1.0), vec3(0.5, 0.6, 0.7) + p_shift);     // ocean
  if (p < 2.5) return cospal(t, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.2, 0.25) + p_shift);    // neon
  if (p < 3.5) return cospal(t, vec3(0.8, 0.5, 0.4), vec3(0.2, 0.4, 0.2), vec3(2.0, 1.0, 1.0), vec3(0.0, 0.25, 0.25) + p_shift); // sunset
  return mix(hsv(p_shift, 0.9, 0.15), hsv(p_shift + 0.5, 0.6, 1.0), t);                                        // duotone
}
vec4 effect(vec2 uv){
  vec3 c = src(uv).rgb;
  float l = clamp((luma(c) - 0.5) * mix(0.5, 2.5, p_contrast) + 0.5, 0.0, 1.0);
  float t = fract(l * (1.0 + floor(p_cycles * 4.0)) * 0.999 + (p_palette < 0.2 ? 0.0 : 0.0));
  if (p_palette < 0.2) t = clamp(l + p_shift * 0.3, 0.0, 1.0);
  vec3 m = palette(t);
  return vec4(mix(m, m * (0.4 + c * 1.2), p_keep), 1.0);
}`,
};
