/**
 * Warning dissemination by SMS.
 *
 * The problem statement asks for flood and cyclone warning dissemination, and the
 * hard part of that is regulatory, not technical. Sending SMS *from* the platform
 * in India requires DLT registration under TRAI's rules: a registered sender
 * header and pre-approved templates, which rules out transmitting free-form
 * generated text. It also needs a backend holding the gateway credentials.
 *
 * This is the part that works today with no backend, no gateway and no
 * registration: compose the warning and hand it to the *user's own* SMS app,
 * pre-filled. They are the sender, so no DLT approval applies. It reaches a
 * feature phone with no data connection, which is precisely the audience a
 * flood warning most needs to arrive at.
 *
 * Message length is treated as a real constraint rather than an afterthought,
 * because a warning split across three segments can arrive out of order.
 */

import { conditionLabel } from '../data/wmo.js';
import { placeLabel } from '../utils/format.js';

/**
 * Characters encodable in GSM 03.38, the 7-bit alphabet SMS uses by default.
 *
 * This matters a great deal here: anything outside it forces the whole message to
 * UCS-2, which cuts a single segment from 160 characters to 70. A Hindi or
 * Bengali warning is therefore less than half the length of an English one, and
 * the composer has to know that.
 */
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

/** These cost two septets each in GSM-7. */
const GSM7_EXTENDED = '^{}\\[~]|€';

function isGsm7(text) {
  for (const char of text) {
    if (!GSM7_BASIC.includes(char) && !GSM7_EXTENDED.includes(char)) return false;
  }
  return true;
}

/**
 * How many SMS segments a message needs.
 *
 * @returns {{ encoding: 'GSM-7'|'UCS-2', length: number, segments: number, limit: number }}
 */
export function smsSegments(text) {
  const body = String(text ?? '');
  const gsm = isGsm7(body);

  // Extended characters occupy two positions in GSM-7.
  const length = gsm
    ? [...body].reduce((n, c) => n + (GSM7_EXTENDED.includes(c) ? 2 : 1), 0)
    : [...body].length;

  const single = gsm ? 160 : 70;
  const concatenated = gsm ? 153 : 67; // headers steal room once split
  const segments = length <= single ? 1 : Math.ceil(length / concatenated);

  return {
    encoding: gsm ? 'GSM-7' : 'UCS-2',
    length,
    segments,
    limit: segments === 1 ? single : concatenated * segments,
  };
}

/* ------------------------------------------------------------------ compose -- */

/** Short, localised level words. Kept terse because every character is budgeted. */
const LEVEL_WORD = {
  en: { red: 'RED', orange: 'ORANGE', yellow: 'YELLOW' },
  hi: { red: 'लाल', orange: 'नारंगी', yellow: 'पीला' },
  bn: { red: 'লাল', orange: 'কমলা', yellow: 'হলুদ' },
  mr: { red: 'लाल', orange: 'नारिंगी', yellow: 'पिवळा' },
  ta: { red: 'சிவப்பு', orange: 'ஆரஞ்சு', yellow: 'மஞ்சள்' },
  te: { red: 'ఎరుపు', orange: 'నారింజ', yellow: 'పసుపు' },
  hinglish: { red: 'RED', orange: 'ORANGE', yellow: 'YELLOW' },
};

const WHEN_WORD = {
  en: { today: 'today', tomorrow: 'tomorrow' },
  hi: { today: 'आज', tomorrow: 'कल' },
  bn: { today: 'আজ', tomorrow: 'আগামীকাল' },
  mr: { today: 'आज', tomorrow: 'उद्या' },
  ta: { today: 'இன்று', tomorrow: 'நாளை' },
  te: { today: 'ఈరోజు', tomorrow: 'రేపు' },
  hinglish: { today: 'aaj', tomorrow: 'kal' },
};

const word = (table, lang, key) => table[lang]?.[key] ?? table.en[key] ?? key;

/** The word "alert" itself, so a Hindi warning does not read "लाल ALERT". */
const ALERT_WORD = {
  en: 'ALERT',
  hi: 'चेतावनी',
  bn: 'সতর্কতা',
  mr: 'इशारा',
  ta: 'எச்சரிக்கை',
  te: 'హెచ్చరిక',
  gu: 'ચેતવણી',
  kn: 'ಎಚ್ಚರಿಕೆ',
  ml: 'മുന്നറിയിപ്പ്',
  pa: 'ਚੇਤਾਵਨੀ',
  hinglish: 'ALERT',
};

