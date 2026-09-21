/**
 * Meteorological data access layer.
 *
 * All upstream I/O lives here so the conversational layer stays provider
 * agnostic. Today the backend is the Open-Meteo family of endpoints, which
 * serve post-processed output from the same global NWP systems an operational
 * met agency runs (NOAA GFS, ECMWF IFS, DWD ICON). Swapping in an IMD/WIS 2.0
 * feed means reimplementing this module only.
 *
 * Responsibilities:
 *  - request building + timeout + abort
 *  - a small TTL cache (keeps repeat questions in a conversation instant)
 *  - normalising provider payloads into the app's internal shape
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const REQUEST_TIMEOUT_MS = 12_000;

/** Available NWP configurations exposed to the user. */
export const NWP_MODELS = [
  {
    id: 'best_match',
    label: 'Multi-model blend',
    agency: 'Open-Meteo',
    resolution: 'adaptive',
    note: 'Automatically picks the best-performing model per region',
  },
  {
    id: 'gfs_seamless',
    label: 'GFS',
    agency: 'NOAA NCEP',
    resolution: '13 km',
    note: 'Global Forecast System — the reference global model',
  },
  {
    id: 'ecmwf_ifs025',
    label: 'ECMWF IFS',
    agency: 'ECMWF',
    resolution: '25 km',
    note: 'Integrated Forecasting System — strongest medium-range skill',
  },
  {
    id: 'icon_seamless',
    label: 'ICON',
    agency: 'DWD',
    resolution: '11 km',
    note: 'Icosahedral Nonhydrostatic model, nested to 2 km over Europe',
  },
];

/* ------------------------------------------------------------------ cache -- */

const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
  // Keep the cache small; this is a browser tab, not a server.
  if (cache.size > 120) cache.delete(cache.keys().next().value);
}

/* ----------------------------------------------------------------- fetch --- */

async function getJSON(url, params, { ttl = 0 } = {}) {
  const qs = new URLSearchParams(params).toString();
  const full = `${url}?${qs}`;

  if (ttl) {
    const cached = cacheGet(full);
    if (cached) return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(full, { signal: controller.signal });
    if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
    const json = await res.json();
    if (json?.error) throw new Error(json.reason || 'Upstream error');
    if (ttl) cacheSet(full, json, ttl);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------- geocoding -- */

/** Forward geocode through the provider (gazetteer fast-path lives in nlu). */
export async function geocode(query, lang = 'en', count = 5) {
  const json = await getJSON(
    GEOCODE_URL,
    { name: query, count, language: lang === 'en' ? 'en' : lang, format: 'json' },
    { ttl: 24 * 60 * 60 * 1000 },
  );
  return (json.results ?? []).map((r) => ({
    name: r.name,
    admin1: r.admin1 ?? '',
    admin2: r.admin2 ?? '',
    country: r.country ?? '',
    countryCode: r.country_code ?? '',
    latitude: r.latitude,
    longitude: r.longitude,
    elevation: r.elevation,
    timezone: r.timezone ?? 'auto',
    population: r.population,
    source: 'open-meteo-geocoder',
  }));
}

/** Best-effort reverse geocode for the "use my location" flow. */
export async function reverseGeocode(latitude, longitude) {
  try {
    const json = await getJSON(
      REVERSE_URL,
      { latitude, longitude, localityLanguage: 'en' },
      { ttl: 24 * 60 * 60 * 1000 },
    );
    const name = json.city || json.locality || json.principalSubdivision || 'Current location';
    return {
      name,
      admin1: json.principalSubdivision ?? '',
      country: json.countryName ?? '',
      countryCode: json.countryCode ?? '',
      latitude,
      longitude,
      timezone: 'auto',
      source: 'reverse-geocoder',
    };
  } catch {
    return {
      name: 'Current location',
      admin1: '',
      country: '',
      countryCode: '',
      latitude,
      longitude,
      timezone: 'auto',
      source: 'coordinates',
    };
  }
}

/* --------------------------------------------------------------- forecast -- */

const CURRENT_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'rain',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];

const HOURLY_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'visibility',
  'wind_speed_10m',
  'wind_gusts_10m',
  'is_day',
];

const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'sunrise',
  'sunset',
  'uv_index_max',
  'precipitation_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
];

/**
 * Full observation + forecast bundle for a location.
 * Cached for 10 minutes — matches the provider's own refresh cadence.
 */
export async function fetchForecast({ latitude, longitude, timezone = 'auto', model = 'best_match', days = 7 }) {
  const params = {
    latitude,
    longitude,
    current: CURRENT_VARS.join(','),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone,
    forecast_days: String(days),
    wind_speed_unit: 'kmh',
  };
  if (model && model !== 'best_match') params.models = model;

  const json = await getJSON(FORECAST_URL, params, { ttl: 10 * 60 * 1000 });
  return normaliseForecast(json, model);
}

