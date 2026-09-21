/**
 * Voice layer — speech in and speech out.
 *
 * This is the accessibility backbone of the product: someone who cannot type in
 * Devanagari can ask in spoken Hindi and have the advisory read back.
 *
 * Three engines, chosen per language and per configuration:
 *
 *   input   Sarvam saarika  → when a key is set; trained for Indian languages
 *           Web Speech      → fallback; adequate for English, weak elsewhere
 *
 *   output  Sarvam bulbul   → Indian languages
 *           Deepgram Aura   → English
 *           Web Speech      → fallback, and often has no Indian voice installed
 *
 * Every entry point is capability-checked so the UI can hide what is
 * unavailable rather than failing at the moment of use.
 */

import { getLanguage } from '../i18n/languages.js';
import { recordingSupported, startRecording } from './audio.js';
import { isSarvamConfigured, sarvamSupports, transcribe, synthesise as sarvamTts } from './voice/sarvam.js';
import { deepgramSupports, synthesise as deepgramTts } from './voice/deepgram.js';

/* ------------------------------------------------------------- capability -- */

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
    : null;

const webSpeechStt = Boolean(SpeechRecognitionImpl);
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Cloud recognition needs both a key and microphone capture. */
const cloudStt = () => isSarvamConfigured && recordingSupported;

/** Is voice input possible at all? */
export const sttSupported = cloudStt() || webSpeechStt;

/** Which engine will handle input for this language. */
export function inputEngine(lang = 'en') {
  if (cloudStt() && sarvamSupports(lang)) return 'sarvam';
  if (webSpeechStt) return 'webspeech';
  return 'none';
}

/** Which engine will handle output for this language. */
export function outputEngine(lang = 'en') {
  if (deepgramSupports(lang)) return 'deepgram';
  if (isSarvamConfigured && sarvamSupports(lang)) return 'sarvam';
  if (ttsSupported) return 'webspeech';
  return 'none';
}

/* ------------------------------------------------------------------ input -- */

/**
 * Start voice input. The returned handle is engine-agnostic.
 *
 * Deliberately a toggle (start / stop) rather than press-and-hold: holding a
 * button is awkward to operate by keyboard, and this has to work for users who
 * cannot use a mouse.
 *
 * @param {object} options
 * @param {string} options.lang
 * @param {(text: string) => void} [options.onPartial]  interim text, Web Speech only
 * @param {(text: string) => void} options.onResult     final transcript
 * @param {(state: 'listening'|'transcribing') => void} [options.onState]
 * @param {(code: string) => void} [options.onError]
 * @param {() => void} [options.onEnd]
 * @returns {Promise<{stop: () => void, cancel: () => void}|null>}
 */
export async function startVoiceInput({ lang = 'en', onPartial, onResult, onState, onError, onEnd } = {}) {
  const engine = inputEngine(lang);

  if (engine === 'sarvam') {
    try {
      const session = await startRecording();
      onState?.('listening');

      let finished = false;
      const finish = async (transcribeIt) => {
        if (finished) return;
        finished = true;

        if (!transcribeIt) {
          session.cancel();
          onEnd?.();
          return;
        }

        let wav = null;
        try {
          wav = await session.stop();
        } catch {
          onError?.('capture-failed');
          onEnd?.();
          return;
        }

        if (!wav) {
          // Too short to contain speech — not worth an API call.
          onError?.('too-short');
          onEnd?.();
          return;
        }

        onState?.('transcribing');
        try {
          const { transcript } = await transcribe(wav, lang);
          if (transcript) onResult?.(transcript);
          else onError?.('no-speech');
        } catch (error) {
          // Fall back rather than losing the user's question entirely.
          onError?.(/(^|-)40[13]/.test(String(error.message)) ? 'auth' : 'transcribe-failed');
        } finally {
          onEnd?.();
        }
      };

      return {
        stop: () => void finish(true),
        cancel: () => void finish(false),
      };
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      onError?.(denied ? 'not-allowed' : 'recording-unsupported');
      onEnd?.();
      return null;
    }
  }

  if (engine === 'webspeech') {
    return startWebSpeech({ lang, onPartial, onResult, onState, onError, onEnd });
  }

  onError?.('unsupported');
  onEnd?.();
  return null;
}

