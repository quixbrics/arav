import { vnoise } from '../util.js';

function tc(t) {
  const f = Math.floor((t % 1) * 25), s = Math.floor(t) % 60, m = Math.floor(t / 60) % 60, h = Math.floor(t / 3600);
  return [h, m, s, f].map(v => String(v).padStart(2, '0')).join(':');
}
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default {
  type: 'handycam', name: 'Handycam', cat: 'VINTAGE',
  desc: '90s camcorder: handheld shake (map KICK), exposure pumping (map LOUD), interlace, colour drift, tape dropouts and a REC overlay.',
  params: [
    { k: 'shake', n: 'Shake', v: 0.2 },
    { k: 'expo', n: 'Exposure', v: 0.5 },
    { k: 'lace', n: 'Interlace', v: 0.35 },
    { k: 'wb', n: 'WB drift', v: 0.3 },
    { k: 'soft', n: 'Softness', v: 0.35 },
    { k: 'grain', n: 'Noise', v: 0.25 },
    { k: 'drop', n: 'Dropouts', v: 0.0 },
    { k: 'osd', n: 'REC overlay', v: 1.0 },
  ],
  // values computed in JS each frame and passed as uniforms
  uniforms(p, info) {
    const t = info.t, s = p.shake;
    return {
      uShake: [(vnoise(t * 2.1, 1) - 0.5) * s * 0.05, (vnoise(t * 2.3, 7) - 0.5) * s * 0.04, (vnoise(t * 1.4, 3) - 0.5) * s * 0.05],
    };
  },
  // 2D canvas layer: on-screen display, composited in the shader
  overlay(ctx, W, H, p, info) {
    ctx.clearRect(0, 0, W, H);
    if (p.osd < 0.5) return;
    const fs = Math.round(H * 0.045);
    ctx.font = `600 ${fs}px "VT323", "JetBrains Mono", monospace`;
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 0;
    const mx = W * 0.05, my = H * 0.08;
    if (Math.floor(info.t * 2) % 2 === 0) { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(mx + fs * 0.35, my - fs * 0.33, fs * 0.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.fillText('REC', mx + fs * 0.85, my);
    ctx.textAlign = 'right'; ctx.fillText('SP ▶', W - mx, my);
    const d = new Date();
    ctx.textAlign = 'left'; ctx.fillText(`${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${d.getFullYear()}`, mx, H - my * 0.75);
    ctx.textAlign = 'right'; ctx.fillText(tc(info.t), W - mx, H - my * 0.75);
    ctx.textAlign = 'left';
  },
  glsl: /* glsl */`
uniform vec3 uShake;
vec4 effect(vec2 uv){
  vec2 c = uv - 0.5;
  float r = uShake.z;
  c = mat2(cos(r), -sin(r), sin(r), cos(r)) * c;
  c /= 1.0 + p_shake * 0.08;
  vec2 suv = c + 0.5 + uShake.xy;
  // interlace: odd output rows shifted
  float row = floor(uv.y * uOut.y / max(1.0, uOut.y / 540.0));
  if (mod(row, 2.0) < 1.0) suv.x += p_lace * 0.004;
  vec3 col = src(suv).rgb;
  if (p_soft > 0.001) {
    vec2 px = vec2(1.0) / uRes * (1.0 + p_soft * 3.0);
    col = (col * 2.0 + src(suv + vec2(px.x, 0)).rgb + src(suv - vec2(px.x, 0)).rgb + src(suv + vec2(0, px.y)).rgb + src(suv - vec2(0, px.y)).rgb) / 6.0;
  }
  col *= mix(0.55, 1.6, p_expo);
  col = col / (1.0 + max(0.0, luma(col) - 1.0));            // soft clip highlights
  float w = sin(uTime * 0.31) * p_wb;
  col *= vec3(1.0 + w * 0.12, 1.0, 1.0 - w * 0.15);
  col = mix(col, vec3(luma(col)), 0.12 * p_wb);
  col += (hash(uv * uRes + fract(uTime) * 91.0) - 0.5) * p_grain * 0.18;
  if (mod(row, 2.0) < 1.0) col *= 1.0 - p_lace * 0.15;
  // tape dropouts: bright horizontal streaks
  float band = floor(uv.y * 90.0);
  float dh = hash(vec2(band, floor(uTime * 25.0)));
  if (dh < p_drop * 0.12) col = mix(col, vec3(0.9) + hash(uv * 400.0 + uTime) * 0.2, 0.8);
  vec4 ov = texture(uOverlay, uv);
  col = mix(col, ov.rgb, ov.a);
  return vec4(col, 1.0);
}`,
};
