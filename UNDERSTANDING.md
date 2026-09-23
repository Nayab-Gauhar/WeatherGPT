# Understanding WeatherGPT

A guide to how this codebase actually works — written to be read before a demo, or
before changing anything.

The `README.md` explains *what* was built and *why* each design decision was made.
This document is narrower and more practical: follow one question through the
code, know where to change things, and be ready for the questions a judge will
ask.

---

## What it is, in one paragraph

A conversational weather platform for India. You ask a question in plain language
— typed or spoken, in English, Hinglish, or nine Indian languages — and it answers
from live meteorological data, showing the data alongside the answer so the claim
can be checked. It runs entirely in the browser: no server, no build step beyond
Vite, and it works with zero API keys configured.

**13,944 lines** of source across **79 tracked files**, with five runtime
dependencies: `react`, `react-dom`, `three` and `react-globe.gl` for the globe, and
`@clerk/react` for optional sign-in. No component library, no state manager, no
chart library — the cards, icons and charts are hand-built SVG and CSS.

---

## The one idea that explains everything else

Almost every design decision follows from two rules:

### Rule 1 — Two tiers, because one engine cannot do both jobs

```
your question
   │
   ├─ Tier 1   deterministic parser (src/services/nlu.js)
   │           ~20–800 ms · no LLM call · no cost · works offline
   │           handles "weather in Kolkata", "कल बारिश होगी", "7 day forecast"
   │
   └─ Tier 2   language model + tool calling (src/services/llm/)
               ~5–7 s · Gemini, falling back to Sarvam
               handles "compare Delhi and Bengaluru, I have asthma"
```

A lexicon parser is *better* than an LLM for recognisable questions: instant, free,
offline, and it cannot invent a district. But it has a hard ceiling — its schema
holds **one** location, so it can never express "compare Kolkata and Mumbai". Tier 2
exists for exactly that ceiling, and Tier 1 remains the fallback whenever Tier 2 is
unavailable.

`assessComplexity()` decides which tier, and it costs nothing because it runs on the
Tier 1 parse that already happened.

### Rule 2 — The model never sources a number

Tools fetch real data. The model only *words* it. Every figure in an AI answer came
from a tool result, and the cards rendered beneath the prose come from those same
results — so any claim can be checked against the numbers on screen.

This was verified in both directions:

- Asked to compare two cities, the model said "up to 33.3 mm" and "below 3.4 mm".
  The API's actual maxima were **exactly** 33.3 and 3.4.
- Asked whether September was wetter than normal *before* month-to-date data
  existed, it **refused to answer** rather than guess. The gap was in the tooling,
  not the model, so `fetchMonthToDate()` was added.

That second one matters more than the first. A system that guesses rainfall on a
disaster-preparedness tool is worse than one that says it doesn't know.

---

## Follow one question through the code

**You type:** `"Compare Delhi and Bengaluru for a morning run tomorrow, I have mild asthma"`

| Step | File | What happens |
|---|---|---|
| 1 | `components/Composer.jsx` | Captures the text, hands it up to `App` |
| 2 | `services/agent.js` → `respond()` | The one place a turn is orchestrated |
| 3 | `services/nlu.js` → `parseQuery()` | Detects language, intent, place, day |
| 4 | `services/nlu.js` → `assessComplexity()` | Two places + comparison + personal context → **Tier 2** |
| 5 | `services/llm/index.js` → `runLlmTurn()` | Starts the bounded agentic loop |
| 6 | `services/llm/gemini.js` | Sends the question plus 6 tool declarations |
| 7 | *model responds* | Asks for 4 tools: forecast + air quality, for each city |
| 8 | `services/tools.js` → `executeTool()` | Runs them **in parallel** |
| 9 | `services/geo.js` → `resolveByName()` | Each city name resolved to coordinates — the safety boundary |
| 10 | `services/openMeteo.js` | Real HTTP calls to the weather APIs |
| 11 | `services/tools.js` | Returns **two things**: a compact payload for the model, and typed cards for the UI |
| 12 | `services/llm/index.js` | Feeds results back; model now answers |
| 13 | `components/Message.jsx` | Renders prose via `RichText`, cards via `BlockRenderer` |

**You see:** a recommendation ("Choose Bengaluru"), the reasoning with real figures
(AQI 39 vs 159), and **nine data cards** — both cities' current conditions, forecast,
warnings and air quality.

