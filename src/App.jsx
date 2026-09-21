import { useCallback, useEffect, useRef, useState } from 'react';

import Header from './components/Header.jsx';
import GlobeView from './components/GlobeView.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import { respond, userMessage, welcomeMessage } from './services/agent.js';
import { reverseGeocode } from './services/openMeteo.js';
import { speak, stopSpeaking } from './services/speech.js';
import { starterChips } from './i18n/chips.js';
import { DEFAULT_LANG, t } from './i18n/index.js';
import { findPlace } from './data/places.js';
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

export default function App() {
  const saved = useRef(loadPrefs()).current;

  const [lang, setLang] = useState(saved.lang ?? DEFAULT_LANG);
  const [theme, setTheme] = useState(saved.theme ?? 'light');
  const [model, setModel] = useState(saved.model ?? 'best_match');
  const [autoSpeak, setAutoSpeak] = useState(saved.autoSpeak ?? false);
  const [mapMode, setMapMode] = useState(saved.mapMode ?? '3d');

  const [messages, setMessages] = useState(() => [welcomeMessage(saved.lang ?? DEFAULT_LANG)]);
  const [busy, setBusy] = useState(false);
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
  }, [lang, theme, model, autoSpeak, mapMode]);

  /* ----------------------------------------------------------------- sending -- */

  const send = useCallback(
    async (text, { display } = {}) => {
      const query = text?.trim();
      if (!query || busy) return;

      stopSpeaking();
      setMessages((prev) => [...prev, userMessage(query, { lang, display })]);
      setBusy(true);

      try {
        const { message, context } = await respond(query, {
          lang,
          context: { ...contextRef.current, model },
        });

        contextRef.current = context;
        if (context.place) setPlace(context.place);

        setMessages((prev) => [...prev, message]);

        if (autoSpeak && message.speech) {
          speak(message.speech, { lang: message.lang ?? lang });
        }
      } finally {
        setBusy(false);
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
      const resolved = await reverseGeocode(lat, lon);
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
        theme={theme}
        onThemeToggle={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
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
