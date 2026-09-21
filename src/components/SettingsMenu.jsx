import { useEffect, useRef } from 'react';

import { LANGUAGES, coverage, t } from '../i18n/index.js';
import { NWP_MODELS } from '../services/openMeteo.js';
import { canSpeak, sttSupported, ttsSupported } from '../services/speech.js';
import { CheckIcon, CloseIcon } from './Icons.jsx';

/**
 * Settings popover: interface language, NWP model selection, and voice
 * preferences.
 *
 * Language is deliberately front and centre — for the audience this product
 * targets it is not a preference buried in a menu, it is the thing that decides
 * whether the tool is usable at all. Each option shows its translation coverage
 * so the choice is honest.
 */
export default function SettingsMenu({
  open,
  onClose,
  lang,
  onLangChange,
  model,
  onModelChange,
  autoSpeak,
  onAutoSpeakChange,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings" ref={ref} role="dialog" aria-label={t('features', lang)}>
      <header className="settings__head">
        <h3>{t('features', lang)}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon width={16} height={16} />
        </button>
      </header>

      <section className="settings__group">
        <h4 className="settings__title">{t('language', lang)}</h4>
        <ul className="settings__langs">
          {LANGUAGES.map((l) => {
            const pct = coverage(l.code);
            return (
              <li key={l.code}>
                <button
                  type="button"
                  className={`settings__lang${l.code === lang ? ' is-active' : ''}`}
                  onClick={() => onLangChange(l.code)}
                  aria-pressed={l.code === lang}
                >
                  <span className="settings__native">{l.native}</span>
                  <span className="settings__english">{l.english}</span>
                  {pct < 100 && <span className="settings__pct">{pct}%</span>}
                  {l.code === lang && <CheckIcon width={14} height={14} />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="settings__hint">
          Ask in any of these scripts and the answer comes back in the same language —
          the interface language only sets the default.
        </p>
      </section>

      <section className="settings__group">
        <h4 className="settings__title">Forecast model</h4>
        <ul className="settings__models">
          {NWP_MODELS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={`settings__model${m.id === model ? ' is-active' : ''}`}
                onClick={() => onModelChange(m.id)}
                aria-pressed={m.id === model}
              >
                <span className="settings__model-top">
                  <strong>{m.label}</strong>
                  <em>
                    {m.agency} · {m.resolution}
                  </em>
                </span>
                <span className="settings__model-note">{m.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings__group">
        <h4 className="settings__title">Voice</h4>
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(e) => onAutoSpeakChange(e.target.checked)}
            disabled={!ttsSupported}
          />
          <span>Read answers aloud automatically</span>
        </label>
        <p className="settings__hint">
          {sttSupported
            ? 'Voice input is available on this browser.'
            : 'Voice input needs a Chromium-based or Safari browser.'}
          {ttsSupported
            ? canSpeak(lang)
              ? ' A voice is installed for the selected language.'
              : ' No system voice is installed for the selected language, so playback may fall back to English.'
            : ' Speech playback is unavailable on this browser.'}
        </p>
      </section>
    </div>
  );
}
