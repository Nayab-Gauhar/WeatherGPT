/**
 * Place resolution — forward and reverse geocoding.
 *
 * Two concerns beyond simply calling a geocoder:
 *
 * 1. **Resilience.** Place lookup sits in front of nearly every answer, so a
 *    single provider outage would take the whole app down. Both directions run
 *    through a provider chain, and every provider used here was verified to be
 *    callable from the browser (CORS) rather than only from a server.
 *
 * 2. **Safety.** This is the boundary where a model-proposed location becomes
 *    coordinates. Nothing the model invents is used directly — an unresolvable
 *    name fails cleanly instead of yielding a confident answer about nowhere.
 */

import { findPlace, scanForPlace, stripIndicSuffix } from '../data/places.js';
import { geocode } from './openMeteo.js';
import {
  clampLatitude,
  formatCoordinates,
  parseCoordinates,
  wrapLongitude,
} from '../utils/coords.js';

/* -------------------------------------------------------------------- cache -- */

/**
 * Resolved places are cached in `localStorage`, not just in memory.
 *
 * Place names map to fixed coordinates, so the result never goes stale within a
 * session — and caching across reloads is what allows the built-in gazetteer to
 * stay small: the second question about a town is instant even though the first
 * needed the network.
 */
const CACHE_KEY = 'weathergpt:places';
const CACHE_LIMIT = 300;

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

const cache = loadCache();

function persistCache() {
  try {
    // Keep the most recent entries; this is a convenience cache, not a database.
    const entries = [...cache.entries()].slice(-CACHE_LIMIT);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* private mode — in-memory only */
  }
}

const cacheKey = (text) => `n:${String(text).toLowerCase().normalize('NFKC').trim()}`;
const coordKey = (lat, lon) => `c:${lat.toFixed(3)},${lon.toFixed(3)}`;

function remember(key, place) {
  if (!place) return;
  cache.set(key, place);
  persistCache();
}

/* ------------------------------------------------------- forward geocoding -- */

/** Rank candidates: exact name, then Indian, then most populous. */
function rank(results, query) {
  const wanted = query.toLowerCase();
  const exact = results.filter((r) => r.name.toLowerCase() === wanted);
  const pool = exact.length ? exact : results;
  const indian = pool.filter((r) => r.countryCode === 'IN');
  // "Hyderabad" should mean Telangana for this audience, not Sindh.
  return (indian.length ? indian : pool).sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
}

/**
 * OpenStreetMap Nominatim — the primary geocoder.
 *
 * Chosen on measured accuracy for this audience, not convenience. Tested against
 * the GeoNames-backed alternative, Nominatim resolved every native-script query
 * correctly (কলকাতা, சென்னை, ಬೆಂಗಳೂರು, ਅੰਮ੍ਰਿਤਸਰ, અમદાવાદ) and every historical
 * alias (Bombay → Mumbai, Calcutta → Kolkata, Vizag → Visakhapatnam,
 * Trivandrum → Thiruvananthapuram). The alternative returned nothing for all
 * native scripts, and for aliases returned confidently *wrong* places on another
 * continent — Bombay in New York, Calcutta in South Africa, Kutch in Colorado.
 *
 * It also returns names in a requested language, which is what lets the built-in
 * gazetteer stay small: native-script display names come from the API rather than
 * from a hand-maintained table.
 *
 * Usage policy: Nominatim asks for light use, cached results and an identifying
 * Referer (browsers send one automatically). The persistent cache above means a
 * given place is fetched at most once per device.
 */
async function nominatimSearch(query, lang, { indiaOnly }) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  // Ask for the user's language first, falling back to English, so a Hindi
  // session can display "कोलकाता" without a local lookup table.
  url.searchParams.set('accept-language', lang && lang !== 'en' ? `${lang},en` : 'en');
  if (indiaOnly) url.searchParams.set('countrycodes', 'in');

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim-${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json) || !json.length) return null;

  // Prefer an inhabited place over a point of interest: searching a city name
  // can otherwise surface, say, a university campus named after the city.
  const settlementRanks = { city: 0, town: 1, village: 2, municipality: 3 };
  const scored = json
    .map((r) => {
      const a = r.address ?? {};
      const kind = a.city ? 'city' : a.town ? 'town' : a.village ? 'village' : a.municipality ? 'municipality' : 'other';
      return { r, a, rank: settlementRanks[kind] ?? 9, importance: r.importance ?? 0 };
    })
    .sort((x, y) => x.rank - y.rank || y.importance - x.importance);

  const { r: best, a } = scored[0];
  const englishName =
    a.city || a.town || a.village || a.municipality || a.state_district || best.name;
  if (!englishName) return null;

  return {
    name: englishName,
    // Nominatim honours accept-language, so `name` may already be localised.
    localName: best.name && best.name !== englishName ? best.name : null,
    admin1: a.state ?? '',
    admin2: a.state_district ?? '',
    country: a.country ?? '',
    countryCode: (a.country_code ?? '').toUpperCase(),
    latitude: Number(best.lat),
    longitude: Number(best.lon),
    timezone: 'auto',
    source: 'nominatim',
  };
}

