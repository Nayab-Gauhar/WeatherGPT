# WeatherGPT

Conversational AI for weather forecasting, alerts and climate intelligence.

Ask about the weather in plain language — by typing or by speaking, in any of ten
Indian languages — and get an answer that is both readable and verifiable: a
sentence that answers the question, followed by the data it was derived from.

Built for **SIH Problem Statement 26068** (Ministry of Earth Sciences / India
Meteorological Department).

---

## Running it

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

No API keys, no accounts, no backend to start. Every data source is keyless.

```bash
npm run check        # lint + NLU test suite + production build
npm run verify:ui    # drives 14 scenarios in a real browser, saves screenshots
```

---

## What it does

| Capability | How it works |
|---|---|
| **Real-time conditions** | Temperature, feels-like, humidity, wind, pressure and visibility for any town, village or coordinate on Earth. |
| **Natural-language queries** | "Will it rain in Kutch tomorrow?", "किसान के लिए फसल सलाह", "சென்னையில் வானிலை எப்படி?" |
| **NWP model integration** | Forecasts are served from GFS (NOAA), IFS (ECMWF) and ICON (DWD). A model-comparison view shows where they disagree. |
| **Early warnings** | Colour-coded rain / heat / cold / wind / fog / thunderstorm / air-quality warnings on IMD's impact-based thresholds. |
| **Location-based forecasting** | Click any point on the globe, or use device geolocation. |
| **Multilingual** | 10 languages. The reply language follows the *question*, not a setting. |
| **Climate analysis** | 15 years of ERA5 reanalysis with least-squares trends per decade. |
| **Voice** | Speech-to-text input and text-to-speech readout via the Web Speech API. |
| **Sector advisories** | Agriculture, aviation, marine and urban/disaster decision support. |

---

## Architecture

```
┌──────────────────────── React 19 + Vite ─────────────────────────┐
│                                                                  │
│  GlobeView ──┐                          ┌── ChatPanel            │
│  (3D / 2D)   │                          │   Composer (text+mic)  │
│              └──────── App state ───────┘   Message + cards      │
│                             │                                    │
│                     services/agent.js                            │
│              the one place a "turn" is orchestrated              │
│                             │                                    │
│   ┌──────────┬──────────────┼──────────────┬─────────────┐       │
│   ▼          ▼              ▼              ▼             ▼       │
│  nlu.js   openMeteo.js   alerts.js   advisory.js    speech.js    │
│  intent   data access    warnings    decisions      voice I/O    │
│   │           │                                                  │
│   │           └──▶ GFS · ECMWF IFS · ICON · ERA5 · CAMS           │
│   └──▶ llm.js (optional hosted model, off by default)            │
└──────────────────────────────────────────────────────────────────┘
```

Every user turn follows the same path:

```
text ─▶ parseQuery      structured intent + entities
     ─▶ resolvePlace    gazetteer → geocoder → conversation memory
     ─▶ fetch*          only the datasets this intent needs
     ─▶ derive/advise   thresholds and sector logic
     ─▶ buildMessage    sentence + typed blocks + follow-up chips
```

The orchestrator returns **pure data**. Rendering is entirely the UI's business,
which is why the same answer can be drawn as a card, read aloud, or (in a future
deployment) pushed as a CAP alert without touching the logic.

### Source layout

```
src/
├── App.jsx                  state, preferences, boot query
├── components/
│   ├── GlobeView.jsx        camera, controls, projection switch
│   ├── Globe3D.jsx          WebGL globe — lazy-loaded chunk
│   ├── MapView2D.jsx        equirectangular fallback, no GPU
│   ├── ChatPanel.jsx        transcript + scroll behaviour
│   ├── Composer.jsx         typing and dictation
│   ├── Message.jsx          one turn, with read-aloud
│   ├── WeatherIcon.jsx      illustrated WMO condition icons
│   └── blocks/              one card per answer type + BlockRenderer
├── services/
│   ├── agent.js             turn orchestration
│   ├── nlu.js               intent + entity extraction
│   ├── llm.js               optional hosted-model adapter
│   ├── openMeteo.js         all upstream I/O, caching, normalising
│   ├── alerts.js            IMD-style warning thresholds
│   ├── advisory.js          general + sector decision support
│   └── speech.js            Web Speech wrapper
├── i18n/                    languages, UI labels, templates, grammar
├── data/                    WMO codes, curated gazetteer
└── utils/format.js          timezone-safe formatting
```

