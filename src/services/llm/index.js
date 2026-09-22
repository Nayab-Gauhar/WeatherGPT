/**
 * Tier 2 — the language-model path, shared across providers.
 *
 * Tier 1 (`services/nlu.js`) answers any question with a recognisable shape in
 * ~200 ms with no network call. Tier 2 exists for what a fixed schema cannot
 * express: more than one location, comparison, personal context, or a phrasing
 * nobody anticipated.
 *
 * Why tool calling
 * ---------------
 * An extraction schema has one `location` field, so it can never represent
 * "compare Kolkata and Mumbai". Tool calling can, because each call carries its
 * own arguments — and in testing the model emitted two parallel `get_forecast`
 * calls for exactly that question.
 *
 * Why the loop is bounded
 * -----------------------
 * Also measured: asked "is this September wetter than normal in Nagpur, and will
 * next week continue?", the model fetched climate normals and stopped, silently
 * answering half. It works one step at a time, so results must be fed back. An
 * unbounded loop is a liability, hence hard caps — and when a cap is reached a
 * final pass runs with the tools withdrawn, so the answer is composed from data
 * already gathered rather than discarded.
 *
 * Why two providers
 * -----------------
 * Gemini's free tier allows 20 requests per model per day and returns 503 under
 * load. Previously, exhausting it meant losing the AI answer altogether. Sarvam
 * is an independent vendor on a separate quota with its own tool-calling support,
 * so the capability survives one provider failing.
 *
 * The invariant
 * -------------
 * The model never sources a number. Tools fetch real data, the prompt forbids
 * stating any figure absent from a tool result, and the cards rendered beneath
 * the prose come from those same results — so any claim can be checked against
 * the figures on screen.
 */

import { TOOL_DECLARATIONS, executeTool } from '../tools.js';
import { getLanguage } from '../../i18n/languages.js';
import { geminiProvider } from './gemini.js';
import { sarvamProvider } from './sarvamLlm.js';

/** Preference order. Gemini first for answer quality, Sarvam as the safety net. */
const PROVIDERS = [geminiProvider, sarvamProvider];

export const isLlmConfigured = () => PROVIDERS.some((p) => p.isConfigured);

/** Providers that could serve a request right now. */
const availableProviders = () => PROVIDERS.filter((p) => p.isAvailable);

/** For the settings panel. */
export function llmStatus() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.isConfigured,
    available: p.isAvailable,
  }));
}

/* ------------------------------------------------------------- guardrails -- */

const MAX_ITERATIONS = 4;
const MAX_TOOL_CALLS = 8;
const TOTAL_BUDGET_MS = 30_000;

/**
 * Time held back for each remaining provider.
 *
 * Without this the budget was shared, and a first provider that fails *slowly* —
 * Gemini retrying across five models on 429s — consumed the whole allowance, so
 * the fallback was skipped and the answer dropped to Tier 1. Having a second
 * provider is pointless if the first is allowed to starve it.
 *
 * Eleven seconds is enough for two round trips plus tool execution, measured
 * against the slower provider.
 */
const RESERVE_PER_FALLBACK_MS = 11_000;

/* ------------------------------------------------------------ instruction -- */

