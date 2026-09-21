/**
 * Tool layer — the bridge between the language model and real meteorology.
 *
 * Every tool does two jobs at once:
 *
 *   1. returns a compact `grounding` object, which is the ONLY source of facts
 *      the model is allowed to speak from;
 *   2. returns `blocks`, the same typed cards the deterministic path renders.
 *
 * That second job is what keeps the feature trustworthy. When the model answers
 * "Mumbai is the drier choice", the actual forecast cards for both cities are
 * rendered underneath, so the reader can check the claim against the numbers
 * rather than taking it on faith.
 *
 * Grounding payloads are deliberately small. A raw 7-day bundle carries 168
 * hourly records; sending that for every tool call would cost tokens and
 * latency while burying the few figures that matter.
 */

import {
  fetchForecast,
  fetchAirQuality,
  fetchClimateTrend,
  fetchModelComparison,
  fetchMonthToDate,
} from './openMeteo.js';
import { deriveAlerts } from './alerts.js';
import { generalAdvisory, sectorAdvisory } from './advisory.js';
import { conditionLabel } from '../data/wmo.js';
import { resolveByName } from './geo.js';
import { aqiBand, placeLabel, weekdayLabel } from '../utils/format.js';

/* --------------------------------------------------------- declarations --- */

const LOCATION_PARAM = {
  type: 'string',
  description:
    'Place name in English, e.g. "Kolkata", "Nagpur", "Kutch". Must come from the user question — never invent one.',
};

/**
 * Gemini function declarations. Descriptions are written for the model, not for
 * developers: they state when to reach for each tool, because that choice is
 * the model's main decision.
 */
