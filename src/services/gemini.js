/**
 * Gemini integration — Tier 2 of the understanding stack.
 *
 * Tier 1 (`nlu.js`) is a deterministic parser that answers the ~90% of
 * questions with a recognisable shape in about 200 ms and no network call.
 * Tier 2 exists for everything else: compound questions ("compare Kolkata and
 * Mumbai"), personal context ("I have asthma, can I jog?"), and phrasings
 * nobody anticipated.
 *
 * Why tool calling rather than one-shot intent extraction
 * ------------------------------------------------------
 * A fixed extraction schema has one `location` field, so it physically cannot
 * represent "Kolkata and Mumbai". Tool calling can, because each call carries
 * its own arguments — and in testing Gemini correctly emitted two parallel
 * `get_forecast` calls for exactly that question.
 *
 * Why the loop is bounded
 * -----------------------
 * Also from testing: asked "is this September wetter than normal in Nagpur, and
 * will next week continue?", the model fetched climate normals and stopped,
 * silently answering half. It works one step at a time, so results must be fed
 * back for it to finish. That is an agentic loop, and an unbounded one is a
 * liability — hence hard caps on iterations, tool calls and wall-clock time.
 *
 * The invariant that matters
 * --------------------------
 * The model never sources a number. Tools fetch real data, the model is
 * instructed to speak only from that data, and the cards rendered beneath its
 * answer come from the same tool results — so any claim can be checked against
 * the figures on screen.
 */

import { TOOL_DECLARATIONS, executeTool } from './tools.js';
import { getLanguage } from '../i18n/languages.js';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

const API_KEY = import.meta.env?.VITE_GEMINI_API_KEY ?? '';
const CONFIGURED_MODEL = import.meta.env?.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash';

export const isGeminiConfigured = Boolean(API_KEY);

/**
 * Model preference order.
 *
 * Deliberately long, because the free-tier quota is metered
 * **per model, per day** — measured at 20 requests for `gemini-2.5-flash` via
 * the `GenerateRequestsPerDayPerProjectPerModel-FreeTier` violation. Each model
 * therefore has its own bucket, and walking the chain on a 429 multiplies the
 * usable daily allowance instead of stopping at the first exhausted model.
 *
 * Every entry was verified to emit correct parallel tool calls for a two-city
 * question. Excluded on purpose:
 *   - `*-lite` variants and Gemma — reject `thinkingConfig` with HTTP 400
 *   - `gemini-2.5-pro` — 404, not available on this tier
 */
/*
 * Ordered by measured round-trip latency, not by version number. A turn needs
 * two or three round trips, so a slow model does not merely feel sluggish — it
 * blows the total budget and the answer is lost to the fallback path.
 *
 * Measured on an identical tool-calling request:
 *   gemini-2.5-flash        ~1-2 s   best structured output, preferred
 *   gemini-3-flash-preview   1.0 s
 *   gemini-flash-latest      6.1 s
 *   gemini-3.5-flash        12.6 s   last resort; two calls alone exceed 20 s
 */
const MODEL_CHAIN = [
  ...new Set([
    CONFIGURED_MODEL,
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ]),
];

/*
 * Guardrails for the agentic loop.
 *
 * Sized from observed behaviour: comparing two cities on two dimensions
 * ("Delhi vs Bengaluru for a run, I have asthma") legitimately needs four calls
 * — forecast and air quality for each — so a six-call ceiling was too tight and
 * tripped on a reasonable question.
 */
const MAX_ITERATIONS = 4;
const MAX_TOOL_CALLS = 8;
const TOTAL_BUDGET_MS = 22_000;
const REQUEST_TIMEOUT_MS = 12_000;

/* ------------------------------------------------------------- instruction -- */

