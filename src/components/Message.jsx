import { useState } from 'react';

import BlockRenderer from './blocks/BlockRenderer.jsx';
import { SpeakerIcon, StopIcon } from './Icons.jsx';
import { t } from '../i18n/index.js';
import { speak, stopSpeaking, ttsSupported } from '../services/speech.js';

/** Small cloud mark used as the assistant's avatar. */
function AssistantAvatar() {
  return (
    <span className="msg__avatar msg__avatar--bot" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="17" height="17">
        <path
          d="M6.5 19a4.5 4.5 0 0 1-.7-8.95 6.2 6.2 0 0 1 12-1.2A3.9 3.9 0 0 1 17.4 19H6.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function UserAvatar() {
  return (
    <span className="msg__avatar msg__avatar--user" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="8.5" r="3.8" fill="currentColor" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0Z" fill="currentColor" />
      </svg>
    </span>
  );
}

/**
 * One transcript turn.
 *
 * User turns are a simple bubble. Assistant turns are a short sentence plus a
 * stack of data cards — the sentence answers the question, the cards let the
 * reader verify it, which is the pattern that keeps a weather assistant
 * trustworthy rather than merely fluent.
 */
export default function Message({ message, lang, onChipClick }) {
  const [speaking, setSpeaking] = useState(false);

  const readAloud = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speak(message.speech ?? message.text, { lang: message.lang ?? lang });
    setSpeaking(false);
  };

  if (message.role === 'user') {
    return (
      <div className="msg msg--user">
        <p className="msg__bubble">{message.text}</p>
        <UserAvatar />
      </div>
    );
  }

  const hasBlocks = Boolean(message.blocks?.length);

  return (
    <div className="msg msg--bot">
      <div className="msg__lead">
        <AssistantAvatar />
        <div className="msg__lead-text">
          <p className="msg__text">{message.text}</p>
          {ttsSupported && (message.speech || message.text) && (
            <button
              type="button"
              className={`msg__speak${speaking ? ' is-active' : ''}`}
              onClick={readAloud}
              aria-label={speaking ? t('stopReading', lang) : t('readAloud', lang)}
              title={speaking ? t('stopReading', lang) : t('readAloud', lang)}
            >
              {speaking ? <StopIcon width={13} height={13} /> : <SpeakerIcon width={14} height={14} />}
            </button>
          )}
        </div>
      </div>

      {hasBlocks && (
        <div className="msg__blocks">
          {message.blocks.map((block, i) => (
            <BlockRenderer key={`${block.type}-${i}`} block={block} lang={message.lang ?? lang} />
          ))}
        </div>
      )}

      {message.chips?.length > 0 && (
        <div className="chips">
          {message.chips.map((chip) => (
            <button
              type="button"
              className="chip"
              key={chip.label}
              onClick={() => onChipClick(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {message.meta && (
        <p className="msg__meta">
          {message.meta.sources?.join(' · ')}
          {message.meta.latencyMs != null && ` · ${message.meta.latencyMs} ms`}
        </p>
      )}
    </div>
  );
}
