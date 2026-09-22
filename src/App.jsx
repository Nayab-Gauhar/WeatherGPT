import { useCallback, useEffect, useRef, useState } from 'react';

import Header from './components/Header.jsx';
import GlobeView from './components/GlobeView.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import { respond, userMessage, welcomeMessage } from './services/agent.js';
import { resolveByCoordinates } from './services/geo.js';
import { speak, stopSpeaking } from './services/speech.js';
import { starterChips } from './i18n/chips.js';
import { DEFAULT_LANG, t } from './i18n/index.js';
import { findPlace } from './data/places.js';
import AuthProvider from './auth/AuthProvider.jsx';
import { useAccount } from './auth/useAccount.js';
import './App.css';
import './components/blocks/blocks.css';

/**
 * Opening demonstration query.
 *
 * The app answers one question on load so the first thing a visitor sees is
 * live data rather than an empty box. Set to `null` to start with a blank
 * conversation.
 */
const DEMO_BOOT_QUERY = 'What is the weather in Kolkata?';

const STORAGE_KEY = 'weathergpt:prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private browsing — preferences simply won't persist */
  }
}

/**
 * Outer shell.
 *
 * Theme lives here so it can be handed to the Clerk provider (its modals must
 * match the app, not flash white in dark mode) while also being available to the
 * inner app. Everything that may call a Clerk hook is inside AuthProvider.
 */
export default function App({ initialTheme = 'light' }) {
  /*
   * Read stored preferences exactly once, via a lazy state initialiser.
   *
   * A ref would also hold the value, but reading `.current` during render to pass
   * it downward is the pattern React's lint rules warn about — state is the
   * correct tool for a value that participates in rendering, even one that never
   * changes.
   */
  const [saved] = useState(loadPrefs);
  const [theme, setTheme] = useState(saved.theme ?? initialTheme);

  return (
    <AuthProvider theme={theme}>
      <WeatherGPT saved={saved} theme={theme} onThemeChange={setTheme} />
    </AuthProvider>
  );
}

