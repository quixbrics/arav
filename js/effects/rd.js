// Gray-Scott reaction-diffusion: two virtual chemicals react and spread,
// growing coral, spots and mazes. Bright parts of the image keep seeding
// growth; Feed and Kill choose the pattern (map them to signals to morph it).
const G = {
  init: /* glsl */`
void main(){ float s = step(0.985, hash(floor(vUv * uRes / 4.0))); fragColor = vec4(1.0, s, 0.0, 1.0); }`,
  step: /* glsl */`
uniform sampler2D uS; uniform sampler2D uImg;
void main(){
  vec2 px = 1.0 / uRes;
  vec2 s = texture(uS, vUv).rg;
  vec2 lap = -s
    + 0.2 * (texture(uS, vUv + vec2(px.x, 0.0)).rg + texture(uS, vUv - vec2(px.x, 0.0)).rg + texture(uS, vUv + vec2(0.0, px.y)).rg + texture(uS, vUv - vec2(0.0, px.y)).rg)
    + 0.05 * (texture(uS, vUv + px).rg + texture(uS, vUv - px).rg + texture(uS, vUv + vec2(px.x, -px.y)).rg + texture(uS, vUv + vec2(-px.x, px.y)).rg);
  float F = mix(0.012, 0.075, p_feed), K = mix(0.045, 0.068, p_kill);
  float abb = s.x * s.y * s.y;
  float a = s.x + (lap.x - abb + F * (1.0 - s.x));
  float b = s.y + (0.5 * lap.y + abb - (K + F) * s.y);
  float img = luma(texture(uImg, vUv).rgb);
  b = mix(b, 1.0, smoothstep(p_seed, p_seed + 0.05, img) * p_inject * 0.08);
  fragColor = vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}`,
  comp: /* glsl */`
uniform sampler2D uS; uniform sampler2D uImg;
void main(){
  float b = texture(uS, vUv).g;
  float v = smoothstep(0.12, 0.35, b);
  vec3 o = texture(uImg, vUv).rgb, c;
  vec3 col = mix(hsv(p_hue, 0.8, 0.15), hsv(p_hue + 0.1, 0.5, 1.0), v);
  if (p_mode < 0.34) c = mix(o * p_bg, col, v);
  else if (p_mode < 0.67) c = o * v;
  else c = o + col * v * 0.6;
  fragColor = vec4(mix(o, c, uMix), 1.0);
}`,
};
export default {
  type: 'rd', name: 'Reaction-Diffusion', cat: 'SIM',
  desc: 'Grows organic patterns (coral, spots, mazes) seeded by the bright parts of the image. Feed and Kill choose the pattern. Map BASS → Speed or SECTION → Feed.',
  params: [
    { k: 'feed', n: 'Feed', v: 0.4 },
    { k: 'kill', n: 'Kill', v: 0.55 },
    { k: 'speed', n: 'Speed', v: 0.5 },
    { k: 'seed', n: 'Seed threshold', v: 0.7 },
    { k: 'inject', n: 'Image seeding', v: 0.5 },
    { k: 'scale', n: 'Scale', v: 0.5 },
    { k: 'mode', n: 'Paint·Mask·Glow', v: 0.0 },
    { k: 'hue', n: 'Hue', v: 0.08 },
    { k: 'bg', n: 'Background', v: 0.15 },
  ],
  custom({ engine, uid, type, orig, slots, p, mix, fr, st }) {
    const div = p.scale < 0.34 ? 1 : p.scale < 0.67 ? 2 : 3;
    const w = Math.max(32, Math.round(Math.min(engine.W, 1280) / div)), h = Math.max(32, Math.round(w * engine.H / engine.W));
    const T = engine.simTargets(uid, 'rd', w, h, 2), prog = n => engine.customProgram(type, n, G[n]);
    const key = `${w}x${h}`;
    if (st.key !== key) { st.key = key; st.i = 0; engine.runPass(prog('init'), T[0], fr, p); }
    const moving = st.lastT === undefined || Math.abs(fr.t - st.lastT) > 1e-4; st.lastT = fr.t;
    if (moving) {
      const n = Math.round(2 + p.speed * 22);
      for (let k = 0; k < n; k++) { engine.runPass(prog('step'), T[1 - st.i], fr, p, {}, { uS: T[st.i].tex, uImg: orig.tex }); st.i = 1 - st.i; }
    }
    engine.runPass(prog('comp'), slots[0], fr, p, { uMix: mix }, { uS: T[st.i].tex, uImg: orig.tex });
    return slots[0];
  },
};
