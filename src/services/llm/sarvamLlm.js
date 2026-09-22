/**
 * Sarvam provider — the second, independent language model.
 *
 * Its purpose is resilience. Gemini's free tier allows 20 requests per model per
 * day and returns 503 under load, and when the whole chain was spent the AI
 * answer used to be lost entirely. A second vendor on a separate quota removes
 * that single point of failure.
 *
 * It earns its place on merit too: `sarvam-105b` is trained on Indian languages,
 * supports tool calling in the OpenAI format, answered in ~1.6 s in testing, and
 * understood Hinglish ("Kolkata ka mausam kaisa hai?") without special handling
 * — which is precisely the register this product's users type in.
 *
 * One operational note: it is a reasoning model, so `max_tokens` must be
 * generous. With a small budget it spends the allowance on `reasoning_content`
 * and returns `content: null` with `finish_reason: "length"`.
 */

const API_URL = 'https://api.sarvam.ai/v1/chat/completions';
const API_KEY = import.meta.env?.VITE_SARVAM_API_KEY ?? '';

const MODEL_CHAIN = ['sarvam-105b', 'sarvam-105b-conversations'];

/* ----------------------------------------------------------- wire encoding -- */

/** Gemini-style declarations → OpenAI `tools`. */
function toOpenAiTools(declarations) {
  return declarations.map((d) => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
}

/** Neutral turn log → OpenAI `messages`. */
function toMessages(turns, system) {
  const messages = [{ role: 'system', content: system }];

  for (const turn of turns) {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text });
      continue;
    }

    if (turn.role === 'assistant') {
      const message = { role: 'assistant', content: turn.text || null };
      if (turn.toolCalls?.length) {
        message.tool_calls = turn.toolCalls.map((call, i) => ({
          id: call.id ?? `call_${i}`,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
        }));
      }
      messages.push(message);
      continue;
    }

    // The OpenAI protocol wants one `tool` message per call id, unlike Gemini
    // which batches all results into a single turn.
    for (const result of turn.results ?? []) {
      messages.push({
        role: 'tool',
        tool_call_id: result.id ?? `call_0`,
        name: result.name,
        content: JSON.stringify(result.data),
      });
    }
  }

  return messages;
}

const isTransient = (status) => status === 429 || status === 500 || status === 502 || status === 503;

/* ------------------------------------------------------------------ provider -- */

export const sarvamProvider = {
  id: 'sarvam',
  label: 'Sarvam',
  get isConfigured() {
    return Boolean(API_KEY);
  },
  get isAvailable() {
    return Boolean(API_KEY);
  },

  async send(turns, { system, tools, deadline, requestTimeoutMs = 14_000 }) {
    const body = {
      messages: toMessages(turns, system),
      temperature: 0.3,
      // Deliberately large: this is a reasoning model and a tight budget is
      // consumed by internal reasoning, yielding a null answer.
      max_tokens: 1600,
    };
    if (tools?.length) body.tools = toOpenAiTools(tools);

    let lastError = null;

    for (const model of MODEL_CHAIN) {
      if (Date.now() > deadline) break;

      const controller = new AbortController();
      const remaining = Math.max(1000, Math.min(requestTimeoutMs, deadline - Date.now()));
      const timer = setTimeout(() => controller.abort(), remaining);

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, model }),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          const error = new Error(`Sarvam ${res.status}: ${detail.slice(0, 200)}`);
          error.status = res.status;
          throw error;
        }

        const json = await res.json();
        return { ...parse(json), model };
      } catch (error) {
        lastError = error;
        if (!isTransient(error.status) && error.status !== 400 && error.name !== 'AbortError') {
          throw error;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('sarvam unreachable');
  },
};

function parse(json) {
  const choice = json?.choices?.[0] ?? {};
  const message = choice.message ?? {};
  return {
    text: (message.content ?? '').trim(),
    toolCalls: (message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function?.name,
      args: safeJson(call.function?.arguments),
    })),
    finishReason: choice.finish_reason ?? 'unknown',
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text ?? '{}');
  } catch {
    return {};
  }
}
