// Datamosh, simulated honestly: estimate the motion between frames (optical
// flow, Lucas-Kanade on a quarter-size image), then keep pushing an OLD frame's
// pixels along that motion instead of showing the new frame, exactly what a
// video decoder does when its keyframes are deleted. A "Keyframe" spike (map
// ONSET, trigger) shows a clean frame again.
const G = {
  flow: /* glsl */`
uniform sampler2D uCur; uniform sampler2D uPrevF;
float L(sampler2D t, vec2 q){ return luma(texture(t, q).rgb); }
void main(){
  vec2 px = 1.0 / uRes;
  float a11 = 0.0, a12 = 0.0, a22 = 0.0, b1 = 0.0, b2 = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 q = vUv + vec2(i, j) * px * 1.5;
    float ix = (L(uCur, q + vec2(px.x, 0.0)) - L(uCur, q - vec2(px.x, 0.0))) * 0.5;
    float iy = (L(uCur, q + vec2(0.0, px.y)) - L(uCur, q - vec2(0.0, px.y))) * 0.5;
    float it = L(uCur, q) - L(uPrevF, q);
    a11 += ix * ix; a12 += ix * iy; a22 += iy * iy; b1 += ix * it; b2 += iy * it;
  }
  float det = a11 * a22 - a12 * a12;
  vec2 v = det > 1e-6 ? -vec2(a22 * b1 - a12 * b2, a11 * b2 - a12 * b1) / det : vec2(0.0);
  fragColor = vec4(clamp(v, -6.0, 6.0), 0.0, 1.0);                       // pixels per frame (at flow resolution)
}`,
  copy: /* glsl */`uniform sampler2D uA; void main(){ fragColor = vec4(texture(uA, vUv).rgb, 1.0); }`,
  mosh: /* glsl */`
uniform sampler2D uFlow; uniform sampler2D uOld; uniform sampler2D uImg; uniform vec2 uFlowRes; uniform float uKey;
void main(){
  vec2 b = vec2(mix(1.0, 24.0, p_blocks)) / uRes;                           // macroblocks
  vec2 cuv = p_blocks > 0.01 ? (floor(vUv / b) + 0.5) * b : vUv;
  vec2 v = texture(uFlow, cuv).xy / uFlowRes * mix(0.5, 3.0, p_amount);
  vec3 old = texture(uOld, vUv - v).rgb;
  vec3 img = texture(uImg, vUv).rgb;
  vec3 c = mix(old, img, max(uKey, p_leak * 0.15));
  if (p_bleed > 0.01) c = mix(c, c + (img - texture(uImg, vUv - v).rgb), p_bleed * 0.5);   // motion residue
  fragColor = vec4(c, 1.0);
}`,
  comp: /* glsl */`
uniform sampler2D uM; uniform sampler2D uImg;
void main(){ fragColor = vec4(mix(texture(uImg, vUv).rgb, texture(uM, vUv).rgb, uMix), 1.0); }`,
};
export default {
  type: 'datamosh', name: 'Datamosh', cat: 'GLITCH',
  desc: 'Drags an old frame along the motion of the new one, like video with its keyframes deleted. Map ONSET (trigger) → Keyframe to snap back on hits. Needs moving footage.',
  params: [
    { k: 'key', n: 'Keyframe', v: 0.0 },
    { k: 'amount', n: 'Motion gain', v: 0.4 },
    { k: 'blocks', n: 'Macroblocks', v: 0.4 },
    { k: 'leak', n: 'Leak', v: 0.1 },
    { k: 'bleed', n: 'Residue', v: 0.3 },
  ],
  custom({ engine, uid, type, orig, slots, p, mix, fr, st }) {
    const fw = Math.max(16, Math.round(engine.W / 4)), fh = Math.max(16, Math.round(engine.H / 4));
    const [F] = engine.simTargets(uid, 'flow', fw, fh, 1), [PF, CF] = engine.simTargets(uid, 'prevf', fw, fh, 2, true);
    const M = engine.simTargets(uid, 'mosh', engine.W, engine.H, 2), prog = n => engine.customProgram(type, n, G[n]);
    if (st.i === undefined) { st.i = 0; st.fresh = true; }
    const moving = st.lastT === undefined || Math.abs(fr.t - st.lastT) > 1e-4;
    const jumped = st.lastT !== undefined && (fr.t < st.lastT || fr.t - st.lastT > 0.5); st.lastT = fr.t;
    if (moving) {
      engine.runPass(prog('copy'), CF, fr, p, {}, { uA: orig.tex });
      engine.runPass(prog('flow'), F, fr, p, {}, { uCur: CF.tex, uPrevF: PF.tex });
      const key = (p.key > 0.5 && !(st.prevKey > 0.5)) || st.fresh || jumped ? 1 : 0; st.prevKey = p.key; st.fresh = false;
      engine.runPass(prog('mosh'), M[1 - st.i], fr, p, { uFlowRes: [fw, fh], uKey: key }, { uFlow: F.tex, uOld: M[st.i].tex, uImg: orig.tex });
      st.i = 1 - st.i;
      engine.runPass(prog('copy'), PF, fr, p, {}, { uA: CF.tex });
    }
    engine.runPass(prog('comp'), slots[0], fr, p, { uMix: mix }, { uM: M[st.i].tex, uImg: orig.tex });
    return slots[0];
  },
};
