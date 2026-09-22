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

That is enough. All weather, air-quality and climate data is keyless, and query
understanding runs locally, so the app is fully functional with no configuration.

Three optional keys each upgrade one capability:

```bash
cp .env.example .env.local     # then fill in what you have
```

| Key | Adds |
|---|---|
| `VITE_GEMINI_API_KEY` | Answers to open-ended and comparative questions ([AI Studio](https://aistudio.google.com/apikey)) |
| `VITE_SARVAM_API_KEY` | Accurate Indian-language speech in and out ([Sarvam](https://dashboard.sarvam.ai)) |
| `VITE_DEEPGRAM_API_KEY` | Higher-quality English speech ([Deepgram](https://console.deepgram.com)) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Sign-in, so saved places and settings follow the user across devices ([Clerk](https://dashboard.clerk.com)) |

> ⚠️ Vite inlines `VITE_*` variables into the client bundle, so these keys are
> readable by anyone who loads the page. Fine for local development and demos;
> before deploying publicly, move the calls behind the gateway described at the
> end of this file. `.env.local` is gitignored.

```bash
npm run check        # lint + 44 NLU/routing tests + production build
npm run verify:ui    # drives 14 scenarios in a real browser, saves screenshots
```

---

## What it does

| Capability | How it works |
|---|---|
| **Real-time conditions** | Temperature, feels-like, humidity, wind, pressure and visibility for any town, village or coordinate on Earth. |
| **Natural-language queries** | "Will it rain in Kutch tomorrow?", "किसान के लिए फसल सलाह", "சென்னையில் வானிலை எப்படி?" |
| **Hinglish** | "Kolkata ka mausam kaisa hai?", "kal barish hogi kya" — answered in the same register |
| **Coordinates** | Paste "22.57, 88.36" or "12°58'N 77°35'E", or click any point on the map |
| **Open-ended reasoning** | "Compare Delhi and Bengaluru for a morning run — I have asthma" is answered from live data for both cities, with a recommendation. |
| **NWP model integration** | Forecasts are served from GFS (NOAA), IFS (ECMWF) and ICON (DWD). A model-comparison view shows where they disagree. |
| **Early warnings** | Colour-coded rain / heat / cold / wind / fog / thunderstorm / air-quality warnings on IMD's impact-based thresholds. |
| **Location-based forecasting** | Click any point on the globe, or use device geolocation. |
| **Multilingual** | 10 languages. The reply language follows the *question*, not a setting. |
| **Climate analysis** | 15 years of ERA5 reanalysis with least-squares trends per decade. |
| **Voice** | Ask by speaking and hear the answer read back — Sarvam for Indian languages, Deepgram for English, browser Web Speech as fallback. |
| **Saved places** | Pin the places you check daily. Local by default; synced to your account when signed in. |
| **Warning dissemination** | Forward a warning by SMS from your own phone — reaches a feature phone with no data. |
| **Sector advisories** | Agriculture, aviation, marine and urban/disaster decision support. |

---

## Architecture

```
┌──────────────────────── React 19 + Vite ─────────────────────────┐
│  GlobeView ──┐                          ┌── ChatPanel            │
│  (3D / 2D)   │                          │   Composer (text+mic)  │
│              └──────── App state ───────┘   Message + cards      │
│                             │                                    │
│                     services/agent.js                            │
│              the one place a "turn" is orchestrated              │
│                             │                                    │
│              ┌──────────────┴──────────────┐                     │
│         TIER 1                          TIER 2                   │
│         nlu.js                          gemini.js                │
│    deterministic parser            tool-calling loop             │
│    ~200 ms · no network            1–7 s · Gemini 2.5 Flash      │
│              │                              │                    │
│              │                          tools.js                 │
│              │                     6 callable functions          │
│              └──────────────┬──────────────┘                     │
│                             ▼                                    │
│      openMeteo.js · alerts.js · advisory.js · geo.js             │
│      data access   warnings    decisions     resolution          │
│                             │                                    │
│                  GFS · ECMWF IFS · ICON · ERA5 · CAMS            │
│                                                                  │
│      speech.js ──▶ Sarvam (Indic) · Deepgram (en) · Web Speech   │
└──────────────────────────────────────────────────────────────────┘
```

**Tier 1** handles any question with a recognisable shape:

```
text ─▶ parseQuery      structured intent + entities
     ─▶ resolvePlace    gazetteer → geocoder → conversation memory
     ─▶ fetch*          only the datasets this intent needs
     ─▶ derive/advise   thresholds and sector logic
     ─▶ buildMessage    sentence + typed blocks + follow-up chips
```

**Tier 2** handles everything else:

```
text ─▶ assessComplexity   multiple places? comparison? personal context?
     ─▶ Gemini + 6 tools   model chooses what to look up
     ─▶ executeTool        real data fetched, location re-resolved
     ─▶ loop back          results returned to the model, up to 4 rounds
     ─▶ grounded answer    prose from the model, cards from the tools
```

Routing costs nothing — it runs on the Tier 1 parse. Any Tier 2 failure falls
back to Tier 1, and the reason is shown to the user rather than hidden.

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
│   ├── RichText.jsx         safe formatter for model-generated prose
│   └── blocks/              one card per answer type + BlockRenderer
├── services/
│   ├── agent.js             turn orchestration + tier routing
│   ├── nlu.js               Tier 1 parser + complexity assessment
│   ├── llm/
│   │   ├── index.js         Tier 2 loop, provider-agnostic
│   │   ├── gemini.js        Gemini provider + quota memory
│   │   └── sarvamLlm.js     Sarvam provider (independent fallback)
│   ├── tools.js             6 callable functions + grounding payloads
│   ├── geo.js               place resolution, multi-provider + cached
│   ├── openMeteo.js         all upstream I/O, caching, normalising
│   ├── alerts.js            IMD-style warning thresholds
│   ├── advisory.js          general + sector decision support
│   ├── speech.js            engine selection for voice in and out
│   ├── audio.js             mic capture + WAV encoding
│   └── voice/
│       ├── sarvam.js        Indian-language STT (saarika) + TTS (bulbul)
│       └── deepgram.js      English TTS (aura-2)
├── auth/
│   ├── config.js            publishable key + a single "is auth available" flag
│   ├── AuthProvider.jsx     mounts Clerk only when configured
│   ├── useAccount.js        one interface for signed-in / signed-out / no-auth
│   └── savedPlacesStore.js  external store for the signed-out case
├── i18n/                    languages, UI labels, templates, grammar
├── data/                    WMO codes, curated gazetteer
└── utils/format.js          timezone-safe formatting
```

---

## Design decisions worth explaining

### Two tiers, because neither approach is sufficient alone

Most questions have a recognisable shape, and for those a lexicon-driven parser
beats a model call outright: it answers in ~200 ms, costs nothing, works offline,
and cannot invent a district — which matters when output may feed warning
dissemination.

But a fixed schema has a hard ceiling. It carries **one** `location` field, so it
physically cannot represent "compare Kolkata and Mumbai", however the prompt is
tuned. That is why Tier 2 uses **tool calling** rather than one-shot intent
extraction: each call carries its own arguments, and Gemini correctly emits two
parallel `get_forecast` calls for that question.

Tool calling alone is not sufficient either. Asked *"is this September wetter than
normal in Nagpur, and will next week continue?"*, the model fetched the climate
normals and stopped — silently answering half. It works one step at a time, so
results must be fed back. Hence a **bounded** loop: 4 iterations, 8 tool calls,
22 s. When a cap is hit, a final pass runs with the tools withdrawn, so it answers
from the data already gathered instead of discarding it.

### The grounding invariant

The model never sources a number. Tools fetch real data, the system instruction
forbids stating any figure absent from a tool result, and the cards rendered
beneath the prose come from those same results — so every claim can be checked
against the numbers on screen.

This was verified, not assumed. Asked to compare two cities, Gemini reported
"up to 33.3 mm" and "below 3.4 mm"; the API's actual daily maxima were 33.3 and
3.4.

It also holds in the negative direction, which is the more telling test. Before
month-to-date observations existed, the model was asked whether September was
wetter than normal and replied that it *could not say*, having only historical
normals. It refused to guess. The gap was in the tooling, not the model, so
`fetchMonthToDate` was added — and the question now answers correctly, at 122%
of normal.

### Calibrating the model, not just prompting it

Three findings from measurement that no prompt change would have fixed:

- **Thinking tokens come out of the answer budget.** Gemini 2.5 Flash reasons
  internally by default. On a two-part question it spent 861 tokens thinking and
  had 35 left for the reply, which returned truncated mid-sentence with
  `finishReason: MAX_TOKENS` — dropping half the user's question. Setting
  `thinkingBudget: 0` fixed the truncation *and* roughly halved latency.
- **Free-tier quota is metered per model, per day** — 20 requests, per the
  `GenerateRequestsPerDayPerProjectPerModel-FreeTier` violation. Because each
  model has its own bucket, the fallback chain multiplies usable capacity, and
  exhausted models are remembered in `sessionStorage` so a reload does not re-pay
  a round trip rediscovering them.
- **Model latency varies by more than 10×** on identical requests:
  `gemini-3-flash-preview` 1.0 s, `gemini-flash-latest` 6.1 s,
  `gemini-3.5-flash` 12.6 s. Since a turn needs two or three round trips, the
  chain is ordered by measured speed — with the slowest model tried first, two
  calls alone exceeded the budget and the answer was lost to the fallback.

### Every external dependency has a fallback

Place lookup sits in front of nearly every answer, and language understanding in
front of the interesting ones, so a single provider outage would take the product
down. Both run through chains:

| Capability | Order |
|---|---|
| Understanding | Gemini (5 models) → Sarvam → deterministic parser |
| Geocoding | Nominatim India-first → Nominatim global → Open-Meteo |
| Reverse geocoding | BigDataCloud → Nominatim → raw coordinates |
| Speech out | Sarvam / Deepgram → browser Web Speech |

Adding Sarvam as a second language model was not redundancy for its own sake:
Gemini's free tier is 20 requests per model per day, and when the chain was spent
the AI answer was lost entirely. Sarvam sits on a separate quota, supports tool
calling in the OpenAI format, and answered in ~1.6 s in testing.

### Choosing a geocoder on evidence

Nominatim is the primary rather than the more convenient GeoNames-backed
alternative, because the alternative is actively wrong for this audience. Tested
side by side:

| Query | Open-Meteo geocoder | Nominatim |
|---|---|---|
| কলকাতা, சென்னை, ಬೆಂಗಳೂರು | *no result* | correct |
| Bombay | Bombay, **New York** | Mumbai |
| Calcutta | Calcutta, **South Africa** | Kolkata |
| Kutch | Kutch, **Colorado** | Kachchh, Gujarat |

Returning a confident forecast for the wrong continent is worse than returning
nothing. The India-restricted pass runs first so "Delhi" and "Hyderabad" resolve
to the Indian cities, with a global pass behind it so London still works.

That evidence also let the built-in gazetteer shrink from 44 hand-maintained
entries to 12 — it is now an offline fast path for the most-asked places, not a
substitute for a geocoder. Results are cached in `localStorage`, so any place is
fetched at most once per device.

### Hinglish is a first-class input, not a fallback

A large share of Indian users type Hindi in the Latin alphabet — "Kolkata ka
mausam kaisa hai", "kal barish hogi kya". Script detection alone reads that as
English, every keyword lookup misses, and a perfectly clear question gets a
generic fallback reply.

So Hinglish is detected as its own register, with its own lexicon (including
spelling variants: mausam/mosam, barish/baarish) and its own response templates,
and the model prompt instructs the same register back. Detection needs two
grammatical markers, or one in a short phrase, which keeps English queries out:
all twelve English and native-script controls in the test suite classify
correctly.

Interface labels stay English deliberately. Users writing Hinglish read English
UI comfortably, and romanising "Humidity" would read worse than leaving it.

### Coordinates are handled once, centrally

`utils/coords.js` exists because three layers previously had their own rules, and
mistakes here are silent:

- **Longitude wraps, latitude clamps.** Dragging a map east past the antimeridian
  produces 190°, which is 170° W; providers reject the former.
- **In-range values pass through untouched.** The obvious modulo turns 88.36 into
  88.36000000000001 — invisible, but enough to make two identical map clicks miss
  the cache and refetch.
- **Out-of-range pairs are rejected, not clamped.** "95, 88" is not a position, so
  silently turning it into the North Pole would answer a question nobody asked.
- **Parsing is strict about intent.** Six notations are accepted, but "7 day
  forecast" and "next 24 hours" must never be read as a position.

### SMS dissemination without a gateway

The problem statement asks for flood and cyclone warning dissemination, and the
hard part is regulatory rather than technical. Sending SMS *from* a platform in
India needs DLT registration under TRAI's rules — a registered header and
**pre-approved templates** — which rules out transmitting freely generated text,
and it needs a backend holding gateway credentials.

What works today with no backend, no gateway and no registration is to compose
the warning and hand it to the *user's own* messaging app, pre-filled, via an
`sms:` link. They are the sender, so no approval applies, and it reaches a feature
phone with no data connection — which is exactly where a flood warning most needs
to arrive.

Message length is treated as a real constraint. Indic scripts force UCS-2
encoding, which allows **70 characters per segment against GSM-7's 160**, so the
same warning in Tamil has less than half the room. The composer builds a required
core — severity, place, hazard, action — then sheds optional detail until it fits
two segments, because parts of a longer message can arrive out of order. Measured
trigger values are reduced to a script-neutral form (`[92 km/h]`) rather than left
as English prose inside a Hindi sentence.

Verified across seven languages: every one fits within two segments, and Tamil
correctly drops both optional parts to do so.

### Authentication is additive, never a gate

Sign-in is provided by Clerk, and the guiding rule is that **nothing about
answering a weather question depends on knowing who is asking**. A farmer
checking whether to spray tomorrow must never meet a sign-in wall.

That is not just a policy, it is a structural constraint. Clerk's provider throws
`Missing publishableKey` when instantiated without one, so wrapping the app
unconditionally — which is what the setup CLI does — turns a checkout without a
key into a blank page. `AuthProvider` therefore mounts Clerk only when a key is
present, and `useAccount` exposes the same interface either way, so no component
contains a branch on whether auth exists.

What an account actually buys the user is saved places and preferences that
follow them to another device. Signing out does not delete anything, and places
saved *before* signing up are merged into the account rather than discarded.

Storage uses Clerk's `unsafeMetadata`, the only metadata field writable from the
browser — which is what makes per-user data possible with no backend at all. The
name is a warning worth heeding: the user can modify it themselves, so it is
right for saved places and display settings and wrong for anything granting
access. Nothing stored there is trusted for authorisation.

Three failure modes are handled explicitly, because each is silent otherwise:

| Situation | Behaviour |
|---|---|
| No key configured | Auth controls hidden; saved places kept in this browser |
| Key present, Clerk loading | Placeholder holds the space so the header does not jump |
| Key wrong or revoked | Visible "check VITE_CLERK_PUBLISHABLE_KEY" notice, app fully usable |

All three were verified in a browser, including that the weather app keeps working
with an unreachable Clerk backend.

### Voice is the accessibility feature, not a gimmick

Web Speech is adequate for English and unreliable for Hindi, Bengali or Tamil;
on many Android builds no Indian-language voice is installed at all. So Sarvam
handles Indian languages in both directions, Deepgram handles English synthesis,
and Web Speech remains the fallback.

One detail worth recording: `MediaRecorder` produces WebM/Opus, but the
recognition endpoint was verified against 16 kHz mono WAV. Rather than gamble on
format support, captured audio is decoded with `decodeAudioData`, downsampled and
re-encoded as WAV in the browser — no library, nothing to install. Downsampling
averages each window rather than dropping samples, because decimation aliases
high frequencies into the speech band and measurably harms recognition.

The round trip is tested end to end: synthesise Hindi → convert through our own
encoder → transcribe → the sentence returns character-for-character.


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
| Gemini 2.5 Flash | Google AI Studio | Open-ended questions, tool calling |
| sarvam-105b | Sarvam AI | Second LLM provider, independent quota |
| Nominatim | OpenStreetMap | Primary geocoding, native scripts, reverse lookup |
| saarika:v2.5 / bulbul:v3 | Sarvam AI | Indian-language speech in and out |
| aura-2 | Deepgram | English speech synthesis |

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
- **Voice support degrades by environment.** With a Sarvam key, recognition works
  in any browser that can record audio; without one it falls back to Web Speech,
  which needs Chromium or Safari and is weak for Indian languages. Every path is
  capability-checked and hidden when unavailable rather than failing on click.
- **Microphone capture was not verified end to end.** The sandbox used for
  development has no audio device, so recording and audible playback could only
  be tested as far as the data path: synthesis returns valid audio, and a WAV
  produced by our own encoder transcribes back exactly. Real-device testing of
  `getUserMedia` remains outstanding.
- **The Gemini free tier allows 20 requests per model per day.** A Tier 2 answer
  costs two or three, so expect on the order of 25–30 open-ended questions daily
  across the model chain before everything falls back to Tier 1. The UI says so
  when it happens. Billing lifts the limit.
- **API keys ship in the client bundle.** Vite inlines `VITE_*` at build time.
  Acceptable for local use, not for public deployment — see the gateway below.
  The Clerk *publishable* key is the exception: it is designed to be public.
- **Sign-in has not been exercised against a live Clerk application.** The
  provider, controls, metadata sync and all three failure states were verified,
  including with a deliberately unreachable key, but no real account existed to
  complete a sign-up round trip. Clerk's CLI cannot provision keys for React
  without an interactive login, so that step needs the project owner.
- **SMS is user-sent, not platform-sent.** The app pre-fills the message; the user
  presses send. Platform-originated SMS needs DLT registration and a backend, and
  for genuine mass alerting India already uses CAP feeds via SACHET and cell
  broadcast, which reach every handset in a tower's range with no phone numbers.
- **No WRF.** The problem statement names GFS/WRF; GFS is integrated directly.
  WRF is a regional model an agency runs itself, so it would arrive as an
  in-house gridded feed — that belongs behind the gateway described below,
  reaching this app through the same normalised shape as every other model.
- **Reverse geocoding** tries two providers and then falls back to labelling the
  point by its coordinates. Most of the planet is ocean or unnamed land, so a
  forecast should not depend on a point having a name.
- **Nominatim is rate-limited by policy** (roughly one request per second, cached
  results expected). Fine at demo volume given the persistent cache, but a
  deployment serving many users needs its own mirror or a commercial geocoder.
- **Marathi and Malayalam place extraction is weaker** where the case marker fuses
  into the stem (पुणे → पुण्यात). The residual-token heuristic usually still finds
  the name; when it cannot, the conversation falls back to the place already under
  discussion.

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
npm run check:nlu    # 82 assertions: parsing, routing, language detection, coordinates
npm run verify:ui    # real browser: 16 scenarios, screenshots + text assertions
```

`scripts/check-nlu.mjs` covers intent classification and entity extraction,
including the agglutinated-suffix forms (`কলকাতায়`, `சென்னையில்`,
`અમદાવાદમાં`, `കൊച്ചിയിൽ`) that a naive matcher fails on.

The routing assertions exist because a real bug slipped past manual testing:
*"is this September wetter than normal in Nagpur, and will next week continue?"*
scored high confidence on the climate intent, stayed on Tier 1, and answered only
the first half. They also pin a subtler trap — the Hindi word for "or" (`या`)
occurs inside the ordinary question marker `क्या`, so naive substring matching
escalated *"will it rain tomorrow?"* to the model. Indic vowel signs are Unicode
**marks**, so boundary checks must exclude `\p{M}` as well as `\p{L}`.

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
