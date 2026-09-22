import { useState } from 'react';

import SettingsMenu from './SettingsMenu.jsx';
import AccountMenu from './AccountMenu.jsx';
import SavedPlaces from './SavedPlaces.jsx';
import { GridIcon, MoonIcon, SunIcon } from './Icons.jsx';
import { t, getLanguage } from '../i18n/index.js';
import './Header.css';

/**
 * Product header: identity on the left, controls on the right.
 */
export default function Header({
  lang,
  onLangChange,
  place,
  account,
  onSelectSaved,
  theme,
  onThemeToggle,
  model,
  onModelChange,
  autoSpeak,
  onAutoSpeakChange,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const language = getLanguage(lang);

  return (
    <header className="appbar">
      <div className="appbar__brand">
        <h1 className="appbar__logo">
          Weather<span>GPT</span>
        </h1>
        <p className="appbar__tagline">{t('tagline', lang)}</p>
      </div>

      <div className="appbar__actions">
        <SavedPlaces
          place={place}
          savedPlaces={account?.savedPlaces ?? []}
          onSave={account?.savePlace}
          onRemove={account?.removePlace}
          onSelect={onSelectSaved}
          isSignedIn={account?.isSignedIn ?? false}
          isConfigured={account?.isConfigured ?? false}
          syncing={account?.syncing ?? false}
          lang={lang}
        />

        <button
          type="button"
          className="appbar__lang"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label={t('language', lang)}
          title={t('language', lang)}
        >
          {language.native}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onThemeToggle}
          aria-label={t('theme', lang)}
          title={t('theme', lang)}
        >
          {theme === 'dark' ? <MoonIcon width={19} height={19} /> : <SunIcon width={19} height={19} />}
        </button>

        <div className="appbar__menu-wrap">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label={t('features', lang)}
            title={t('features', lang)}
            aria-expanded={settingsOpen}
          >
            <GridIcon width={18} height={18} />
          </button>

          <SettingsMenu
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            lang={lang}
            onLangChange={onLangChange}
            model={model}
            onModelChange={onModelChange}
            autoSpeak={autoSpeak}
            onAutoSpeakChange={onAutoSpeakChange}
          />
        </div>

        <AccountMenu />

        {/* Placeholder identity mark, shown only when auth is not configured. */}
        {!account?.isConfigured && (
          <span className="appbar__avatar" aria-hidden="true">
            N
          </span>
        )}
      </div>
    </header>
  );
}
