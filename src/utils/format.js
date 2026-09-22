/**
 * Formatting helpers.
 *
 * Important: the provider returns *local* wall-clock times for the requested
 * location as naive ISO strings ("2026-09-15T11:00" — no offset). Passing those
 * to `new Date()` would reinterpret them in the browser's timezone and shift
 * every label. So we parse the components out of the string and format from
 * those, keeping the station's local time intact regardless of where the user is.
 */

import { getLanguage } from '../i18n/languages.js';
import { hasNativeName, localisedPlaceName } from '../data/places.js';
import { formatCoordinates } from './coords.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-15T11:00" -> { y, m, d, hh, mm } */
export function parseIsoParts(iso) {
  if (!iso) return null;
  const [datePart, timePart = '00:00'] = String(iso).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return { y, m, d, hh: hh ?? 0, mm: mm ?? 0 };
}

/** A UTC-anchored Date, used only for weekday/month name lookup. */
function asUtcDate(iso) {
  const p = parseIsoParts(iso);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm));
}

/** "11 AM", "5 PM", "12 AM" */
export function hourLabel(iso) {
  const p = parseIsoParts(iso);
  if (!p) return '';
  const suffix = p.hh < 12 ? 'AM' : 'PM';
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return `${h12} ${suffix}`;
}

/** "10:30 AM" */
export function timeLabel(iso) {
  const p = parseIsoParts(iso);
  if (!p) return '';
  const suffix = p.hh < 12 ? 'AM' : 'PM';
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return `${h12}:${String(p.mm).padStart(2, '0')} ${suffix}`;
}

/** "15 Sep 2026, 10:30 AM" — the "Updated" stamp on the weather card. */
export function updatedLabel(iso) {
  const p = parseIsoParts(iso);
  if (!p) return '';
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}, ${timeLabel(iso)}`;
}

/** Localised short weekday, e.g. "Mon" / "सोम" / "সোম". */
export function weekdayLabel(iso, lang = 'en') {
  const date = asUtcDate(iso);
  if (!date) return '';
  const { bcp47 } = getLanguage(lang);
  try {
    return date.toLocaleDateString(bcp47, { weekday: 'short', timeZone: 'UTC' });
  } catch {
    return date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' });
  }
}

/** Localised "12 Sep" style day + month. */
export function dayMonthLabel(iso, lang = 'en') {
  const parts = parseIsoParts(iso);
  if (!parts) return '';

  // en-IN renders September as "Sept"; use the conventional three-letter form.
  // Hinglish is written in Latin script, so it takes the same form.
  if (lang === 'en' || lang === 'hinglish') return `${parts.d} ${MONTHS_SHORT[parts.m - 1]}`;

  const date = asUtcDate(iso);
  const { bcp47 } = getLanguage(lang);
  try {
    return date.toLocaleDateString(bcp47, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return `${parts.d} ${MONTHS_SHORT[parts.m - 1]}`;
  }
}

/** Decimal degrees -> "Lat 22.57° N, Lon 88.36° E" */
export function coordLabel(lat, lon) {
  return `Lat ${formatCoordinates(lat, lon).replace(', ', ', Lon ')}`;
}

/**
 * Full place label: "Kolkata, West Bengal" (state omitted when redundant).
 *
 * When answering in an Indian language and a native spelling of the city is
 * known, the native name is used on its own. Appending an English state name to
 * a Devanagari or Bengali city name produces mixed-script output that reads
 * badly, and the state adds little once the city is unambiguous.
 */
export function placeLabel(place, lang = 'en') {
  if (!place) return '';
  // Hinglish is Latin script, so a native-script city name would clash.
  if (lang !== 'hinglish' && hasNativeName(place, lang)) return localisedPlaceName(place, lang);

  const region = place.admin1 && place.admin1 !== place.name ? place.admin1 : '';
  const foreign = place.countryCode && place.countryCode !== 'IN' ? place.country : '';
  return [place.name, region, foreign].filter(Boolean).join(', ');
}

/** Short place name, localised where possible. */
export function placeName(place, lang = 'en') {
  return localisedPlaceName(place, lang);
}

export function round(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Temperature with degree sign, e.g. "26°C" or "26°". */
export function temp(n, { unit = false } = {}) {
  if (n == null) return '—';
  return `${Math.round(n)}°${unit ? 'C' : ''}`;
}

/** US AQI -> descriptive band (matches CPCB-style colour semantics). */
export function aqiBand(aqi) {
  if (aqi == null) return { key: 'unknown', label: 'Unknown', color: 'var(--text-3)' };
  if (aqi <= 50) return { key: 'good', label: 'Good', color: 'var(--green)' };
  if (aqi <= 100) return { key: 'moderate', label: 'Satisfactory', color: '#9acd32' };
  if (aqi <= 150) return { key: 'unhealthy_sensitive', label: 'Moderate', color: 'var(--yellow)' };
  if (aqi <= 200) return { key: 'unhealthy', label: 'Poor', color: 'var(--orange)' };
  if (aqi <= 300) return { key: 'very_unhealthy', label: 'Very Poor', color: 'var(--red)' };
  return { key: 'hazardous', label: 'Severe', color: 'var(--violet)' };
}

/** UV index -> band label. */
export function uvBand(uv) {
  if (uv == null) return { label: '—', color: 'var(--text-3)' };
  if (uv < 3) return { label: 'Low', color: 'var(--green)' };
  if (uv < 6) return { label: 'Moderate', color: 'var(--yellow)' };
  if (uv < 8) return { label: 'High', color: 'var(--orange)' };
  if (uv < 11) return { label: 'Very High', color: 'var(--red)' };
  return { label: 'Extreme', color: 'var(--violet)' };
}
