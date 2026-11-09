// Effect registry. Each effect is one file exporting a plain object:
//   { type, name, cat, desc, params:[{k,n,v}], glsl, history?, overlay?, uniforms? }
// `glsl` defines   vec4 effect(vec2 uv)   — see TEMPLATE.js for the full contract.
import chromatic from './chromatic.js';
import block from './block.js';
import wave from './wave.js';
import feedback from './feedback.js';
import crt from './crt.js';
import handycam from './handycam.js';
import playhead from './playhead.js';
import grid from './grid.js';
import colscan from './colscan.js';
import pixelsort from './pixelsort.js';
import dct from './dct.js';
import lumatrails from './lumatrails.js';
import echo from './echo.js';
import vhs from './vhs.js';
import film from './film.js';
import scope from './scope.js';
import spectro from './spectro.js';
import pointcloud from './pointcloud.js';
import ridges from './ridges.js';
import plexus from './plexus.js';
import blobs from './blobs.js';
import motion from './motion.js';
import slitscan from './slitscan.js';
import beatrepeat from './beatrepeat.js';
import timeremap from './timeremap.js';
import ascii from './ascii.js';
import dither from './dither.js';
import contours from './contours.js';
import gradmap from './gradmap.js';
import kaleido from './kaleido.js';
import fluid from './fluid.js';
import rd from './rd.js';
import datamosh from './datamosh.js';
import depthfx from './depthfx.js';
import personmask from './personmask.js';
import lyrics from './lyrics.js';
import ambi from './ambi.js';

export const EFFECTS = Object.fromEntries([chromatic, block, wave, grid, colscan, pixelsort, dct, feedback, lumatrails, echo, crt, vhs, film, handycam, playhead, scope, spectro, pointcloud, ridges, plexus, blobs, motion, slitscan, beatrepeat, timeremap, ascii, dither, contours, gradmap, kaleido, fluid, rd, datamosh, depthfx, personmask, lyrics, ambi].map(e => [e.type, e]));

export const CATC = {
  SOURCE: '#8a93a3', GLITCH: '#ff3d71', TRAILS: '#b98cff', VINTAGE: '#ffb23d', SPATIAL: '#3de0ff', TRACK: '#7dffa8',
  TIME: '#5d8bff', PLAYHEAD: '#ffe14d', STYLISE: '#ff7a3d', SIM: '#4dffd2', ML: '#ff6bd6', OUTPUT: '#ffffff',
};

// Library catalogue. `type` = available now; `phase` = on the roadmap.
export const LIB = [
  ['GLITCH', 'Block Displace', 'Cells jump out of place; can reseed on every hit.', { type: 'block' }],
  ['GLITCH', 'Chromatic Shift', 'RGB split: directional or radial, with jitter.', { type: 'chromatic' }],
  ['GLITCH', 'Wave Displace', 'Sine-wave row and column offsets, optionally banded.', { type: 'wave' }],
  ['GLITCH', 'Grid Stretch', 'Cells scale outward past their bounds.', { type: 'grid' }],
  ['GLITCH', 'Column Scan', 'Echoing vertical scan stripes.', { type: 'colscan' }],
  ['GLITCH', 'Pixel Sort', 'Sorts spans by brightness above a threshold.', { type: 'pixelsort' }],
  ['GLITCH', 'DCT Macroblock', 'JPEG-style 8×8 crush; quality follows loudness.', { type: 'dct' }],
  ['GLITCH', 'Datamosh', 'Freeze the keyframe and drag pixels along motion.', { type: 'datamosh' }],
  ['TRAILS', 'Feedback', 'Zoom / rotate / hue-drift echo of the previous frame.', { type: 'feedback' }],
  ['TRAILS', 'Luma Trails', 'Only bright pixels leave trails.', { type: 'lumatrails' }],
  ['TRAILS', 'Echo Frames', 'Strobe copies on beat subdivisions.', { type: 'echo' }],
  ['VINTAGE', 'CRT', 'Scanlines, aperture grille, curvature, bloom, flicker.', { type: 'crt' }],
  ['VINTAGE', 'Handycam', 'Handheld shake, exposure pump, interlace, REC OSD.', { type: 'handycam' }],
  ['VINTAGE', 'VHS', 'Chroma bleed, tracking wobble, head-switch noise.', { type: 'vhs' }],
  ['VINTAGE', 'Film', 'Grain, gate weave, dust, halation, light leaks.', { type: 'film' }],
  ['SPATIAL', 'Point Cloud', 'The image as glowing 3D points; depth from brightness, orbiting camera.', { type: 'pointcloud' }],
  ['SPATIAL', 'Ridge Lines', 'Rows become stacked mountain lines in 3D, nearer ridges hide farther ones.', { type: 'ridges' }],
  ['SPATIAL', 'Plexus', 'Bright points joined by fading lines, like a constellation.', { type: 'plexus' }],
  ['TRACK', 'Blob Callouts', 'Boxes, crosshairs and live data labels on bright or dark shapes.', { type: 'blobs' }],
  ['TRACK', 'Motion Boxes', 'Boxes and IDs on whatever moves.', { type: 'motion' }],
  ['TIME', 'Slit-Scan', 'Each slice of the frame shows a different moment in the past.', { type: 'slitscan' }],
  ['TIME', 'Time Remap', 'The source clock follows the music: speed, reverse and jumps on hits.', { type: 'timeremap' }],
  ['TIME', 'Beat Repeat', 'Stutters slices of time on the beat, like the DJ effect.', { type: 'beatrepeat' }],
  ['PLAYHEAD', 'Scan Playhead', 'Sweeping line synced to bars; glows, displaces, trails.', { type: 'playhead' }],
  ['PLAYHEAD', 'Oscilloscope', 'Live waveform drawn over the frame.', { type: 'scope' }],
  ['PLAYHEAD', 'Spectro Scroll', 'The spectrogram as a moving texture.', { type: 'spectro' }],
  ['STYLISE', 'ASCII', 'Glyph rendering; density follows level.', { type: 'ascii' }],
  ['STYLISE', 'Dither', 'Bayer, noise or halftone dots with retro palettes.', { type: 'dither' }],
  ['STYLISE', 'Contours', 'Topographic isolines from brightness or depth.', { type: 'contours' }],
  ['STYLISE', 'Gradient Map', 'Palette follows the harmony (chroma).', { type: 'gradmap' }],
  ['STYLISE', 'Kaleido', 'Mirror segments and spiral twist; map signals to the segment count.', { type: 'kaleido' }],
  ['SIM', 'Fluid', 'Stable fluids; audio injects dye and force.', { type: 'fluid' }],
  ['SIM', 'Reaction-Diffusion', 'Gray-Scott growth seeded by the frame.', { type: 'rd' }],
  ['ML', 'Depth FX', 'AI depth from any 2D footage (Depth Anything): fog, depth slice, focus blur, 2.5D.', { type: 'depthfx' }],
  ['ML', 'Person Mask', 'AI person segmentation: effects on the figure or the background only.', { type: 'personmask' }],
  ['ML', 'Kinetic Lyrics', 'Whisper transcription (in the browser) as word-timed moving type.', { type: 'lyrics' }],
  ['OUTPUT', 'Ambisonic Focus', 'Effects follow where the sound is in a 4-ch AmbiX mix.', { type: 'ambi' }],
];
