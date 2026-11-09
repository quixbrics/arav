export default {
  type: 'dither', name: 'Dither', cat: 'STYLISE',
  desc: 'Reduces the image to a few colours with ordered (Bayer), noise or halftone-dot dithering and retro palettes. Map KICK → Pixel size.',
  params: [
    { k: 'pixel', n: 'Pixel size', v: 0.15 },
    { k: 'levels', n: 'Levels', v: 0.0 },
    { k: 'pattern', n: 'Bayer·Noise·Dots', v: 0.0 },
    { k: 'palette', n: 'Mono·GB·CGA·Hue·Src', v: 0.0 },
    { k: 'hue', n: 'Hue', v: 0.6 },
    { k: 'contrast', n: 'Contrast', v: 0.5 },
    { k: 'bias', n: 'Brightness', v: 0.5 },
  ],
  glsl: /* glsl */`
float bayer8(vec2 p){
  ivec2 q = ivec2(mod(p, 8.0)); int x = q.x, y = q.y, v = 0;
  int xy = x ^ y;
  v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}
vec3 pal(float l, vec3 c){
  float p = p_palette;
  if (p < 0.2) return vec3(l);
  if (p < 0.4) { vec3 a = vec3(0.06, 0.22, 0.06), b = vec3(0.19, 0.38, 0.19), d = vec3(0.55, 0.67, 0.06), e = vec3(0.61, 0.74, 0.06);
    return l < 0.34 ? mix(a, b, l * 3.0) : l < 0.67 ? mix(b, d, (l - 0.34) * 3.0) : mix(d, e, (l - 0.67) * 3.0); }
  if (p < 0.6) { return l < 0.25 ? vec3(0.0) : l < 0.5 ? vec3(0.33, 1.0, 1.0) * 0.8 : l < 0.75 ? vec3(1.0, 0.33, 1.0) : vec3(1.0); }
  if (p < 0.8) return mix(hsv(p_hue, 0.9, 0.12), hsv(p_hue + 0.08, 0.35, 1.0), l);
  return c * (0.2 + l);
}
vec4 effect(vec2 uv){
  float px = max(1.0, floor(mix(1.0, 12.0, p_pixel) * uOut.y / 1080.0 + 0.5));
  vec2 cellOut = px / uOut;
  vec2 q = (floor(uv / cellOut) + 0.5) * cellOut;
  vec3 c = src(q).rgb;
  float l = clamp((luma(c) - 0.5) * mix(0.5, 2.5, p_contrast) + 0.5 + (p_bias - 0.5) * 0.6, 0.0, 1.0);
  vec2 cp = floor(uv * uOut / px);
  float th;
  if (p_pattern < 0.34) th = bayer8(cp);
  else if (p_pattern < 0.67) th = hash(cp + floor(uTime * 12.0) * 0.0);
  else { vec2 r = mat2(0.707, -0.707, 0.707, 0.707) * (uv * uOut / (px * 4.0)); th = length(fract(r) - 0.5) * 1.4; }
  float n = floor(mix(2.0, 8.0, p_levels) + 0.5) - 1.0;
  float v = floor(l * n + th) / n;
  return vec4(pal(clamp(v, 0.0, 1.0), c), 1.0);
}`,
};
