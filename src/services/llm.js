/**
 * Optional hosted-LLM adapter.
 *
 * WeatherGPT's default understanding engine is the deterministic parser in
 * `nlu.js` — it is instant, free, offline-capable and cannot hallucinate a
 * location, which matters when the output feeds warning dissemination.
 *
 * For genuinely open-ended questions ("compare this monsoon with 2019 and tell
 * me what it means for paddy transplanting") a hosted model adds real value.
 * This adapter lets one be plugged in without touching the rest of the app: it
 * asks the model to return the same structured shape `parseQuery` produces, so
 * the orchestrator is indifferent to which engine answered.
 *
 * Disabled unless configured. Set in `.env.local`:
 *
 *   VITE_LLM_ENDPOINT=https://api.openai.com/v1/chat/completions
 *   VITE_LLM_MODEL=gpt-4o-mini
 *   VITE_LLM_API_KEY=sk-...
 *
 * Note: a browser-side key is acceptable for a demo only. In deployment this
 * call belongs behind the FastAPI gateway described in the README, which holds
 * the credential and applies rate limiting.
 */

import { INTENTS } from './nlu.js';

const ENDPOINT = import.meta.env?.VITE_LLM_ENDPOINT ?? '';
const API_KEY = import.meta.env?.VITE_LLM_API_KEY ?? '';
const MODEL = import.meta.env?.VITE_LLM_MODEL ?? 'gpt-4o-mini';

export const isLlmConfigured = Boolean(ENDPOINT && API_KEY);

const SYSTEM_PROMPT = `You are the query-understanding component of a weather assistant for India.
Convert the user's question into JSON only, with no prose and no code fences:
{
  "intent": one of ${Object.values(INTENTS).map((i) => `"${i}"`).join(' | ')},
  "location": string | null,      // place name in English, null if not mentioned
  "sector": "agriculture" | "aviation" | "marine" | "urban" | null,
  "dayOffset": integer | null,    // 0 = today, 1 = tomorrow
  "horizonDays": integer | null,  // forecast length if asked
  "language": ISO 639-1 code of the user's language
}
Never invent a location that is not in the question.`;

/**
 * Ask the configured model to parse a query.
 * @returns {Promise<object|null>} parsed shape, or null when unavailable.
 */
export async function llmParse(text, { timeoutMs = 6000 } = {}) {
  if (!isLlmConfigured) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(stripFences(content));
    return {
      intent: parsed.intent,
      locationQuery: parsed.location ?? null,
      sector: parsed.sector ?? null,
      dayOffset: parsed.dayOffset ?? null,
      horizonDays: parsed.horizonDays ?? null,
      lang: parsed.language ?? 'en',
      engine: 'llm',
    };
  } catch {
    // Any failure (network, timeout, malformed JSON) falls back to the
    // deterministic parser — the assistant must never go silent.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripFences(s) {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}
