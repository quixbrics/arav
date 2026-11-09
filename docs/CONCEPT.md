# ARAV — Audio-Reactive Audio-Visual Lab

A browser tool for an immersive film-making seminar on audioreactivity. It is hosted as a static site on GitHub Pages, with no install and no server.

This document records what to keep from *Glitch Distortion Lab v2.17*, how the app should be organised for students, and which effects to build.

---

## 1. What carries over from Glitch Distortion Lab v2.17

v2.17 is built for an expert user, but its engine design is sound. These parts are worth keeping:

| Keep | Why it matters for students |
|---|---|
| **WebGL2 ping-pong FBO chain + effect registry** | Fast, and each effect is a self-contained pass, so students can write their own. |
| **`renderFrame(n)` is a pure function of frame number** | Scrubbing, playback and export always produce the same picture. |
| **ANALYSIS mode** (decode the file once, precompute band envelopes and onsets per frame) | Makes the reaction deterministic and exportable, and lets the timeline *show* the audio features. |
| **LIVE mode** (mic / BlackHole input) | For performance and VJ sessions. Not reproducible, and the UI should say so. |
| **`pv()` modulation layer** (base value + automation envelope + audio modulation) | This is the core teaching idea: automation draws the arc of a piece and audio rides on top. |
| **Bindings name a *band*, not a mechanism** | A patch keeps working when you switch between live and file mode. |
| **Hash-based per-cell randomness** | Reseeding is cheap enough to fire on every onset. |
| **WebCodecs + mp4-muxer frame-accurate export** | Gives render-quality output with audio. |

What changes is the **interface** (v2.17 has a 340px wall of sliders) and the **file structure**: one 224KB HTML file becomes small ES modules that students can read and fork.

---

## 2. Student workflow

Six stages, shown left to right as tabs or steps:

```
 LOAD  →  LISTEN  →  BUILD  →  MAP  →  SHAPE  →  EXPORT
```

1. **LOAD**: drag in an audio file (wav/mp3/flac/m4a) and a visual source: video, image, image sequence, webcam, or a built-in generator (test card, noise, gradient, SDF shapes). You can also drop in **stems** (drums / bass / vox / other) as extra analysis sources.
2. **LISTEN**: analysis runs once. The timeline shows the waveform, spectrogram, feature lanes (low / mid / high, loudness, brightness, onsets, beat grid) and detected **sections**. Students can *see* what the machine hears before mapping anything.
3. **BUILD**: an effect stack of cards. Drag to reorder, toggle, solo, and set a mix amount per card. Start from **scene presets** ("VHS memory", "Data storm", "Point cloud drift").
4. **MAP**: the main interaction. Drag an audio feature chip (e.g. `KICK`, `BRIGHTNESS`, `ONSET`) onto any parameter knob. A coloured ring shows the modulation depth and the knob moves live, so cause and effect are visible.
5. **SHAPE**: each mapping has a small response editor: range, curve, attack/release smoothing, threshold/gate, invert, and *trigger* vs *continuous* mode. Automation lanes sit on the timeline for long-form arcs, and section markers can switch scenes.
6. **EXPORT**: three options:
   - quick real-time recording (MediaRecorder, any browser)
   - frame-accurate MP4/WebM render with audio (WebCodecs, Chrome/Edge)
   - PNG sequence
   - the **analysis data itself** as JSON/CSV, so students can drive TouchDesigner, Unreal, Blender, Resolve/Fusion or After Effects from the same analysis

**Project save/load** writes a `.arav.json` file containing the stack, mappings, automation and scene list. It does not include the media. Students can swap patches and the class can build a shared preset library.

**Learn mode**: hovering over any control shows a one-line explanation, and each effect card has an "ⓘ how it works" panel showing its shader snippet.

---

## 3. Audio features (beyond low/mid/high)

