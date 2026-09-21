/**
 * Conversation orchestrator.
 *
 * Pipeline for every user turn:
 *
 *   text ──▶ parseQuery (nlu)          structured intent + entities
 *        ──▶ resolvePlace              gazetteer → geocoder → conversation memory
 *        ──▶ fetch* (openMeteo)        only the datasets the intent needs
 *        ──▶ deriveAlerts / advisory   impact interpretation
 *        ──▶ buildMessage              text + typed blocks + follow-up chips
 *
 * The returned message is pure data; rendering is entirely the UI's business.
 * `context` carries conversational memory (last place, last intent) so
 * follow-ups like "will it rain tomorrow?" resolve without repeating the city.
 */

import { parseQuery, INTENTS } from './nlu.js';
import {
  geocode,
  fetchForecast,
  fetchAirQuality,
  fetchClimateTrend,
  fetchModelComparison,
} from './openMeteo.js';
import { deriveAlerts } from './alerts.js';
import { generalAdvisory, sectorAdvisory, speechSummary } from './advisory.js';
import { conditionLabel } from '../data/wmo.js';
import { tpl, t, word } from '../i18n/index.js';
import { chipLabel } from '../i18n/chips.js';
import { placeLabel, placeName, round } from '../utils/format.js';

let seq = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

/* -------------------------------------------------------- place resolution -- */

/**
 * Resolve the location for a turn.
 * Order: entity matched in the gazetteer → free-text geocode → the place the
 * conversation is already about.
 */
async function resolvePlace(parsed, context) {
  if (parsed.place) return { place: parsed.place, resolvedBy: 'gazetteer' };

  if (parsed.locationQuery) {
    try {
      const results = await geocode(parsed.locationQuery, parsed.lang === 'en' ? 'en' : parsed.lang);
      if (results.length) {
        // Prefer an exact name match, then Indian results, then the largest place.
        const wanted = parsed.locationQuery.toLowerCase();
        const exact = results.filter((r) => r.name.toLowerCase() === wanted);
        const pool = exact.length ? exact : results;
        const indian = pool.filter((r) => r.countryCode === 'IN');
        const ranked = (indian.length ? indian : pool).sort(
          (a, b) => (b.population ?? 0) - (a.population ?? 0),
        );
        return { place: ranked[0], resolvedBy: 'geocoder' };
      }
    } catch {
      // fall through to context / not-found handling
    }
    if (context.place) return { place: context.place, resolvedBy: 'context', unresolvedQuery: parsed.locationQuery };
    return { place: null, resolvedBy: 'none', unresolvedQuery: parsed.locationQuery };
  }

  if (context.place) return { place: context.place, resolvedBy: 'context' };
  return { place: null, resolvedBy: 'none' };
}

/* ------------------------------------------------------------ chip builders -- */

function currentChips(place, lang) {
  // Labels are localised for reading; queries stay in canonical English so the
  // parser resolves them identically whatever the interface language.
  const shown = placeName(place, lang);
  return [
    { label: chipLabel('forecast7', lang), query: `7 day forecast for ${place.name}` },
    { label: chipLabel('rainTomorrow', lang), query: `will it rain tomorrow in ${place.name}` },
    { label: chipLabel('aqi', lang, shown), query: `air quality in ${place.name}` },
  ];
}

function forecastChips(place, lang) {
  return [
    { label: chipLabel('warnings', lang), query: `weather warnings for ${place.name}` },
    { label: chipLabel('models', lang), query: `compare forecast models for ${place.name}` },
    { label: chipLabel('agri', lang), query: `crop advisory for farmers in ${place.name}` },
  ];
}

function alertChips(place, lang) {
  return [
    { label: chipLabel('forecast7', lang), query: `7 day forecast for ${place.name}` },
    { label: chipLabel('urban', lang), query: `urban flooding risk in ${place.name}` },
    { label: chipLabel('marine', lang), query: `fishing conditions near ${place.name}` },
  ];
}

function genericChips(place, lang) {
  return [
    { label: chipLabel('currentAgain', lang, placeName(place, lang)), query: `current weather in ${place.name}` },
    { label: chipLabel('forecast7', lang), query: `7 day forecast for ${place.name}` },
    { label: chipLabel('climate', lang), query: `climate trend for ${place.name}` },
  ];
}

