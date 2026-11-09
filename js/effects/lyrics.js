// Kinetic type from word-timed lyrics (Whisper transcription, or typed in by hand).
const FONTS = ['600 {s}px "Space Grotesk", system-ui, sans-serif', '700 {s}px "JetBrains Mono", monospace', 'italic 600 {s}px Georgia, serif', '{s}px "VT323", monospace'];
const hashf = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
export default {
  type: 'lyrics', name: 'Kinetic Lyrics', cat: 'ML',
  desc: 'Word-timed lyrics as moving type: one word at a time, a karaoke line, or words scattered across the frame. Transcribe with Whisper (in your browser) or type them in.',
  needs: () => ['lyrics'],
  actions: [{ id: 'transcribe', label: 'Transcribe (Whisper)' }, { id: 'edit', label: 'Edit lyrics…' }],
  params: [
    { k: 'mode', n: 'Word·Line·Scatter', v: 0.0 },
    { k: 'size', n: 'Size', v: 0.45 },
    { k: 'pop', n: 'Pop', v: 0.5 },
    { k: 'ypos', n: 'Position', v: 0.5 },
    { k: 'font', n: 'Font', v: 0.0 },
    { k: 'hue', n: 'Colour', v: 0.0 },
    { k: 'sat', n: 'Saturation', v: 0.0 },
    { k: 'glow', n: 'Glow', v: 0.4 },
    { k: 'shake', n: 'Shake', v: 0.0 },
    { k: 'upper', n: 'Upper case', v: 1.0 },
    { k: 'blend', n: 'Over·Add·Diff', v: 0.0 },
  ],
  overlay(ctx, W, H, p, fr) {
    ctx.clearRect(0, 0, W, H);
    const words = fr.lyrics || [];
    if (!words.length) return;
    const t = fr.t, k = H / 1080, mode = p.mode < 0.34 ? 'word' : p.mode < 0.67 ? 'line' : 'scatter';
    const font = s => FONTS[Math.min(3, Math.floor(p.font * 3.99))].replace('{s}', Math.round(s));
    const col = a => `hsla(${Math.round(p.hue * 360)},${Math.round(p.sat * 100)}%,${p.sat > 0.01 ? 62 : 100}%,${a})`;
    const txt = w => p.upper > 0.5 ? w.text.toUpperCase() : w.text;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = col(0.9); ctx.shadowBlur = p.glow * 40 * k;
    let i = -1; for (let j = 0; j < words.length; j++) { if (words[j].t0 <= t) i = j; else break; }
    let sc = 0; const sh = () => (hashf(Math.floor(t * 30) * 13.1 + sc++) - 0.5) * p.shake * 30 * k;
    if (mode === 'word') {
      const w = words[i]; if (!w || t > w.t1 + 0.6) return;
      const age = t - w.t0, s = (60 + p.size * 260) * k * (1 + p.pop * 0.5 * Math.exp(-age * 9));
      ctx.font = font(s); ctx.fillStyle = col(Math.min(1, (w.t1 + 0.6 - t) / 0.3));
      ctx.fillText(txt(w), W / 2 + sh(), H * (1 - p.ypos) + sh());
    } else if (mode === 'line') {
      // group words into lines by gaps > 0.8 s or 7 words
      let a = Math.max(0, i), b = a;
      while (a > 0 && words[a].t0 - words[a - 1].t1 < 0.8 && b - a < 6) a--;
      while (b < words.length - 1 && words[b + 1].t0 - words[b].t1 < 0.8 && b - a < 6) b++;
      if (i < 0 || t > words[b].t1 + 1.0) return;
      const s = (30 + p.size * 110) * k; ctx.font = font(s);
      const parts = words.slice(a, b + 1).map(txt), widths = parts.map(x => ctx.measureText(x + ' ').width), total = widths.reduce((x, y) => x + y, 0);
      let x = W / 2 - total / 2; ctx.textAlign = 'left';
      parts.forEach((pt, j) => {
        const w = words[a + j], on = w.t0 <= t, age = t - w.t0;
        ctx.font = font(s * (on ? 1 + p.pop * 0.25 * Math.exp(-age * 8) : 1));
        ctx.fillStyle = on ? col(1) : col(0.28);
        ctx.fillText(pt, x + sh(), H * (1 - p.ypos) + sh()); x += widths[j];
      });
    } else {
      for (let j = Math.max(0, i - 12); j <= i; j++) {
        const w = words[j], age = t - w.t0, life = 2.5; if (age > life) continue;
        const s = (30 + p.size * 200) * k * (0.6 + hashf(j) * 0.8) * (1 + p.pop * 0.4 * Math.exp(-age * 8));
        ctx.font = font(s); ctx.fillStyle = col(Math.max(0, 1 - age / life));
        ctx.fillText(txt(w), W * (0.15 + hashf(j * 3.1) * 0.7) + sh(), H * (0.15 + hashf(j * 7.7) * 0.7) + sh());
      }
    }
    ctx.shadowBlur = 0;
  },
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  vec4 ov = texture(uOverlay, uv); vec3 c = src(uv).rgb;
  if (p_blend < 0.34) return vec4(mix(c, ov.rgb, ov.a), 1.0);
  if (p_blend < 0.67) return vec4(c + ov.rgb * ov.a, 1.0);
  return vec4(abs(c - ov.rgb * ov.a), 1.0);
}`,
};
