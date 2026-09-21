/**
 * Sarvam AI — speech recognition and synthesis for Indian languages.
 *
 * This is the accessibility core of the product. The browser's built-in Web
 * Speech engine is serviceable for English but unreliable for Hindi, Bengali or
 * Tamil, and on many Android builds no Indian-language voice is installed at
 * all. Sarvam's models are trained for exactly these languages, so a farmer can
 * speak Marathi and hear the advisory back in Marathi.
 *
 * Verified working configuration (stale IDs return HTTP 400):
 *   STT  saarika:v2.5   — earlier saarika:v2 and :flash are deprecated
 *   TTS  bulbul:v3      — v2 is deprecated, and v2's speakers are rejected by v3
 */

import { getLanguage } from '../../i18n/languages.js';

const STT_URL = 'https://api.sarvam.ai/speech-to-text';
const TTS_URL = 'https://api.sarvam.ai/text-to-speech';

const API_KEY = import.meta.env?.VITE_SARVAM_API_KEY ?? '';

export const isSarvamConfigured = Boolean(API_KEY);

const STT_MODEL = 'saarika:v2.5';
const TTS_MODEL = 'bulbul:v3';

/** A bulbul:v3-compatible voice. v2 speakers such as "anushka" are rejected. */
const SPEAKER = 'ritu';

/** Languages Sarvam supports, as the API's own codes. */
const SUPPORTED = new Set([
  'en-IN', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN',
  'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'od-IN',
]);

/** Map an app language code to a Sarvam language code. */
function sarvamLang(lang) {
  const { bcp47 } = getLanguage(lang);
  return SUPPORTED.has(bcp47) ? bcp47 : 'hi-IN';
}

export function sarvamSupports(lang) {
  return isSarvamConfigured && SUPPORTED.has(getLanguage(lang).bcp47);
}

/* ---------------------------------------------------------------------- STT -- */

/**
 * Transcribe recorded speech.
 *
 * @param {Blob} wavBlob 16 kHz mono WAV
 * @param {string} lang app language code; the API can also auto-detect
 * @returns {Promise<{transcript: string, language: string|null}>}
 */
export async function transcribe(wavBlob, lang = 'en', { timeoutMs = 20_000 } = {}) {
  if (!isSarvamConfigured) throw new Error('sarvam-not-configured');

  const form = new FormData();
  form.append('model', STT_MODEL);
  form.append('file', wavBlob, 'speech.wav');
  // A language hint measurably improves accuracy; omit it and the model guesses.
  form.append('language_code', sarvamLang(lang));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': API_KEY },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`sarvam-stt-${res.status}: ${detail.slice(0, 160)}`);
    }

    const json = await res.json();
    return {
      transcript: (json.transcript ?? '').trim(),
      language: json.language_code ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------- TTS -- */

/**
 * Sarvam caps the text length per request, so long advisories are split on
 * sentence boundaries and the resulting clips are played in sequence.
 */
const MAX_CHARS = 450;

function splitForSpeech(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_CHARS) return [clean];

  // Split after sentence-ending punctuation, including the Devanagari danda.
  const sentences = clean.split(/(?<=[.!?।])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > MAX_CHARS) {
      if (current) chunks.push(current.trim());
      // A single sentence longer than the cap gets hard-split.
      current = sentence.length > MAX_CHARS ? sentence.slice(0, MAX_CHARS) : sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/**
 * Synthesise speech.
 *
 * @returns {Promise<Blob[]>} one WAV blob per chunk, in playback order
 */
export async function synthesise(text, lang = 'hi', { timeoutMs = 25_000 } = {}) {
  if (!isSarvamConfigured) throw new Error('sarvam-not-configured');

  const chunks = splitForSpeech(text);
  const targetLanguage = sarvamLang(lang);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const blobs = [];
    for (const chunk of chunks) {
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'api-subscription-key': API_KEY, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: chunk,
          target_language_code: targetLanguage,
          model: TTS_MODEL,
          speaker: SPEAKER,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`sarvam-tts-${res.status}: ${detail.slice(0, 160)}`);
      }

      const json = await res.json();
      const base64 = json.audios?.[0];
      if (base64) blobs.push(base64ToBlob(base64, 'audio/wav'));
    }
    return blobs;
  } finally {
    clearTimeout(timer);
  }
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
