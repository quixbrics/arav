// Plexus: bright points found in the image are joined to their neighbours by
// lines that fade with distance, like a constellation network.
import { vnoise } from '../util.js';

export default {
  type: 'plexus', name: 'Plexus', cat: 'SPATIAL',
  desc: 'Finds bright points in the image and joins nearby ones with fading lines. Map BASS → Reach, ONSET → Jitter.',
  probe: { w: 96, h: 54 },
  params: [
    { k: 'density', n: 'Points', v: 0.5 },
    { k: 'thresh', n: 'Threshold', v: 0.35 },
    { k: 'reach', n: 'Reach', v: 0.4 },
    { k: 'jitter', n: 'Jitter', v: 0.2 },
    { k: 'drift', n: 'Drift', v: 0.3 },
    { k: 'dots', n: 'Dot size', v: 0.35 },
    { k: 'width', n: 'Line width', v: 0.25 },
    { k: 'hue', n: 'Hue', v: 0.55 },
    { k: 'colour', n: 'Image colour', v: 0.3 },
    { k: 'bg', n: 'Background', v: 0.35 },
  ],
  cpu(px, w, h, p, fr, st) {
    const gx = Math.round(8 + p.density * 26), gy = Math.max(3, Math.round(gx * h / w));
    const pts = [];
    for (let cy = 0; cy < gy; cy++) for (let cx = 0; cx < gx; cx++) {
      let best = -1, bx = 0, by = 0;
      const x0 = Math.floor(cx * w / gx), x1 = Math.floor((cx + 1) * w / gx), y0 = Math.floor(cy * h / gy), y1 = Math.floor((cy + 1) * h / gy);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * w + x) * 4, l = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255; if (l > best) { best = l; bx = x; by = y; } }
      if (best < p.thresh) continue;
      const o = (by * w + bx) * 4, i = cy * gx + cx, t = fr.t;
      const jx = (vnoise(i * 1.7, t * (0.3 + p.drift * 2)) - 0.5) * (p.drift * 0.06 + p.jitter * 0.08);
      const jy = (vnoise(i * 2.3 + 9, t * (0.3 + p.drift * 2)) - 0.5) * (p.drift * 0.06 + p.jitter * 0.08);
      pts.push({ x: (bx + 0.5) / w + jx, y: 1 - (by + 0.5) / h + jy, l: best, c: [px[o], px[o + 1], px[o + 2]] });
    }
    st.pts = pts;
  },
  overlay(ctx, W, H, p, fr, st) {
    ctx.clearRect(0, 0, W, H);
    const pts = st.pts || [], k = H / 1080, reach = (0.03 + p.reach * 0.3), A = W / H;
    const col = (q, a) => { const h = p.hue * 360; const base = `hsla(${h},85%,65%,${a})`; if (p.colour < 0.01) return base; const [r, g, b] = q.c; return p.colour > 0.99 ? `rgba(${r},${g},${b},${a})` : `rgba(${Math.round(r * p.colour + 255 * (1 - p.colour) * 0.6)},${Math.round(g * p.colour + 200 * (1 - p.colour) * 0.6)},${Math.round(b * p.colour + 255 * (1 - p.colour))},${a})`; };
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(0.5, (0.5 + p.width * 3) * k);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], dx = (a.x - b.x) * A, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach) continue;
      ctx.strokeStyle = col(a, (1 - d / reach) * 0.8);
      ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke();
    }
    for (const q of pts) { ctx.fillStyle = col(q, 0.95); ctx.beginPath(); ctx.arc(q.x * W, q.y * H, (1 + p.dots * 6 * (0.4 + q.l)) * k, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  },
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  vec4 ov = texture(uOverlay, uv);
  return vec4(src(uv).rgb * p_bg + ov.rgb * ov.a * 1.2, 1.0);
}`,
};
