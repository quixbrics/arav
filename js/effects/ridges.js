// Ridge lines: each row of the image becomes a mountain line in 3D, stacked
// from front to back (the classic "Unknown Pleasures" look). Nearer ridges
// hide the ones behind them. Scroll moves the rows through the image over time.
const cam = (p, fr) => [(p.yaw - 0.5) * 1.6 + p.orbit * Math.sin(fr.t * 0.3) * 0.5, 0.15 + p.tilt * 0.9, 3.4 * Math.pow(2, (0.5 - p.zoom) * 2), 1.8];
const RC = p => [Math.floor(8 + 112 * p.rows), Math.floor(64 + 336 * p.detail)];
const COMMON = /* glsl */`
float R(){ return floor(8.0 + 112.0 * p_rows); }
float C(){ return floor(64.0 + 336.0 * p_detail); }
vec3 ridge(float row, float col, out vec3 c){
  float rows = R(), cols = C(), aspect = uRes.x / uRes.y;
  float u = col / (cols - 1.0);
  float v = fract((row + 0.5) / rows + uTime * (p_scroll - 0.5) * 0.25);
  c = textureLod(uSrc, vec2(u, v), 0.0).rgb;
  float h = pow(clamp(luma(c), 0.0, 1.0), mix(0.4, 3.0, p_gamma)) * p_height * 1.3;
  h *= mix(1.0, smoothstep(0.0, 0.25, u) * smoothstep(1.0, 0.75, u), p_taper);
  h += sin(u * 14.0 + uBeats * PI * 0.5 + row * 0.7) * p_wave * 0.12;
  return vec3((u - 0.5) * 2.0 * aspect * 1.05, h - 0.35, ((row + 0.5) / rows * 2.0 - 1.0) * 1.4);
}
`;
export default {
  type: 'ridges', name: 'Ridge Lines', cat: 'SPATIAL',
  desc: 'Rows of the image become stacked mountain lines in 3D, with nearer ridges hiding farther ones. Map KICK → Height, BASS → Wave.',
  params: [
    { k: 'rows', n: 'Rows', v: 0.3 },
    { k: 'detail', n: 'Detail', v: 0.5 },
    { k: 'height', n: 'Height', v: 0.35 },
    { k: 'gamma', n: 'Peakiness', v: 0.5 },
    { k: 'taper', n: 'Taper edges', v: 0.6 },
    { k: 'wave', n: 'Wave', v: 0.0 },
    { k: 'scroll', n: 'Scroll', v: 0.6 },
    { k: 'thick', n: 'Line width', v: 0.25 },
    { k: 'fill', n: 'Occlusion', v: 1.0 },
    { k: 'tilt', n: 'Tilt', v: 0.45 },
    { k: 'yaw', n: 'Yaw', v: 0.5 },
    { k: 'orbit', n: 'Orbit', v: 0.0 },
    { k: 'zoom', n: 'Zoom', v: 0.65 },
    { k: 'tint', n: 'Tint', v: 0.8 },
    { k: 'hue', n: 'Tint hue', v: 0.12 },
    { k: 'bright', n: 'Brightness', v: 0.5 },
    { k: 'fog', n: 'Depth fade', v: 0.5 },
    { k: 'bg', n: 'Background', v: 0.0 },
  ],
  uniforms: (p, fr) => ({ uCam: cam(p, fr) }),
  geom: {
    layers(p) {
      const [rows, cols] = RC(p), L = [];
      if (p.fill > 0.01) L.push({
        prim: 'STRIP', count: cols * 2, instances: rows, depth: true, offset: 1, blend: 'alpha',
        vs: COMMON + /* glsl */`
void main(){
  float row = float(gl_InstanceID), k = float(gl_VertexID);
  vec3 c; vec3 P = ridge(row, floor(k / 2.0), c);
  if (mod(k, 2.0) > 0.5) P.y = -3.0;
  gl_Position = project(P);
}`,
        fs: `void main(){ fragColor = vec4(0.0, 0.0, 0.0, p_fill); }`,
      });
      L.push({
        prim: 'STRIP', count: cols * 2, instances: rows, depth: true, depthFunc: 'lequal', depthWrite: false, blend: 'alpha',
        vs: COMMON + /* glsl */`
out vec3 vCol; out float vSide;
void main(){
  float row = float(gl_InstanceID), k = float(gl_VertexID), cols = C();
  float col = floor(k / 2.0), side = mod(k, 2.0) < 0.5 ? -1.0 : 1.0;
  vec3 c, c2; vec3 P = ridge(row, col, c);
  bool last = col >= cols - 1.0;
  vec3 Q = ridge(row, last ? col - 1.0 : col + 1.0, c2);
  vec4 a = project(P), b = project(Q);
  vec2 sa = a.xy / a.w * uRes, sb = b.xy / b.w * uRes;
  vec2 dir = normalize((last ? sa - sb : sb - sa) + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  float th = mix(0.6, 6.0, p_thick) * uRes.y / 1080.0;
  a.xy += nrm * side * th * 2.0 / uRes * a.w;
  gl_Position = a;
  float l = luma(c);
  vCol = mix(c * 1.3, hsv(p_hue, 0.55, 1.0) * (0.55 + l * 0.8), p_tint) * mix(0.5, 2.0, p_bright) * mix(1.0, 0.25, (row + 0.5) / R() * p_fog);
  vSide = side;
}`,
        fs: /* glsl */`
in vec3 vCol; in float vSide;
void main(){ float a = 1.0 - smoothstep(0.4, 1.0, abs(vSide)); fragColor = vec4(vCol, max(a, 0.35)); }`,
      });
      return L;
    },
  },
};