/* ------------------------------------------------------------ turn handlers -- */

async function handleCurrent(parsed, place, lang) {
  const [forecast, air] = await Promise.all([
    fetchForecast({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
      model: parsed.model ?? 'best_match',
    }),
    fetchAirQuality({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
    }).catch(() => null),
  ]);

  const label = placeLabel(place, lang);
  const shown = placeName(place, lang);
  const warnings = deriveAlerts(forecast, { lang, air });
  const advisory = generalAdvisory(forecast, shown, lang);

  const blocks = [
    { type: 'current', place, forecast, air },
    { type: 'hourly', forecast, hours: 24 },
    { type: 'advisory', advisory },
  ];

  // Surface active warnings inline — this is the disaster-preparedness path.
  if (warnings.count > 0) {
    blocks.push({ type: 'alerts', warnings, place, compact: true });
  }

  return {
    text: tpl('currentIntro', lang, label),
    blocks,
    chips: currentChips(place, lang),
    speech: speechSummary(forecast, shown, lang),
    forecast,
    air,
    warnings,
  };
}

async function handleForecast(parsed, place, lang) {
  const days = parsed.horizonDays ?? 7;
  const forecast = await fetchForecast({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
    model: parsed.model ?? 'best_match',
    days: Math.min(Math.max(days, 2), 16),
  });

  const label = placeLabel(place, lang);
  const shown = placeName(place, lang);

  // "What about Thursday?" — a specific day was asked for.
  if (parsed.dayOffset != null && parsed.dayOffset > 0 && !parsed.horizonDays) {
    const day = forecast.daily[Math.min(parsed.dayOffset, forecast.daily.length - 1)];
    const dayName =
      parsed.dayOffset === 1 ? word('tomorrowWord', lang) : day?.date ?? '';
    return {
      text: tpl('dayIntro', lang, label, dayName),
      blocks: [
        { type: 'daySummary', place, day, forecast, dayIndex: parsed.dayOffset, lang },
        { type: 'daily', forecast, place, highlight: parsed.dayOffset },
      ],
      chips: forecastChips(place, lang),
      speech: `${shown}, ${dayName}: ${conditionLabel(day?.code, lang)}, ${Math.round(day?.tmax)} degrees.`,
      forecast,
    };
  }

  return {
    text: tpl('forecastIntro', lang, label, forecast.daily.length),
    blocks: [{ type: 'daily', forecast, place }],
    chips: forecastChips(place, lang),
    speech: `${shown}: ${forecast.daily.length} day outlook. ${conditionLabel(forecast.daily[0]?.code, lang)} today, ${Math.round(forecast.daily[0]?.tmax)} degrees.`,
    forecast,
  };
}

async function handleRain(parsed, place, lang) {
  const forecast = await fetchForecast({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
    model: parsed.model ?? 'best_match',
  });

  const offset = parsed.dayOffset ?? 0;
  const day = forecast.daily[Math.min(offset, forecast.daily.length - 1)];
  const whenWord =
    offset === 0 ? word('next24', lang) : offset === 1 ? word('tomorrowWord', lang) : day?.date ?? '';

  const mm = round(day?.rain ?? 0, 1);
  const willRain = (day?.rain ?? 0) >= 0.5 || (day?.pop ?? 0) >= 40;

  const shown = placeName(place, lang);
  const text = willRain
    ? tpl('rainYes', lang, shown, whenWord, mm)
    : tpl('rainNo', lang, shown, whenWord);

  return {
    text,
    blocks: [
      { type: 'rain', place, forecast, dayIndex: offset, willRain },
      { type: 'hourly', forecast, hours: 24, startAtDay: offset },
    ],
    chips: [
      { label: chipLabel('forecast7', lang), query: `7 day forecast for ${place.name}` },
      { label: chipLabel('warnings', lang), query: `weather warnings for ${place.name}` },
      { label: chipLabel('agri', lang), query: `crop advisory for farmers in ${place.name}` },
    ],
    speech: text,
    forecast,
  };
}

