// Recipes: ready-made patches (effect stack + mappings) to start from.
// fx: index into the recipe's stack, or 'src' for the source.
import { S, newFx, newMap, SRC_UID } from './state.js';

export const RECIPES = [
  { name: 'VHS Memory', desc: 'Home-video nostalgia: tape tracking that rides the bass, handheld shake on kicks, REC overlay.',
    stack: [{ type: 'wave', params: { amp: 0.04, bands: 0.4, speed: 0.55 } }, { type: 'vhs', params: { tracking: 0.25, band: 0.15, bleed: 0.6 } }, { type: 'handycam', params: { shake: 0.15, osd: 1 } }],
    maps: [{ fx: 1, p: 'tracking', sig: 'bass', depth: 0.45, rel: 0.4 }, { fx: 2, p: 'shake', sig: 'kick', depth: 0.5, rel: 0.15 }, { fx: 1, p: 'crease', sig: 'onset', depth: 0.6, mode: 'trig', rel: 0.12 }, { fx: 2, p: 'expo', sig: 'loud', depth: 0.25, rel: 0.6 }] },
  { name: 'Data Storm', desc: 'Peak-time glitch: compression crush on loudness, blocks and stretches on hits, sorting in the highlights.',
    stack: [{ type: 'grid', params: { intensity: 0, coverage: 0.4 } }, { type: 'pixelsort', params: { lo: 0.45, steps: 0.35 } }, { type: 'block', params: { amount: 0, density: 0.35 } }, { type: 'dct', params: { crush: 0.2, block: 0.5 } }, { type: 'chromatic', params: { amount: 0.05 } }],
    maps: [{ fx: 0, p: 'intensity', sig: 'kick', depth: 0.6, curve: 0.7, rel: 0.12 }, { fx: 1, p: 'lo', sig: 'loud', depth: 0.5, inv: true, rel: 0.4 }, { fx: 2, p: 'amount', sig: 'onset', depth: 0.5, mode: 'trig', rel: 0.15 }, { fx: 3, p: 'crush', sig: 'loud', depth: 0.6, curve: 0.7, rel: 0.3 }, { fx: 3, p: 'corrupt', sig: 'onset', depth: 0.6, mode: 'trig', rel: 0.1 }, { fx: 4, p: 'amount', sig: 'kick', depth: 0.5, rel: 0.1 }] },
  { name: 'CRT Broadcast', desc: 'Late-night TV: column scan on the mids, a bar-synced playhead, bloom pumping with the kick.',
    stack: [{ type: 'colscan', params: { amp: 0.02, pattern: 0.9, repeat: 0.5 } }, { type: 'playhead', params: { glow: 0.5, trail: 0.4 } }, { type: 'chromatic', params: { amount: 0.08, radial: 0.8 } }, { type: 'crt', params: { curve: 0.4, scan: 0.6 } }],
    maps: [{ fx: 0, p: 'amp', sig: 'mid', depth: 0.25, rel: 0.3 }, { fx: 3, p: 'bloom', sig: 'kick', depth: 0.6, rel: 0.12 }, { fx: 3, p: 'flicker', sig: 'high', depth: 0.5, rel: 0.05 }, { fx: 1, p: 'displace', sig: 'high', depth: 0.6, rel: 0.1 }] },
  { name: 'Film Dream', desc: 'Soft, warm and drifting: luma trails, echoes on the beat, halation that blooms with brightness.',
    stack: [{ type: 'feedback', params: { decay: 0.35, zoom: 0.53, hue: 0.05 } }, { type: 'lumatrails', params: { thresh: 0.75, tint: 0.3, hue: 0.07, amount: 0.45 } }, { type: 'echo', params: { delay: 0.45, count: 0.33, mode: 0, decay: 0.35 } }, { type: 'film', params: { fade: 0.5, leak: 0.35, gate: 0 } }],
    maps: [{ fx: 0, p: 'decay', sig: 'loud', depth: 0.3, rel: 0.8 }, { fx: 1, p: 'amount', sig: 'kick', depth: 0.35, rel: 0.25 }, { fx: 3, p: 'halation', sig: 'bright', depth: 0.6, rel: 0.4 }, { fx: 3, p: 'leak', sig: 'section', depth: 0.5, rel: 1 }] },
  { name: 'Scope Club', desc: 'The waveform as the star: an oscilloscope fed back on itself, echoed on the beat and put on a tube.',
    source: { gen: 'gradient', params: { pulse: 0, speed: 0.1 } },
    stack: [{ type: 'scope', params: { mode: 1.0, dim: 0.75, glow: 0.6, width: 0.3, gain: 0.35 } }, { type: 'feedback', params: { decay: 0.75, zoom: 0.6, rotate: 0.53, hue: 0.3 } }, { type: 'echo', params: { delay: 0.25, count: 1, mode: 0.5, zoom: 0.5 } }, { type: 'crt', params: { curve: 0.3 } }],
    maps: [{ fx: 0, p: 'gain', sig: 'loud', depth: 0.4, rel: 0.2 }, { fx: 1, p: 'zoom', sig: 'kick', depth: 0.25, rel: 0.12 }, { fx: 0, p: 'hue', sig: 'chroma', depth: 1, rel: 0.5 }, { fx: 1, p: 'hue', sig: 'bright', depth: 0.5, rel: 0.5 }] },
  { name: 'Spectral Wash', desc: 'The spectrogram becomes a displacement map; feedback colour follows the harmony.',
    stack: [{ type: 'spectro', params: { mode: 0.5, amount: 0.5, window: 0.2 } }, { type: 'feedback', params: { decay: 0.6, hue: 0.0 } }, { type: 'chromatic', params: { amount: 0.06, radial: 1 } }],
    maps: [{ fx: 0, p: 'amount', sig: 'bass', depth: 0.5, rel: 0.25 }, { fx: 1, p: 'hue', sig: 'chroma', depth: 0.8, rel: 0.6 }, { fx: 2, p: 'amount', sig: 'onset', depth: 0.6, mode: 'trig', rel: 0.12 }] },
  { name: 'Handycam Diary', desc: 'Intimate and lo-fi: camcorder look, soft film fade, echoes on half-beats.',
    stack: [{ type: 'echo', params: { delay: 0.2, count: 0.33, decay: 0.4 } }, { type: 'film', params: { grain: 0.3, dust: 0.1, scratch: 0, fade: 0.4, leak: 0.25 } }, { type: 'handycam', params: { shake: 0.3, lace: 0.2 } }],
    maps: [{ fx: 2, p: 'shake', sig: 'bass', depth: 0.35, rel: 0.4 }, { fx: 2, p: 'drop', sig: 'onset', depth: 0.5, mode: 'trig', rel: 0.08 }] },
  { name: 'Surveillance', desc: 'Tracking-room aesthetic: boxes on whatever moves, callouts on highlights, monochrome tube. Lock-on fires on hits.',
    stack: [{ type: 'motion', params: { mono: 1, labels: 0, links: 0.3, hue: 0.35 } }, { type: 'blobs', params: { thresh: 0.7, boxes: 0.25, labels: 0.5, hue: 0.12 } }, { type: 'crt', params: { scan: 0.6, curve: 0.25, mask: 0.2 } }],
    maps: [{ fx: 0, p: 'lock', sig: 'onset', depth: 1, mode: 'trig', rel: 0.25 }, { fx: 1, p: 'jitter', sig: 'high', depth: 0.6, rel: 0.1 }, { fx: 2, p: 'flicker', sig: 'kick', depth: 0.5, rel: 0.1 }] },
  { name: 'Point Cloud Drift', desc: 'The image as a slowly orbiting field of points that bursts apart on hits and breathes with the kick.',
    stack: [{ type: 'pointcloud', params: { orbit: 0.5, density: 0.55, size: 0.4 } }, { type: 'feedback', params: { decay: 0.45, zoom: 0.52 } }],
    maps: [{ fx: 0, p: 'scatter', sig: 'onset', depth: 0.3, mode: 'trig', rel: 0.25 }, { fx: 0, p: 'extrude', sig: 'kick', depth: 0.4, rel: 0.15 }, { fx: 0, p: 'explode', sig: 'section', depth: 0.3, rel: 1 }, { fx: 0, p: 'wave', sig: 'bass', depth: 0.5, rel: 0.3 }] },
  { name: 'Ridge Pulse', desc: 'Rows of the image as stacked mountain lines that scroll through the picture and rise with the music.',
    stack: [{ type: 'ridges', params: { rows: 0.35, tint: 0.9, hue: 0.12, scroll: 0.62 } }, { type: 'film', params: { grain: 0.3, dust: 0.1, scratch: 0.1, fade: 0.2, halation: 0.3 } }],
    maps: [{ fx: 0, p: 'height', sig: 'kick', depth: 0.35, rel: 0.15 }, { fx: 0, p: 'wave', sig: 'bass', depth: 0.6, rel: 0.25 }, { fx: 0, p: 'hue', sig: 'chroma', depth: 0.3, rel: 0.8 }] },
  { name: 'Time Smear', desc: 'Time made visible: slit-scan whose depth follows the bass, beat-repeat stutters, echoes on half beats.',
    stack: [{ type: 'slitscan', params: { depth: 0.15, dir: 0.6, shape: 0.5 } }, { type: 'beatrepeat', params: { len: 0.3, chance: 0.3 } }, { type: 'echo', params: { delay: 0.25, count: 0.33, mode: 0.5 } }],
    maps: [{ fx: 0, p: 'depth', sig: 'bass', depth: 0.4, rel: 0.4 }, { fx: 1, p: 'force', sig: 'onset', depth: 1, mode: 'gate', thr: 0.5, rel: 0.15 }, { fx: 2, p: 'hue', sig: 'bright', depth: 0.5, rel: 0.5 }] },
  { name: 'Terminal', desc: 'The picture as green text on a dark screen; cells get bigger on the kick and the charset changes with each section.',
    stack: [{ type: 'ascii', params: { cell: 0.2, colour: 0.5, contrast: 0.6 } }, { type: 'crt', params: { scan: 0.5, curve: 0.3, bloom: 0.3 } }],
    maps: [{ fx: 0, p: 'cell', sig: 'kick', depth: 0.25, rel: 0.15 }, { fx: 0, p: 'set', sig: 'section', depth: 1, rel: 0.05 }, { fx: 1, p: 'flicker', sig: 'high', depth: 0.4, rel: 0.05 }] },
  { name: 'Game Boy Dream', desc: '4-shade handheld palette, kaleidoscope segments stepping with the beat.',
    stack: [{ type: 'kaleido', params: { segments: 0.2, spin: 0.55 } }, { type: 'dither', params: { palette: 0.3, levels: 0.35, pixel: 0.3 } }],
    maps: [{ fx: 0, p: 'segments', sig: 'section', depth: 0.6, rel: 0.05 }, { fx: 1, p: 'pixel', sig: 'kick', depth: 0.3, rel: 0.12 }] },
  { name: 'Living Ink', desc: 'Reaction-diffusion grows out of the bright parts of the image while a fluid swirls dye with the kick.',
    stack: [{ type: 'fluid', params: { force: 0.25, inject: 0.3, mode: 0.5, warp: 0.6 } }, { type: 'rd', params: { mode: 0.9, inject: 0.6, hue: 0.55 } }, { type: 'gradmap', params: { palette: 0.45 } }],
    maps: [{ fx: 0, p: 'force', sig: 'kick', depth: 0.5, rel: 0.15 }, { fx: 1, p: 'speed', sig: 'bass', depth: 0.5, rel: 0.3 }, { fx: 2, p: 'shift', sig: 'chroma', depth: 1, rel: 0.6 }] },
  { name: 'Mosh Pit', desc: 'Datamosh that snaps back to a clean frame on every hit, then smears again. Needs moving footage.',
    stack: [{ type: 'datamosh', params: { amount: 0.6, blocks: 0.5, bleed: 0.4 } }, { type: 'chromatic', params: { amount: 0.04 } }],
    maps: [{ fx: 0, p: 'key', sig: 'onset', depth: 1, mode: 'trig', rel: 0.05 }, { fx: 1, p: 'amount', sig: 'kick', depth: 0.4, rel: 0.1 }] },
  { name: 'Depth Pulse', desc: 'AI depth: a glowing plane sweeps from front to back every bar, with fog in the distance (downloads a ~50 MB model once).',
    stack: [{ type: 'depthfx', params: { mode: 0.25, bars: 0.0, glow: 0.8, amount: 0.7 } }, { type: 'contours', params: { source: 1, levels: 0.3, bg: 1, march: 0.5 } }],
    maps: [{ fx: 0, p: 'glow', sig: 'kick', depth: 0.4, rel: 0.12 }, { fx: 1, p: 'levels', sig: 'bass', depth: 0.3, rel: 0.3 }] },
];

