// ASCII / glyph rendering: the frame is cut into character cells and each cell
// is drawn as the glyph whose "ink" matches its brightness.
const SETS = [
  " .'`:,;-~=+*#%@█",
  " ·░░▒▒▒▓▓▓████▉█",
  "    ..::0011001█",
  " ｰｨｳｴｵｶｷｸｹｺｻｼｽｾ",
];
export default {
  type: 'ascii', name: 'ASCII', cat: 'STYLISE',
  desc: 'Renders the image as text characters. Map LOUD → Cell size or SECTION → Charset so the type changes with the song.',
  textures() {
    const S = 64, c = document.createElement('canvas'); c.width = S * 16; c.height = S * 4;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `600 ${S * 0.82}px "JetBrains Mono", "Menlo", monospace`;
    SETS.forEach((set, r) => [...set].forEach((ch, i) => x.fillText(ch, i * S + S / 2, r * S + S / 2 + S * 0.04)));
    return { uGlyphs: c };
  },
  params: [
    { k: 'cell', n: 'Cell size', v: 0.25 },
    { k: 'set', n: 'Charset', v: 0.0 },
    { k: 'contrast', n: 'Contrast', v: 0.5 },
    { k: 'colour', n: 'Src·Mono·Tint', v: 0.0 },
    { k: 'hue', n: 'Tint hue', v: 0.35 },
    { k: 'bg', n: 'Background', v: 0.0 },
    { k: 'invert', n: 'Invert', v: 0.0 },
  ],
  glsl: /* glsl */`
uniform sampler2D uGlyphs;
vec4 effect(vec2 uv){
  float cpx = mix(6.0, 40.0, p_cell) * uOut.y / 1080.0;               // cell height in output pixels
  vec2 cell = vec2(cpx * 0.6, cpx) / uOut;                              // monospace aspect
  vec2 id = floor(uv / cell), f = fract(uv / cell);
  vec2 cuv = (id + 0.5) * cell;
  vec3 c = (src(cuv).rgb * 2.0 + src(cuv + cell * vec2(0.25, 0.25)).rgb + src(cuv - cell * vec2(0.25, 0.25)).rgb) / 4.0;
  float l = clamp((luma(c) - 0.5) * mix(0.6, 2.5, p_contrast) + 0.5, 0.0, 1.0);
  if (p_invert > 0.5) l = 1.0 - l;
  float gi = floor(l * 15.99), row = floor(p_set * 3.99);
  vec2 g = vec2((gi + f.x) / 16.0, 1.0 - (row + 1.0 - f.y) / 4.0);
  float ink = texture(uGlyphs, g).a;
  vec3 col = p_colour < 0.34 ? c * 1.4 : p_colour < 0.67 ? vec3(0.55, 1.0, 0.6) * (0.4 + l) : hsv(p_hue, 0.7, 0.4 + l);
  return vec4(mix(src(uv).rgb * p_bg, col, ink), 1.0);
}`,
};
