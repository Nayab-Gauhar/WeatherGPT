/**
 * Microphone capture and WAV encoding.
 *
 * Why the conversion step exists: `MediaRecorder` produces WebM/Opus, which is
 * excellent for size but is not what the speech-recognition endpoint was
 * verified against. A 16 kHz mono WAV round-tripped a Hindi sentence back
 * character-for-character, so that is what gets sent.
 *
 * The path is therefore: MediaRecorder (reliable capture) → decodeAudioData
 * (the browser already knows how to unpack Opus) → downsample to 16 kHz mono →
 * encode a 16-bit PCM WAV. No external library, no ffmpeg, nothing to install.
 */

const TARGET_SAMPLE_RATE = 16_000;

export const recordingSupported =
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined';

/** First MIME type the browser will actually record. */
function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => window.MediaRecorder.isTypeSupported?.(type)) ?? '';
}

/**
 * Begin recording.
 *
 * @returns {Promise<{stop: () => Promise<Blob|null>, cancel: () => void}>}
 *          `stop` resolves with a 16 kHz mono WAV blob.
 */
export async function startRecording() {
  if (!recordingSupported) throw new Error('recording-unsupported');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  // Timeslice so a chunk exists even for a very short press.
  recorder.start(250);

  const releaseMic = () => stream.getTracks().forEach((track) => track.stop());

  return {
    async stop() {
      if (recorder.state === 'inactive') {
        releaseMic();
        return null;
      }

      const finished = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.stop();
      await finished;
      releaseMic();

      if (!chunks.length) return null;
      const raw = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      // Guard against an accidental tap producing a near-empty file.
      if (raw.size < 1200) return null;

      return toWav(raw);
    },

    cancel() {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } finally {
        releaseMic();
      }
    },
  };
}

/* ------------------------------------------------------------- conversion -- */

/** Decode any browser-supported audio blob and re-encode as 16 kHz mono WAV. */
export async function toWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioCtx();

  try {
    const decoded = await context.decodeAudioData(arrayBuffer);
    const mono = downmix(decoded);
    const resampled =
      decoded.sampleRate === TARGET_SAMPLE_RATE
        ? mono
        : resample(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
    return encodeWav(resampled, TARGET_SAMPLE_RATE);
  } finally {
    // Release the hardware context; leaking these eventually stops playback.
    context.close?.();
  }
}

/** Average all channels into one. */
function downmix(audioBuffer) {
  const { numberOfChannels, length } = audioBuffer;
  if (numberOfChannels === 1) return audioBuffer.getChannelData(0);

  const out = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch += 1) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) out[i] += data[i];
  }
  for (let i = 0; i < length; i += 1) out[i] /= numberOfChannels;
  return out;
}

/**
 * Downsample by averaging each source window.
 *
 * Averaging rather than nearest-neighbour picking: dropping samples aliases
 * high frequencies down into the speech band, which measurably degrades
 * recognition accuracy.
 */
function resample(samples, fromRate, toRate) {
  const ratio = fromRate / toRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), samples.length);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += samples[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Wrap Float32 PCM in a 16-bit mono WAV container. */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