/** Browser-native recognition — streaming, but weak for Indian languages. */
function startWebSpeech({ lang, onPartial, onResult, onState, onError, onEnd }) {
  const recognition = new SpeechRecognitionImpl();
  recognition.lang = getLanguage(lang).bcp47;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    onPartial?.(finalText || interim);
  };

  recognition.onerror = (event) => {
    if (event.error === 'aborted') return; // user cancelled; not an error
    onError?.(event.error === 'not-allowed' ? 'not-allowed' : event.error ?? 'unknown');
  };

  recognition.onend = () => {
    const text = finalText.trim();
    if (text) onResult?.(text);
    onEnd?.();
  };

  try {
    recognition.start();
    onState?.('listening');
  } catch {
    onError?.('start-failed');
    onEnd?.();
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
    cancel: () => {
      try {
        finalText = '';
        recognition.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

/* ----------------------------------------------------------------- output -- */

let currentAudio = null;
let playbackToken = 0;

/**
 * Play a sequence of audio blobs.
 *
 * Returns a status rather than a boolean, because "the user pressed stop" and
 * "the audio would not play" demand opposite responses: the first must stay
 * silent, the second should fall back to another engine.
 *
 * @returns {Promise<'done'|'superseded'|'error'>}
 */
async function playBlobs(blobs, token) {
  for (const blob of blobs) {
    if (token !== playbackToken) return 'superseded';

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    try {
      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('playback-failed'));
        audio.play().catch(reject);
      });
    } catch {
      // No audio sink, an unsupported container, or autoplay was blocked.
      return token === playbackToken ? 'error' : 'superseded';
    } finally {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    }
  }
  return 'done';
}

/**
 * Read text aloud using the best available engine.
 *
 * @returns {Promise<boolean>} whether audio was actually produced
 */
export async function speak(text, { lang = 'en', rate = 0.96, onStart, onEnd } = {}) {
  const clean = String(text ?? '').trim();
  if (!clean) return false;

  stopSpeaking();
  const token = (playbackToken += 1);
  const engine = outputEngine(lang);

  if (engine === 'sarvam' || engine === 'deepgram') {
    try {
      const blobs =
        engine === 'deepgram' ? await deepgramTts(clean) : await sarvamTts(clean, lang);

      if (token !== playbackToken) return false;
      if (blobs.length) {
        onStart?.();
        const status = await playBlobs(blobs, token);
        if (status === 'done') {
          onEnd?.();
          return true;
        }
        if (status === 'superseded') {
          onEnd?.();
          return false;
        }
        // status === 'error': the audio arrived but could not be played, so try
        // the browser engine below rather than leaving the user in silence.
      }
    } catch {
      // Cloud synthesis failed outright — same fallback.
    }
  }

  if (ttsSupported) return webSpeak(clean, { lang, rate, onStart, onEnd, token });

  return false;
}

/* ------------------------------------------------- browser speech synthesis -- */

let voicesCache = [];

function loadVoices() {
  if (!ttsSupported) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) voicesCache = voices;
  return voicesCache;
}

if (ttsSupported) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(lang) {
  const { bcp47 } = getLanguage(lang);
  const voices = loadVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => v.lang === bcp47) ??
    voices.find((v) => v.lang?.replace('_', '-').startsWith(`${lang}-`)) ??
    voices.find((v) => v.lang?.startsWith(lang)) ??
    voices.find((v) => v.lang === 'en-IN') ??
    null
  );
}

function webSpeak(text, { lang, rate, onStart, onEnd, token }) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? getLanguage(lang).bcp47;
    utterance.rate = rate;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => {
      onEnd?.();
      resolve(true);
    };
    utterance.onerror = () => {
      onEnd?.();
      resolve(false);
    };

    if (token !== playbackToken) {
      resolve(false);
      return;
    }
    window.speechSynthesis.speak(utterance);
  });
}

/** Stop any playback, whichever engine produced it. */
export function stopSpeaking() {
  playbackToken += 1;
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (ttsSupported) window.speechSynthesis.cancel();
}

/** True when this language can be spoken by some engine. */
export function canSpeak(lang) {
  const engine = outputEngine(lang);
  if (engine === 'sarvam' || engine === 'deepgram') return true;
  if (engine === 'webspeech') return Boolean(pickVoice(lang));
  return false;
}
