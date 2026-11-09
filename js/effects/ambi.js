// Ambisonic focus: places the visual emphasis where the sound is.
// With a 4-channel AmbiX (first-order ambisonic) file, the direction comes from
// the sound field's energy vector (AZIM / ELEV signals). With stereo, AZIM
// follows the stereo position. Designed for 360° equirectangular output, where
// azimuth 0 (front) is the centre of the frame, but it works on flat frames too.
import { sampleAt } from '../util.js';

export default {
  type: 'ambi', name: 'Ambisonic Focus', cat: 'OUTPUT',
  desc: 'Puts a spotlight, lens or ripple where the sound is coming from. Uses the direction in a 4-channel AmbiX file, or stereo position. Best with 360° output.',
  uniforms(p, fr) {
    const a = fr.ana; let az = 0.5, el = 0.5, lv = 0;
    if (a && a.f.azim) { az = sampleAt(a.f.azim, a.rate, fr.t); el = sampleAt(a.f.elev, a.rate, fr.t); lv = sampleAt(a.f.loud, a.rate, fr.t); }
    return { uDir: [az, el, lv] };
  },
  params: [
    { k: 'mode', n: 'Spot·Lens·Ripple·Marker', v: 0.0 },
    { k: 'amount', n: 'Amount', v: 0.6 },
    { k: 'size', n: 'Size', v: 0.4 },
    { k: 'dim', n: 'Dim elsewhere', v: 0.6 },
    { k: 'hue', n: 'Colour', v: 0.12 },
    { k: 'flat', n: 'Flat frame', v: 0.0 },
  ],
  glsl: /* glsl */`
uniform vec3 uDir;
vec4 effect(vec2 uv){
  // direction → frame position. 360: u = 0.5 − azimuth/2π (AZIM 0.5 = front). Flat: ±90° across the width.
  float az = (uDir.x - 0.5) * TAU, el = (uDir.y - 0.5) * PI;
  vec2 c = p_flat > 0.5 ? vec2(0.5 - az / PI, 0.5 + el / PI) : vec2(0.5 - az / TAU, 0.5 + el / PI);
  vec2 d = uv - c; if (p_flat < 0.5) d.x = mod(d.x + 0.5, 1.0) - 0.5;   // wrap across the 360 seam
  d.x *= uRes.x / uRes.y;
  float r = length(d), s = mix(0.05, 0.4, p_size) * (0.8 + uDir.z * 0.4);
  float m = floor(p_mode * 3.99);
  vec3 col = src(uv).rgb, tint = hsv(p_hue, 0.7, 1.0);
  float spot = exp(-r * r / (s * s));
  if (m < 0.5) return vec4(col * mix(1.0 - p_dim * p_amount, 1.0 + p_amount * 0.4, spot) + tint * spot * p_amount * 0.15, 1.0);
  if (m < 1.5) { vec2 suv = uv - normalize(d + 1e-5) * spot * s * p_amount * 0.5 / vec2(uRes.x / uRes.y, 1.0); return vec4(src(suv).rgb * mix(1.0 - p_dim * 0.5, 1.0, spot), 1.0); }
  if (m < 2.5) { float w = sin(r * 60.0 - uTime * 8.0) * exp(-r / s) * p_amount; return vec4(src(uv + normalize(d + 1e-5) * w * 0.01).rgb + tint * max(w, 0.0) * 0.3, 1.0); }
  float ring = smoothstep(0.004, 0.0, abs(r - s * 0.5)) + smoothstep(0.003, 0.0, abs(d.x)) * step(r, s) + smoothstep(0.003, 0.0, abs(d.y)) * step(r, s);
  return vec4(col * (1.0 - p_dim * 0.3) + tint * ring * p_amount * 1.5, 1.0);
}`,
};