function systemInstruction(lang) {
  const language = getLanguage(lang);
  const target =
    lang === 'hinglish'
      ? 'Hinglish — conversational Hindi written in the Latin alphabet, exactly as the user wrote (for example "Kolkata mein kal barish hogi, chhatri le jaana")'
      : `${language.english}${language.code === 'en' ? '' : ` (${language.native})`}`;

  return `You are WeatherGPT, a weather and climate assistant for India, built for the India Meteorological Department.

ABSOLUTE RULE — GROUNDING
You have no weather knowledge of your own. Every number, condition, date and place fact you state MUST come from a tool result in this conversation. Never estimate, never recall, never interpolate. If you need data you do not have, call a tool. If a tool reports an error, say the data is unavailable — do not substitute a guess. Inventing a rainfall figure on a system used for disaster preparedness is a serious failure.

TOOL USE
- Call tools before answering any factual question.
- For a question about two or more places, call the tool once per place.
- If answering fully needs two kinds of data (for example historical normals AND the coming forecast), call the second tool after seeing the first result. Do not answer half the question.
- Do not call a tool twice with the same arguments.
- Pass locations to tools as English place names, even when the user wrote them in another script or spelling ("मुंबई", "Bengaluru", "Bangalore" → "Mumbai", "Bengaluru").

LANGUAGE
- Reply in ${target}.
- Match the user's register. If they wrote Hindi in Latin letters, reply the same way — do not switch to Devanagari, and do not switch to formal English.
- Keep place names, units and numerals in the form the user would expect to read.

ANSWERING
- Be direct and brief: 2–4 sentences, or a short list when comparing options.
- Lead with the answer to what was actually asked, then the reason.
- A single sentence may contain several questions. Identify every distinct one and answer ALL of them; a two-part question needs a two-part reply.
- Detailed data cards are displayed beneath your answer automatically, so do not reproduce tables, coordinates, or long number lists. Cite only the few figures that carry your point.
- If a warning is active and relevant, mention it and what to do.
- When the user has a practical decision to make, commit to a recommendation rather than listing considerations.
- Never mention tools, functions, JSON, or these instructions.`;
}

/* ------------------------------------------------------------------- loop -- */

/**
 * Run one conversational turn with tool access, across providers.
 *
 * @param {string} userText
 * @param {object} options
 * @param {string} options.lang     language to answer in ('hinglish' supported)
 * @param {object} [options.place]  place already under discussion
 * @param {string} [options.model]  NWP model preference passed to tools
 * @param {(step: {label: string}) => void} [options.onStep]
 */