---

## Design decisions worth explaining

### Query understanding is deterministic, not an LLM call

`services/nlu.js` is a lexicon-driven parser across all ten languages, not a
hosted model. For this product that is a feature rather than a compromise:

- **Latency.** Parsing costs microseconds, so response time is dominated by the
  meteorological fetch. Measured latency is printed under every answer.
- **It cannot hallucinate a location.** When output may feed disaster-warning
  dissemination, inventing a district is not an acceptable failure mode.
- **It runs offline and costs nothing per query**, which is what makes
  district-scale deployment plausible.

`services/llm.js` is a drop-in adapter for OpenAI / Llama / Gemini for genuinely
open-ended questions. It returns the same structured shape, so either engine can
drive the app; if it is unreachable, the deterministic parser answers anyway.
Disabled unless configured — see `.env.example`.

### Warnings are derived from thresholds, and always carry an action

`services/alerts.js` implements IMD's impact-based structure, where the colour
*is* the instruction: yellow "be updated", orange "be prepared", red "take
action". Rainfall classes follow IMD's published 24-hour categories (heavy
64.5–115.5 mm, very heavy 115.6–204.4 mm, extremely heavy > 204.4 mm); wind,
heat, cold and fog follow the corresponding criteria.

A hazard is never shown without guidance on what to do about it — a warning
without an action is not actionable. The module's output shape is the same shape
an authoritative CAP / WIS 2.0 feed would produce, so substituting real IMD
bulletins means replacing this one file.

### Model disagreement is shown rather than hidden

Asking for model guidance runs the same forecast through GFS, ECMWF IFS and ICON
and reports the spread. A 0.9 °C spread on day 3 and a 5.2 °C spread on day 4
are very different pieces of information, and a single blended number conceals
that. Spread is the honest expression of forecast confidence.

### Multilingual means grammar, not string substitution

Indian languages mark case on the noun, so interpolating a place name into a
template produces text a native speaker instantly recognises as machine-made:
`কলকাতা-এর আবহাওয়া` instead of `কলকাতার আবহাওয়া`. Two strategies, chosen per
language in `i18n/grammar.js`:

- **Real inflection** where morphology is regular enough to be safe. Bengali
  qualifies — the ending depends only on whether the name is vowel- or
  consonant-final, so `কলকাতা → কলকাতায়` and `হায়দ্রাবাদ → হায়দ্রাবাদে`.
- **A case-free carrier noun** where it is not. Tamil, Telugu, Kannada and
  Malayalam take a following word meaning "area/region"
  (`சென்னை பகுதியில்`), which is idiomatic and invariant, so no name is ever
  mangled. Marathi uses `येथील / येथे` the same way.

Place names themselves are localised from the gazetteer's own alias lists: each
alias is written in exactly one script, and a script implies its language, so
adding `কলকাতা` as a search alias automatically improves how the name is
rendered back to the user.

Recognition works the other way too. Indian languages agglutinate locative
suffixes onto place names — `কলকাতায়`, `சென்னையில்`, `અમદાવાદમાં` — so matching
strips a trailing case marker before lookup. (A related trap: Indic vowel signs
are Unicode *marks*, not letters, so any tokenising regex must include `\p{M}`
or it splits every word at its first matra.)

### Two projections, because the audience has two kinds of device

The 3D globe is a textured WebGL scene. The 2D map is one raster and CSS
transforms — no GPU, a fraction of the bytes. It is the automatic fallback when
WebGL is unavailable, which matters for the rural-accessibility goal, and it is
also simply better for comparing two distant places. Marker, click-to-query and
zoom behave identically in both.

The globe sphere uses an **unlit** material. With the library's default lit
material, half the visible disc is in shadow and the terminator swings with the
camera, which reads as a broken render on a product whose whole point is
clarity.

### Performance

three.js is ~550 kB gzipped — far larger than everything else combined — so
`Globe3D.jsx` is a lazily-loaded chunk. The conversation becomes interactive
without waiting for the renderer, and a user in 2D mode never downloads it.

