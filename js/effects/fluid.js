// Stable fluids (Jos Stam / GPU Gems) on a low-resolution grid. Audio drives
// orbiting emitters that push dye and force; the image can inject dye and push
// the flow along its own edges; the flow can also warp the image itself.
const G = {
  advect: /* glsl */`
uniform sampler2D uVel; uniform sampler2D uQ; uniform float uDt, uDiss; uniform vec2 uSimRes;
void main(){ vec2 v = texture(uVel, vUv).xy; fragColor = vec4(texture(uQ, vUv - uDt * v / uSimRes).xyz * uDiss, 1.0); }`,
  force: /* glsl */`
uniform sampler2D uVel; uniform sampler2D uImg; uniform float uDt, uEN; uniform vec4 uE0, uE1, uE2, uE3;
vec2 emit(vec4 e){ vec2 d = (vUv - e.xy) * vec2(uRes.x / uRes.y, 1.0); return e.zw * exp(-dot(d, d) / 0.003); }
void main(){
  vec2 v = texture(uVel, vUv).xy, f = vec2(0.0);
  if (uEN > 0.5) f += emit(uE0); if (uEN > 1.5) f += emit(uE1); if (uEN > 2.5) f += emit(uE2); if (uEN > 3.5) f += emit(uE3);
  f *= p_force * 16000.0;
  vec2 px = 1.0 / uRes;
  float gx = luma(texture(uImg, vUv + vec2(px.x, 0.0)).rgb) - luma(texture(uImg, vUv - vec2(px.x, 0.0)).rgb);
  float gy = luma(texture(uImg, vUv + vec2(0.0, px.y)).rgb) - luma(texture(uImg, vUv - vec2(0.0, px.y)).rgb);
  f += vec2(-gy, gx) * p_push * 6000.0;                                   // flow along edges
  float e = 0.02; vec2 q = vUv * vec2(uRes.x / uRes.y, 1.0) * 3.0 + uTime * 0.07;
  f += vec2(noise(q + vec2(0.0, e)) - noise(q - vec2(0.0, e)), noise(q - vec2(e, 0.0)) - noise(q + vec2(e, 0.0))) / (2.0 * e) * p_swirl * 900.0;
  fragColor = vec4(v + f * uDt, 0.0, 1.0);
}`,
  div: /* glsl */`
uniform sampler2D uVel;
void main(){ vec2 px = 1.0 / uRes;
  float L = texture(uVel, vUv - vec2(px.x, 0.0)).x, R = texture(uVel, vUv + vec2(px.x, 0.0)).x, B = texture(uVel, vUv - vec2(0.0, px.y)).y, T = texture(uVel, vUv + vec2(0.0, px.y)).y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`,
  jacobi: /* glsl */`
uniform sampler2D uP; uniform sampler2D uDiv;
void main(){ vec2 px = 1.0 / uRes;
  float L = texture(uP, vUv - vec2(px.x, 0.0)).x, R = texture(uP, vUv + vec2(px.x, 0.0)).x, B = texture(uP, vUv - vec2(0.0, px.y)).x, T = texture(uP, vUv + vec2(0.0, px.y)).x;
  fragColor = vec4((L + R + B + T - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
  grad: /* glsl */`
uniform sampler2D uVel; uniform sampler2D uP;
void main(){ vec2 px = 1.0 / uRes;
  float L = texture(uP, vUv - vec2(px.x, 0.0)).x, R = texture(uP, vUv + vec2(px.x, 0.0)).x, B = texture(uP, vUv - vec2(0.0, px.y)).x, T = texture(uP, vUv + vec2(0.0, px.y)).x;
  fragColor = vec4(texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B), 0.0, 1.0); }`,
  dye: /* glsl */`
uniform sampler2D uVel; uniform sampler2D uQ; uniform sampler2D uImg; uniform float uDt, uDiss, uEN; uniform vec2 uSimRes; uniform vec4 uE0, uE1, uE2, uE3;
vec3 spot(vec4 e, float i){ vec2 d = (vUv - e.xy) * vec2(uRes.x / uRes.y, 1.0); return hsv(p_hue + i * 0.17 + uTime * 0.02, 0.85, 1.0) * exp(-dot(d, d) / 0.0015); }
void main(){
  vec2 v = texture(uVel, vUv).xy;
  vec3 d = texture(uQ, vUv - uDt * v / uSimRes).rgb * uDiss;
  vec3 img = texture(uImg, vUv).rgb;
  d += img * smoothstep(0.35, 0.9, luma(img)) * p_inject * uDt * 4.0;
  vec3 s = vec3(0.0);
  if (uEN > 0.5) s += spot(uE0, 0.0); if (uEN > 1.5) s += spot(uE1, 1.0); if (uEN > 2.5) s += spot(uE2, 2.0); if (uEN > 3.5) s += spot(uE3, 3.0);
  d += s * p_force * uDt * 10.0;
  fragColor = vec4(min(d, vec3(3.0)), 1.0);
}`,
  comp: /* glsl */`
