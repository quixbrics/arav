// WebGL2 render engine.
//   source pass → [effect pass(es) → …] → display
//
// Render targets are RGBA16F when the GPU allows it, otherwise RGBA8.
// An effect definition can declare any of:
//   history:true       its own previous output as uPrev (feedback, trails)
//   historyPass:n      …taken after pass n instead of the last pass
//   passes(p,fr)->n    run the shader n times; uPass = 0..n-1, uSrc = previous
//                      pass, uOrig = the effect's input
//   ring:true          keeps recent input frames in a texture array; sample
//                      them with past(uv, secondsAgo). ringSpan(p,fr) = seconds kept
//   probe:{w,h}        a small copy of the input read back to the CPU each frame
//                      and handed to cpu(pixels, w, h, p, fr, state)
//   overlay(ctx,W,H,p,fr,state)   a 2D canvas layer, bound as uOverlay
//   uniforms(p,fr,state)->{}      extra uniforms computed in JS
//   geom:{ layers(p,fr)->[…] }    3D geometry drawn with custom vertex shaders
//                                 (point clouds, ridge lines) instead of `glsl`
import { EFFECTS } from '../effects/index.js';
import { GENS, MEDIA_GLSL } from '../source.js';

const VERT = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const COMMON = `
uniform vec2 uRes; uniform vec2 uOut;
uniform float uTime, uBeats, uOnsets, uMix, uPass, uPasses;
#define PI 3.14159265
#define TAU 6.28318531
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
uint uhash(uint x){ x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float hashu(uint a, uint b){ return float(uhash(a * 0x9E3779B9u ^ uhash(b + 0x632BE5ABu))) / 4294967295.0; }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
`;
const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform sampler2D uOrig; uniform sampler2D uPrev; uniform sampler2D uOverlay;
uniform sampler2DArray uRing; uniform float uRingHead, uRingN, uRingDt, uRingCount;
uniform sampler2D uSource; uniform sampler2D uDepth; uniform sampler2D uMask; uniform float uHasDepth, uHasMask;
` + COMMON + `
vec4 src(vec2 uv){ return texture(uSrc, uv); }
// a frame from the past: needs ring:true on the effect
vec4 past(vec2 uv, float secAgo){
  float f = clamp(secAgo / max(uRingDt, 1e-4), 0.0, max(uRingCount - 1.0, 0.0));
  float i0 = floor(f), w = f - i0;
  float l0 = mod(uRingHead - i0 + uRingN, uRingN), l1 = mod(uRingHead - i0 - 1.0 + uRingN, uRingN);
  return mix(texture(uRing, vec3(uv, l0)), texture(uRing, vec3(uv, l1)), i0 + 1.0 < uRingCount ? w : 0.0);
}
`;
// header for geometry layers (vertex and fragment)
const GEO_VS_HEAD = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSrc; uniform sampler2D uDepth; uniform float uHasDepth;
uniform vec4 uCam;   // yaw, pitch, distance, focal
` + COMMON + `
vec4 project(vec3 p){
  float cy = cos(uCam.x), sy = sin(uCam.x), cp = cos(uCam.y), sp = sin(uCam.y);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p = vec3(p.x, cp * p.y + sp * p.z, -sp * p.y + cp * p.z);
  float z = p.z + uCam.z;
  float aspect = uRes.x / uRes.y, n = 0.05, f = 60.0;
  return vec4(p.x * uCam.w / aspect, p.y * uCam.w, (z - n) / (f - n) * 2.0 * z - z, z);
}
`;
const GEO_FS_HEAD = `#version 300 es
precision highp float;
out vec4 fragColor;
` + COMMON;