export function buildRecipe(r) {
  const stack = r.stack.map(s => { const f = newFx(s.type); Object.assign(f.params, s.params || {}); if (s.on === false) f.on = false; if (s.mix !== undefined) f.mix = s.mix; return f; });
  const maps = (r.maps || []).map(m => { const { fx, p, sig, ...o } = m; const id = fx === 'src' ? SRC_UID : stack[fx]?.uid; return id ? newMap(id, p, sig, o) : null; }).filter(Boolean);
  return { stack, maps };
}

// load = replace the stack; append = add the recipe's effects (switched off) to the end
export function applyRecipe(r, mode = 'load') {
  const { stack, maps } = buildRecipe(r);
  if (mode === 'append') { stack.forEach(f => f.on = false); S.stack.push(...stack); S.maps.push(...maps); return stack[0]?.uid; }
  const keep = new Set(stack.map(f => f.uid));
  S.stack = stack;
  S.maps = [...S.maps.filter(m => m.fx === SRC_UID && !maps.some(n => n.fx === SRC_UID && n.p === m.p)), ...maps];
  for (const k of Object.keys(S.auto)) if (!k.startsWith(SRC_UID + ':') && !keep.has(k.split(':')[0])) delete S.auto[k];
  if (r.source && S.source.kind === 'gen') { S.source.gen = r.source.gen; Object.assign(S.source.params, r.source.params || {}); }
  return stack[0]?.uid;
}

// ---- user recipes (saved in this browser) ----
const KEY = 'arav.recipes';
export function userRecipes() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
export function saveUserRecipe(name) {
  const idx = new Map(S.stack.map((f, i) => [f.uid, i]));
  const r = { name, desc: 'Saved ' + new Date().toLocaleDateString(), user: true,
    stack: S.stack.map(f => ({ type: f.type, on: f.on, mix: f.mix, params: { ...f.params } })),
    maps: S.maps.filter(m => m.fx === SRC_UID || idx.has(m.fx)).map(m => { const { id, fx, ...o } = m; return { ...o, fx: fx === SRC_UID ? 'src' : idx.get(fx) }; }) };
  const list = userRecipes().filter(x => x.name !== name); list.push(r);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  return r;
}
export function deleteUserRecipe(name) { try { localStorage.setItem(KEY, JSON.stringify(userRecipes().filter(x => x.name !== name))); } catch (e) {} }
