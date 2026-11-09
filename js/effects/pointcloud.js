// Point cloud: the image becomes a grid of glowing points in 3D. Each point's
// depth comes from its brightness (or darkness, or saturation), and a camera
// orbits around it. Scatter / Explode / Ripple make it react.
const cam = (p, fr) => {
  const yaw = (p.yaw - 0.5) * Math.PI + p.orbit * Math.sin(fr.t * 0.35) * 0.9;
  const pitch = (p.pitch - 0.5) * 1.4 + p.orbit * Math.sin(fr.t * 0.23) * 0.2;
  return [yaw, pitch, 1.8 * Math.pow(2, (0.5 - p.zoom) * 2), 1.8];
};
export const gridSize = (p, fr) => { const cols = Math.floor(40 + 320 * p.density); return [cols, Math.floor(cols * fr.outH / fr.outW)]; };
export default {
  type: 'pointcloud', name: 'Point Cloud', cat: 'SPATIAL',
  desc: 'The image as glowing points in 3D. Depth comes from brightness. Orbit the camera and map ONSET → Scatter, KICK → Extrude or BASS → Explode.',
  params: [
    { k: 'density', n: 'Density', v: 0.45 },
    { k: 'extrude', n: 'Extrude', v: 0.55 },
    { k: 'size', n: 'Point size', v: 0.4 },
    { k: 'scatter', n: 'Scatter', v: 0.0 },
    { k: 'explode', n: 'Explode', v: 0.0 },
    { k: 'wave', n: 'Ripple', v: 0.0 },
    { k: 'cutoff', n: 'Cutoff', v: 0.08 },
    { k: 'yaw', n: 'Yaw', v: 0.68 },
    { k: 'pitch', n: 'Pitch', v: 0.4 },
    { k: 'orbit', n: 'Orbit', v: 0.3 },
    { k: 'zoom', n: 'Zoom', v: 0.5 },
    { k: 'depthsrc', n: 'Bright·Dark·Sat·AI', v: 0.0 },
    { k: 'jitter', n: 'Jitter', v: 0.5 },
    { k: 'tint', n: 'Tint', v: 0.0 },
    { k: 'hue', n: 'Tint hue', v: 0.55 },
    { k: 'bright', n: 'Brightness', v: 0.6 },
    { k: 'bg', n: 'Background', v: 0.0 },
  ],
  needs: p => (p.depthsrc >= 0.75 ? ['depth'] : []),
  uniforms: (p, fr) => ({ uCam: cam(p, fr) }),
  geom: {
    layers(p, fr) {
      const [c, r] = gridSize(p, fr);
      return [{
        prim: 'POINTS', count: c * r, blend: 'add',
        vs: /* glsl */`
out vec3 vCol; out float vSize;
void main(){
  float cols = floor(40.0 + 320.0 * p_density), rows = floor(cols * uOut.y / uOut.x);
  float id = float(gl_VertexID), cx = mod(id, cols), cy = floor(id / cols);
  vec2 uv = (vec2(cx, cy) + 0.5) / vec2(cols, rows);
  uv += (vec2(hash(vec2(cx, cy)), hash(vec2(cy + 3.1, cx))) - 0.5) / vec2(cols, rows) * p_jitter;
  vec3 c = textureLod(uSrc, uv, 0.0).rgb;
  float l = luma(c);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float d = p_depthsrc < 0.25 ? l : p_depthsrc < 0.5 ? 1.0 - l : p_depthsrc < 0.75 ? sat : (uHasDepth > 0.5 ? textureLod(uDepth, uv, 0.0).r : l);
  float aspect = uRes.x / uRes.y;
  vec3 P = vec3((uv.x - 0.5) * 2.0 * aspect, (uv.y - 0.5) * 2.0, -(d - 0.5) * p_extrude * 2.0);
  P.z += sin(length(P.xy) * 6.0 - uBeats * PI) * p_wave * 0.35;
  vec3 rnd = vec3(hash(uv * 91.7), hash(uv * 37.3 + 3.0), hash(uv * 53.1 + 9.0)) - 0.5;
  P += rnd * p_scatter * 1.4;
  P += normalize(P + vec3(0.0, 0.0, 0.001)) * p_explode * (0.4 + hash(uv * 13.0));
  vec4 clip = project(P);
  gl_Position = l < p_cutoff ? vec4(9.0, 9.0, 9.0, 1.0) : clip;
  gl_PointSize = max(1.5, mix(1.0, 10.0, p_size) * uRes.y / 1080.0 * 3.0 / max(clip.w, 0.25));
  vSize = gl_PointSize;
  vCol = mix(c, hsv(p_hue, 0.7, 1.0) * (0.25 + l), p_tint) * mix(0.5, 2.5, p_bright);
}`,
        fs: /* glsl */`
in vec3 vCol; in float vSize;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = vSize < 4.0 ? 1.0 : smoothstep(0.5, 0.15, d);
  fragColor = vec4(vCol, a);
}`,
      }];
    },
  },
};
