// Whisper speech-to-text in a worker, so the app stays responsive.
// Input: 16 kHz mono Float32Array. Output: [{text, t0, t1}] words.
const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';

self.onmessage = async e => {
  const { audio, model, language } = e.data;
  try {
    const { pipeline, env } = await import(TF_URL);
    env.allowLocalModels = false;
    const device = self.navigator && self.navigator.gpu ? 'webgpu' : 'wasm';
    const files = {};
    const progress_callback = ev => {
      if (ev.status === 'progress' && ev.total) { files[ev.file] = [ev.loaded, ev.total]; const a = Object.values(files).reduce((s, [l, t]) => [s[0] + l, s[1] + t], [0, 0]); postMessage({ status: 'download', p: a[0] / a[1] }); }
    };
    let asr;
    try { asr = await pipeline('automatic-speech-recognition', model, { device, dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8', progress_callback }); }
    catch (err) { asr = await pipeline('automatic-speech-recognition', model, { device: 'wasm', dtype: 'q8', progress_callback }); }
    postMessage({ status: 'transcribing' });
    const opts = { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 };
    if (language && !model.endsWith('.en_timestamped')) opts.language = language;
    const out = await asr(audio, opts);
    const words = (out.chunks || []).map(c => ({ text: String(c.text).trim(), t0: c.timestamp[0] ?? 0, t1: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 0.3 })).filter(w => w.text);
    postMessage({ status: 'done', words, text: out.text });
  } catch (err) { postMessage({ status: 'error', message: String(err && err.message || err) }); }
};