async function handleAlerts(parsed, place, lang) {
  const [forecast, air] = await Promise.all([
    fetchForecast({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
    }),
    fetchAirQuality({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
    }).catch(() => null),
  ]);

  const warnings = deriveAlerts(forecast, { lang, air });
  const label = placeLabel(place, lang);
  const shown = placeName(place, lang);

  return {
    text:
      warnings.count > 0
        ? tpl('alertsIntro', lang, label, warnings.count)
        : tpl('alertsNone', lang, label),
    blocks: [{ type: 'alerts', warnings, place, forecast }],
    chips: alertChips(place, lang),
    speech:
      warnings.count > 0
        ? `${warnings.count} warnings for ${shown}. ${warnings.alerts.map((a) => a.title).join(', ')}.`
        : tpl('alertsNone', lang, shown),
    forecast,
    air,
    warnings,
  };
}

async function handleAqi(parsed, place, lang) {
  const air = await fetchAirQuality({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
  });

  return {
    text: tpl('aqiIntro', lang, placeLabel(place, lang)),
    blocks: [{ type: 'aqi', air, place }],
    chips: [
      { label: chipLabel('currentAgain', lang, placeName(place, lang)), query: `current weather in ${place.name}` },
      { label: chipLabel('urban', lang), query: `urban advisory for ${place.name}` },
      { label: chipLabel('forecast7', lang), query: `7 day forecast for ${place.name}` },
    ],
    speech: `${placeName(place, lang)} air quality index is ${Math.round(air.aqi ?? 0)}.`,
    air,
  };
}

async function handleClimate(parsed, place, lang) {
  const climate = await fetchClimateTrend({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
    years: 15,
  });

  const years = climate.toYear - climate.fromYear + 1;
  return {
    text: tpl('climateIntro', lang, placeLabel(place, lang), years),
    blocks: [{ type: 'climate', climate, place }],
    chips: genericChips(place, lang),
    speech: `${placeName(place, lang)}: ${climate.monthName} mean temperature is changing by ${climate.tempTrendPerDecade} degrees per decade.`,
    climate,
  };
}

async function handleModels(parsed, place, lang) {
  const comparison = await fetchModelComparison({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
  });

  return {
    text: tpl('modelIntro', lang, placeLabel(place, lang)),
    blocks: [{ type: 'models', comparison, place }],
    chips: forecastChips(place, lang),
    speech: `Model agreement for ${placeName(place, lang)} is ${comparison.confidence}, average spread ${comparison.meanSpread} degrees.`,
    comparison,
  };
}

