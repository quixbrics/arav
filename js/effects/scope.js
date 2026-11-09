// Oscilloscope drawn from the real audio samples at the playhead.
// Y-T = classic waveform, X-Y = Lissajous (left vs right channel), Circle = polar.
const MODES = ['Y-T', 'X-Y', 'CIRCLE'];
export default {
  type: 'scope', name: 'Oscilloscope', cat: 'PLAYHEAD',
  desc: 'Draws the actual audio waveform over the image: Y-T line, X-Y Lissajous (stereo) or circular. Map LOUD to Glow.',
  params: [
    { k: 'mode', n: 'Y-T · X-Y · Circle', v: 0.0 },
    { k: 'window', n: 'Window', v: 0.3 },
    { k: 'gain', n: 'Gain', v: 0.5 },
    { k: 'width', n: 'Line width', v: 0.25 },
    { k: 'glow', n: 'Glow', v: 0.5 },
    { k: 'hue', n: 'Colour', v: 0.38 },
    { k: 'ypos', n: 'Position', v: 0.5 },
    { k: 'dim', n: 'Dim image', v: 0.0 },
  ],
  overlay(ctx, W, H, p, fr) {
    ctx.clearRect(0, 0, W, H);
    const a = fr.audio; const k = H / 1080;
    const mode = MODES[Math.min(2, Math.floor(p.mode * 2.99))];
    const N = 900, win = (0.005 + p.window * p.window * 0.25), gain = 0.2 + p.gain * 3;
    const col = `hsl(${Math.round(p.hue * 360)},90%,62%)`;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, (1 + p.width * 8) * k); ctx.lineJoin = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = p.glow * 40 * k;
    const sample = (ch, i) => { if (!a) return 0; const d = ch === 1 && a.R ? a.R : a.L; return d[i] || 0; };
    const i0 = a ? Math.floor((fr.t - win) * a.sr) : 0, step = a ? (win * a.sr) / N : 1;
    ctx.beginPath();
    for (let j = 0; j <= N; j++) {
      const i = Math.max(0, Math.floor(i0 + j * step)), l = sample(0, i), r = sample(1, i), m = (l + r) * 0.5;
      let x, y;
      if (mode === 'Y-T') { x = j / N * W; y = H * (1 - p.ypos) - m * gain * H * 0.4; }
      else if (mode === 'X-Y') { x = W / 2 + l * gain * H * 0.45; y = H / 2 - r * gain * H * 0.45; }
      else { const ang = j / N * Math.PI * 2, rad = H * 0.22 * (1 + m * gain); x = W / 2 + Math.cos(ang) * rad; y = H * (1 - p.ypos) + Math.sin(ang) * rad; }
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  },
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  vec4 ov = texture(uOverlay, uv);
  vec3 c = src(uv).rgb * (1.0 - p_dim * 0.85);
  return vec4(c + ov.rgb * ov.a * 1.3, 1.0);
}`,
};