const paramUniforms = defs => defs.map(p => `uniform float p_${p.k};`).join('\n') + '\n';
const FX_MAIN = `
void main(){ vec4 a = texture(uOrig, vUv); vec4 b = effect(vUv); fragColor = vec4(mix(a.rgb, b.rgb, uMix), 1.0); }`;
const SRC_MAIN = `
void main(){ fragColor = vec4(clamp(gen(vUv), 0.0, 1.0), 1.0); }`;
const COPY = HEAD + `void main(){ fragColor = vec4(texture(uSrc, vUv).rgb, 1.0); }`;
const DIM = HEAD + `uniform float uDim; void main(){ fragColor = vec4(texture(uSrc, vUv).rgb * uDim, 1.0); }`;
const MIXP = HEAD + `void main(){ fragColor = vec4(mix(texture(uOrig, vUv).rgb, texture(uSrc, vUv).rgb, uMix), 1.0); }`;
const DISPLAY = HEAD + `
uniform sampler2D uA; uniform float uSplit, uDome; uniform vec4 uLook;   // yaw, pitch, fov, on
void main(){
  vec2 uv = vUv;
  if (uLook.w > 0.5) {                       // look inside the 360 sphere
    vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0 * tan(uLook.z * 0.5);
    vec3 d = normalize(vec3(q.x, q.y, 1.0));
    float cp = cos(uLook.y), sp = sin(uLook.y); d = vec3(d.x, cp * d.y + sp * d.z, -sp * d.y + cp * d.z);
    float cy = cos(uLook.x), sy = sin(uLook.x); d = vec3(cy * d.x + sy * d.z, d.y, -sy * d.x + cy * d.z);
    uv = vec2(atan(d.x, d.z) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  }
  vec3 c = (uSplit > 0.0 && uv.x < uSplit) ? texture(uA, uv).rgb : texture(uSrc, uv).rgb;
  if (uDome > 0.5) c *= smoothstep(0.5, 0.497, length(uv - 0.5));
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const RING_N = 48;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.vao = gl.createVertexArray();
    this.progs = new Map(); this.errors = new Map();
    this.hist = new Map(); this.rings = new Map(); this.overlays = new Map(); this.probes = new Map(); this.states = new Map();
    this.mediaTex = this.makeTex();
    this.dummyArray = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.dummyArray);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    this.W = 0; this.H = 0; this.wrap = false; this.depth = null;
    this.display = this.program('display', DISPLAY);
    this.copy = this.program('copy', COPY);
    this.dim = this.program('dim', DIM);
    this.mixp = this.program('mix', MIXP);
  }
  makeTex() {
    const gl = this.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  }
  target(w, h, low = false) {
    const gl = this.gl, tex = this.makeTex(), f16 = this.float && !low;
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, f16 ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, f16 ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }
  freeTarget(t) { if (!t) return; this.gl.deleteFramebuffer(t.fb); this.gl.deleteTexture(t.tex); }
  resize(w, h, wrap) {
    w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h));
    if (w === this.W && h === this.H && wrap === this.wrap) return;
    this.W = w; this.H = h; this.wrap = wrap;
    this.canvas.width = w; this.canvas.height = h;
    ['tSrc', 'tA', 'tB', 'tC'].forEach(k => { this.freeTarget(this[k]); this[k] = this.target(w, h); });
    if (this.depth) this.gl.deleteRenderbuffer(this.depth);
    this.depth = this.gl.createRenderbuffer();
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depth);
    this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT24, w, h);
    this.clearHistory();
    this.overlays.forEach(o => { o.canvas.width = w; o.canvas.height = h; });
  }
  compile(type, text) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, text); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
    return s;
  }
  program(key, frag, vert = VERT) {
    if (this.progs.has(key)) return this.progs.get(key);
    const gl = this.gl; let entry = null;
    try {
      const p = gl.createProgram();
      gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vert));
      gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const loc = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, u.name); }
      entry = { prog: p, loc };
    } catch (e) { console.error('Shader error in', key, '\n', e.message); this.errors.set(key, e.message); }
    this.progs.set(key, entry);
    return entry;
  }
  fxProgram(type) { const d = EFFECTS[type]; return this.program('fx:' + type, HEAD + paramUniforms(d.params) + d.glsl + FX_MAIN); }
  geoProgram(type, i, L) {
    const d = EFFECTS[type], pu = paramUniforms(d.params);
    return this.program(`geo:${type}:${i}`, GEO_FS_HEAD + pu + L.fs, GEO_VS_HEAD + pu + L.vs);
  }
  srcProgram(kind, gen, defs) {
    if (kind === 'gen') return this.program('gen:' + gen, HEAD + paramUniforms(defs) + GENS[gen].glsl + SRC_MAIN);
    return this.program('media', HEAD + paramUniforms(defs) + MEDIA_GLSL + SRC_MAIN);
  }
  set(e, name, v) {
    const l = e.loc[name]; if (!l) return; const gl = this.gl;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else if (v.length === 4) gl.uniform4fv(l, v);
  }
  bindTex(e, name, unit, tex, target) {
    const l = e.loc[name]; if (!l) return; const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target || gl.TEXTURE_2D, tex); gl.uniform1i(l, unit);
  }
  draw(target, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, w || this.W, h || this.H);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  upload(tex, el) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); } catch (e) { /* not ready */ }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  overlay(uid) {
    let o = this.overlays.get(uid);
    if (!o) { const c = document.createElement('canvas'); c.width = this.W; c.height = this.H; o = { canvas: c, ctx: c.getContext('2d'), tex: this.makeTex() }; this.overlays.set(uid, o); }
    return o;
  }
  state(uid) { let s = this.states.get(uid); if (!s) { s = {}; this.states.set(uid, s); } return s; }
  // ---- frame ring (texture array) ----
  ring(uid) {
    let r = this.rings.get(uid);
    if (!r) {
      const gl = this.gl, rw = Math.max(16, Math.round(Math.min(this.W, 800))), rh = Math.max(16, Math.round(rw * this.H / this.W));
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, rw, rh, RING_N, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, this.wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbs = [];
      for (let i = 0; i < RING_N; i++) { const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, i); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); fbs.push(fb); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      r = { tex, fbs, w: rw, h: rh, head: -1, count: 0, lastT: -1e9 };
      this.rings.set(uid, r);
    }
    return r;
  }
  freeRing(r) { const gl = this.gl; r.fbs.forEach(f => gl.deleteFramebuffer(f)); gl.deleteTexture(r.tex); }
  pushRing(r, srcTex, t, span) {
    const dt = span / RING_N;
    if (t < r.lastT - 1e-4) { r.count = 0; r.lastT = -1e9; }        // jumped back: restart
    if (t - r.lastT < dt * 0.999 && r.count) return;
    r.head = (r.head + 1) % RING_N; r.count = Math.min(RING_N, r.count + 1); r.lastT = t; r.dt = dt;
    const gl = this.gl, e = this.copy;
    gl.useProgram(e.prog); this.bindTex(e, 'uSrc', 0, srcTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.fbs[r.head]); gl.viewport(0, 0, r.w, r.h);
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // ---- CPU probe ----
  probe(uid, srcTex, w, h) {
    let p = this.probes.get(uid);
    if (!p || p.t.w !== w || p.t.h !== h) { if (p) this.freeTarget(p.t); p = { t: this.target(w, h, true), px: new Uint8Array(w * h * 4) }; this.probes.set(uid, p); }
    const gl = this.gl, e = this.copy;
    gl.useProgram(e.prog); this.bindTex(e, 'uSrc', 0, srcTex); this.draw(p.t, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.t.fb);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, p.px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return p.px;
  }
  // frame: {t, beats, onsets, outW, outH, spb, source, stack:[{uid,type,on,mix,params}], split, dome, …}
  render(fr) {
    const gl = this.gl, common = e => {
      this.set(e, 'uRes', [this.W, this.H]); this.set(e, 'uOut', [fr.outW, fr.outH]);
      this.set(e, 'uTime', fr.t); this.set(e, 'uBeats', fr.beats); this.set(e, 'uOnsets', fr.onsets);
    };
    this.renderSource(fr, common);
    // ---- effects ----
    let read = this.tSrc;
    const live = new Set();
    for (const f of fr.stack) {
      if (!f.on || f.mix <= 0.001) continue;
      const d = EFFECTS[f.type]; if (!d) continue;
      live.add(f.uid);
      const orig = read, slots = [this.tA, this.tB, this.tC].filter(t => t !== orig), st = this.state(f.uid);
      // CPU side
      if (d.probe) { const pw = d.probe.w, ph = d.probe.h; d.cpu(this.probe(f.uid, orig.tex, pw, ph), pw, ph, f.params, fr, st); }
      let ovTex = null;
      if (d.overlay) { const o = this.overlay(f.uid); d.overlay(o.ctx, this.W, this.H, f.params, fr, st); this.upload(o.tex, o.canvas); ovTex = o.tex; }
      const extra = d.uniforms ? d.uniforms(f.params, fr, st) : null;
      let ring = null;
      if (d.ring) { ring = this.ring(f.uid); this.pushRing(ring, orig.tex, fr.t, d.ringSpan ? d.ringSpan(f.params, fr) : 1); }

      if (d.geom) { read = this.renderGeom(f, d, orig, slots, fr, common, extra); continue; }
      if (d.custom) {
        const out = d.custom({ engine: this, gl, uid: f.uid, type: f.type, orig, slots, p: f.params, mix: f.mix, fr, st, common, extra });
        if (out) { live.add(f.uid); read = out; }
        continue;
      }

      const e = this.fxProgram(f.type); if (!e) continue;
      let h = null;
      if (d.history) { h = this.hist.get(f.uid); if (!h) { h = this.target(this.W, this.H); this.hist.set(f.uid, h); } }
      const passes = Math.max(1, Math.round(d.passes ? d.passes(f.params, fr) : 1));
      gl.useProgram(e.prog); common(e);
      for (const k in f.params) this.set(e, 'p_' + k, f.params[k]);
      if (extra) for (const k in extra) this.set(e, k, extra[k]);
      this.set(e, 'uPasses', passes);
      this.bindTex(e, 'uOrig', 4, orig.tex);
      this.bindGlobals(e, f.type);
      if (h) this.bindTex(e, 'uPrev', 1, h.tex);
      if (ovTex) this.bindTex(e, 'uOverlay', 2, ovTex);
      if (ring) { this.bindTex(e, 'uRing', 10, ring.tex, gl.TEXTURE_2D_ARRAY); this.set(e, 'uRingHead', ring.head); this.set(e, 'uRingN', RING_N); this.set(e, 'uRingDt', ring.dt || 0.016); this.set(e, 'uRingCount', ring.count); }
      else if (e.loc.uRing) this.bindTex(e, 'uRing', 10, this.dummyArray, gl.TEXTURE_2D_ARRAY);
      let pin = orig;
      for (let p = 0; p < passes; p++) {
        const dst = slots[p % 2];
        this.set(e, 'uPass', p);
        this.set(e, 'uMix', p === passes - 1 ? f.mix : 1);
        this.bindTex(e, 'uSrc', 0, pin.tex);
        this.draw(dst);
        pin = dst;
        if (h && d.historyPass === p) this.blit(pin, h);
      }
      if (h && d.historyPass === undefined) this.blit(pin, h);
      read = pin;
    }
    for (const [k, t] of this.hist) if (!live.has(k)) { this.freeTarget(t); this.hist.delete(k); }
    for (const [k, r] of this.rings) if (!live.has(k)) { this.freeRing(r); this.rings.delete(k); }
    for (const k of this.states.keys()) if (!live.has(k)) this.states.delete(k);
    if (this.sims) for (const [k, S] of this.sims) if (!live.has(k)) { Object.values(S).flat().forEach(t => this.freeTarget(t)); this.sims.delete(k); }
    // ---- display ----
    const dp = this.display;
    gl.useProgram(dp.prog); common(dp);
    this.bindTex(dp, 'uSrc', 0, read.tex); this.bindTex(dp, 'uA', 1, this.tSrc.tex);
    this.set(dp, 'uSplit', fr.look ? 0 : fr.split || 0); this.set(dp, 'uDome', fr.dome ? 1 : 0);
    this.set(dp, 'uLook', fr.look ? [fr.look.yaw, fr.look.pitch, fr.look.fov, 1] : [0, 0, 1, 0]);
    this.draw(null);
  }
  // the source pass alone (stateless): used to feed ML models the exact frame before effects run
  renderSource(fr, common) {
    const gl = this.gl;
    common = common || (e => { this.set(e, 'uRes', [this.W, this.H]); this.set(e, 'uOut', [fr.outW, fr.outH]); this.set(e, 'uTime', fr.t); this.set(e, 'uBeats', fr.beats); this.set(e, 'uOnsets', fr.onsets); });
    // ---- source ----
    const s = fr.source, sp = this.srcProgram(s.kind === 'gen' ? 'gen' : 'media', s.gen, s.defs);
    if (sp) {
      gl.useProgram(sp.prog); common(sp);
      this.set(sp, 'uTime', s.time ?? fr.t);
      for (const k in s.params) this.set(sp, 'p_' + k, s.params[k]);
      if (s.kind !== 'gen') {
        if (s.el) this.upload(this.mediaTex, s.el);
        this.bindTex(sp, 'uMedia', 3, this.mediaTex);
        this.set(sp, 'uMediaRes', [s.mw || 1, s.mh || 1]); this.set(sp, 'uMirror', s.mirror ? 1 : 0);
      }
      this.draw(this.tSrc);
    }
  }
  // 3D layers drawn over a (dimmed) copy of the input, with a depth buffer
  renderGeom(f, d, orig, slots, fr, common, extra) {
    const gl = this.gl, dst = slots[0];
    gl.useProgram(this.dim.prog); this.bindTex(this.dim, 'uSrc', 0, orig.tex); this.set(this.dim, 'uDim', f.params.bg ?? 0); this.draw(dst);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(this.vao);
    const layers = d.geom.layers(f.params, fr);
    layers.forEach((L, i) => {
      const e = this.geoProgram(f.type, i, L); if (!e) return;
      gl.useProgram(e.prog); common(e);
      for (const k in f.params) this.set(e, 'p_' + k, f.params[k]);
      if (extra) for (const k in extra) this.set(e, k, extra[k]);
      if (L.uniforms) for (const k in L.uniforms) this.set(e, k, L.uniforms[k]);
      this.bindTex(e, 'uSrc', 0, orig.tex);
      if (e.loc.uDepth) { const G = this.globals || {}; this.bindTex(e, 'uDepth', 12, G.depth?.ok ? G.depth.tex : this.mediaTex); this.set(e, 'uHasDepth', G.depth?.ok ? 1 : 0); }
      if (L.depth) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(L.depthFunc === 'lequal' ? gl.LEQUAL : gl.LESS); gl.depthMask(L.depthWrite !== false); } else gl.disable(gl.DEPTH_TEST);
      if (L.offset) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(L.offset, L.offset); } else gl.disable(gl.POLYGON_OFFSET_FILL);
      if (L.blend === 'add') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); }
      else if (L.blend === 'alpha') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      else gl.disable(gl.BLEND);
      const prim = { POINTS: gl.POINTS, LINES: gl.LINES, STRIP: gl.TRIANGLE_STRIP, TRIANGLES: gl.TRIANGLES }[L.prim];
      if (L.count > 0) gl.drawArraysInstanced(prim, 0, L.count, L.instances || 1);
    });
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (f.mix >= 0.999) return dst;
    const out = slots[1], e = this.mixp;
    gl.useProgram(e.prog); this.bindTex(e, 'uOrig', 4, orig.tex); this.bindTex(e, 'uSrc', 0, dst.tex); this.set(e, 'uMix', f.mix); this.draw(out);
    return out;
  }
  // ---- shared textures: original source, AI depth, AI person mask, per-effect assets ----
  setGlobal(name, el) {
    this.globals = this.globals || {};
    if (!el) { this.globals[name] = null; return; }
    let g = this.globals[name]; if (!g) g = this.globals[name] = { tex: this.makeTex() };
    this.upload(g.tex, el); g.ok = true;
  }
  bindGlobals(e, type) {
    const G = this.globals || {};
    this.bindTex(e, 'uSource', 11, this.tSrc.tex);
    if (e.loc.uDepth) { this.bindTex(e, 'uDepth', 12, G.depth?.ok ? G.depth.tex : this.mediaTex); this.set(e, 'uHasDepth', G.depth?.ok ? 1 : 0); }
    if (e.loc.uMask) { this.bindTex(e, 'uMask', 13, G.mask?.ok ? G.mask.tex : this.mediaTex); this.set(e, 'uHasMask', G.mask?.ok ? 1 : 0); }
    const d = EFFECTS[type];
    if (d && d.textures) {
      this.assetTex = this.assetTex || new Map();
      let A = this.assetTex.get(type);
      if (!A) { A = {}; const src = d.textures(); for (const k in src) { A[k] = this.makeTex(); this.upload(A[k], src[k]); } this.assetTex.set(type, A); }
      let unit = 14; for (const k in A) this.bindTex(e, k, unit++, A[k]);
    }
  }
  // ---- helpers for custom (multi-buffer) effects such as fluids ----
  customProgram(type, name, glsl) { const d = EFFECTS[type]; return this.program(`cu:${type}:${name}`, HEAD + paramUniforms(d.params) + glsl); }
  simTargets(uid, key, w, h, n = 1, low = false) {
    this.sims = this.sims || new Map();
    let S = this.sims.get(uid); if (!S) { S = {}; this.sims.set(uid, S); }
    const k = `${key}:${w}x${h}`;
    if (!S[k]) S[k] = Array.from({ length: n }, () => this.target(w, h, low));
    return S[k];
  }
  // run one full-screen pass of a custom program into target (or its size)
  runPass(e, target, fr, p, uniforms = {}, textures = {}) {
    const gl = this.gl;
    gl.useProgram(e.prog);
    this.set(e, 'uRes', [target.w, target.h]); this.set(e, 'uOut', [fr.outW, fr.outH]);
    this.set(e, 'uTime', fr.t); this.set(e, 'uBeats', fr.beats); this.set(e, 'uOnsets', fr.onsets);
    for (const k in p) this.set(e, 'p_' + k, p[k]);
    for (const k in uniforms) this.set(e, k, uniforms[k]);
    let unit = 0; for (const k in textures) this.bindTex(e, k, unit++, textures[k]);
    this.bindTex(e, 'uSource', 11, this.tSrc.tex);
    const G = this.globals || {};
    if (e.loc.uDepth) { this.bindTex(e, 'uDepth', 12, G.depth?.ok ? G.depth.tex : this.mediaTex); this.set(e, 'uHasDepth', G.depth?.ok ? 1 : 0); }
    if (e.loc.uMask) { this.bindTex(e, 'uMask', 13, G.mask?.ok ? G.mask.tex : this.mediaTex); this.set(e, 'uHasMask', G.mask?.ok ? 1 : 0); }
    this.draw(target, target.w, target.h);
  }
  blit(a, b) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, a.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, b.fb);
    gl.blitFramebuffer(0, 0, this.W, this.H, 0, 0, this.W, this.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
  clearHistory() {
    this.hist.forEach(t => this.freeTarget(t)); this.hist.clear();
    this.rings.forEach(r => this.freeRing(r)); this.rings.clear();
    this.probes.forEach(p => this.freeTarget(p.t)); this.probes.clear();
    this.states.clear();
    if (this.sims) { for (const S of this.sims.values()) Object.values(S).flat().forEach(t => this.freeTarget(t)); this.sims.clear(); }
  }
}
