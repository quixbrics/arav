// ─────────────────────────────────────────────────────────────────────────────
// WRITE YOUR OWN EFFECT
// 1. Copy this file to js/effects/myeffect.js and change `type` and `name`.
// 2. Import it in js/effects/index.js and add it to the EFFECTS list.
// 3. Add a line for it to LIB in the same file so it appears in the library.
//
// Every param is a 0..1 slider and becomes a GLSL uniform called p_<k>.
// Map ranges inside the shader, e.g.  float amount = p_amount * 0.05;
// Anything a student maps (KICK → amount) changes that uniform every frame.
//
// Available in your shader:
//   vec4  src(vec2 uv)      the image coming into this effect
//   vec2  uRes              this pass's size in pixels (changes with preview ½ / ¼)
//   vec2  uOut              the final output size; use this for anything measured
//                           in pixels so the preview matches the render
//   float uTime             seconds since the start of the track
//   float uBeats            beats since the first downbeat (from the BPM grid)
//   float uOnsets           number of onsets (hits) so far, useful as a seed
//   float hash(vec2), noise(vec2), luma(vec3)
//   sampler2D uPrev         this effect's own previous output (set history:true)
//   sampler2D uOverlay      a 2D-canvas layer you draw in overlay() (optional)
//   vec4  past(vec2 uv, float secondsAgo)   an earlier frame (set ring:true and
//                           ringSpan: p => seconds to keep; see slitscan.js)
//   hsv(h,s,v), hashu(uint,uint), PI, TAU
// For 3D geometry (points / lines) see pointcloud.js and ridges.js; for
// analysing the picture on the CPU (tracking, plexus) see blobs.js.
// ─────────────────────────────────────────────────────────────────────────────
export default {
  type: 'template',
  name: 'My Effect',
  cat: 'STYLISE',
  desc: 'Describe what it does in one line.',
  params: [
    { k: 'amount', n: 'Amount', v: 0.5 },
    { k: 'speed', n: 'Speed', v: 0.3 },
  ],
  glsl: /* glsl */`
vec4 effect(vec2 uv){
  float a = p_amount * 0.05;
  vec2 off = vec2(sin(uv.y * 40.0 + uTime * p_speed * 10.0), 0.0) * a;
  return src(uv + off);
}`,
};
