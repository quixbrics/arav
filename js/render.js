// Frame-accurate offline render → MP4 (H.264 + AAC/Opus) using WebCodecs.
// Each frame is rendered at exactly t = i / fps from the precomputed analysis,
// so the result is identical every time and never drops frames, however slow
// the machine. Video sources are seeked to the exact frame before rendering.
const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm';

export const canRender = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

// yield to the browser without setTimeout (which hidden tabs throttle)
const yieldNow = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

function seekExact(v, time) {
  return new Promise(res => {
    if (Math.abs(v.currentTime - time) < 0.0005 && v.readyState >= 2) return res();
    // (requestVideoFrameCallback never fires for a video that isn't in the page, so rely on 'seeked')
    const done = () => { clearTimeout(to); v.removeEventListener('seeked', done); res(); };
    const to = setTimeout(done, 3000);
    v.addEventListener('seeked', done);
    v.currentTime = time;
  });
}

async function pickVideoCodec(w, h, fps, bitrate) {
  const tries = [
    { codec: 'avc1.640033', mux: 'avc' }, { codec: 'avc1.4d0033', mux: 'avc' }, { codec: 'avc1.640028', mux: 'avc' },
    { codec: 'avc1.42003e', mux: 'avc' }, { codec: 'vp09.00.51.08', mux: 'vp9' }, { codec: 'vp09.00.41.08', mux: 'vp9' },
  ];
  for (const c of tries) {
    const cfg = { codec: c.codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', ...(c.mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return { cfg, mux: c.mux }; } catch (e) {}
  }
  throw new Error(`This browser can't encode ${w}×${h} video. Try a smaller output format.`);
}

async function prepareAudio(buffer, from, to) {
  if (!buffer || typeof AudioEncoder === 'undefined') return null;
  const sr = buffer.sampleRate, a = Math.floor(from * sr), b = Math.min(buffer.length, Math.ceil(to * sr));
  const L = buffer.getChannelData(0).slice(a, b), R = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice(a, b);
  const aac = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 };
  try { if ((await AudioEncoder.isConfigSupported(aac)).supported) return { cfg: aac, mux: 'aac', L, R, sr }; } catch (e) {}
  // Opus needs 48 kHz
  const n48 = Math.ceil(L.length * 48000 / sr), oc = new OfflineAudioContext(2, n48, 48000), src = oc.createBufferSource(), tmp = oc.createBuffer(2, L.length, sr);
  tmp.copyToChannel(L, 0); tmp.copyToChannel(R, 1); src.buffer = tmp; src.connect(oc.destination); src.start();
  const r = await oc.startRendering();
  const opus = { codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
  if ((await AudioEncoder.isConfigSupported(opus)).supported) return { cfg: opus, mux: 'opus', L: r.getChannelData(0), R: r.getChannelData(1), sr: 48000 };
  return null;
}

/**
 * opts: { canvas, engine, buildFrame(t)->fr, video (HTMLVideoElement|null), from, to, fps, mbps,
 *         audioBuffer, onProgress(i, n, eta), cancelled() }
 * returns Blob (video/mp4)
 */
export async function renderMP4(o) {
  const { Muxer, ArrayBufferTarget } = await import(MUXER_URL);
  const n = Math.max(1, Math.round((o.to - o.from) * o.fps));
  // first frame sizes the engine at full resolution
  o.engine.clearHistory();
  const fr0 = o.buildFrame(o.from);
  const w = o.canvas.width & ~1, h = o.canvas.height & ~1;
  const vc = await pickVideoCodec(w, h, o.fps, o.mbps * 1e6);
  const au = o.audioBuffer ? await prepareAudio(o.audioBuffer, o.from, o.to) : null;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: vc.mux, width: w, height: h, frameRate: o.fps },
    ...(au ? { audio: { codec: au.mux, sampleRate: au.sr, numberOfChannels: 2 } } : {}),
  });
  let err = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = e; } });
  venc.configure(vc.cfg);
  const t0 = performance.now();
  let fr = fr0;
  for (let i = 0; i < n; i++) {
    if (o.cancelled()) { venc.close(); throw new Error('cancelled'); }
    if (err) throw err;
    const t = o.from + i / o.fps;
    if (i > 0) fr = o.buildFrame(t);
    if (o.video) { const d = o.video.duration || 1; await seekExact(o.video, ((fr.srcT % d) + d) % d); }
    if (o.ml && o.mlNeeded(fr.stack)) { o.engine.renderSource(fr); await o.ml(fr); }
    o.engine.render(fr);
    const vf = new VideoFrame(o.canvas, { timestamp: Math.round(i * 1e6 / o.fps), duration: Math.round(1e6 / o.fps) });
    venc.encode(vf, { keyFrame: i % (o.fps * 2) === 0 });
    vf.close();
    while (venc.encodeQueueSize > 6) await yieldNow();
    if (i % 3 === 0) { const el = (performance.now() - t0) / 1000; o.onProgress(i + 1, n, el / (i + 1) * (n - i - 1)); await yieldNow(); }
  }
  await venc.flush(); venc.close();
  if (au) {
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { err = e; } });
    aenc.configure(au.cfg);
    const CH = 4096;
    for (let off = 0; off < au.L.length; off += CH) {
      const m = Math.min(CH, au.L.length - off), data = new Float32Array(m * 2);
      data.set(au.L.subarray(off, off + m), 0); data.set(au.R.subarray(off, off + m), m);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: au.sr, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round(off * 1e6 / au.sr), data });
      aenc.encode(ad); ad.close();
      if (aenc.encodeQueueSize > 20) await yieldNow();
    }
    await aenc.flush(); aenc.close();
  }
  if (err) throw err;
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: vc.cfg.codec, audio: au ? au.mux : null, frames: n, w, h };
}