/**
 * Open-Meteo's geocoder — last resort only.
 *
 * Fast and reliable for unambiguous English names, but demonstrably unsafe as a
 * primary for this product: it silently returns same-named places on other
 * continents. Kept because it covers cases Nominatim occasionally misses, and
 * because a second vendor means place lookup survives a Nominatim outage.
 */
async function openMeteoSearch(query, lang) {
  const results = await geocode(query, lang === 'en' ? 'en' : lang);
  return results.length ? rank(results, query)[0] : null;
}

/**
 * Resolve a free-text place name.
 *
 * Order: cache → curated gazetteer → provider chain. The first two are instant
 * and offline; only genuinely unknown names reach the network.
 *
 * @returns {Promise<{place: object|null, resolvedBy: string}>}
 */
export async function resolveByName(name, lang = 'en') {
  const query = String(name ?? '').trim();
  if (!query) return { place: null, resolvedBy: 'none' };

  // A bare coordinate pair is a location in itself.
  const coords = parseCoordinates(query);
  if (coords) {
    const place = await resolveByCoordinates(coords.latitude, coords.longitude);
    return { place, resolvedBy: 'coordinates' };
  }

  const key = cacheKey(query);
  if (cache.has(key)) return { place: cache.get(key), resolvedBy: 'cache' };

  const exact = findPlace(query) ?? scanForPlace(query);
  if (exact) return { place: exact, resolvedBy: 'gazetteer' };

  /*
   * India-restricted search runs first. This is the disambiguation that matters
   * most here: an unrestricted lookup for "Delhi" or "Hyderabad" can legitimately
   * return Iowa or Sindh, and for an IMD-facing tool the Indian place is almost
   * always the intended one. A global pass follows so "London" and "Tokyo" still
   * work.
   */
  const providers = [
    { id: 'nominatim-in', run: () => nominatimSearch(query, lang, { indiaOnly: true }) },
    { id: 'nominatim', run: () => nominatimSearch(query, lang, { indiaOnly: false }) },
    { id: 'open-meteo', run: () => openMeteoSearch(query, lang) },
  ];

  for (const provider of providers) {
    try {
      const place = await provider.run();
      if (place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
        remember(key, place);
        return { place, resolvedBy: provider.id };
      }
    } catch {
      // Try the next provider rather than failing the whole question.
    }
  }

  /*
   * Last attempt: strip an attached Indic case marker and retry.
   *
   * "নাগপুরে" is Nagpur plus a locative ending, and a geocoder has no more idea
   * what that means than a plain index does. The seed handles this for the
   * twelve places it knows; this covers everywhere else.
   */
  const stem = stripIndicSuffix(query);
  if (stem && stem !== query) {
    const retry = await resolveByName(stem, lang);
    if (retry.place) {
      remember(key, retry.place);
      return { place: retry.place, resolvedBy: `${retry.resolvedBy}+suffix` };
    }
  }

  return { place: null, resolvedBy: 'none' };
}

/* ------------------------------------------------------- reverse geocoding -- */

async function bigDataCloudReverse(latitude, longitude) {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('localityLanguage', 'en');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`bigdatacloud-${res.status}`);
  const json = await res.json();

  const name = json.city || json.locality || json.principalSubdivision;
  if (!name) return null;

  return {
    name,
    admin1: json.principalSubdivision ?? '',
    country: json.countryName ?? '',
    countryCode: json.countryCode ?? '',
    latitude,
    longitude,
    timezone: 'auto',
    source: 'bigdatacloud',
  };
}

async function nominatimReverse(latitude, longitude) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '10');
  url.searchParams.set('accept-language', 'en');

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim-reverse-${res.status}`);
  const json = await res.json();

  const a = json.address ?? {};
  const name =
    a.city || a.town || a.village || a.municipality || a.county || a.state_district || a.state;
  if (!name) return null;

  return {
    name,
    admin1: a.state ?? '',
    country: a.country ?? '',
    countryCode: (a.country_code ?? '').toUpperCase(),
    latitude,
    longitude,
    timezone: 'auto',
    source: 'nominatim',
  };
}

/**
 * Name the place at a coordinate — used for map clicks and device location.
 *
 * Always returns a usable place. Two thirds of the planet is ocean and much of
 * the land is unnamed, so when no provider can name a point the coordinates
 * themselves become the label. The forecast works regardless; refusing to answer
 * because a point has no name would be the wrong failure.
 */
export async function resolveByCoordinates(latitude, longitude) {
  const lat = clampLatitude(latitude);
  const lon = wrapLongitude(longitude);
  const key = coordKey(lat, lon);

  if (cache.has(key)) return cache.get(key);

  for (const run of [bigDataCloudReverse, nominatimReverse]) {
    try {
      const place = await run(lat, lon);
      if (place) {
        remember(key, place);
        return place;
      }
    } catch {
      // Next provider.
    }
  }

  const fallback = {
    name: formatCoordinates(lat, lon),
    admin1: '',
    country: '',
    countryCode: '',
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    source: 'coordinates',
    unnamed: true,
  };
  remember(key, fallback);
  return fallback;
}

/*
 * Coordinate maths lives in utils/coords.js, shared with the query parser and
 * both map projections. Re-exported here so callers that think in terms of
 * places have one import.
 */
export { clampLatitude, wrapLongitude, formatCoordinates, parseCoordinates };

/** Diagnostics for the settings panel. */
export function placeCacheSize() {
  return cache.size;
}
