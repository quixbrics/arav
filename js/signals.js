// The audio features students can map. Every one is a 0..1 curve sampled at
// the analysis rate (60/s), computed once when a file is loaded.
export const SIGS = [
  { id: 'kick',    n: 'KICK',    c: '#ff7a3d', d: '40–120 Hz energy',   k: 'BAND' },
  { id: 'bass',    n: 'BASS',    c: '#ffb23d', d: '60–250 Hz body',     k: 'BAND' },
  { id: 'mid',     n: 'MID',     c: '#ffe14d', d: '250 Hz–2 kHz',       k: 'BAND' },
  { id: 'high',    n: 'HIGH',    c: '#3de0ff', d: '6–16 kHz air',       k: 'BAND' },
  { id: 'loud',    n: 'LOUD',    c: '#7dffa8', d: 'overall level',      k: 'LEVEL' },
  { id: 'bright',  n: 'BRIGHT',  c: '#b98cff', d: 'spectral centroid',  k: 'TIMBRE' },
  { id: 'noise',   n: 'NOISE',   c: '#9aa3b2', d: 'noisy ↔ tonal',      k: 'TIMBRE' },
  { id: 'onset',   n: 'ONSET',   c: '#ff3d71', d: 'new hit detected',   k: 'TRIG' },
  { id: 'beat',    n: 'BEAT φ',  c: '#f2f2f2', d: 'position in beat',   k: 'PHASE' },
  { id: 'pan',     n: 'PAN',     c: '#5d8bff', d: 'stereo L ↔ R',       k: 'SPACE' },
  { id: 'chroma',  n: 'CHROMA',  c: '#ff6bd6', d: 'harmony → hue',      k: 'PITCH' },
  { id: 'section', n: 'SECTION', c: '#4dffd2', d: 'song structure',     k: 'STEP' },
  { id: 'azim',    n: 'AZIM',    c: '#a8ff5d', d: 'sound direction',    k: 'SPACE' },
  { id: 'elev',    n: 'ELEV',    c: '#5dc8ff', d: 'sound height',       k: 'SPACE' },
];
export const SIG = Object.fromEntries(SIGS.map(s => [s.id, s]));
export const PITCH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const STAGES = [['load', 'LOAD'], ['listen', 'LISTEN'], ['build', 'BUILD'], ['map', 'MAP'], ['shape', 'SHAPE'], ['export', 'EXPORT']];
export const COACH = {
  load: 'Drop in an audio track and a visual source (video, image or webcam), or start from a generator. Extra files named drums / bass / vox load as stems.',
  listen: 'Read the song before you patch: sections, kicks, brightness, onsets. Check the BPM and set the downbeat if the grid is off. Click the timeline to audition.',
  build: 'Stack effects top to bottom (order matters), or start from a recipe in the library. Capture looks as Scenes, then cue them on sections so the visuals change with the song.',
  map: 'Drag a signal chip onto any knob. The coloured ring shows how far the audio can push it. Shift-drag a knob to change that depth.',
  shape: 'Tune how the sound moves the image: curve, attack, release, continuous vs trigger. Right-click a knob → Automate to draw long arcs on the timeline.',
  export: 'Record in real time with sound, save stills, or export the analysis as data for TouchDesigner, Unreal or AE.',
};