| Feature | What it captures | Typical visual use |
|---|---|---|
| Band energy (sub, low, low-mid, mid, high, air) | Where the energy sits | Displacement amount, scale |
| RMS / loudness (LUFS-ish) | Overall intensity | Feedback decay, exposure |
| **Spectral centroid** | Brightness / timbre | Colour temperature, blur, grain size |
| **Spectral flux / onsets** | Note and hit starts | Triggers: reseed, cut, flash, stutter |
| **Spectral flatness** | Noise vs tone | Glitch vs clean mix |
| **Beat grid / BPM / beat phase** | Pulse | Quantised cuts, strobe, beat-synced zoom |
| **Chroma (12 pitch classes)** | Harmony / key | Hue mapping, palette selection |
| Pitch (YIN) | Melody line | Vertical position of the playhead or particles |
| **Stereo pan / width** | Spatial placement | Horizontal position, 360 yaw |
| **Novelty / sections** | Structure (verse → drop) | Scene changes, automation anchors |
| Per-stem versions of the above | Isolate instruments | Kick drives shake, vox drives text |

All features are computed offline per frame in ANALYSIS mode. A cheaper subset runs in LIVE mode.

---

## 4. Effects

### 4.1 Requested categories

**Glitch** (ported from v2.17 and extended)
- Block displace, grid stretch, chromatic shift, wave displace, column scan, pixel sort (ported)
- **DCT / JPEG macroblocking**: quantise 8×8 DCT blocks in a shader, with quality driven by loudness
- **Datamosh (simulated)**: freeze the I-frame and keep pushing pixels along optical flow. Onsets "drop the keyframe".
- Bit-depth / posterise / palette crush, RGB channel swaps, scanline tearing

**Feedback trails**
- Feedback buffer with zoom / rotate / translate / hue-drift per frame, and decay mapped to RMS
- Luma-keyed feedback (only bright pixels leave trails)
- Self-displacement (the feedback frame warps itself by its own luminance)
- **Echo frames**: N stroboscopic copies on beat subdivisions

**Vintage**
- **Handycam / camcorder**: kick-driven handheld shake (spring physics), auto-exposure pumping, white-balance drift, interlace combing, REC ● / timecode / date-stamp OSD, tape dropouts on onsets
- **CRT**: scanlines, aperture grille / shadow mask, barrel curvature, phosphor persistence (a short feedback), bloom, flicker, rolling hum bar
- **VHS**: chroma bleed and delay, head-switching noise at the bottom, tracking wobble, generation loss
- **Film**: grain, gate weave, dust and scratches, halation, light leaks, 8mm/16mm frame lines

**Point clouds** (a rendering effect, not splats)
- Sample the frame on a grid and render it as instanced points in 3D. Z comes from luminance, a chosen channel, or **an estimated depth map**.
- Audio drives point size, Z-extrusion, scatter / explode on onsets, a camera orbit locked to beat phase, and density
- Variants: line-scan (Joy Division-style ridge lines from rows), voxel cubes, connected nearest-neighbour "plexus"

**Audioreactive playhead**
- A scanning line or bar that sweeps the frame in sync with the music (bar length or a free speed). It reveals, freezes, or displaces what it passes.
- Overlays: oscilloscope, a spectrogram scrolling as a texture, waveform, and a beat ticker
- "Visual sequencer": the playhead triggers events where it crosses bright blobs

**Blob tracking / callout boxes**
- Fast GPU threshold or motion-difference mask, then connected components on a downsampled frame on the CPU, giving blobs with centroid, area and bbox
- Overlays: bounding boxes, crosshairs, IDs, leader-line labels with live data readouts (`FREQ 82Hz / −6dB`), and constellation lines between blobs
- Audio drives the threshold, the maximum box count, label text, and box jitter. Onsets "lock on" to a new target.
- Optional ML labelling (MediaPipe object detector) for the "surveillance UI" look

### 4.2 Contemporary ideas worth offering

