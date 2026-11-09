// Only bright pixels leave trails. Pass 1 builds a trail buffer (kept as this
// effect's history); pass 2 lays it over the image.
export default {
  type: 'lumatrails', name: 'Luma Trails', cat: 'TRAILS',
  desc: 'Only the brightest parts leave trails, which drift and fade. Map KICK to Amount, or BRIGHT to Hue.',
  history: true, historyPass: 0,
  passes: () => 2,
  params: [
    { k: 'thresh', n: 'Threshold', v: 0.55 },
    { k: 'decay', n: 'Length', v: 0.75 },
    { k: 'amount', n: 'Amount', v: 0.8 },
    { k: 'drift', n: 'Drift', v: 0.3 },
    { k: 'angle', n: 'Direction', v: 0.25 },
    { k: 'tint', n: 'Tint', v: 0.4 },
    { k: 'hue', n: 'Hue', v: 0.6 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  if (uPass < 0.5) {
    float a = p_angle * TAU;
    vec2 dir = vec2(cos(a), sin(a) * uRes.x / uRes.y) * p_drift * 0.006;
    vec3 prev = texture(uPrev, uv - dir).rgb * mix(0.6, 0.985, p_decay);
    vec3 s = texture(uOrig, uv).rgb;
    vec3 lit = s * smoothstep(p_thresh, p_thresh + 0.06, luma(s));
    lit = mix(lit, hsv(p_hue, 0.85, luma(lit) * 1.5), p_tint);
    return vec4(max(prev, lit), 1.0);
  }
  vec3 s = texture(uOrig, uv).rgb, tr = src(uv).rgb;
  return vec4(1.0 - (1.0 - s) * (1.0 - tr * p_amount), 1.0);   // screen blend
}`,
};