uniform sampler2D uVel; uniform sampler2D uDye; uniform sampler2D uImg; uniform vec2 uSimRes;
void main(){
  vec2 v = texture(uVel, vUv).xy / uSimRes;
  vec3 o = texture(uImg, vUv).rgb, dye = texture(uDye, vUv).rgb, w = texture(uImg, vUv - v * p_warp * 0.4).rgb, c;
  if (p_mode < 0.34) c = o + dye; else if (p_mode < 0.67) c = w + dye * 0.4; else c = dye;
  fragColor = vec4(mix(o, c, uMix), 1.0);
}`,
};
export default {
  type: 'fluid', name: 'Fluid', cat: 'SIM',
  desc: 'A real-time fluid simulation. Emitters push dye and force (map KICK → Force), the image can inject dye and steer the flow, and the flow can warp the picture.',
  params: [
    { k: 'force', n: 'Force', v: 0.3 },
    { k: 'emitters', n: 'Emitters', v: 0.5 },
    { k: 'swirl', n: 'Swirl', v: 0.3 },
    { k: 'push', n: 'Image push', v: 0.2 },
    { k: 'inject', n: 'Image dye', v: 0.2 },
    { k: 'fade', n: 'Dye fade', v: 0.4 },
    { k: 'visc', n: 'Viscosity', v: 0.4 },
    { k: 'mode', n: 'Dye·Warp·Only', v: 0.0 },
    { k: 'warp', n: 'Warp amount', v: 0.5 },
    { k: 'hue', n: 'Hue', v: 0.55 },
  ],
  custom({ engine, uid, type, orig, slots, p, mix, fr, st }) {
    const W = engine.W, H = engine.H, sh = 160, sw = Math.max(16, Math.round(sh * W / H));
    const V = engine.simTargets(uid, 'vel', sw, sh, 2), P = engine.simTargets(uid, 'prs', sw, sh, 2), [D] = engine.simTargets(uid, 'div', sw, sh, 1);
    const Y = engine.simTargets(uid, 'dye', Math.round(W / 2), Math.round(H / 2), 2);
    const prog = n => engine.customProgram(type, n, G[n]);
    if (st.v === undefined) { st.v = 0; st.p = 0; st.d = 0; }
    let dt = st.lastT === undefined ? 0 : fr.t - st.lastT; st.lastT = fr.t;
    if (dt < 0 || dt > 0.25) dt = 0; dt = Math.min(dt, 1 / 24);
    const n = Math.round(p.emitters * 4), E = {};
    for (let i = 0; i < 4; i++) {
      const a = fr.t * (0.35 + i * 0.07) + i * 1.9, x = 0.5 + Math.cos(a) * (0.22 + 0.06 * i), y = 0.5 + Math.sin(a * 1.3) * (0.22 + 0.04 * i);
      E['uE' + i] = [x, y, -Math.sin(a), Math.cos(a * 1.3) * 1.3];
    }
    const simU = { uSimRes: [sw, sh], uEN: n, ...E };
    if (dt > 0) {
      const vd = Math.pow(0.4 + 0.599 * (1 - p.visc), dt * 60), dd = Math.pow(0.9 + 0.0995 * (1 - p.fade), dt * 60);
      let a = V[st.v], b = V[1 - st.v];
      engine.runPass(prog('advect'), b, fr, p, { uDt: dt, uDiss: vd, ...simU }, { uVel: a.tex, uQ: a.tex }); [a, b] = [b, a];
      engine.runPass(prog('force'), b, fr, p, { uDt: dt, ...simU }, { uVel: a.tex, uImg: orig.tex }); [a, b] = [b, a];
      engine.runPass(prog('div'), D, fr, p, {}, { uVel: a.tex });
      let pa = P[st.p], pb = P[1 - st.p];
      for (let i = 0; i < 20; i++) { engine.runPass(prog('jacobi'), pb, fr, p, {}, { uP: pa.tex, uDiv: D.tex }); [pa, pb] = [pb, pa]; }
      engine.runPass(prog('grad'), b, fr, p, {}, { uVel: a.tex, uP: pa.tex }); [a, b] = [b, a];
      st.v = V.indexOf(a); st.p = P.indexOf(pa);
      const da = Y[st.d], db = Y[1 - st.d];
      engine.runPass(prog('dye'), db, fr, p, { uDt: dt, uDiss: dd, ...simU }, { uVel: a.tex, uQ: da.tex, uImg: orig.tex });
      st.d = 1 - st.d;
    }
    engine.runPass(prog('comp'), slots[0], fr, p, { uMix: mix, uSimRes: [sw, sh] }, { uVel: V[st.v].tex, uDye: Y[st.d].tex, uImg: orig.tex });
    return slots[0];
  },
};