Step 11 is the one worth understanding. Each tool returns a *grounding payload* and
*UI blocks* from the same fetch. That is what makes the answer auditable rather than
merely fluent.

---

## Where to change things

| To change… | Open |
|---|---|
| How a question is understood | `services/nlu.js` |
| Which tier a question goes to | `assessComplexity()` in `services/nlu.js` |
| What the AI can look up | `services/tools.js` (declarations + executors) |
| The AI's instructions / tone | `systemInstruction()` in `services/llm/index.js` |
| Add another AI provider | New file in `services/llm/`, add to `PROVIDERS` |
| Warning thresholds | `services/alerts.js` |
| Farmer / pilot / fisher advice | `services/advisory.js` |
| Weather API calls | `services/openMeteo.js` — **all** upstream I/O is here |
| Place lookup, geocoding chain | `services/geo.js` |
| Add a language | `i18n/languages.js`, `ui.js`, `templates.js` |
| Grammar for place names | `i18n/grammar.js` |
| A new answer card | `components/blocks/` + one line in `BlockRenderer.jsx` |
| Colours, spacing, dark mode | `src/index.css` (design tokens) |
| Voice engines | `services/speech.js`, `services/voice/` |
| Sign-in behaviour | `src/auth/` |

**The important boundary:** every external HTTP call lives in `services/`. No
component fetches anything. That is what makes the "move it behind a FastAPI
gateway" plan a per-module change rather than a rewrite.

---

## The six subsystems

### 1. Understanding (`services/nlu.js`, `services/llm/`)
Tier 1 is a lexicon across 10 languages plus Hinglish. Tier 2 is Gemini with six
callable tools and a bounded loop (4 iterations, 8 calls). Falls back: Gemini → Sarvam
→ Tier 1.

### 2. Data (`services/openMeteo.js`, `geo.js`)
Live forecasts from **GFS** (NOAA), **IFS** (ECMWF) and **ICON** (DWD); climate from
**ERA5**; air quality from **CAMS**. Geocoding is Nominatim-first because the
alternative resolved "Calcutta" to South Africa and "Bombay" to New York.

### 3. Interpretation (`services/alerts.js`, `advisory.js`)
Turns numbers into decisions. Warnings use IMD's impact-based colour thresholds and
always carry an action. Sector advice covers agriculture, aviation, marine and urban.

### 4. Presentation (`components/`)
A 3D WebGL globe with a GPU-free 2D fallback, and one card component per answer type.
three.js is lazily loaded so the chat is interactive before the renderer arrives.

### 5. Voice (`services/speech.js`, `audio.js`, `voice/`)
Sarvam for Indian languages, Deepgram for English, browser Web Speech as fallback.
Audio is re-encoded to 16 kHz mono WAV in the browser because that is the format the
recogniser was verified against.

### 6. Accounts + dissemination (`src/auth/`, `services/smsShare.js`)
Optional sign-in syncs saved places and preferences. Warnings can be forwarded by
SMS from the user's own phone — no gateway, no DLT registration.

---

## Demo script

Run `npm run dev`. It answers a question on load, so live data is on screen
immediately.

| # | Type this | Point out |
|---|---|---|
| 1 | *(already answered on load)* | Real observation, updated timestamp, warnings derived live |
| 2 | `Kolkata ka mausam kaisa hai?` | **Hinglish** in, Hinglish out — how most Indians actually type |
| 3 | `kal barish hogi kya` | No place named — it remembers the conversation |
| 4 | `कोलकाता में कल बारिश होगी क्या?` | Same question, Devanagari, correct grammar (`कोलकाता में`) |
| 5 | `any weather warnings for Puri` | Colour-coded warnings **+ Forward by SMS** |
| 6 | `crop advisory for farmers in Nagpur` | Decisions, not measurements: "Irrigation — Defer" |
| 7 | `compare forecast models for Chennai` | GFS vs ECMWF vs ICON disagreement = honest confidence |
| 8 | `Compare Delhi and Bengaluru for a morning run, I have mild asthma` | **Tier 2** — the AI moment. Note the ✨ badge and both cities' cards |
| 9 | `22.57, 88.36` | Paste coordinates; or click anywhere on the globe |
| 10 | Settings (grid icon) | 10 languages with honest coverage %, NWP model choice, which engines are live |

