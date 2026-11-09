export default {
  type: 'wave', name: 'Wave Displace', cat: 'GLITCH',
  desc: 'Pushes rows sideways along a sine wave. Bands turns it into stepped, VHS-like tearing.',
  params: [
    { k: 'amp', n: 'Amplitude', v: 0.15 },
    { k: 'freq', n: 'Frequency', v: 0.3 },
    { k: 'speed', n: 'Speed', v: 0.6 },
    { k: 'bands', n: 'Bands', v: 0.0 },
    { k: 'vert', n: 'Vertical', v: 0.0 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float amp = p_amp * 0.06;
  float f = mix(2.0, 80.0, p_freq * p_freq);
  float sp = (p_speed - 0.5) * 16.0;
  float n = mix(120.0, 6.0, p_bands);
  float y = p_bands > 0.01 ? floor(uv.y * n) / n : uv.y;
  float x = p_bands > 0.01 ? floor(uv.x * n) / n : uv.x;
  vec2 d = vec2(sin(y * f + uTime * sp), sin(x * f * 0.8 + uTime * sp * 0.9) * p_vert);
  if (p_bands > 0.01) d.x *= hash(vec2(y, floor(uTime * 12.0))) * 2.0;
  return src(uv + d * amp);
}`,
};
