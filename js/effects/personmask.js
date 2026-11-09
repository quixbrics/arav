// Person mask (MediaPipe selfie segmentation, in the browser). Put it BELOW the
// effects you want to limit: it keeps their result only on the person (or only
// on the background) and restores the clean source elsewhere.
export default {
  type: 'personmask', name: 'Person Mask', cat: 'ML',
  desc: 'Finds people in the frame (AI, runs in your browser). Effects ABOVE this card then apply only to the figure, or only to the background. It can also cut out, outline or spotlight the person.',
  needs: () => ['mask'],
  params: [
    { k: 'mode', n: 'Fx on person·bg·Cutout·Outline·Spot', v: 0.0 },
    { k: 'soft', n: 'Softness', v: 0.3 },
    { k: 'thresh', n: 'Threshold', v: 0.5 },
    { k: 'glow', n: 'Outline glow', v: 0.5 },
    { k: 'hue', n: 'Colour', v: 0.9 },
    { k: 'dim', n: 'Background dim', v: 0.7 },
  ],
  glsl: /* glsl */`
float maskAt(vec2 uv){ if (uHasMask < 0.5) return 1.0; float m = texture(uMask, uv).r; float s = mix(0.01, 0.25, p_soft); return smoothstep(p_thresh - s, p_thresh + s, m); }
vec4 effect(vec2 uv){
  float m = maskAt(uv), mode = floor(p_mode * 4.99);
  vec3 fx = src(uv).rgb, clean = texture(uSource, uv).rgb, tint = hsv(p_hue, 0.8, 1.0);
  if (mode < 0.5) return vec4(mix(clean, fx, m), 1.0);
  if (mode < 1.5) return vec4(mix(fx, clean, m), 1.0);
  if (mode < 2.5) return vec4(mix(tint * 0.08 * (1.0 - p_dim), fx, m), 1.0);
  if (mode < 3.5) {
    vec2 px = vec2(2.5) / uRes;
    float e = abs(maskAt(uv + vec2(px.x, 0.0)) - maskAt(uv - vec2(px.x, 0.0))) + abs(maskAt(uv + vec2(0.0, px.y)) - maskAt(uv - vec2(0.0, px.y)));
    float g = 0.0; for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; g += abs(maskAt(uv + vec2(cos(a), sin(a)) * px * 4.0) - m); }
    return vec4(fx + tint * (e * 1.5 + g * 0.15) * p_glow * 1.5, 1.0);
  }
  return vec4(mix(fx * (1.0 - p_dim), fx * 1.15, m), 1.0);
}`,
};