**Latency note worth saying out loud:** queries 2–7 answer in well under a second
because they never touch an LLM. Only query 8 does, and it takes ~5 s. That is the
two-tier design paying off, not a limitation.

---

## Questions you will be asked

**"Is this real data or mocked?"**
Real, live, every time. Open DevTools → Network. Sources are named under each answer.

**"Does the AI make up numbers?"**
No, and it's enforced structurally, not by hoping. Tools fetch, the model phrases. The
cards below the prose come from the same fetch, so you can check it. It has been
observed *refusing* to answer when it lacked data.

**"Why not just use ChatGPT / Gemini directly?"**
Three reasons. It has no live weather data. It would take seconds for questions we
answer in milliseconds. And it would confidently invent rainfall figures — which on a
disaster-management tool is not a cosmetic flaw.

**"Is this official IMD data?"**
No, and the README says so plainly. Warnings are *derived* from forecast fields using
IMD's published thresholds — heavy rain 64.5–115.5 mm, and so on. It is not a
substitute for an IMD bulletin. Real deployment would ingest authoritative CAP feeds,
which is a one-module change.

**"How does it scale?"**
Today it's a client with a shared 10-minute cache. Production adds a thin FastAPI
gateway holding the credentials, Redis, PostGIS for warning polygons, and MQTT/WIS 2.0
for push-based warning ingest. The `services/` boundary is already the seam.

**"What about WRF? The problem statement names it."**
GFS is integrated directly, along with ECMWF and ICON. WRF is a regional model an
agency runs in-house, so it arrives as a private gridded feed — that belongs behind
the gateway, reaching the app through the same normalised shape as every other model.

**"Multilingual — is it just translated strings?"**
No. Indian languages mark case on the noun, so naive interpolation gives
`কলকাতা-এর আবহাওয়া`, which reads as machine output. Bengali is properly inflected
(`কলকাতায়`); Tamil, Telugu, Kannada and Malayalam use an invariant carrier noun.
Recognition also strips agglutinated suffixes, so `কলকাতায়` and `சென்னையில்` resolve.

**"What if an API goes down?"**
Every dependency has a chain: understanding (Gemini → Sarvam → local parser),
geocoding (Nominatim IN → Nominatim global → Open-Meteo), reverse geocoding, and
speech. Demonstrated live: with Gemini's daily quota spent, `sarvam-105b` answered.

---

## Limits — know these before someone finds them

- **Gemini free tier is 20 requests per model per day.** A Tier 2 answer costs 2–3, so
  expect ~25–30 open-ended questions daily across the model chain. When exhausted the
  app degrades to Tier 1 **and says so** in the answer.
- **API keys ship in the client bundle.** Vite inlines `VITE_*`. Fine for a laptop
  demo, not for public deployment. The Clerk *publishable* key is the exception — it's
  public by design.
- **Sign-in is not exercised end to end.** The provider, controls, metadata sync and
  all three failure states are verified, but no live Clerk app was linked — the CLI
  needs an interactive browser login. Add `VITE_CLERK_PUBLISHABLE_KEY` and it
  activates with no code change.
- **Microphone capture is untested on real hardware.** The dev sandbox had no audio
  device. The data path is proven (synthesised Hindi → our WAV encoder → transcribed
  back exactly), but test `getUserMedia` on a real laptop before demoing voice.
- **SMS is user-sent, not platform-sent.** Deliberate: platform SMS in India needs DLT
  registration and pre-approved templates.
- **Marathi and Malayalam place extraction is weaker** where the case marker fuses into
  the stem (पुणे → पुण्यात). It falls back to the place already under discussion.

---

## Commands

```bash
npm install
npm run dev          # http://127.0.0.1:5173

npm run check        # lint + 82 assertions + production build
npm run check:nlu    # parsing, tier routing, language detection, coordinates
npm run verify:ui    # drives 16 scenarios in a real browser, saves screenshots
```

`scripts/check-nlu.mjs` is worth reading. Several assertions exist because of bugs
that manual testing missed — `"hi"` matching inside "s**hi**mla" and "Del**hi**" so
bare place names were classified as greetings, and Hindi `या` ("or") matching inside
`क्या` (the question marker) so "will it rain tomorrow?" was escalated to the AI.
Both are now pinned by tests.
