/**
 * Coordinate handling.
 *
 * Shared because three layers need the same rules and previously each had its
 * own: the geocoder, the query parser, and both map projections. Getting this
 * wrong is silent — a longitude of 190° is simply rejected by upstream APIs, and
 * a point picked near the edge of a dragged map lands in the wrong ocean.
 */

/** Latitude clamps: there is no land past the poles to wrap onto. */
export function clampLatitude(lat) {
  const value = Number(lat);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-90, Math.min(90, value));
}

/**
 * Longitude wraps.
 *
 * Dragging a world map east past the antimeridian produces values like 190°,
 * which is really 170° W. Providers reject the former and accept the latter, so
 * every coordinate leaving the UI passes through here.
 */
export function wrapLongitude(lon) {
  const value = Number(lon);
  if (!Number.isFinite(value)) return 0;

  /*
   * Return in-range values untouched.
   *
   * The modulo arithmetic below is not exact in binary floating point: it turns
   * 88.36 into 88.36000000000001. Harmless to look at, but it leaks into cache
   * keys and request URLs, so two identical clicks would miss the cache and
   * re-fetch. Only genuinely out-of-range values need normalising.
   */
  if (value >= -180 && value <= 180) return value;

  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** "22.57° N, 88.36° E" — the compact form used on cards. */
export function formatCoordinates(lat, lon, digits = 2) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lon).toFixed(digits)}° ${ew}`;
}

/** Degrees-minutes-seconds, for users who work in that notation. */
export function formatDms(lat, lon) {
  const part = (value, positive, negative) => {
    const hemisphere = value >= 0 ? positive : negative;
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);
    // Carry seconds/minutes that round up to 60.
    const [s, m, d] = sec === 60 ? [0, min + 1, deg] : [sec, min, deg];
    const [m2, d2] = m === 60 ? [0, d + 1] : [m, d];
    return `${d2}°${String(m2).padStart(2, '0')}'${String(s).padStart(2, '0')}" ${hemisphere}`;
  };
  return `${part(lat, 'N', 'S')}, ${part(lon, 'E', 'W')}`;
}

/**
 * Parse a typed coordinate pair, so a position can be pasted straight into the
 * chat box.
 *
 * Accepts the forms people actually use:
 *   "22.57, 88.36"         "22.57 88.36"
 *   "22.57N 88.36E"        "12°58'30\"N 77°35'00\"E"
 *   "lat 22.57 lon 88.36"
 *
 * Returns null unless the whole string is essentially just a position, so an
 * ordinary sentence containing numbers ("7 day forecast for 2026") is never
 * mistaken for one.
 */
export function parseCoordinates(text) {
  const raw = String(text ?? '').trim();
  if (!raw || !/\d/.test(raw)) return null;

  // Ignore a leading "lat"/"lon"/"latitude"/"longitude" label.
  const cleaned = raw.replace(/\b(lat|latitude|lon|lng|long|longitude)\b\s*:?\s*/gi, ' ').trim();

  // Degrees / minutes / seconds with hemisphere letters.
  const dms = cleaned.match(
    /(\d{1,3})[°\s:]+(\d{1,2})['′\s:]*(\d{1,2}(?:\.\d+)?)?["″\s]*([NSns])[,\s]+(\d{1,3})[°\s:]+(\d{1,2})['′\s:]*(\d{1,2}(?:\.\d+)?)?["″\s]*([EWew])/,
  );
  if (dms) {
    return validate(
      toDecimal(dms[1], dms[2], dms[3], dms[4]),
      toDecimal(dms[5], dms[6], dms[7], dms[8]),
    );
  }

  // Decimal degrees, optionally with hemisphere letters.
  const decimal = cleaned.match(
    /^[^\d+-]*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])?[^\d]*$/,
  );
  if (!decimal) return null;

  let lat = Number(decimal[1]);
  let lon = Number(decimal[3]);
  if (/[Ss]/.test(decimal[2] ?? '')) lat = -Math.abs(lat);
  if (/[Ww]/.test(decimal[4] ?? '')) lon = -Math.abs(lon);

  // A bare pair of small integers ("7 day", "2 3") is far more likely to be
  // prose than a position, so require a decimal point or a hemisphere letter.
  const looksDeliberate =
    /\./.test(decimal[1]) || /\./.test(decimal[3]) || decimal[2] || decimal[4] || /°/.test(cleaned);
  if (!looksDeliberate) return null;

  return validate(lat, lon);
}

function toDecimal(deg, min, sec, hemisphere) {
  const value = Number(deg) + Number(min ?? 0) / 60 + Number(sec ?? 0) / 3600;
  return /[SsWw]/.test(hemisphere) ? -value : value;
}

function validate(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Latitude beyond ±90 means the pair is not a position at all — do not silently
  // clamp it into one.
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { latitude: lat, longitude: lon };
}
