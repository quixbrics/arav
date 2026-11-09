// Time Remap changes the SOURCE's clock (video playhead or generator time),
// wherever it sits in the stack. Speed can follow the music, the direction can
// flip on every hit, and hits can jump the footage forward.
// The whole timeline is integrated in advance (see mod.js → remapTime), so
// scrubbing and rendering always land on the same frame.
export default {
  type: 'timeremap', name: 'Time Remap', cat: 'TIME',
  desc: 'Changes the source\'s clock: video speed follows the music, reverses on hits, or jumps forward. Affects the source wherever this card sits. Map LOUD → Speed.',
  sourceTime: true,
  params: [
    { k: 'speed', n: 'Speed (−1×…3×)', v: 0.5 },
    { k: 'flip', n: 'Reverse on hits', v: 0.0 },
    { k: 'jump', n: 'Jump on hits', v: 0.0 },
    { k: 'freeze', n: 'Freeze', v: 0.0 },
  ],
  glsl: /* glsl */`vec4 effect(vec2 uv){ return src(uv); }`,
};
