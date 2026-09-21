/**
 * Deepgram — English speech synthesis (Aura 2).
 *
 * Used only for English. Aura's voices are noticeably more natural than the
 * browser's default English voice, but the model range does not cover Indian
 * languages, so anything other than English is routed to Sarvam instead.
 */

const TTS_URL = 'https://api.deepgram.com/v1/speak';
const API_KEY = import.meta.env?.VITE_DEEPGRAM_API_KEY ?? '';

export const isDeepgramConfigured = Boolean(API_KEY);

/** Aura 2 English voice. */
const MODEL = 'aura-2-thalia-en';

/** Deepgram covers English only in this integration. */
export function deepgramSupports(lang) {
  return isDeepgramConfigured && lang === 'en';
}

/**
 * Synthesise English speech.
 *
 * @returns {Promise<Blob[]>} a single MP3 blob, wrapped in an array so callers
 *          can treat Sarvam and Deepgram output identically.
 */
export async function synthesise(text, { timeoutMs = 25_000 } = {}) {
  if (!isDeepgramConfigured) throw new Error('deepgram-not-configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${TTS_URL}?model=${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Token ${API_KEY}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ text: String(text).replace(/\s+/g, ' ').trim() }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`deepgram-tts-${res.status}: ${detail.slice(0, 160)}`);
    }

    return [await res.blob()];
  } finally {
    clearTimeout(timer);
  }
}