| Idea | What it is | Why it suits this seminar |
|---|---|---|
| **Slit-scan / time displacement** | Each row or column, or a depth or gradient map, samples a different *past* frame from a ring buffer | Classic temporal effect, and very effective when audio sets the time offset |
| **Video time-remap by audio** | Video playback speed or position follows loudness, and the video stutters or reverses on onsets | Rhythmic editing without editing. Works well with immersive footage. |
| **Beat-repeat / stutter / freeze** | Quantised frame holds and loops on the beat grid | The visual counterpart of the DJ effect |
| **Monocular depth (Depth Anything, in-browser via ONNX/WebGPU)** | A depth map from any 2D footage | Feeds point clouds, 2.5D parallax, depth fog, and a **depth-slice scan** (a plane sweeps through Z on the beat) |
| **Optical flow** | Per-pixel motion vectors | Drives datamosh, flow-advected particles, motion smear |
| **Person segmentation and pose** (MediaPipe) | A mask and a skeleton | Effects only on the figure or the background, and pose-anchored callouts |
| **ASCII / glyph / halftone / dither** | Text-mode, Bayer, or error-diffusion 1-bit rendering | Glyph density follows loudness, and the charset swaps per section |
| **Topographic contours** | Isolines from luminance or depth | A "terrain map" of the image whose contour spacing breathes with the bass |
| **Reaction-diffusion** | Gray-Scott simulation seeded from the frame | Organic growth with audio-driven feed/kill rates |
| **Stable fluids** | A GPU fluid sim | Audio injects dye and force, with the video as the dye source |
| **Kaleidoscope / polar / Droste** | Mirror and recursive warps | Segment count steps on beats |
| **Gradient-map / LUT grading from chroma** | Palette follows the harmony | Colour that "hears" the key change |
| **Kinetic lyrics (Whisper in-browser)** | Word-timed transcription becomes typography | Students get timed text with no manual keying |
| **Bloom / anamorphic streaks** | Lens-style glow | A cheap polish layer driven by transients |

### 4.3 Immersive-specific output

Immersive work needs more than a 16:9 canvas:

- **Equirectangular 360 (2:1)** output with **seam-aware effects**: horizontal sampling wraps so glitches don't break at the seam. There is also a preview mode that looks *into* the sphere.
- **Dome / fisheye (domemaster)** output
- **Spatial audio → space**: stereo pan sets yaw. With **First-Order Ambisonics (AmbiX, 4-channel)** input, compute the direction of energy and place effects *where the sound is* in the 360 frame. This is uncommon in teaching tools.
- Arbitrary canvas sizes for LED walls and projection mapping, with **Syphon/Spout-style** handoff via OBS window capture as a workaround

---

## 5. Architecture

- **No build step.** Vanilla ES modules plus a few vendored libraries (mp4-muxer, and optional ML runtimes that are lazy-loaded only when used). GitHub Pages serves the repo as-is, and students can view source and fork it.
- **Effect plugin format.** Each effect is one file that exports `{ id, name, category, params, shader, passes? }`. A `TEMPLATE.js` and a short guide let students write their own effect in the seminar.
- **Modules:** `engine/` (GL, FBO chain, renderFrame), `audio/` (decode, analysis, live), `mod/` (mappings, envelopes, triggers), `ui/` (timeline, stack, knobs, mapping drag-drop), `export/`, `effects/`.
- **Target browser:** Chrome or Edge on desktop, for WebGL2 + WebCodecs. Safari and Firefox fall back to real-time recording.
- **Performance:** a preview-resolution toggle (½ or ¼) during patching and full resolution on export.

---

## 6. Suggested build phases

1. **Foundation** ✅ *built; see README*: app shell, LOAD (audio + video/image/webcam + generators), offline analysis, timeline with waveform, spectrogram and feature lanes, transport, a 4–5 effect stack, drag-to-map UI with the response editor, real-time recording, and project save/load.
2. **Core aesthetics** ✅ *built*: port the v2.17 glitch suite. Add feedback, CRT, VHS, handycam, film, and the playhead family, plus scene presets.
3. **Spatial and temporal** ✅ *built*: point clouds, blob tracking and callouts, slit-scan, stutter and time-remap, and frame-accurate export with analysis data export.
4. **Contemporary / ML** ✅ *built*: depth, segmentation, optical flow, ASCII and contours, fluids and reaction-diffusion, Whisper lyrics, 360 and dome output, and ambisonic direction.
