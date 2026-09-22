/**
 * Gemini provider.
 *
 * Owns the Google wire format and the quirks specific to this API; the agentic
 * loop that drives it lives in ./index.js and is provider-agnostic.
 *
 * Quirks encoded here, all found by measurement:
 *
 *  - `thinkingBudget: 0`. Gemini 2.5 Flash reasons internally by default and
 *    those tokens come out of the *same* budget as the reply. On a two-part
 *    question it spent 861 tokens thinking and left 35 for the answer, which
 *    returned truncated at `MAX_TOKENS` — silently dropping half the question.
 *    Disabling it fixed that and roughly halved latency.
 *
 *  - Model chain ordered by measured latency, not version. Identical requests
 *    took 1.0 s on gemini-3-flash-preview and 12.6 s on gemini-3.5-flash; with
 *    the slow one first, two round trips blew the budget.
 *
 *  - Free-tier quota is metered per model per day (20 requests, reported as
 *    `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Each model has its
 *    own bucket, so walking the chain multiplies capacity — and spent models are
 *    remembered so a reload does not re-pay a round trip rediscovering them.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

const API_KEY = import.meta.env?.VITE_GEMINI_API_KEY ?? '';
const CONFIGURED_MODEL = import.meta.env?.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash';

const MODEL_CHAIN = [
  ...new Set([
    CONFIGURED_MODEL,
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ]),
];

/* ------------------------------------------------------- daily quota memory -- */

const EXHAUSTED_KEY = 'weathergpt:gemini-exhausted';

function loadExhausted() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(EXHAUSTED_KEY) ?? '{}');
    if (raw.date === new Date().toISOString().slice(0, 10)) return new Set(raw.models ?? []);
  } catch {
    /* storage unavailable */
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
    /* rediscovered next reload */
  }
}

/** A per-day exhaustion, as opposed to a per-minute burst limit. */
function isDailyQuota(error) {
  return error?.status === 429 && /PerDay|RequestsPerDay/i.test(error.detail ?? error.message ?? '');
}

/** True when every model in the chain is spent for today. */
export function geminiExhausted() {
  return MODEL_CHAIN.every((m) => exhaustedToday.has(m));
}

/* ----------------------------------------------------------- wire encoding -- */

/** Neutral turn log → Gemini `contents`. */
function toContents(turns) {
  return turns.map((turn) => {
    if (turn.role === 'user') return { role: 'user', parts: [{ text: turn.text }] };

    if (turn.role === 'assistant') {
      const parts = [];
      if (turn.text) parts.push({ text: turn.text });
      for (const call of turn.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args ?? {} } });
      }
      return { role: 'model', parts };
    }

    // Tool results are sent back on the user turn in Gemini's protocol.
    return {
      role: 'user',
      parts: (turn.results ?? []).map((r) => ({
        functionResponse: { name: r.name, response: r.data },
      })),
    };
  });
}

async function post(model, body, signal) {
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
    error.detail = detail; // retained so the quota check can find `quotaId`
    throw error;
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTransient = (status) => status === 429 || status === 500 || status === 503;

/* ------------------------------------------------------------------ provider -- */

export const geminiProvider = {
  id: 'gemini',
  label: 'Gemini',
  get isConfigured() {
    return Boolean(API_KEY);
  },
  get isAvailable() {
    return Boolean(API_KEY) && !geminiExhausted();
  },

  /**
   * @param {Array} turns neutral conversation log
   * @param {object} options { system, tools, deadline, requestTimeoutMs }
   * @returns {Promise<{text: string, toolCalls: Array, finishReason: string, model: string}>}
   */
  async send(turns, { system, tools, deadline, requestTimeoutMs = 12_000 }) {
    const body = {
      contents: toContents(turns),
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        topP: 0.9,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    if (tools?.length) body.tools = [{ functionDeclarations: tools }];

    let lastError = null;

    for (const model of MODEL_CHAIN) {
      if (exhaustedToday.has(model)) continue;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (Date.now() > deadline) throw lastError ?? new Error('gemini deadline exceeded');

        const controller = new AbortController();
        const remaining = Math.max(1000, Math.min(requestTimeoutMs, deadline - Date.now()));
        const timer = setTimeout(() => controller.abort(), remaining);

        try {
          const json = await post(model, body, controller.signal);
          return { ...parse(json), model };
        } catch (error) {
          lastError = error;

          // Some models reject thinkingConfig; retry once without it rather than
          // discarding an otherwise usable model.
          if (error.status === 400 && /thinking/i.test(error.message)) {
            const retry = { ...body, generationConfig: { ...body.generationConfig } };
            delete retry.generationConfig.thinkingConfig;
            try {
              const json = await post(model, retry, controller.signal);
              return { ...parse(json), model };
            } catch (retryError) {
              lastError = retryError;
              break;
            }
          }

          if (isDailyQuota(error)) {
            rememberExhausted(model);
            break; // waiting cannot restore a daily allowance
          }
          if (error.status === 404) break; // no access to this model
          if (!isTransient(error.status) && error.name !== 'AbortError') throw error;
          if (attempt === 1 && Date.now() + 1500 < deadline) await sleep(1200);
        } finally {
          clearTimeout(timer);
        }
      }
    }

    throw lastError ?? new Error('gemini unreachable');
  },
};

function parse(json) {
  const candidate = json?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  return {
    text: parts
      .filter((p) => typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim(),
    toolCalls: parts
      .filter((p) => p.functionCall)
      .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} })),
    finishReason: candidate?.finishReason ?? 'UNKNOWN',
  };
}
