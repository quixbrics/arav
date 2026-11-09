export default {
  type: 'crt', name: 'CRT', cat: 'VINTAGE',
  desc: 'Tube monitor: scanlines, aperture grille, barrel curvature, bloom, flicker and a rolling hum bar.',
  params: [
    { k: 'scan', n: 'Scanlines', v: 0.55 },
    { k: 'lines', n: 'Line size', v: 0.35 },
    { k: 'mask', n: 'Grille', v: 0.4 },
    { k: 'curve', n: 'Curvature', v: 0.3 },
    { k: 'bloom', n: 'Bloom', v: 0.25 },
    { k: 'flicker', n: 'Flicker', v: 0.2 },
    { k: 'vignette', n: 'Vignette', v: 0.5 },
  ],
  glsl: /* glsl */`
vec2 barrel(vec2 uv, float k){
  uv = uv * 2.0 - 1.0;
  uv += uv * (uv.yx * uv.yx) * k;
  return uv * 0.5 + 0.5;
}
vec4 effect(vec2 uv){
  vec2 cuv = barrel(uv, p_curve * 0.22);
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 c = src(cuv).rgb;
  if (p_bloom > 0.001) {
    vec3 b = vec3(0.0);
    vec2 px = vec2(1.0 / uRes.y * uRes.y / uRes.x, 1.0 / uRes.y) * 3.0;
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) b += src(cuv + vec2(i, j) * px * 2.0).rgb;
    b /= 25.0;
    c += b * b * p_bloom * 2.2;
  }
  // scanlines measured in OUTPUT pixels so preview matches render
  float period = mix(2.0, 8.0, p_lines) * uOut.y / 1080.0;
  float s = 0.5 + 0.5 * cos(cuv.y * uOut.y * 6.28318 / max(period, 1.0));
  c *= mix(1.0, 0.25 + 0.75 * s, p_scan);
  // aperture grille
  float col = mod(floor(cuv.x * uOut.x / max(1.0, uOut.y / 1080.0 * 1.5)), 3.0);
  vec3 m = col < 1.0 ? vec3(1.0, 0.55, 0.55) : col < 2.0 ? vec3(0.55, 1.0, 0.55) : vec3(0.55, 0.55, 1.0);
  c *= mix(vec3(1.0), m * 1.3, p_mask);
  // flicker + rolling hum bar
  c *= 1.0 - p_flicker * 0.12 * hash(vec2(floor(uTime * 60.0), 1.0));
  float bar = smoothstep(0.0, 0.15, fract(cuv.y * 0.6 - uTime * 0.25)) * smoothstep(0.3, 0.15, fract(cuv.y * 0.6 - uTime * 0.25));
  c *= 1.0 - p_flicker * 0.15 * bar;
  // vignette
  vec2 v = uv - 0.5;
  c *= mix(1.0, smoothstep(0.85, 0.2, length(v * vec2(1.0, 1.1))), p_vignette);
  return vec4(c, 1.0);
}`,
};
