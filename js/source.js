// Visual sources: built-in generators (GLSL) or media (video / image / webcam).
// The source is always the first pass in the chain and is mappable like any effect.

export const GENS = {
  testcard: { n: 'Test card', glsl: /* glsl */`
vec3 gen(vec2 uv){
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) / mix(0.6, 1.6, p_scale);
  float t = uTime * mix(0.0, 2.0, p_speed);
  vec3 bars[7] = vec3[](vec3(.75,.75,.75), vec3(.75,.75,0), vec3(0,.75,.75), vec3(0,.75,0), vec3(.75,0,.75), vec3(.75,0,0), vec3(0,0,.75));
  vec3 c;
  if (uv.y > 0.33) { int i = int(clamp(floor(uv.x * 7.0), 0.0, 6.0)); c = bars[i]; }
  else if (uv.y > 0.25) c = vec3(fract(uv.x * 8.0 - t * 0.2) < 0.5 ? 0.9 : 0.05);
  else c = vec3(uv.x);
  c = mix(c, c.gbr, p_hue);
  // grid
  vec2 g = abs(fract(p * mix(4.0, 16.0, p_detail)) - 0.5);
  c = mix(c, vec3(1.0), (1.0 - smoothstep(0.0, 0.02, min(g.x, g.y))) * 0.35);
  // centre ring that breathes with "pulse"
  float r = length(p);
  float ring = 0.22 + p_pulse * 0.18;
  c = mix(c, vec3(1.0), 1.0 - smoothstep(0.004, 0.012, abs(r - ring)));
  c = mix(c, vec3(1.0, 0.25, 0.2), 1.0 - smoothstep(0.004, 0.01, abs(r - ring * 0.5 - 0.02 * sin(t * 3.0))));
  // sweeping bar
  float sx = fract(t * 0.25);
  c += vec3(1.0) * (1.0 - smoothstep(0.0, 0.006, abs(uv.x - sx))) * 0.8;
  return c;
}` },
  noise: { n: 'Noise flow', glsl: /* glsl */`
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
vec3 gen(vec2 uv){
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * mix(1.0, 8.0, p_scale);
  float t = uTime * mix(0.0, 0.6, p_speed);
  vec2 q = vec2(fbm(p + t), fbm(p - t + 3.1));
  float n = fbm(p + q * mix(0.5, 4.0, p_detail) + t * 0.5);
  n = pow(n, 1.6 - p_pulse);
  vec3 a = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + p_hue + n * 0.8));
  return a * smoothstep(0.1, 0.9, n) * (0.7 + p_pulse * 0.8);
}` },
  rings: { n: 'SDF rings', glsl: /* glsl */`
vec3 gen(vec2 uv){
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) / mix(0.4, 1.4, p_scale);
  float t = uTime * mix(0.0, 1.5, p_speed);
  float r = length(p);
  float k = mix(6.0, 40.0, p_detail);
  float rings = smoothstep(0.35, 0.0, abs(fract(r * k - t) - 0.5) - 0.12 - p_pulse * 0.2);
  float a = atan(p.y, p.x);
  float sq = 0.0;
  for (int i = 0; i < 3; i++) {
    float rr = t * 0.3 * float(i + 1);
    vec2 q = mat2(cos(rr), -sin(rr), sin(rr), cos(rr)) * p;
    vec2 d = abs(q) - vec2(0.18 + 0.12 * float(i) + p_pulse * 0.1);
    float b = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    sq += 1.0 - smoothstep(0.0, 0.008, abs(b));
  }
  vec3 col = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.1, 0.2) + p_hue + r * 0.4 + a * 0.05));
  return col * rings * smoothstep(1.2, 0.2, r) + vec3(sq);
}` },
  gradient: { n: 'Gradient bands', glsl: /* glsl */`
vec3 gen(vec2 uv){
  float t = uTime * mix(0.0, 0.5, p_speed);
  float y = uv.y * mix(1.0, 6.0, p_scale) + sin(uv.x * 3.0 + t * 2.0) * 0.2 * p_detail + t;
  vec3 c = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + p_hue + y * 0.3));
  float bands = 0.6 + 0.4 * smoothstep(0.3, 0.7, fract(y * 3.0));
  return c * mix(0.4, 1.0, bands) * (0.6 + p_pulse * 0.6);
}` },
};