```
index.js     132 kB gzip   (app + React)
Globe3D.js   547 kB gzip   (three.js — loaded only for 3D)
index.css      6 kB gzip
```

Upstream responses are cached in-memory with per-dataset TTLs (10 min for
forecasts, 30 min for air quality, 7 days for the climate archive), so follow-up
questions in a conversation are instant.

---

## Data sources

| Dataset | Provider | Used for |
|---|---|---|
| GFS | NOAA NCEP (13 km) | Forecast + model comparison |
| IFS | ECMWF (25 km) | Forecast + model comparison |
| ICON | DWD (11 km) | Forecast + model comparison |
| ERA5 | Copernicus / ECMWF | Climate trends, 15-year normals |
| CAMS | Copernicus | Air quality (PM2.5, PM10, NO₂, O₃, SO₂, CO) |
| Geocoding | Open-Meteo / GeoNames | Place resolution |

Delivered through the [Open-Meteo](https://open-meteo.com) API family, which
serves post-processed output from these systems without an API key. All upstream
access is confined to `services/openMeteo.js`.

---

## Honest limitations

Worth stating plainly, since a weather product that overstates itself is worse
than one that admits its edges:

- **Warnings are derived, not official.** They are computed from forecast fields
  using IMD's published thresholds. They are not IMD bulletins and must not be
  treated as a substitute for them. Some IMD criteria (heat wave, cold wave)
  depend on departure from *station* normals; those are approximated with
  absolute thresholds.
- **Translation coverage is uneven** — full for English, Hindi, Bengali, Tamil,
  Telugu and Marathi; partial for Gujarati, Kannada, Malayalam and Punjabi,
  which fall back to English for less common labels. The settings panel shows
  each language's real coverage rather than implying completeness.
- **Voice support depends on the browser.** Dictation needs Chromium or Safari;
  playback quality depends on which system voices are installed. Both paths are
  capability-checked and hidden when unavailable rather than failing on click.
- **No WRF.** The problem statement names GFS/WRF; GFS is integrated directly.
  WRF is a regional model an agency runs itself, so it would arrive as an
  in-house gridded feed — that belongs behind the gateway described below,
  reaching this app through the same normalised shape as every other model.
- **Reverse geocoding** for map clicks uses a third-party endpoint and degrades
  to raw coordinates when unavailable.

---

## Deployment path

This repository is the client — the part that had to be proven interactively.
Production would add a thin gateway, without changing the contracts above:

```
Mobile / Web ──▶ FastAPI gateway ──▶ Redis cache ──▶ NWP + IMD feeds
                      │                              (GFS, WRF, AWS network)
                      ├──▶ PostGIS      station, district and warning geometry
                      ├──▶ MQTT / WIS 2.0   real-time warning ingest + fan-out
                      └──▶ LLM           open-ended questions only
```

- The gateway holds every credential, applies rate limiting, and lets many
  clients share one warm cache.
- **MQTT / WIS 2.0** replaces polling for warnings: the ingest path is
  push-based, and dissemination fans out to subscribers by district.
- **PostGIS** turns "warnings for my location" into a real spatial query against
  official warning polygons instead of point thresholds.
- The client's `services/` boundary is already the seam: each module would call
  the gateway instead of the public API, and no component changes.

---

## Testing

```bash
npm run check:nlu    # 28 cases across 10 languages: intent, place, day, sector
npm run verify:ui    # real browser: 14 scenarios, screenshots + text assertions
```

`scripts/check-nlu.mjs` covers intent classification and entity extraction,
including the agglutinated-suffix forms (`কলকাতায়`, `சென்னையில்`,
`અમદાવાદમાં`, `കൊച്ചിയിൽ`) that a naive matcher fails on.

`scripts/verify.sh` drives the running app through one query per intent and
asserts the rendered text, which catches data-path and layout regressions that a
unit test would not.

---

## Accessibility

Keyboard-operable throughout with visible focus rings; semantic landmarks and
ARIA labels on every control; `aria-live` status for listening and thinking
states; icons carry text labels, never colour alone; `prefers-reduced-motion`
disables the globe's idle rotation and all transitions; light and dark themes
both meet WCAG AA contrast.