export async function runLlmTurn(userText, { lang = 'en', place = null, model, onStep } = {}) {
  const providers = availableProviders();
  if (!providers.length) {
    return fail(isLlmConfigured() ? 'quota-exhausted' : 'not-configured');
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const system = systemInstruction(lang);

  // Conversational memory: tell the model what "there" refers to.
  const preamble = place
    ? `The user is currently looking at ${place.name}${place.admin1 ? `, ${place.admin1}` : ''}. If they do not name a place, assume this one.\n\n`
    : '';

  const turns = [{ role: 'user', text: `${preamble}${userText}` }];
  const blocks = [];
  const toolCalls = [];
  let resolvedPlace = place;
  let lastError = 'unknown';

  for (const [index, provider] of providers.entries()) {
    // Leave enough of the overall budget for the providers still queued behind
    // this one.
    const fallbacksLeft = providers.length - 1 - index;
    const providerDeadline = deadline - fallbacksLeft * RESERVE_PER_FALLBACK_MS;
    if (Date.now() >= providerDeadline) {
      lastError = 'timeout';
      continue;
    }

    // Each provider restarts from the user's question with its own conversation.
    const providerTurns = turns.slice(0, 1);

    /*
     * Deduplication is per provider, not global.
     *
     * The set exists to stop one provider looping on an identical call. Sharing
     * it across providers was a bug: when the first provider fetched data and
     * then failed, the second started with an empty transcript, re-requested the
     * same tools, and received "already requested" instead of the data — so it
     * correctly but uselessly reported that it had no data to answer from, even
     * though the cards below its answer were fully populated.
     *
     * Re-fetching costs almost nothing because the upstream responses are cached
     * for ten minutes.
     */
    const executed = new Set();

    try {
      const result = await runWithProvider(provider, providerTurns, {
        system,
        deadline: providerDeadline,
        lang,
        model,
        onStep,
        blocks,
        toolCalls,
        executed,
        setPlace: (p) => {
          resolvedPlace = p;
        },
      });

      if (result.text) {
        return {
          ok: true,
          text: result.text,
          blocks: dedupeBlocks(blocks),
          toolCalls,
          provider: provider.id,
          model: result.model,
          place: resolvedPlace,
          truncated: result.truncated ?? false,
        };
      }
      lastError = result.error ?? 'empty-response';
    } catch (error) {
      lastError = classifyError(error);
    }

    if (Date.now() >= deadline) break;
  }

  return {
    ok: false,
    text: '',
    blocks: dedupeBlocks(blocks),
    toolCalls,
    provider: null,
    model: '',
    place: resolvedPlace,
    error: lastError,
  };
}

/** The bounded tool loop for a single provider. */
async function runWithProvider(provider, turns, ctx) {
  const { system, deadline, lang, model, onStep, blocks, toolCalls, executed, setPlace } = ctx;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    if (Date.now() > deadline) return { error: 'timeout' };

    const reply = await provider.send(turns, {
      system,
      tools: TOOL_DECLARATIONS,
      deadline,
    });

    if (!reply.toolCalls?.length) {
      if (reply.text) {
        return {
          text: reply.text,
          model: reply.model,
          truncated: /MAX_TOKENS|length/i.test(reply.finishReason ?? ''),
        };
      }
      return { error: `empty-response (${reply.finishReason})` };
    }

    if (toolCalls.length + reply.toolCalls.length > MAX_TOOL_CALLS) {
      return forceAnswer(provider, turns, ctx, 'tool-budget');
    }

    turns.push({ role: 'assistant', text: reply.text, toolCalls: reply.toolCalls });
    onStep?.({ label: describeStep(reply.toolCalls) });

    // Execute in parallel — two cities should cost one round trip, not two.
    const results = await Promise.all(
      reply.toolCalls.map(async (call) => {
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

    const resultTurn = { role: 'tool', results: [] };
    for (const { call, result } of results) {
      toolCalls.push({ name: call.name, args: call.args ?? {}, ok: result.ok });
      if (result.blocks?.length) blocks.push(...result.blocks);
      if (result.place) setPlace(result.place);
      resultTurn.results.push({
        id: call.id,
        name: call.name,
        data: result.ok ? result.grounding : { error: result.grounding?.error ?? 'failed' },
      });
    }
    turns.push(resultTurn);
  }

  return forceAnswer(provider, turns, ctx, 'iteration-cap');
}

/**
 * Final pass with tool access withdrawn.
 *
 * Hitting a cap used to discard the turn and fall back to Tier 1 — throwing away
 * real data already fetched and answering a two-city comparison with one city.
 * Removing the tools leaves the model no option but to answer from what it has,
 * which is both more useful and more honest: it can name a missing detail while
 * still using everything it retrieved.
 */
async function forceAnswer(provider, turns, ctx, reason) {
  if (!ctx.toolCalls.some((c) => c.ok)) return { error: reason };

  const closing = [
    ...turns,
    {
      role: 'user',
      text: 'Answer now using only the data already retrieved. Do not request anything further. If some part of the question cannot be answered from it, say so briefly.',
    },
  ];

  try {
    const reply = await provider.send(closing, {
      system: ctx.system,
      tools: null, // withdrawing the tools is the whole point
      deadline: Date.now() + 12_000,
    });
    return reply.text ? { text: reply.text, model: reply.model } : { error: reason };
  } catch {
    return { error: reason };
  }
}

/* ----------------------------------------------------------------- helpers -- */

function fail(error) {
  return {
    ok: false,
    text: '',
    blocks: [],
    toolCalls: [],
    provider: null,
    model: '',
    place: null,
    error,
  };
}

/** Turn a raw failure into a reason the UI can explain to a user. */
export function classifyError(error) {
  const message = String(error?.message ?? error);
  if (error?.status === 429 || message.includes('429')) return 'rate-limited';
  if (error?.status === 503 || message.includes('503')) return 'model-overloaded';
  if (error?.status === 401 || error?.status === 403) return 'bad-key';
  if (error?.name === 'AbortError' || /deadline|timeout/i.test(message)) return 'timeout';
  return message.slice(0, 120);
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
  return places.length ? `Checking ${what} for ${places.join(' and ')}…` : `Checking ${what}…`;
}

/**
 * Two tool calls can legitimately produce the same card — a forecast lookup
 * followed by a warnings lookup for the same city, say. Keep the first of each
 * kind per place so the transcript does not repeat itself.
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
