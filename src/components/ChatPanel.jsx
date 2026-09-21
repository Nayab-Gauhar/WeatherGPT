import { useEffect, useRef } from 'react';

import Message from './Message.jsx';
import Composer from './Composer.jsx';
import { t } from '../i18n/index.js';
import './ChatPanel.css';

/** Three-dot "assistant is working" affordance. */
function Thinking({ lang, step }) {
  return (
    <div className="msg msg--bot">
      <div className="msg__lead">
        <span className="msg__avatar msg__avatar--bot" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17">
            <path
              d="M6.5 19a4.5 4.5 0 0 1-.7-8.95 6.2 6.2 0 0 1 12-1.2A3.9 3.9 0 0 1 17.4 19H6.5Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <p className="thinking" role="status">
          <span className="thinking__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {step ?? t('thinking', lang)}
        </p>
      </div>
    </div>
  );
}

/**
 * The conversational surface.
 *
 * Owns scroll behaviour and layout only; all interpretation happens upstream in
 * the orchestrator, and all rendering of data happens downstream in the cards.
 */
export default function ChatPanel({ messages, busy, step, lang, starters, onSend, onChipClick }) {
  const scrollRef = useRef(null);
  const endRef = useRef(null);

  // Follow new turns, but never yank the view while the user is reading back.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (nearBottom || messages.at(-1)?.role === 'user') {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, busy]);

  return (
    <section className="chat" aria-label="WeatherGPT conversation">
      <header className="chat__head">
        <h2 className="chat__brand">
          Weather<span>GPT</span>
        </h2>
        <p className="chat__sub">{t('chatSub', lang)}</p>
      </header>

      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__thread">
          {messages.map((message) => (
            <Message key={message.id} message={message} lang={lang} onChipClick={onChipClick} />
          ))}

          {busy && <Thinking lang={lang} step={step} />}

          {starters?.length > 0 && messages.length <= 1 && !busy && (
            <div className="chips chips--starters">
              {starters.map((chip) => (
                <button type="button" className="chip" key={chip.label} onClick={() => onChipClick(chip)}>
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <footer className="chat__foot">
        <Composer onSubmit={onSend} lang={lang} busy={busy} />
      </footer>
    </section>
  );
}
