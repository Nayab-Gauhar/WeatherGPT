/**
 * Place resolution, shared by the deterministic parser and the tool layer.
 *
 * Order matters: the curated gazetteer answers instantly and handles native
 * scripts and aliases, so it is tried first; only unknown names reach the
 * network geocoder.
 *
 * This is also a safety boundary for tool calling. Gemini proposes a location
 * as free text, and nothing it proposes is ever used as coordinates directly —
 * every name must resolve through here first. A hallucinated place simply fails
 * to resolve instead of producing a confident answer about nowhere.
 */

import { findPlace, scanForPlace } from '../data/places.js';
import { geocode } from './openMeteo.js';

/**
 * @param {string} name free-text place name
 * @param {string} lang language hint for the geocoder
 * @returns {Promise<{place: object|null, resolvedBy: string}>}
 */
export async function resolveByName(name, lang = 'en') {
  const query = String(name ?? '').trim();
  if (!query) return { place: null, resolvedBy: 'none' };

  // 1. Exact gazetteer hit.
  const exact = findPlace(query);
  if (exact) return { place: exact, resolvedBy: 'gazetteer' };

  // 2. Gazetteer scan — catches "near Kochi" or an attached case suffix.
  const scanned = scanForPlace(query);
  if (scanned) return { place: scanned, resolvedBy: 'gazetteer' };

  // 3. Network geocoder.
  try {
    const results = await geocode(query, lang === 'en' ? 'en' : lang);
    if (!results.length) return { place: null, resolvedBy: 'none' };

    const wanted = query.toLowerCase();
    const exactName = results.filter((r) => r.name.toLowerCase() === wanted);
    const pool = exactName.length ? exactName : results;
    // Prefer Indian results, then the most populous — "Hyderabad" should mean
    // Telangana, not Sindh, for this audience.
    const indian = pool.filter((r) => r.countryCode === 'IN');
    const ranked = (indian.length ? indian : pool).sort(
      (a, b) => (b.population ?? 0) - (a.population ?? 0),
    );
    return { place: ranked[0], resolvedBy: 'geocoder' };
  } catch {
    return { place: null, resolvedBy: 'error' };
  }
}
