import { useEffect, useRef, useState } from 'react';

import { MicIcon, SendIcon, StopIcon } from './Icons.jsx';
import { t } from '../i18n/index.js';
import { startDictation, sttSupported } from '../services/speech.js';

/**
 * Query input.
 *
 * Two equal-status entry paths: typing and speaking. The mic is not a
 * decoration — for a user who is comfortable speaking Marathi but not typing
 * Devanagari it is the only usable path, so dictation writes into the same
 * field and can be reviewed and edited before sending.
 */
export default function Composer({ onSubmit, lang, busy, disabled }) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const inputRef = useRef(null);
  const sessionRef = useRef(null);

  // Auto-grow the textarea up to a cap, then scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  useEffect(() => () => sessionRef.current?.abort(), []);

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

  const toggleMic = () => {
    if (listening) {
      sessionRef.current?.stop();
      return;
    }

    setMicError(null);
    const session = startDictation({
      lang,
      onPartial: (text) => setValue(text),
      onResult: (text) => {
        setValue('');
        onSubmit(text);
      },
      onError: (code) => {
        setMicError(code === 'not-allowed' ? 'permission' : code);
        setListening(false);
      },
      onEnd: () => {
        setListening(false);
        sessionRef.current = null;
      },
    });

    if (session) {
      sessionRef.current = session;
      setListening(true);
    }
  };

  return (
    <div className="composer">
      <div className={`composer__field${listening ? ' is-listening' : ''}`}>
        <textarea
          ref={inputRef}
          className="composer__input"
          rows={1}
          value={value}
          placeholder={listening ? t('listening', lang) : t('placeholder', lang)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={t('placeholder', lang)}
        />

        {sttSupported && (
          <button
            type="button"
            className={`composer__mic${listening ? ' is-active' : ''}`}
            onClick={toggleMic}
            aria-label={listening ? t('stopListening', lang) : t('voiceInput', lang)}
            title={listening ? t('stopListening', lang) : t('voiceInput', lang)}
            aria-pressed={listening}
          >
            {listening ? <StopIcon width={16} height={16} /> : <MicIcon width={18} height={18} />}
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

      {listening && (
        <p className="composer__status" role="status">
          <span className="composer__pulse" aria-hidden="true" />
          {t('listening', lang)}
        </p>
      )}

      {micError && (
        <p className="composer__status composer__status--error" role="alert">
          {micError === 'permission'
            ? 'Microphone permission was denied. Enable it in your browser settings to ask by voice.'
            : 'Voice input is unavailable right now — please type your question.'}
        </p>
      )}
    </div>
  );
}