function WeatherGPT({ saved, theme, onThemeChange }) {
  const [lang, setLang] = useState(saved.lang ?? DEFAULT_LANG);
  const [model, setModel] = useState(saved.model ?? 'best_match');
  const [autoSpeak, setAutoSpeak] = useState(saved.autoSpeak ?? false);
  const [mapMode, setMapMode] = useState(saved.mapMode ?? '3d');

  const account = useAccount();

  const [messages, setMessages] = useState(() => [welcomeMessage(saved.lang ?? DEFAULT_LANG)]);
  const [busy, setBusy] = useState(false);
  // What the assistant is doing right now. Tier 2 makes several network calls,
  // so naming the current one keeps a 1-3s wait from feeling like a stall.
  const [step, setStep] = useState(null);
  const [locating, setLocating] = useState(false);
  const [place, setPlace] = useState(null);

  // Conversation memory: last place, last intent, last fetched bundles.
  const contextRef = useRef({ lang: saved.lang ?? DEFAULT_LANG });
  const bootedRef = useRef(false);

  /* ------------------------------------------------------------ preferences -- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    savePrefs({ lang, theme, model, autoSpeak, mapMode });
    // Mirror to the account so settings follow the user to another device.
    // No-op when signed out.
    account.savePrefs({ lang, theme, model, autoSpeak, mapMode });
    // `account` is intentionally excluded: its identity changes on every Clerk
    // refresh, and re-running this effect for that would write on a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, theme, model, autoSpeak, mapMode]);

  /*
   * Adopt account preferences once, on sign-in.
   *
   * Only applied when the account actually holds preferences, and only once, so
   * a signed-in user changing the theme on this device is not immediately
   * reverted by their stored copy.
   */
  const adoptedPrefs = useRef(false);
  useEffect(() => {
    if (adoptedPrefs.current || !account.isSignedIn || !account.remotePrefs) return;
    adoptedPrefs.current = true;
    const remote = account.remotePrefs;
    if (remote.lang) setLang(remote.lang);
    if (remote.theme) onThemeChange(remote.theme);
    if (remote.model) setModel(remote.model);
    if (typeof remote.autoSpeak === 'boolean') setAutoSpeak(remote.autoSpeak);
    if (remote.mapMode) setMapMode(remote.mapMode);
  }, [account.isSignedIn, account.remotePrefs, onThemeChange]);

  /* ----------------------------------------------------------------- sending -- */

  const send = useCallback(
    async (text, { display } = {}) => {
      const query = text?.trim();
      if (!query || busy) return;

      stopSpeaking();
      setMessages((prev) => [...prev, userMessage(query, { lang, display })]);
      setBusy(true);
      setStep(null);

      try {
        const { message, context } = await respond(query, {
          lang,
          context: { ...contextRef.current, model },
          onStep: ({ label }) => setStep(label),
        });

        contextRef.current = context;
        if (context.place) setPlace(context.place);

        setMessages((prev) => [...prev, message]);

        if (autoSpeak && message.speech) {
          speak(message.speech, { lang: message.lang ?? lang });
        }
      } finally {
        setBusy(false);
        setStep(null);
      }
    },
    [busy, lang, model, autoSpeak],
  );

  /* ------------------------------------------------------------- boot query -- */

  useEffect(() => {
    if (!DEMO_BOOT_QUERY) return undefined;

    // Pre-position the globe so the camera flight and the answer land together.
    setPlace(findPlace('Kolkata'));

    /*
     * The guard lives inside the timeout, not at the top of the effect.
     * In development React mounts twice; a top-level `if (booted) return`
     * would let the first pass set the flag, the cleanup cancel its timer, and
     * the second pass bail out — so the query would never actually fire.
     */
    const timer = setTimeout(() => {
      if (bootedRef.current) return;
      bootedRef.current = true;
      send(DEMO_BOOT_QUERY);
    }, 600);

    return () => clearTimeout(timer);
    // Intentionally mount-only; `send` is captured once for this single query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------------- map input -- */

  const handlePickCoordinates = useCallback(
    async (lat, lon) => {
      if (busy) return;
      const resolved = await resolveByCoordinates(lat, lon);
      setPlace(resolved);
      contextRef.current = { ...contextRef.current, place: resolved };
      send(`current weather in ${resolved.name}`, {
        display: `${resolved.name} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      });
    },
    [busy, send],
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setLocating(false);
        await handlePickCoordinates(coords.latitude, coords.longitude);
      },
      () => {
        setLocating(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            lang,
            text:
              'I could not access your location. Allow location permission in your browser, or just type a place name.',
            blocks: [],
            chips: [{ label: t('myLocation', lang), query: 'weather in New Delhi' }],
          },
        ]);
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }, [handlePickCoordinates, lang, locating]);

  /* ----------------------------------------------------------------- render -- */

  const handleChip = useCallback((chip) => send(chip.query, { display: chip.label }), [send]);

  /** Picking a saved place moves the globe there and asks about it. */
  const handleSelectSaved = useCallback(
    (savedPlace) => {
      setPlace(savedPlace);
      contextRef.current = { ...contextRef.current, place: savedPlace };
      send(`current weather in ${savedPlace.name}`, { display: savedPlace.name });
    },
    [send],
  );

  const handleLangChange = useCallback((next) => {
    setLang(next);
    contextRef.current = { ...contextRef.current, lang: next };
    stopSpeaking();
  }, []);

  return (
    <div className="app">
      <Header
        lang={lang}
        onLangChange={handleLangChange}
        place={place}
        account={account}
        onSelectSaved={handleSelectSaved}
        theme={theme}
        onThemeToggle={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
        model={model}
        onModelChange={setModel}
        autoSpeak={autoSpeak}
        onAutoSpeakChange={setAutoSpeak}
      />

      <main className="app__main">
        <div className="app__map">
          <GlobeView
            place={place}
            mode={mapMode}
            onModeChange={setMapMode}
            onPickCoordinates={handlePickCoordinates}
            onUseMyLocation={handleUseMyLocation}
            lang={lang}
            theme={theme}
            locating={locating}
          />
          <p className="app__credit">
            {t('liveData', lang)} <span aria-hidden="true">·</span> {t('poweredBy', lang)}
          </p>
        </div>

        <div className="app__chat">
          <ChatPanel
            messages={messages}
            busy={busy}
            step={step}
            lang={lang}
            starters={starterChips(lang)}
            onSend={send}
            onChipClick={handleChip}
          />
        </div>
      </main>
    </div>
  );
}
