# ARAV: Audio-Reactive Audio-Visual Lab

A browser tool for audioreactive image-making, built for a seminar on immersive film-making. Load a track and some footage (or use a generator), stack GPU effects, drag audio signals onto knobs, then record the result.

It runs entirely in the browser: no install, no server, no build step. Use **Chrome or Edge** on a desktop or laptop for the best results. Firefox and Safari work, with some caveats listed below.

## What's in this version (Phases 1–4)

| Step | What you can do |
|---|---|
| **① Load** | Drop audio (wav / mp3 / flac / m4a / ogg / aiff). Files with *drums / bass / vox / other* in the name load as **stems**. Visual sources: video, image, webcam, or 4 GPU generators (test card, noise flow, SDF rings, gradient bands). There is also a **built-in demo track** (`assets/demo.m4a`; if it can't be fetched, a 124 BPM track is synthesised in the browser instead). The last media you used is remembered across reloads. |
| **② Listen** | One-off analysis in a background worker produces: waveform, spectrogram, 12 signals at 60 values/sec, onsets, BPM and beat phase, key, and automatic **sections**. You can fix the beat grid by hand (BPM, ½, ×2, *1 = here*). Rename sections or add markers by double-clicking. |
| **③ Build** | An effect stack you can reorder by drag, toggle and mix. **37 effects** are ready:<br>• **Glitch:** Block Displace, Chromatic Shift, Wave Displace, Grid Stretch, Column Scan, Pixel Sort, DCT Macroblock<br>• **Trails:** Feedback, Luma Trails, Echo Frames<br>• **Vintage:** CRT, VHS, Film, Handycam<br>• **Playhead:** Scan Playhead, Oscilloscope, Spectro Scroll<br>• **Spatial:** Point Cloud, Ridge Lines (3D, with occlusion), Plexus<br>• **Track:** Blob Callouts, Motion Boxes (boxes, IDs, live data labels)<br>• **Time:** Slit-Scan, Beat Repeat, Time Remap<br>• **Stylise:** ASCII, Dither, Contours, Gradient Map, Kaleido<br>• **Sim:** Fluid, Reaction-Diffusion, plus Datamosh (optical flow) in Glitch<br>• **AI (in the browser):** Depth FX (Depth Anything V2), Person Mask (MediaPipe), Kinetic Lyrics (Whisper)<br>• **Output:** Ambisonic Focus<br>There are **16 recipes** (ready-made patches) and you can save your own. **Scenes** snapshot the whole stack; cue them on the timeline (or on every HIGH/MID/LOW section) and the stack crossfades between them as the song plays. |
| **④ Map** | Drag a signal chip onto any knob. Shift-drag sets depth. Mappings can listen to the full mix or to any stem. The source's own knobs are mappable too. |
| **⑤ Shape** | Per-mapping response: Continuous / Trigger / Gate, curve, attack, release, range, threshold, invert. A live in/out scope shows the result. **Automation lanes** on the timeline draw long arcs (right-click a knob → *Automate*). |
| **⑥ Export** | **Frame-accurate MP4 render** (H.264 + AAC via WebCodecs; every frame rendered exactly, never drops frames), real-time recording with audio (WebM, or MP4 on Safari), full-resolution PNG stills, analysis data as **JSON / CSV** (for TouchDesigner, Unreal, AE, Blender), a markers CSV, and project save/load (`.arav.json`). |

Output formats: 16:9 (720p, 1080p, 4K), 9:16, 1:1, **360° equirectangular** (effects wrap across the seam, and **◎ LOOK** previews the sphere from inside), and **dome master**. **4-channel AmbiX** files are recognised: you hear a stereo fold-down, and the **AZIM / ELEV** signals follow where the sound is coming from. There is also an A|B before/after split, fullscreen output, undo/redo, and a project that saves itself automatically.

## Running it locally

ES modules need to be served over http, not opened as a file:

```bash
cd ARAV
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publishing on GitHub Pages

1. Create a GitHub repository and push this folder to it.
2. In the repository, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
3. The site will appear at `https://<user>.github.io/<repo>/`.

The empty `.nojekyll` file tells Pages to serve the files exactly as they are.

## AI features (Phase 4)

Everything runs **in the browser**; no audio or video leaves the machine. Models download from Hugging Face or Google the first time they're used, then the browser caches them:

| Feature | Model | Download | Speed (M-series Mac, WebGPU) |
|---|---|---|---|
| Depth FX, and AI depth in Point Cloud / Contours | Depth Anything V2 small (transformers.js) | ~50 MB | ~80–110 ms per frame |
| Person Mask | MediaPipe selfie segmenter | <1 MB | ~11 ms per frame |
| Kinetic Lyrics | Whisper base / tiny.en, word-timestamped | ~40–150 MB | ~10–30 s per track |

Whisper invents words on instrumental music, so load a vocal stem for real songs. Lyrics can also be typed or corrected in **Project → Lyrics…**. In live preview depth updates a few times a second; frame-accurate renders compute it for every frame.

## Project layout

```
index.html            app shell
css/app.css           all styling
js/main.js            wiring, render loop, media loading, recording
js/state.js           project state, undo/redo, autosave, output formats
js/mod.js             modulation maths: response curves, automation, live values
js/signals.js         signal definitions and step/coach text
js/source.js          generators (GLSL) + video / image / webcam sources
js/audio/audio.js     decode, playback clock, fallback demo synth
assets/demo.m4a       demo track
js/audio/analysis-worker.js   FFT analysis: features, onsets, tempo, sections, key
js/engine/engine.js   WebGL2 pass chain (ping-pong FBOs, feedback history, overlays)
js/effects/*.js       one file per effect, plus TEMPLATE.js for writing your own
js/ui/*.js            panels, inspector + response editor, timeline, modals
js/export.js          recorder, stills, data and project export
js/scenes.js          scene snapshots, timeline cues, crossfades
js/presets.js         built-in and user recipes
js/render.js          frame-accurate MP4 render (WebCodecs + mp4-muxer)
js/effects/blobkit.js blob detection, tracking and callout drawing
js/ml/vision.js       Depth Anything + MediaPipe person mask
js/ml/whisper*.js     Whisper transcription (in a worker) and the lyrics format
js/phase4.js          AI scheduling, lyrics editor, 360 look-around
js/idb.js             remembers media between reloads (IndexedDB)
docs/CONCEPT.md       design notes and roadmap
mockup/               the original UI mockup
```

## Writing your own effect (seminar exercise)

Copy `js/effects/TEMPLATE.js`, write a GLSL `vec4 effect(vec2 uv)` function, and add the file to the `EFFECTS` list and the `LIB` catalogue in `js/effects/index.js`. Every param you declare becomes a knob that signals can be mapped onto. Shader errors appear in red over the viewer.

## Known limits (Phase 1)

- **Real-time recording** captures what plays, so a slow machine can drop frames, and the tab must stay visible. Use **Frame-accurate render** for finals. It needs WebCodecs (Chrome, Edge, Safari 17+), and a live webcam can't be rendered that way.
- Frame-accurate render loads its MP4 muxer (`mp4-muxer` 5.1.3) from the jsDelivr CDN, so it needs an internet connection the first time.
- Plexus, Blob Callouts and Motion Boxes read a small copy of each frame back to the CPU. This is cheap, but it adds a sync point; use ½ preview on slower laptops.
- Time Remap on video works by seeking the video every frame. That's smooth in a frame-accurate render, but can look steppy in live preview, depending on the codec (MP4 with frequent keyframes seeks best).
- Recorded **WebM** files have no duration metadata, so some editors handle them badly. Convert with HandBrake or `ffmpeg -i in.webm out.mp4` if needed.
- Feedback trails restart when the output resolution changes, which includes the start of a recording and a still capture.
- Live audio input (mic / BlackHole) and MIDI are not in this version yet.
- Pixel Sort is a GPU approximation (an odd-even sort running a limited number of passes), not v2.17's exact CPU sort. Long streaks at 4K are heavy on the GPU.
- Grid Stretch and Column Scan are faithful ports of v2.17, but the random seeds differ, so a given seed won't reproduce v2.17 pixel for pixel.
- Recording format depends on the browser: Chrome, Edge and Firefox record WebM; Safari records MP4.
