// JPEG-style compression, really done: pass 1 takes each block's 2D DCT in
// YCbCr and quantises the coefficients; pass 2 inverts it. Crank Quality down
// for blocky, ringing, colour-smeared artefacts. Corrupt glitches whole blocks
// (dropped detail, DC colour shifts) and reseeds on hits.
export default {
  type: 'dct', name: 'DCT Macroblock', cat: 'GLITCH',
  desc: 'Real JPEG-style DCT compression. Lower Quality for blocky artefacts; Corrupt breaks blocks on hits. Try LOUD → Crush.',
  passes: () => 2,
  params: [
    { k: 'crush', n: 'Crush', v: 0.35 },
    { k: 'block', n: '8 · 16 · 32 px', v: 0.0 },
    { k: 'chroma', n: 'Chroma crush', v: 0.4 },
    { k: 'corrupt', n: 'Corrupt', v: 0.0 },
    { k: 'rate', n: 'Corrupt rate', v: 0.2 },
  ],
  glsl: /* glsl */`
vec3 toYCC(vec3 c){ float y = luma(c); return vec3(y, (c.b - y) * 0.565, (c.r - y) * 0.713); }
vec3 fromYCC(vec3 v){ return vec3(v.x + 1.403 * v.z, v.x - 0.344 * v.y - 0.714 * v.z, v.x + 1.773 * v.y); }
float basis(float x, float u, float n){ return cos((2.0 * x + 1.0) * u * PI / (2.0 * n)) * (u < 0.5 ? sqrt(1.0 / n) : sqrt(2.0 / n)); }
vec4 effect(vec2 uv){
  float bOut = 8.0 * exp2(floor(p_block * 2.99));
  float n = clamp(floor(bOut * uRes.y / uOut.y + 0.5), 2.0, 16.0);
  vec2 pix = floor(uv * uRes), b0 = floor(pix / n) * n, k = pix - b0;
  if (uPass < 0.5) {
    vec3 acc = vec3(0.0);
    for (int y = 0; y < 16; y++) { if (float(y) >= n) break;
      float by = basis(float(y), k.y, n);
      for (int x = 0; x < 16; x++) { if (float(x) >= n) break;
        acc += toYCC(texture(uSrc, (b0 + vec2(x, y) + 0.5) / uRes).rgb) * basis(float(x), k.x, n) * by; } }
    float q = mix(0.004, 0.5, p_crush * p_crush) * (1.0 + (k.x + k.y) * mix(0.3, 2.5, p_crush)) * n / 8.0;
    float qc = q * mix(1.0, 8.0, p_chroma);
    acc.x = floor(acc.x / q + 0.5) * q;
    acc.yz = floor(acc.yz / qc + 0.5) * qc;
    uint bid = uint(b0.x / n) + uint(b0.y / n) * 4099u;
    uint sd = uint(floor(uTime * mix(0.5, 24.0, p_rate))) + uint(uOnsets) * 31u;
    if (hashu(bid, sd) < p_corrupt * 0.6) {
      if (k.x + k.y > 0.5) acc *= hashu(bid, sd + 7u) < 0.5 ? 0.0 : 4.0;
      else acc.yz += (vec2(hashu(bid, sd + 3u), hashu(bid, sd + 5u)) - 0.5) * n * 0.4;
    }
    return vec4(acc / (2.0 * n) + 0.5, 1.0);
  }
  vec3 acc = vec3(0.0);
  for (int v = 0; v < 16; v++) { if (float(v) >= n) break;
    float bv = basis(k.y, float(v), n);
    for (int u = 0; u < 16; u++) { if (float(u) >= n) break;
      vec3 co = (texture(uSrc, (b0 + vec2(u, v) + 0.5) / uRes).rgb - 0.5) * 2.0 * n;
      acc += co * basis(k.x, float(u), n) * bv; } }
  return vec4(clamp(fromYCC(acc), 0.0, 1.0), 1.0);
}`,
};