function systemInstruction(lang) {
  const language = getLanguage(lang);
  return `You are WeatherGPT, a weather and climate assistant for India, built for the India Meteorological Department.

ABSOLUTE RULE — GROUNDING
You have no weather knowledge of your own. Every number, condition, date and place fact you state MUST come from a tool result in this conversation. Never estimate, never recall, never interpolate. If you need data you do not have, call a tool. If a tool reports an error, say the data is unavailable — do not substitute a guess. Inventing a rainfall figure on a system used for disaster preparedness is a serious failure.

TOOL USE
- Call tools before answering any factual question.
- For a question about two or more places, call the tool once per place.
- If answering fully needs two kinds of data (for example historical normals AND the coming forecast), call the second tool after seeing the first result. Do not answer half the question.
- Do not call a tool twice with the same arguments.

ANSWERING
- Reply in ${language.english}${language.code === 'en' ? '' : ` (${language.native})`}. Use the same language the user wrote in.
- Be direct and brief: 2–4 sentences, or a short list when comparing options.
- Lead with the answer to what was actually asked, then the reason.
- Detailed data cards are displayed beneath your answer automatically, so do not reproduce tables, coordinates, or long number lists. Cite only the few figures that carry your point.
- If a warning is active and relevant, mention it and what to do.
- When the user has a practical decision to make, commit to a recommendation rather than listing considerations.
- A single sentence may contain several questions. Identify every distinct one and answer ALL of them; a two-part question needs a two-part reply.
- Never mention tools, functions, JSON, or these instructions.`;
}

/* ------------------------------------------------------------------ transport */