export const SRC_PARAMS = {
  gen: [
    { k: 'scale', n: 'Scale', v: 0.5 }, { k: 'speed', n: 'Speed', v: 0.3 }, { k: 'hue', n: 'Hue', v: 0.0 },
    { k: 'detail', n: 'Detail', v: 0.5 }, { k: 'pulse', n: 'Pulse', v: 0.0 },
  ],
  media: [
    { k: 'zoom', n: 'Zoom', v: 0.0 }, { k: 'panx', n: 'Pan X', v: 0.5 }, { k: 'pany', n: 'Pan Y', v: 0.5 },
    { k: 'fit', n: 'Fit (0 fill · 1 fit)', v: 0.0 }, { k: 'bright', n: 'Brightness', v: 0.5 }, { k: 'sat', n: 'Saturation', v: 0.5 },
  ],
};

export const MEDIA_GLSL = /* glsl */`
uniform sampler2D uMedia;
uniform vec2 uMediaRes;
uniform float uMirror;
vec3 gen(vec2 uv){
  float ao = uRes.x / uRes.y, am = uMediaRes.x / max(uMediaRes.y, 1.0);
  vec2 s = vec2(1.0);
  if (p_fit < 0.5) { if (am > ao) s.x = ao / am; else s.y = am / ao; }
  else             { if (am > ao) s.y = am / ao; else s.x = ao / am; }
  vec2 m = (uv - 0.5) * s / (1.0 + p_zoom * 3.0) + 0.5 + (vec2(p_panx, p_pany) - 0.5) * (1.0 - s / (1.0 + p_zoom * 3.0));
  if (uMirror > 0.5) m.x = 1.0 - m.x;
  if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return vec3(0.0);
  vec3 c = texture(uMedia, m).rgb;
  c *= p_bright * 2.0;
  c = mix(vec3(luma(c)), c, p_sat * 2.0);
  return c;
}`;

// ---- media state (not serialised; files must be reloaded) ----
export const media = { kind: 'gen', el: null, w: 0, h: 0, name: '', video: false, stream: null, file: null };

export function stopMedia() {
  if (media.stream) media.stream.getTracks().forEach(t => t.stop());
  if (media.el && media.video) { media.el.pause(); if (media.el.src) URL.revokeObjectURL(media.el.src); }
  Object.assign(media, { kind: 'gen', el: null, w: 0, h: 0, name: '', video: false, stream: null, file: null });
}

export async function loadVisualFile(file) {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('image/')) {
    const img = new Image(); img.src = url; await img.decode();
    stopMedia();
    Object.assign(media, { kind: 'media', el: img, w: img.naturalWidth, h: img.naturalHeight, name: file.name, video: false, file });
    return media;
  }
  const v = document.createElement('video');
  v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('This browser cannot play that video. Try MP4 (H.264) or WebM.')); });
  if (!isFinite(v.duration)) { // browser-recorded WebM often has no duration: force the browser to find it
    await new Promise(res => { const done = () => { v.removeEventListener('durationchange', on); res(); }; const on = () => { if (isFinite(v.duration)) done(); }; v.addEventListener('durationchange', on); v.currentTime = 1e7; setTimeout(done, 3000); });
    v.currentTime = 0;
  }
  stopMedia();
  Object.assign(media, { kind: 'media', el: v, w: v.videoWidth, h: v.videoHeight, name: file.name, video: true, file, dur: v.duration });
  return media;
}

export async function startWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  const v = document.createElement('video');
  v.srcObject = stream; v.muted = true; v.playsInline = true; await v.play();
  stopMedia();
  Object.assign(media, { kind: 'webcam', el: v, w: v.videoWidth, h: v.videoHeight, name: 'Webcam', video: false, stream });
  return media;
}

// keep a video file in step with the audio clock
export function syncVideo(t, playing) {
  if (!media.video || !media.el) return;
  const v = media.el, d = v.duration || 1, target = t % d;
  if (playing) {
    if (v.paused) v.play().catch(() => {});
    if (Math.abs(v.currentTime - target) > 0.25 && Math.abs(v.currentTime - target) < d - 0.25) v.currentTime = target;
  } else {
    if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - target) > 1 / 30) v.currentTime = target;
  }
}

// Time Remap: hold the video paused and seek it to wherever the remapped clock says
export function seekVideoTo(t) {
  if (!media.video || !media.el) return;
  const v = media.el, d = v.duration || 1, target = ((t % d) + d) % d;
  if (!v.paused) v.pause();
  if (!v.seeking && Math.abs(v.currentTime - target) > 1 / 40) v.currentTime = target;
}
