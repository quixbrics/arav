// Beat repeat: like the DJ effect, but for pictures. On chosen beats, the first
// slice of the beat (1/16 note up to 2 beats) loops until the next beat.
// "Chance" picks beats at random (but the same ones every playback); map
// ONSET (gate) to "Force" to stutter on hits instead.
import { h1 } from '../util.js';

const LENS = [0.25, 0.5, 1, 2];
const state = (p, fr) => {
  const lenB = LENS[Math.min(3, Math.floor(p.len * 3.99))], group = lenB >= 1 ? 4 : 1;   // loop within a beat, or within a bar
  const gi = Math.floor(fr.beats / group), into = (fr.beats - gi * group) * fr.spb;           // seconds since the group started
  const on = p.force > 0.5 || h1(gi * 7.31 + p.seed * 100) < p.chance;
  const L = lenB * fr.spb, k = Math.floor(into / L);
  return on && k > 0 ? { uAgo: k * L, uRep: k, uOn: 1 } : { uAgo: 0, uRep: 0, uOn: 0 };
};
export default {
  type: 'beatrepeat', name: 'Beat Repeat', cat: 'TIME',
  desc: 'Stutters the image in time with the music: on chosen beats, a short slice loops until the next beat. Map ONSET (gate) → Force.',
  ring: true,
  ringSpan: (p, fr) => fr.spb * 4.3,
  uniforms: (p, fr) => state(p, fr),
  params: [
    { k: 'len', n: '¼·½·1·2 beats', v: 0.3 },
    { k: 'chance', n: 'Chance', v: 0.35 },
    { k: 'force', n: 'Force', v: 0.0 },
    { k: 'seed', n: 'Pattern', v: 0.0 },
    { k: 'fade', n: 'Fade', v: 0.8 },
    { k: 'zoom', n: 'Zoom per hit', v: 0.2 },
    { k: 'flash', n: 'Flash', v: 0.2 },
    { k: 'invert', n: 'Invert odd', v: 0.0 },
  ],
  glsl: /* glsl */`
uniform float uAgo, uRep, uOn;
vec4 effect(vec2 uv){
  if (uOn < 0.5) return src(uv);
  vec2 q = (uv - 0.5) / (1.0 + p_zoom * 0.08 * uRep) + 0.5;
  vec3 c = past(q, uAgo).rgb * pow(mix(0.55, 1.0, p_fade), uRep);
  c += p_flash * 0.5 * exp(-fract(uBeats * 4.0) * 6.0);
  if (p_invert > 0.5 && mod(uRep, 2.0) > 0.5) c = 1.0 - c;
  return vec4(c, 1.0);
}`,
};