async function handleAdvisory(parsed, place, lang) {
  const sector = parsed.sector ?? 'agriculture';
  const [forecast, air] = await Promise.all([
    fetchForecast({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
      days: 7,
    }),
    sector === 'urban'
      ? fetchAirQuality({
          latitude: place.latitude,
          longitude: place.longitude,
          timezone: place.timezone ?? 'auto',
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const advisory = sectorAdvisory(sector, forecast, place, { lang, air });
  const warnings = deriveAlerts(forecast, { lang, air });

  const blocks = [{ type: 'sector', advisory, place, forecast }];
  if (warnings.count > 0) blocks.push({ type: 'alerts', warnings, place, compact: true });

  return {
    text: tpl('advisoryIntro', lang, placeLabel(place, lang), t(sector, lang).toLowerCase()),
    blocks,
    chips: [
      { label: chipLabel('forecast7', lang), query: `7 day forecast for ${place.name}` },
      { label: chipLabel('warnings', lang), query: `weather warnings for ${place.name}` },
      { label: chipLabel('currentAgain', lang, placeName(place, lang)), query: `current weather in ${place.name}` },
    ],
    speech: `${advisory.title} for ${placeName(place, lang)}. ${advisory.headline}`,
    forecast,
    air,
    warnings,
  };
}

const HANDLERS = {
  [INTENTS.CURRENT]: handleCurrent,
  [INTENTS.FORECAST]: handleForecast,
  [INTENTS.RAIN]: handleRain,
  [INTENTS.ALERTS]: handleAlerts,
  [INTENTS.AQI]: handleAqi,
  [INTENTS.CLIMATE]: handleClimate,
  [INTENTS.MODELS]: handleModels,
  [INTENTS.ADVISORY]: handleAdvisory,
};

/* ------------------------------------------------------------------ public -- */

/**
 * Handle one user turn.
 *
 * @param {string} text        raw user input
 * @param {object} options     { lang, context }
 * @returns {Promise<{ message: object, context: object }>}
 */
export async function respond(text, { lang = 'en', context = {} } = {}) {
  const started = performance.now();
  const parsed = parseQuery(text, { lang, context });
  const replyLang = parsed.lang;

  const base = {
    id: nextId('a'),
    role: 'assistant',
    lang: replyLang,
    createdAt: new Date().toISOString(),
  };

  // Conversational intents need no data fetch.
  if (parsed.intent === INTENTS.GREETING || parsed.intent === INTENTS.HELP) {
    const greeting = tpl('greeting', replyLang);
    return {
      message: {
        ...base,
        text: greeting,
        blocks: [{ type: 'capabilities', lang: replyLang }],
        chips: [],
        speech: greeting,
        meta: { intent: parsed.intent, confidence: parsed.confidence, latencyMs: Math.round(performance.now() - started) },
      },
      context: { ...context, lang: replyLang },
    };
  }

  const { place, resolvedBy, unresolvedQuery } = await resolvePlace(parsed, context);

  if (!place) {
    const text2 = unresolvedQuery ? tpl('notFound', replyLang, unresolvedQuery) : tpl('fallback', replyLang);
    return {
      message: {
        ...base,
        text: text2,
        blocks: [{ type: 'capabilities', lang: replyLang }],
        chips: [],
        speech: text2,
        meta: { intent: parsed.intent, confidence: parsed.confidence, latencyMs: Math.round(performance.now() - started) },
      },
      context: { ...context, lang: replyLang },
    };
  }

  const handler = HANDLERS[parsed.intent] ?? handleCurrent;

  try {
    const result = await handler(parsed, place, replyLang);
    const latencyMs = Math.round(performance.now() - started);

    return {
      message: {
        ...base,
        text: result.text,
        blocks: result.blocks,
        chips: result.chips ?? [],
        speech: result.speech,
        place,
        meta: {
          intent: parsed.intent,
          sector: parsed.sector ?? null,
          confidence: parsed.confidence,
          resolvedBy,
          model: parsed.model ?? 'best_match',
          latencyMs,
          sources: sourcesFor(parsed.intent),
        },
      },
      context: {
        ...context,
        lang: replyLang,
        place,
        lastIntent: parsed.intent,
        forecast: result.forecast ?? context.forecast,
        air: result.air ?? context.air,
        warnings: result.warnings ?? context.warnings,
      },
    };
  } catch (error) {
    const text3 = tpl('error', replyLang);
    return {
      message: {
        ...base,
        text: text3,
        blocks: [],
        chips: [{ label: t('retry', replyLang), query: text }],
        speech: text3,
        error: String(error?.message ?? error),
        meta: { intent: parsed.intent, confidence: parsed.confidence, latencyMs: Math.round(performance.now() - started) },
      },
      context: { ...context, lang: replyLang, place },
    };
  }
}

function sourcesFor(intent) {
  switch (intent) {
    case INTENTS.CLIMATE:
      return ['ERA5 reanalysis (Copernicus/ECMWF)'];
    case INTENTS.AQI:
      return ['CAMS global air quality'];
    case INTENTS.MODELS:
      return ['NOAA GFS', 'ECMWF IFS', 'DWD ICON'];
    default:
      return ['Multi-model NWP blend', 'Surface observations'];
  }
}

/** The opening message shown before the user has asked anything. */
export function welcomeMessage(lang = 'en') {
  return {
    id: nextId('w'),
    role: 'assistant',
    lang,
    createdAt: new Date().toISOString(),
    text: tpl('greeting', lang),
    blocks: [{ type: 'capabilities', lang }],
    chips: [],
    isWelcome: true,
  };
}

export function userMessage(text, { lang = 'en', display } = {}) {
  return {
    id: nextId('u'),
    role: 'user',
    lang,
    text: display ?? text,
    query: text,
    createdAt: new Date().toISOString(),
  };
}