const NO_WARNING = {
  en: 'no active weather warnings',
  hi: 'कोई मौसम चेतावनी नहीं',
  bn: 'কোনো আবহাওয়া সতর্কতা নেই',
  mr: 'कोणतेही हवामान इशारे नाहीत',
  ta: 'வானிலை எச்சரிக்கை இல்லை',
  te: 'వాతావరణ హెచ్చరికలు లేవు',
  hinglish: 'koi mausam chetavni nahi',
};

/** Two segments is the practical ceiling; beyond that parts can arrive out of order. */
const TARGET_SEGMENTS = 2;

/**
 * Compose a forwardable warning, trimmed to fit.
 *
 * Built from a required core plus optional detail, then the optional parts are
 * shed until it fits two segments. This is not cosmetic: Indic scripts force
 * UCS-2 encoding, which allows 70 characters per segment against GSM-7's 160, so
 * the same warning in Tamil has less than half the room. A fixed template would
 * either waste English capacity or overflow in Hindi.
 *
 * Shedding order is deliberate — attribution first, then the measured trigger.
 * What is never dropped is the severity, the place, the hazard and the action,
 * because those four are the warning.
 */
export function composeWarningSms({ place, warnings, lang = 'en' }) {
  const label = placeLabel(place, lang);
  const top = warnings?.alerts?.[0];

  if (!top) {
    return `${label}: ${NO_WARNING[lang] ?? NO_WARNING.en} -WeatherGPT`;
  }

  const when = ['today', 'tomorrow'].includes(top.when)
    ? word(WHEN_WORD, lang, top.when)
    : (top.date ?? '');

  // Keep the first sentence of the action: it carries the instruction, the rest
  // elaborates. The Devanagari danda counts as a sentence end.
  const action = String(top.action ?? '')
    .split(/(?<=[.।])\s/)[0]
    .replace(/[.।]\s*$/, '');

  const core = [
    `${word(LEVEL_WORD, lang, top.level)} ${ALERT_WORD[lang] ?? ALERT_WORD.en}`,
    `${label} (${when})`,
    top.title,
    action,
  ];

  // Optional tail, dropped last-first until the message fits.
  const measurement = numericMetric(top.metric);
  const optional = [measurement ? `[${measurement}]` : '', '-WeatherGPT'].filter(Boolean);

  for (let drop = 0; drop <= optional.length; drop += 1) {
    const candidate = assemble([...core, ...optional.slice(0, optional.length - drop)]);
    if (smsSegments(candidate).segments <= TARGET_SEGMENTS) return candidate;
  }

  // Even the core exceeds the target: send it anyway rather than truncate a
  // safety instruction mid-word.
  return assemble(core);
}

function assemble(parts) {
  return parts
    .filter(Boolean)
    .join('. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reduce a warning's trigger to just the number and unit.
 *
 * The threshold engine phrases these in English — "gusts to 92 km/h", "140 mm in
 * 24 h" — which reads badly dropped into a Hindi message. A bare "92 km/h" is
 * script-neutral, understood across all ten languages, and shorter, which matters
 * when UCS-2 leaves only 70 characters per segment.
 *
 * Returns null for descriptive triggers with no measurement ("thunderstorm with
 * hail likely"), since translating those is not worth the characters — the hazard
 * name already says it.
 */
function numericMetric(metric) {
  const match = String(metric ?? '').match(/(\d+(?:\.\d+)?)\s*(mm|km\/h|°C|µg\/m³|m\b)/);
  if (!match) return null;
  return `${Math.round(Number(match[1]))} ${match[2]}`;
}

/** Compose a plain current-conditions message, for sharing a forecast. */
export function composeForecastSms({ place, forecast, lang = 'en' }) {
  const c = forecast?.current ?? {};
  const today = forecast?.daily?.[0] ?? {};
  const label = placeLabel(place, lang);

  return [
    `${label}: ${Math.round(c.temp)}C ${conditionLabel(c.code, lang)}`,
    today.tmax != null ? `max ${Math.round(today.tmax)}/min ${Math.round(today.tmin)}` : '',
    (today.rain ?? 0) >= 1 ? `rain ${Math.round(today.rain)}mm` : '',
    '-WeatherGPT',
  ]
    .filter(Boolean)
    .join(', ')
    .trim();
}

/* --------------------------------------------------------------------- link -- */

/**
 * Build an `sms:` URL that pre-fills the user's messaging app.
 *
 * `sms:?&body=` is the form that works across both iOS and Android; iOS ignores a
 * bare `?body=` and Android tolerates the stray ampersand. No recipient is set —
 * the user picks who needs to know, which is the whole point.
 */
export function smsHref(body, recipient = '') {
  return `sms:${recipient}?&body=${encodeURIComponent(body)}`;
}

/** Copy to clipboard, for desktop where no SMS app exists. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
