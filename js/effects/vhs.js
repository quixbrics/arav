export default {
  type: 'vhs', name: 'VHS', cat: 'VINTAGE',
  desc: 'Videotape: soft luma, smeared and delayed colour, tracking wobble, a rolling tracking band, head-switching noise and tape speckle.',
  params: [
    { k: 'tracking', n: 'Tracking', v: 0.25 },
    { k: 'bleed', n: 'Colour bleed', v: 0.5 },
    { k: 'noise', n: 'Tape noise', v: 0.3 },
    { k: 'band', n: 'Tracking band', v: 0.2 },
    { k: 'head', n: 'Head switch', v: 0.5 },
    { k: 'sat', n: 'Saturation', v: 0.45 },
    { k: 'soft', n: 'Softness', v: 0.5 },
    { k: 'crease', n: 'Crease (hits)', v: 0.0 },
  ],
  glsl: /* glsl */`
vec3 rgb2yiq(vec3 c){ return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312))); }
vec3 yiq2rgb(vec3 c){ return vec3(c.x + 0.956 * c.y + 0.621 * c.z, c.x - 0.272 * c.y - 0.647 * c.z, c.x - 1.106 * c.y + 1.703 * c.z); }
vec4 effect(vec2 uv){
  float lines = 480.0;
  float line = floor((1.0 - uv.y) * lines);
  float t = uTime;
  // per-line wobble + slow rolling band
  float wob = (noise(vec2(line * 0.15, t * 6.0)) - 0.5) * p_tracking * 0.012;
  float bandY = fract(t * 0.07);
  float band = smoothstep(0.06, 0.0, abs((1.0 - uv.y) - bandY)) * p_band;
  wob += band * (noise(vec2(line, t * 30.0)) - 0.3) * 0.04;
  // crease: a burst of displacement on hits
  float cr = p_crease * step(0.6, hash(vec2(floor(t * 12.0), line * 0.05)));
  wob += cr * 0.03 * sin(line * 0.3 + t * 40.0);
  // head switching at the bottom
  float hs = smoothstep(0.06, 0.0, uv.y) * p_head;
  wob += hs * (hash(vec2(line, floor(t * 30.0))) - 0.2) * 0.05;
  vec2 suv = vec2(uv.x + wob, 1.0 - (line + 0.5) / lines * mix(0.0, 1.0, 1.0) );
  suv.y = mix(uv.y, suv.y, 0.85);
  // luma: soft horizontal blur; chroma: wide blur, delayed to the right
  float px = 1.0 / uOut.x * (1.0 + p_soft * 2.5);
  float Y = 0.0, I = 0.0, Q = 0.0;
  for (int i = -2; i <= 2; i++) Y += rgb2yiq(src(suv + vec2(float(i) * px, 0.0)).rgb).x * (i == 0 ? 0.36 : i == 1 || i == -1 ? 0.22 : 0.1);
  float cw = px * (2.0 + p_bleed * 10.0), cd = p_bleed * 0.006;
  for (int i = -4; i <= 4; i++) { vec3 c = rgb2yiq(src(suv + vec2(float(i) * cw - cd, 0.0)).rgb); I += c.y; Q += c.z; }
  I /= 9.0; Q /= 9.0;
  vec3 col = yiq2rgb(vec3(Y, I * p_sat * 2.0, Q * p_sat * 2.0));
  // speckle & streaks
  float sp = hash(vec2(floor(uv.x * uOut.x * 0.5), line + floor(t * 60.0) * 7.0));
  col += step(1.0 - p_noise * 0.04, sp) * 0.6;
  col += (hash(uv * uRes + fract(t) * 17.0) - 0.5) * p_noise * 0.12;
  col = mix(col, vec3(hash(vec2(uv.x * 40.0, floor(t * 30.0)))), hs * 0.5);
  col *= 1.0 - band * 0.25;
  return vec4(col, 1.0);
}`,
};