/** Air quality (PM2.5 / PM10 / US AQI + trace gases). */
export async function fetchAirQuality({ latitude, longitude, timezone = 'auto' }) {
  const json = await getJSON(
    AIR_URL,
    {
      latitude,
      longitude,
      current: 'pm10,pm2_5,us_aqi,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
      timezone,
    },
    { ttl: 30 * 60 * 1000 },
  );
  const c = json.current ?? {};
  return {
    time: c.time,
    aqi: c.us_aqi ?? null,
    pm25: c.pm2_5 ?? null,
    pm10: c.pm10 ?? null,
    co: c.carbon_monoxide ?? null,
    no2: c.nitrogen_dioxide ?? null,
    so2: c.sulphur_dioxide ?? null,
    o3: c.ozone ?? null,
  };
}

/**
 * Climate analysis from the ERA5 reanalysis archive.
 *
 * Returns a per-year series for the same calendar window (so the comparison is
 * seasonally fair) plus a linear trend — the core of the "climate analytics for
 * researchers" use case.
 */
export async function fetchClimateTrend({ latitude, longitude, years = 15, timezone = 'auto' }) {
  const now = new Date();
  // ERA5 lags real time by ~5 days; end the window safely in the past.
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - years + 1;
  const month = now.getUTCMonth() + 1;

  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(endYear, month, 0)).getUTCDate();

  const json = await getJSON(
    ARCHIVE_URL,
    {
      latitude,
      longitude,
      start_date: `${startYear}-${mm}-01`,
      end_date: `${endYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      daily: 'temperature_2m_mean,temperature_2m_max,precipitation_sum',
      timezone,
    },
    { ttl: 7 * 24 * 60 * 60 * 1000 },
  );

  const times = json.daily?.time ?? [];
  const means = json.daily?.temperature_2m_mean ?? [];
  const maxes = json.daily?.temperature_2m_max ?? [];
  const rains = json.daily?.precipitation_sum ?? [];

  /** @type {Map<number, {temps:number[], maxes:number[], rain:number}>} */
  const byYear = new Map();
  times.forEach((iso, i) => {
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    if (m !== month) return; // the archive returns whole range; keep our month
    if (!byYear.has(y)) byYear.set(y, { temps: [], maxes: [], rain: 0 });
    const bucket = byYear.get(y);
    if (means[i] != null) bucket.temps.push(means[i]);
    if (maxes[i] != null) bucket.maxes.push(maxes[i]);
    if (rains[i] != null) bucket.rain += rains[i];
  });

  const series = [...byYear.entries()]
    .filter(([, v]) => v.temps.length > 0)
    .map(([year, v]) => ({
      year,
      meanTemp: avg(v.temps),
      maxTemp: Math.max(...v.maxes),
      rainfall: Math.round(v.rain * 10) / 10,
    }))
    .sort((a, b) => a.year - b.year);

  const temps = series.map((s) => s.meanTemp);
  const rainTotals = series.map((s) => s.rainfall);

  return {
    month,
    monthName: new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en', { month: 'long' }),
    fromYear: series[0]?.year ?? startYear,
    toYear: series.at(-1)?.year ?? endYear,
    series,
    normalTemp: round1(avg(temps)),
    normalRain: Math.round(avg(rainTotals)),
    tempTrendPerDecade: round1(slope(series.map((s) => s.year), temps) * 10),
    rainTrendPerDecade: Math.round(slope(series.map((s) => s.year), rainTotals) * 10),
    source: 'ERA5 reanalysis (Copernicus / ECMWF)',
  };
}

/**
 * Run the same forecast through several NWP models so the UI can show
 * ensemble agreement — an honest proxy for forecast confidence.
 */
export async function fetchModelComparison({ latitude, longitude, timezone = 'auto' }) {
  const models = NWP_MODELS.filter((m) => m.id !== 'best_match');
  const results = await Promise.allSettled(
    models.map((m) =>
      getJSON(
        FORECAST_URL,
        {
          latitude,
          longitude,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
          models: m.id,
          timezone,
          forecast_days: '5',
          wind_speed_unit: 'kmh',
        },
        { ttl: 15 * 60 * 1000 },
      ).then((json) => ({ model: m, json })),
    ),
  );

  const runs = results
    .filter((r) => r.status === 'fulfilled')
    .map(({ value }) => ({
      id: value.model.id,
      label: value.model.label,
      agency: value.model.agency,
      resolution: value.model.resolution,
      days: (value.json.daily?.time ?? []).map((date, i) => ({
        date,
        tmax: value.json.daily.temperature_2m_max?.[i] ?? null,
        tmin: value.json.daily.temperature_2m_min?.[i] ?? null,
        rain: value.json.daily.precipitation_sum?.[i] ?? null,
        code: value.json.daily.weather_code?.[i] ?? null,
      })),
    }));

  // Spread of day-1..5 max temperature across models = disagreement measure.
  const dayCount = Math.min(...runs.map((r) => r.days.length), 5);
  const spread = [];
  for (let d = 0; d < dayCount; d += 1) {
    const vals = runs.map((r) => r.days[d]?.tmax).filter((v) => v != null);
    const rains = runs.map((r) => r.days[d]?.rain).filter((v) => v != null);
    spread.push({
      date: runs[0]?.days[d]?.date,
      tmaxMin: Math.min(...vals),
      tmaxMax: Math.max(...vals),
      tmaxSpread: round1(Math.max(...vals) - Math.min(...vals)),
      rainMin: Math.min(...rains),
      rainMax: Math.max(...rains),
    });
  }

  const meanSpread = avg(spread.map((s) => s.tmaxSpread));
  return {
    runs,
    spread,
    meanSpread: round1(meanSpread),
    confidence: meanSpread <= 1.5 ? 'high' : meanSpread <= 3 ? 'moderate' : 'low',
  };
}

/* ------------------------------------------------------------ normalising -- */

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function compassPoint(deg) {
  if (deg == null) return '';
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function normaliseForecast(json, model) {
  const c = json.current ?? {};
  const hourlyTimes = json.hourly?.time ?? [];

  // Index of the hour matching "now" in local time, used for visibility/UV.
  const nowIso = (c.time ?? '').slice(0, 13);
  let idx = hourlyTimes.findIndex((t) => t.slice(0, 13) === nowIso);
  if (idx < 0) idx = 0;

  const hourly = hourlyTimes.map((time, i) => ({
    time,
    temp: json.hourly.temperature_2m?.[i] ?? null,
    humidity: json.hourly.relative_humidity_2m?.[i] ?? null,
    pop: json.hourly.precipitation_probability?.[i] ?? null,
    precip: json.hourly.precipitation?.[i] ?? null,
    code: json.hourly.weather_code?.[i] ?? null,
    visibility: json.hourly.visibility?.[i] ?? null,
    wind: json.hourly.wind_speed_10m?.[i] ?? null,
    gust: json.hourly.wind_gusts_10m?.[i] ?? null,
    isDay: json.hourly.is_day?.[i] === 1,
  }));

  const daily = (json.daily?.time ?? []).map((date, i) => ({
    date,
    code: json.daily.weather_code?.[i] ?? null,
    tmax: json.daily.temperature_2m_max?.[i] ?? null,
    tmin: json.daily.temperature_2m_min?.[i] ?? null,
    feelsMax: json.daily.apparent_temperature_max?.[i] ?? null,
    sunrise: json.daily.sunrise?.[i] ?? null,
    sunset: json.daily.sunset?.[i] ?? null,
    uv: json.daily.uv_index_max?.[i] ?? null,
    rain: json.daily.precipitation_sum?.[i] ?? null,
    rainHours: json.daily.precipitation_hours?.[i] ?? null,
    pop: json.daily.precipitation_probability_max?.[i] ?? null,
    windMax: json.daily.wind_speed_10m_max?.[i] ?? null,
    gustMax: json.daily.wind_gusts_10m_max?.[i] ?? null,
  }));

  const visibilityM = hourly[idx]?.visibility ?? null;

  return {
    model,
    coordinates: { latitude: json.latitude, longitude: json.longitude },
    elevation: json.elevation,
    timezone: json.timezone,
    utcOffsetSeconds: json.utc_offset_seconds ?? 0,
    current: {
      time: c.time ?? null,
      temp: c.temperature_2m ?? null,
      feelsLike: c.apparent_temperature ?? null,
      humidity: c.relative_humidity_2m ?? null,
      precip: c.precipitation ?? null,
      rain: c.rain ?? null,
      code: c.weather_code ?? 0,
      isDay: c.is_day === 1,
      cloudCover: c.cloud_cover ?? null,
      pressure: Math.round(c.pressure_msl ?? c.surface_pressure ?? 0) || null,
      windSpeed: c.wind_speed_10m ?? null,
      windDir: c.wind_direction_10m ?? null,
      windCompass: compassPoint(c.wind_direction_10m),
      gusts: c.wind_gusts_10m ?? null,
      visibilityKm: visibilityM != null ? Math.round(visibilityM / 1000) : null,
      uv: daily[0]?.uv ?? null,
      sunrise: daily[0]?.sunrise ?? null,
      sunset: daily[0]?.sunset ?? null,
    },
    hourly,
    hourlyIndexNow: idx,
    daily,
    fetchedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ math --- */

function avg(list) {
  if (!list.length) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Ordinary least-squares slope of y over x. */
function slope(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export const __testables = { slope, avg, normaliseForecast };
