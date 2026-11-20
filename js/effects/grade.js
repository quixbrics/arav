// Colour grade: a conventional primary grade. Every knob is neutral at 0.5, so double-clicking a knob (reset to default) always means "no change".
// Order: exposure and white balance, then lift / gamma / gain, then contrast
// about a pivot, then hue and saturation last so they act on the final tones.
//   Lift  raises or crushes the blacks, white stays put
//   Gamma bends the midtones, black and white stay put
//   Gain  scales the image, black stays put
// Saturation and vibrance are measured against luma, so they don't change
// brightness. Map KICK → Exposure or Contrast for a pump on the beat.
export default {
  type: 'grade', name: 'Colour Grade', cat: 'COLOUR',
  desc: 'Exposure, temperature, tint, lift, gamma, gain, contrast, hue, saturation and vibrance. Every knob is neutral in the middle.',
  params: [
    { k: 'exposure', n: 'Exposure', v: 0.5 },
    { k: 'temp', n: 'Temperature', v: 0.5 },
    { k: 'tint', n: 'Tint', v: 0.5 },
    { k: 'lift', n: 'Lift', v: 0.5 },
    { k: 'gamma', n: 'Gamma', v: 0.5 },
    { k: 'gain', n: 'Gain', v: 0.5 },
    { k: 'contrast', n: 'Contrast', v: 0.5 },
    { k: 'pivot', n: 'Pivot', v: 0.5 },
    { k: 'hue', n: 'Hue', v: 0.5 },
    { k: 'sat', n: 'Saturation', v: 0.5 },
    { k: 'vib', n: 'Vibrance', v: 0.5 },
  ],
  glsl: /* glsl */`
vec3 hueRotate(vec3 c, float a){
  const vec3 k = vec3(0.57735);              // rotate about the grey axis
  float ca = cos(a), sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}
vec4 effect(vec2 uv){
  vec4 s = src(uv);
  vec3 c = s.rgb;
  float temp = (p_temp - 0.5) * 2.0, tint = (p_tint - 0.5) * 2.0;

  c *= exp2((p_exposure - 0.5) * 6.0);                                   // ±3 stops
  c *= vec3(1.0 + temp * 0.25 - tint * 0.1, 1.0 + tint * 0.2, 1.0 - temp * 0.25 - tint * 0.1);
  c = max(c, 0.0);
  c = c + (p_lift - 0.5) * 0.5 * (1.0 - c);                              // ±0.25
  c *= p_gain * 2.0;                                                     // 0..2×
  c = pow(max(c, 0.0), vec3(1.0 / exp2((p_gamma - 0.5) * 3.0)));         // 0.35..2.8
  c = (c - p_pivot) * (p_contrast * 2.0) + p_pivot;                      // 0..2×
  c = hueRotate(c, (p_hue - 0.5) * TAU);                                 // ±180°

  float sat = p_sat < 0.5 ? p_sat * 2.0 : 1.0 + (p_sat - 0.5) * 4.0;     // 0..3×
  float cur = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float vib = max(1.0 + (p_vib - 0.5) * 2.0 * (1.0 - clamp(cur, 0.0, 1.0)), 0.0);
  float l = luma(c);
  c = l + (c - l) * sat * vib;

  return vec4(clamp(c, 0.0, 1.0), s.a);
}`,
};
