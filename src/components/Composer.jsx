import { useEffect, useRef, useState } from 'react';

import { MicIcon, SendIcon, StopIcon } from './Icons.jsx';
import { t } from '../i18n/index.js';
import { startVoiceInput, sttSupported, inputEngine } from '../services/speech.js';

/** Why voice input failed, in words a user can act on. */
const MIC_ERRORS = {
  'not-allowed':
    'Microphone permission was denied. Enable it in your browser settings to ask by voice.',
  'too-short': 'That was too short to hear. Hold the button while speaking, then tap it again.',
  'no-speech': 'I could not make out any speech. Please try again.',
  auth: 'Speech recognition is not configured correctly. Please type your question instead.',
  'transcribe-failed': 'Speech recognition failed just now. Please try again or type instead.',
  'capture-failed': 'Could not capture audio from the microphone.',
  'recording-unsupported': 'This browser cannot record audio. Please type your question.',
  unsupported: 'Voice input is unavailable in this browser. Please type your question.',
  default: 'Voice input is unavailable right now — please type your question.',
};

/**
 * Query input.
 *
 * Typing and speaking are equal-status entry paths. For a user comfortable
 * speaking Marathi but not typing Devanagari, the microphone is the only usable
 * path — so dictation writes into the same field and the result is submitted
 * directly.
 */
export default function Composer({ onSubmit, lang, busy, disabled }) {
  const [value, setValue] = useState('');
  const [voiceState, setVoiceState] = useState('idle'); // idle | listening | transcribing
  const [micError, setMicError] = useState(null);
  const inputRef = useRef(null);
  const sessionRef = useRef(null);

  const engine = inputEngine(lang);

  // Auto-grow the textarea up to a cap, then scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  useEffect(() => () => sessionRef.current?.cancel(), []);

  const send = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onSubmit(text);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const toggleMic = async () => {
    if (voiceState !== 'idle') {
      sessionRef.current?.stop();
      return;
    }

    setMicError(null);
    const session = await startVoiceInput({
      lang,
      // Interim text only arrives from the browser engine; cloud recognition
      // returns one final transcript.
      onPartial: (text) => setValue(text),
      onResult: (text) => {
        setValue('');
        onSubmit(text);
      },
      onState: (state) => setVoiceState(state),
      onError: (code) => {
        setMicError(code);
        setVoiceState('idle');
      },
      onEnd: () => {
        setVoiceState('idle');
        sessionRef.current = null;
      },
    });

    sessionRef.current = session;
  };

  const active = voiceState !== 'idle';
  const placeholder =
    voiceState === 'listening'
      ? t('listening', lang)
      : voiceState === 'transcribing'
        ? 'Transcribing…'
        : t('placeholder', lang);

  return (
    <div className="composer">
      <div className={`composer__field${active ? ' is-listening' : ''}`}>
        <textarea
          ref={inputRef}
          className="composer__input"
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={t('placeholder', lang)}
        />

        {sttSupported && (
          <button
            type="button"
            className={`composer__mic${active ? ' is-active' : ''}`}
            onClick={toggleMic}
            aria-label={active ? t('stopListening', lang) : t('voiceInput', lang)}
            title={
              active
                ? t('stopListening', lang)
                : `${t('voiceInput', lang)}${engine === 'sarvam' ? ' (Sarvam AI)' : ''}`
            }
            aria-pressed={active}
            disabled={voiceState === 'transcribing'}
          >
            {active ? <StopIcon width={16} height={16} /> : <MicIcon width={18} height={18} />}
          </button>
        )}
      </div>

      <button
        type="button"
        className="composer__send"
        onClick={send}
        disabled={!value.trim() || busy}
        aria-label={t('send', lang)}
        title={t('send', lang)}
      >
        <SendIcon width={20} height={20} />
      </button>

      {active && (
        <p className="composer__status" role="status">
          <span className="composer__pulse" aria-hidden="true" />
          {voiceState === 'listening'
            ? `${t('listening', lang)}${engine === 'sarvam' ? '' : ''} — tap to stop`
            : 'Transcribing…'}
        </p>
      )}

      {micError && !active && (
        <p className="composer__status composer__status--error" role="alert">
          {MIC_ERRORS[micError] ?? MIC_ERRORS.default}
        </p>
      )}
    </div>
  );
}