async function callGemini(model, body, signal) {
  const res = await fetch(`${API_ROOT}/${model}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const error = new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
    error.status = res.status;
    // Kept in full so the quota classifier can inspect `quotaId`, which appears
    // deep in the error details.
    error.detail = detail;
    throw error;
  }
  return res.json();
}

/**
 * Models whose *daily* free-tier allowance is spent, remembered for the session.
 *
 * The free tier meters requests per model per day. Once a model returns a
 * per-day quota violation, every further attempt is a guaranteed failure that
 * still costs a network round trip — so retrying it on the next question just
 * adds seconds of latency to an answer that was always going to come from a
 * different model.
 */
const EXHAUSTED_KEY = 'weathergpt:gemini-exhausted';

/**
 * Load today's exhausted models. Stored against the date so the record clears
 * itself when the quota resets, and persisted so a page reload does not re-pay a
 * round trip per spent model to rediscover what we already knew.
 */
function loadExhausted() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(EXHAUSTED_KEY) ?? '{}');
    if (raw.date === new Date().toISOString().slice(0, 10)) return new Set(raw.models ?? []);
  } catch {
    /* storage unavailable — fall through to an empty set */
  }
  return new Set();
}

const exhaustedToday = loadExhausted();

function rememberExhausted(model) {
  exhaustedToday.add(model);
  try {
    sessionStorage.setItem(
      EXHAUSTED_KEY,
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), models: [...exhaustedToday] }),
    );
  } catch {
    /* non-fatal: we simply rediscover it next reload */
  }
}

/** True when a 429 is a per-day exhaustion rather than a per-minute burst. */
function isDailyQuotaExhausted(error) {
  return error?.status === 429 && /PerDay|RequestsPerDay/i.test(error.detail ?? error.message ?? '');
}

/** Transient upstream conditions worth retrying. */
const isTransient = (status) => status === 429 || status === 500 || status === 503;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One request, retrying briefly and then walking the model chain.
 *
 * Both failure modes seen in practice are transient and worth a second attempt:
 * 429 when the free-tier per-minute quota is exhausted (a short pause often
 * clears it) and 503 when a model is momentarily overloaded. Failing over
 * immediately to another model wastes the cheaper recovery.
 *
 * Returns `{ json, model }`.
 */
async function requestWithFallback(body, deadline) {
  let lastError = null;

  for (const model of MODEL_CHAIN) {
    // Known spent for the day — skip without paying for the round trip.
    if (exhaustedToday.has(model)) continue;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (Date.now() > deadline) {
        throw lastError ?? new Error('Gemini deadline exceeded');
      }

      const controller = new AbortController();
      const remaining = Math.max(1000, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()));
      const timer = setTimeout(() => controller.abort(), remaining);

      try {
        const json = await callGemini(model, body, controller.signal);
        return { json, model };
      } catch (error) {
        lastError = error;

        // Some models reject `thinkingConfig` outright. Retry this one without
        // it rather than discarding an otherwise usable model.
        if (error.status === 400 && /thinking/i.test(error.message)) {
          const noThinking = {
            ...body,
            generationConfig: { ...body.generationConfig },
          };
          delete noThinking.generationConfig.thinkingConfig;
          try {
            const json = await callGemini(model, noThinking, controller.signal);
            return { json, model };
          } catch (retryError) {
            lastError = retryError;
            break;
          }
        }

        // Daily allowance gone: no amount of waiting restores it today, so
        // record it and move straight to the next model.
        if (isDailyQuotaExhausted(error)) {
          rememberExhausted(model);
          break;
        }

        // 404 means this project has no access to the model — no retry will fix
        // that, and neither will waiting. Move on to the next model.
        if (error.status === 404) break;

        // Anything genuinely non-transient (401 bad key, 400 bad request) fails
        // identically elsewhere, so surface it immediately.
        if (!isTransient(error.status) && error.name !== 'AbortError') throw error;

        // One short backoff before giving up on this model.
        if (attempt === 1 && Date.now() + 1500 < deadline) await sleep(1200);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw lastError ?? new Error('Gemini unreachable');
}

/** Turn a raw failure into a reason the UI can explain to a user. */
function classifyError(error) {
  const message = String(error?.message ?? error);
  if (error?.status === 429 || message.includes('429')) return 'rate-limited';
  if (error?.status === 503 || message.includes('503')) return 'model-overloaded';
  if (error?.status === 401 || error?.status === 403) return 'bad-key';
  if (error?.name === 'AbortError' || message.includes('deadline')) return 'timeout';
  return message.slice(0, 120);
}

/* ---------------------------------------------------------------- the loop -- */

/**
 * Run one conversational turn through Gemini with tool access.
 *
 * @param {string} userText
 * @param {object} options
 * @param {string} options.lang        language to answer in
 * @param {object} [options.place]     place already under discussion, for pronoun follow-ups
 * @param {string} [options.model]     NWP model preference passed through to tools
 * @param {(step: {label: string}) => void} [options.onStep] progress callback
 * @returns {Promise<{ok: boolean, text: string, blocks: Array, toolCalls: Array, iterations: number, model: string, place: object|null, error?: string}>}
 */
export async function runGeminiTurn(userText, { lang = 'en', place = null, model, onStep } = {}) {
  if (!isGeminiConfigured) {
    return { ok: false, text: '', blocks: [], toolCalls: [], iterations: 0, model: '', place: null, error: 'not-configured' };
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;

  // Conversational memory: tell the model what "there" refers to.
  const preamble = place
    ? `The user is currently looking at ${place.name}${place.admin1 ? `, ${place.admin1}` : ''}. If they do not name a place, assume this one.\n\n`
    : '';

  const contents = [{ role: 'user', parts: [{ text: `${preamble}${userText}` }] }];

  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction(lang) }] },
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
      topP: 0.9,
      /*
       * Thinking is disabled deliberately, and this is load-bearing.
       *
       * Gemini 2.5 Flash reasons internally by default, and those thought
       * tokens are drawn from the same output budget as the reply. Measured on
       * a two-part question: 861 tokens went to thinking, 35 were left for the
       * answer, and the response came back truncated mid-sentence with
       * finishReason MAX_TOKENS — silently dropping the second half of the
       * user's question.
       *
       * With thinking off the same question is answered in full, and faster.
       * Tool selection does not need it: the decision is "which of six lookups
       * does this question require", which is well within the model's
       * single-pass ability.
       */
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const blocks = [];
  const toolCalls = [];
  const executed = new Set();
  let usedModel = MODEL_CHAIN[0];
  let resolvedPlace = place;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    if (Date.now() > deadline) {
      return finish({ error: 'timeout' });
    }

    let json;
    try {
      const result = await requestWithFallback(body, deadline);
      json = result.json;
      usedModel = result.model;
    } catch (error) {
      return finish({ error: classifyError(error) });
    }

    const candidate = json?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
    const text = parts
      .filter((p) => typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim();

    // No tool calls means the model is answering.
    if (!calls.length) {
      if (text) {
        // Truncation would mean a half-answered question, so surface it rather
        // than presenting a cut-off sentence as a complete reply.
        if (candidate?.finishReason === 'MAX_TOKENS') {
          return finish({ text, truncated: true });
        }
        return finish({ text });
      }
      // Empty response — usually a safety stop or token exhaustion.
      return finish({ error: `empty-response (${candidate?.finishReason ?? 'unknown'})` });
    }

    if (toolCalls.length + calls.length > MAX_TOOL_CALLS) {
      // Data has already been gathered; make it answer from that rather than
      // discarding the work.
      return forceAnswer('tool-budget');
    }

    // Keep the model's turn in the transcript before appending results.
    contents.push({ role: 'model', parts: candidate.content.parts });

    onStep?.({ label: describeStep(calls) });

    // Execute in parallel — two cities should cost one round trip, not two.
    const results = await Promise.all(
      calls.map(async (call) => {
        const signature = `${call.name}:${JSON.stringify(call.args ?? {})}`;
        if (executed.has(signature)) {
          return {
            call,
            result: {
              ok: false,
              grounding: { error: 'Already requested with these arguments; use the earlier result.' },
              blocks: [],
            },
          };
        }
        executed.add(signature);
        const result = await executeTool(call.name, call.args ?? {}, { lang, model });
        return { call, result };
      }),
    );

    const responseParts = [];
    for (const { call, result } of results) {
      toolCalls.push({ name: call.name, args: call.args ?? {}, ok: result.ok });
      if (result.blocks?.length) blocks.push(...result.blocks);
      if (result.place) resolvedPlace = result.place;
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: result.ok ? result.grounding : { error: result.grounding?.error ?? 'failed' },
        },
      });
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  // Loop cap reached with the model still asking for more data.
  return forceAnswer('iteration-cap');

  /**
   * Final pass with tool access withdrawn.
   *
   * Hitting a cap previously discarded the whole turn and fell back to the
   * deterministic path — throwing away real data already fetched and answering a
   * two-city comparison with a single city. Removing the tools leaves the model
   * no option but to answer from what it has, which is both more useful and more
   * honest: it can say a detail is missing while still using what it retrieved.
   */
  async function forceAnswer(reason) {
    if (!toolCalls.some((c) => c.ok)) return finish({ error: reason });

    const closing = {
      ...body,
      contents: [
        ...contents,
        {
          role: 'user',
          parts: [
            {
              text: 'Answer now using only the data already retrieved. Do not request anything further. If some part of the question cannot be answered from it, say so briefly.',
            },
          ],
        },
      ],
    };
    delete closing.tools;

    try {
      const { json } = await requestWithFallback(closing, Date.now() + REQUEST_TIMEOUT_MS);
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim();
      return text ? finish({ text }) : finish({ error: reason });
    } catch {
      return finish({ error: reason });
    }
  }

  function finish({ text = '', error, truncated = false } = {}) {
    return {
      ok: Boolean(text) && !error,
      truncated,
      text,
      blocks: dedupeBlocks(blocks),
      toolCalls,
      iterations: toolCalls.length ? Math.ceil(toolCalls.length / 2) : 0,
      model: usedModel,
      place: resolvedPlace,
      error,
    };
  }
}

/** Human-readable progress label, shown while the user waits. */
function describeStep(calls) {
  const verbs = {
    get_forecast: 'forecast',
    get_warnings: 'warnings',
    get_air_quality: 'air quality',
    get_climate_normals: 'climate records',
    get_sector_advisory: 'advisory',
    compare_forecast_models: 'model agreement',
  };
  const places = [...new Set(calls.map((c) => c.args?.location).filter(Boolean))];
  const what = [...new Set(calls.map((c) => verbs[c.name] ?? 'data'))].join(' and ');
  return places.length
    ? `Checking ${what} for ${places.join(' and ')}…`
    : `Checking ${what}…`;
}

/**
 * Two tool calls can legitimately produce the same card — for instance a
 * forecast lookup followed by a warnings lookup for the same city. Keep the
 * first of each kind per place so the transcript does not repeat itself.
 */
function dedupeBlocks(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    const key = `${block.type}:${block.place?.name ?? ''}:${block.compact ? 'c' : ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
