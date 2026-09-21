/**
 * Voice layer — speech recognition (input) and synthesis (output).
 *
 * This is the accessibility backbone of the product: a farmer who cannot type
 * in Devanagari can hold the mic button, ask in spoken Hindi, and have the
 * advisory read back. Both directions use the browser's built-in Web Speech
 * API, so nothing is uploaded to a third-party ASR service.
 *
 * Support is uneven across browsers, so every entry point is capability-checked
 * and the UI hides what is unavailable rather than failing at click time.
 */

import { getLanguage } from '../i18n/languages.js';

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
    : null;

export const sttSupported = Boolean(SpeechRecognitionImpl);
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Start dictation.
 *
 * @param {object} options
 * @param {string} options.lang        app language code (e.g. 'hi')
 * @param {(text:string)=>void} options.onPartial  interim transcript
 * @param {(text:string)=>void} options.onResult   final transcript
 * @param {(err:string)=>void}  options.onError
 * @param {()=>void}            options.onEnd
 * @returns {{ stop: ()=>void, abort: ()=>void } | null}
 */
export function startDictation({ lang = 'en', onPartial, onResult, onError, onEnd } = {}) {
  if (!SpeechRecognitionImpl) {
    onError?.('unsupported');
    return null;
  }

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
    if (interim) onPartial?.(interim);
    if (finalText) onPartial?.(finalText);
  };

  recognition.onerror = (event) => {
    // "aborted" is the normal outcome of the user cancelling; not an error.
    if (event.error !== 'aborted') onError?.(event.error ?? 'unknown');
  };

  recognition.onend = () => {
    const text = finalText.trim();
    if (text) onResult?.(text);
    onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    onError?.('start-failed');
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
    abort: () => {
      try {
        finalText = '';
        recognition.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

/* ---------------------------------------------------------------- synthesis -- */

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

/** Best available voice for a language, preferring an Indian locale. */
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

/** True when the platform can actually speak this language. */
export function canSpeak(lang) {
  return ttsSupported && Boolean(pickVoice(lang));
}

/**
 * Read text aloud. Resolves when speech finishes or is cancelled.
 */
export function speak(text, { lang = 'en', rate = 0.96, onStart, onEnd } = {}) {
  if (!ttsSupported || !text) return Promise.resolve(false);

  window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? getLanguage(lang).bcp47;
    utterance.rate = rate;
    utterance.pitch = 1;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => {
      onEnd?.();
      resolve(true);
    };
    utterance.onerror = () => {
      onEnd?.();
      resolve(false);
    };

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel();
}