export const TOOL_DECLARATIONS = [
  {
    name: 'get_forecast',
    description:
      'Current observed weather plus the daily forecast for one location. Use for anything about present conditions, temperature, rain, wind, or what the weather will be on a coming day. For two places, call this twice.',
    parameters: {
      type: 'object',
      properties: {
        location: LOCATION_PARAM,
        days: {
          type: 'integer',
          description: 'Forecast length in days, 1–16. Default 7.',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_warnings',
    description:
      'Active colour-coded weather warnings (heavy rain, heat wave, cold wave, squall, fog, thunderstorm) for one location. Use when asked about danger, safety, cyclones, floods, or alerts.',
    parameters: {
      type: 'object',
      properties: { location: LOCATION_PARAM },
      required: ['location'],
    },
  },
  {
    name: 'get_air_quality',
    description:
      'Current air quality index and pollutant breakdown. Use for pollution, smog, breathing, asthma, or whether outdoor exercise is advisable.',
    parameters: {
      type: 'object',
      properties: { location: LOCATION_PARAM },
      required: ['location'],
    },
  },
  {
    name: 'get_climate_normals',
    description:
      'Historical climate for the current calendar month across recent years, with per-decade trends, from the ERA5 reanalysis. Use to compare present weather against what is normal, or for questions about long-term change.',
    parameters: {
      type: 'object',
      properties: {
        location: LOCATION_PARAM,
        years: { type: 'integer', description: 'How many past years to analyse, 5–30. Default 15.' },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_sector_advisory',
    description:
      'Structured decision support for a specific sector. Use when the user has a practical occupational decision to make — sowing or spraying a crop, flying, fishing, or managing a city.',
    parameters: {
      type: 'object',
      properties: {
        location: LOCATION_PARAM,
        sector: {
          type: 'string',
          enum: ['agriculture', 'aviation', 'marine', 'urban'],
          description: 'Which sector the advice is for.',
        },
      },
      required: ['location', 'sector'],
    },
  },
  {
    name: 'compare_forecast_models',
    description:
      'Compare GFS, ECMWF and ICON predictions to gauge forecast confidence. Use when asked how reliable or certain a forecast is.',
    parameters: {
      type: 'object',
      properties: { location: LOCATION_PARAM },
      required: ['location'],
    },
  },
];

export const TOOL_NAMES = TOOL_DECLARATIONS.map((t) => t.name);

/* ------------------------------------------------------------- executors --- */

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Compact daily rows — the shape the model reasons over. */
function dailyRows(forecast, lang, limit) {
  return (forecast.daily ?? []).slice(0, limit).map((d) => ({
    date: d.date,
    weekday: weekdayLabel(d.date, 'en'),
    condition: conditionLabel(d.code, lang === 'en' ? 'en' : 'en'),
    max_c: round(d.tmax),
    min_c: round(d.tmin),
    rain_mm: round(d.rain),
    rain_chance_pct: d.pop == null ? null : Math.round(d.pop),
    wind_max_kmh: round(d.windMax),
    gust_max_kmh: round(d.gustMax),
  }));
}

async function forecastTool(args, ctx) {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 16);
  const { place } = ctx;

  const [forecast, air] = await Promise.all([
    fetchForecast({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
      model: ctx.model ?? 'best_match',
      days,
    }),
    fetchAirQuality({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
    }).catch(() => null),
  ]);

  const c = forecast.current;
  const start = forecast.hourlyIndexNow ?? 0;
  const next24 = forecast.hourly.slice(start, start + 24);
  const warnings = deriveAlerts(forecast, { lang: ctx.lang, air });
  const advisory = generalAdvisory(forecast, place.name, ctx.lang);

  const grounding = {
    place: placeLabel(place, 'en'),
    coordinates: { lat: round(place.latitude, 2), lon: round(place.longitude, 2) },
    local_observation_time: c.time,
    current: {
      temp_c: round(c.temp),
      feels_like_c: round(c.feelsLike),
      condition: conditionLabel(c.code, 'en'),
      humidity_pct: c.humidity == null ? null : Math.round(c.humidity),
      wind_kmh: round(c.windSpeed),
      wind_direction: c.windCompass,
      pressure_hpa: c.pressure,
      visibility_km: c.visibilityKm,
      uv_index: round(c.uv),
      is_daytime: c.isDay,
    },
    next_24_hours: {
      total_rain_mm: round(next24.reduce((s, h) => s + (h.precip ?? 0), 0)),
      max_rain_chance_pct: Math.round(Math.max(0, ...next24.map((h) => h.pop ?? 0))),
      max_gust_kmh: round(Math.max(0, ...next24.map((h) => h.gust ?? 0))),
    },
    daily: dailyRows(forecast, ctx.lang, days),
    active_warnings: warnings.alerts.map((a) => ({
      type: a.title,
      level: a.level,
      when: a.when,
      detail: a.metric,
    })),
  };

  const blocks = [
    { type: 'current', place, forecast, air },
    { type: 'hourly', forecast, hours: 24 },
  ];
  if (days > 1) blocks.push({ type: 'daily', forecast, place });
  if (warnings.count > 0) blocks.push({ type: 'alerts', warnings, place, compact: true });

  return { grounding, blocks, forecast, air, warnings, advisory };
}

async function warningsTool(_args, ctx) {
  const { place } = ctx;
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

  const warnings = deriveAlerts(forecast, { lang: ctx.lang, air });

  return {
    grounding: {
      place: placeLabel(place, 'en'),
      highest_level: warnings.level,
      warning_count: warnings.count,
      warnings: warnings.alerts.map((a) => ({
        type: a.title,
        level: a.level,
        when: a.when,
        detail: a.metric,
        recommended_action: a.action,
      })),
      note: 'Derived from forecast fields using IMD impact-based thresholds; not an official IMD bulletin.',
    },
    blocks: [{ type: 'alerts', warnings, place, forecast }],
    forecast,
    air,
    warnings,
  };
}

async function airQualityTool(_args, ctx) {
  const { place } = ctx;
  const air = await fetchAirQuality({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
  });
  const band = aqiBand(air.aqi);

  return {
    grounding: {
      place: placeLabel(place, 'en'),
      us_aqi: air.aqi == null ? null : Math.round(air.aqi),
      band: band.label,
      pollutants_ug_m3: {
        pm2_5: round(air.pm25),
        pm10: round(air.pm10),
        no2: round(air.no2),
        o3: round(air.o3),
        so2: round(air.so2),
      },
      co_mg_m3: air.co == null ? null : round(air.co / 1000, 2),
    },
    blocks: [{ type: 'aqi', air, place }],
    air,
  };
}

async function climateTool(args, ctx) {
  const { place } = ctx;
  const years = Math.min(Math.max(Number(args.years) || 15, 5), 30);

  // Normals alone cannot answer "is THIS month wetter than usual?", so the
  // month-to-date observation is fetched alongside them.
  const [climate, mtd] = await Promise.all([
    fetchClimateTrend({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
      years,
    }),
    fetchMonthToDate({
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
    }).catch(() => null),
  ]);

  /*
   * Compare like with like. Month-to-date covers only part of the month, so
   * holding it against a whole-month normal would make every month look dry.
   * The normal is pro-rated to the same number of elapsed days.
   */
  let comparison = null;
  if (mtd && climate.normalRain != null && mtd.daysElapsed > 0) {
    const daysInMonth = new Date(Date.UTC(mtd.year, mtd.month, 0)).getUTCDate();
    const proRatedNormal = (climate.normalRain * mtd.daysElapsed) / daysInMonth;
    const pct = proRatedNormal > 0 ? Math.round((mtd.rainfall / proRatedNormal) * 100) : null;
    comparison = {
      days_elapsed: mtd.daysElapsed,
      observed_rain_mm: mtd.rainfall,
      expected_rain_by_now_mm: Math.round(proRatedNormal),
      percent_of_normal: pct,
      verdict:
        pct == null ? 'unknown' : pct >= 125 ? 'wetter than normal' : pct <= 75 ? 'drier than normal' : 'near normal',
      observed_mean_temp_c: mtd.meanTemp,
    };
  }

  return {
    grounding: {
      place: placeLabel(place, 'en'),
      month: climate.monthName,
      normals_period: `${climate.fromYear}–${climate.toYear}`,
      normal_mean_temp_c: climate.normalTemp,
      normal_whole_month_rain_mm: climate.normalRain,
      temp_trend_c_per_decade: climate.tempTrendPerDecade,
      rain_trend_mm_per_decade: climate.rainTrendPerDecade,
      this_month_so_far: comparison,
      yearly: climate.series.map((s) => ({
        year: s.year,
        mean_temp_c: round(s.meanTemp),
        rainfall_mm: round(s.rainfall),
      })),
      source: climate.source,
    },
    blocks: [{ type: 'climate', climate, place, monthToDate: comparison }],
    climate,
  };
}

async function sectorTool(args, ctx) {
  const { place } = ctx;
  const sector = ['agriculture', 'aviation', 'marine', 'urban'].includes(args.sector)
    ? args.sector
    : 'agriculture';

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

  const advisory = sectorAdvisory(sector, forecast, place, { lang: ctx.lang, air });
  const warnings = deriveAlerts(forecast, { lang: ctx.lang, air });

  return {
    grounding: {
      place: placeLabel(place, 'en'),
      sector,
      headline: advisory.headline,
      guidance: advisory.points.map((p) => ({ topic: p.label, verdict: p.value, reason: p.note })),
      daily: dailyRows(forecast, ctx.lang, 5),
    },
    blocks: [{ type: 'sector', advisory, place, forecast }],
    forecast,
    air,
    warnings,
  };
}

async function modelsTool(_args, ctx) {
  const { place } = ctx;
  const comparison = await fetchModelComparison({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
  });

  return {
    grounding: {
      place: placeLabel(place, 'en'),
      confidence: comparison.confidence,
      mean_spread_c: comparison.meanSpread,
      per_day_spread: comparison.spread.map((s) => ({
        date: s.date,
        min_max_temp_c: s.tmaxMin,
        max_max_temp_c: s.tmaxMax,
        spread_c: s.tmaxSpread,
      })),
      models: comparison.runs.map((r) => ({
        model: r.label,
        agency: r.agency,
        resolution: r.resolution,
        daily_max_c: r.days.map((d) => round(d.tmax)),
      })),
    },
    blocks: [{ type: 'models', comparison, place }],
    comparison,
  };
}

const EXECUTORS = {
  get_forecast: forecastTool,
  get_warnings: warningsTool,
  get_air_quality: airQualityTool,
  get_climate_normals: climateTool,
  get_sector_advisory: sectorTool,
  compare_forecast_models: modelsTool,
};

/* ---------------------------------------------------------------- runner --- */

/**
 * Execute one model-requested tool call.
 *
 * Returns a result even on failure, because the model needs to be *told* that a
 * lookup failed — otherwise it fills the silence with an invented answer.
 *
 * @param {string} name tool name proposed by the model
 * @param {object} args arguments proposed by the model
 * @param {{ lang?: string, model?: string }} options
 */
export async function executeTool(name, args = {}, { lang = 'en', model } = {}) {
  const executor = EXECUTORS[name];
  if (!executor) {
    return { ok: false, grounding: { error: `Unknown tool "${name}".` }, blocks: [] };
  }

  // Everything the model names must survive real geocoding before it is used.
  const { place, resolvedBy } = await resolveByName(args.location, lang);
  if (!place) {
    return {
      ok: false,
      grounding: {
        error: `Could not resolve the location "${args.location ?? ''}". Ask the user to confirm the place name.`,
      },
      blocks: [],
    };
  }

  try {
    const result = await executor(args, { place, lang, model });
    return { ok: true, place, resolvedBy, ...result };
  } catch (error) {
    return {
      ok: false,
      place,
      grounding: {
        error: `Data lookup failed for ${place.name}: ${error?.message ?? 'unknown error'}. Tell the user the data is unavailable — do not estimate it.`,
      },
      blocks: [],
    };
  }
}
