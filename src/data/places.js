/**
 * Offline place seed.
 *
 * This used to be a 44-entry hand-maintained gazetteer. It is now deliberately
 * small, because measurement showed the geocoder does the job better: Nominatim
 * resolves native-script names (কলকাতা, சென்னை, ಬೆಂಗಳೂರು), historical aliases
 * (Bombay, Calcutta, Vizag, Trivandrum) and small towns correctly, and returns
 * localised names for display. Duplicating that in source would mean maintaining
 * a worse copy of it by hand.
 *
 * What remains and why:
 *
 *  - The twelve places most likely to be asked about, so the first question is
 *    answered with no network round trip and the app still works offline.
 *  - A handful of native spellings and colloquial aliases for those, which also
 *    supply display names without a lookup.
 *  - `GLOBE_LABELS`, which is presentation data — there is no API that says where
 *    to place a country label on a rendered globe.
 *
 * Everything else resolves through `services/geo.js`, which caches results in
 * `localStorage`, so a place is fetched at most once per device.
 */

export const SEED_PLACES = [
  {
    name: 'New Delhi',
    admin1: 'Delhi',
    lat: 28.6139,
    lon: 77.209,
    aliases: ['delhi', 'new delhi', 'दिल्ली', 'नई दिल्ली', 'দিল্লি'],
  },
  {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    lat: 19.076,
    lon: 72.8777,
    aliases: ['bombay', 'मुंबई', 'मुम्बई', 'মুম্বাই', 'மும்பை'],
  },
  {
    name: 'Kolkata',
    admin1: 'West Bengal',
    lat: 22.5726,
    lon: 88.3639,
    aliases: ['calcutta', 'কলকাতা', 'कोलकाता'],
  },
  {
    name: 'Chennai',
    admin1: 'Tamil Nadu',
    lat: 13.0827,
    lon: 80.2707,
    aliases: ['madras', 'சென்னை', 'चेन्नई'],
  },
  {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    lat: 12.9716,
    lon: 77.5946,
    aliases: ['bangalore', 'ಬೆಂಗಳೂರು', 'बेंगलुरु'],
  },
  {
    name: 'Hyderabad',
    admin1: 'Telangana',
    lat: 17.385,
    lon: 78.4867,
    aliases: ['హైదరాబాద్', 'हैदराबाद'],
  },
  {
    name: 'Pune',
    admin1: 'Maharashtra',
    lat: 18.5204,
    lon: 73.8567,
    aliases: ['poona', 'पुणे'],
  },
  {
    name: 'Ahmedabad',
    admin1: 'Gujarat',
    lat: 23.0225,
    lon: 72.5714,
    aliases: ['amdavad', 'અમદાવાદ', 'अहमदाबाद'],
  },
  {
    name: 'Nagpur',
    admin1: 'Maharashtra',
    lat: 21.1458,
    lon: 79.0882,
    aliases: ['नागपूर', 'नागपुर'],
  },
  {
    name: 'Lucknow',
    admin1: 'Uttar Pradesh',
    lat: 26.8467,
    lon: 80.9462,
    aliases: ['लखनऊ'],
  },
  {
    name: 'Jaipur',
    admin1: 'Rajasthan',
    lat: 26.9124,
    lon: 75.7873,
    aliases: ['जयपुर'],
  },
  {
    name: 'Kochi',
    admin1: 'Kerala',
    lat: 9.9312,
    lon: 76.2673,
    aliases: ['cochin', 'കൊച്ചി', 'कोच्चि'],
  },
];

/** Country labels drawn on the 3D globe. Presentation data, not a gazetteer. */
export const GLOBE_LABELS = [
  { text: 'India', lat: 22.5, lon: 79, size: 0.85 },
  { text: 'China', lat: 35, lon: 103, size: 0.85 },
  { text: 'Russia', lat: 61, lon: 90, size: 0.85 },
  { text: 'Saudi Arabia', lat: 24, lon: 45, size: 0.6 },
  { text: 'Kazakhstan', lat: 48, lon: 67, size: 0.6 },
  { text: 'Iran', lat: 32, lon: 53, size: 0.6 },
  { text: 'Pakistan', lat: 30, lon: 69, size: 0.6 },
  { text: 'Indonesia', lat: -2, lon: 118, size: 0.6 },
  { text: 'Australia', lat: -25, lon: 134, size: 0.7 },
  { text: 'Egypt', lat: 26, lon: 30, size: 0.55 },
  { text: 'Mongolia', lat: 46, lon: 104, size: 0.55 },
  { text: 'Myanmar', lat: 21, lon: 96, size: 0.5 },
  { text: 'Thailand', lat: 15, lon: 101, size: 0.5 },
];

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[.,!?;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Every name and alias (normalised) → place record. */
const INDEX = new Map();
for (const place of SEED_PLACES) {
  const record = {
    name: place.name,
    admin1: place.admin1 ?? '',
    country: 'India',
    countryCode: 'IN',
    latitude: place.lat,
    longitude: place.lon,
    timezone: 'Asia/Kolkata',
    source: 'seed',
  };
  INDEX.set(norm(place.name), record);
  for (const alias of place.aliases ?? []) INDEX.set(norm(alias), record);
}

/** Exact (normalised) match against the seed. */
export function findPlace(query) {
  if (!query) return null;
  return INDEX.get(norm(query)) ?? null;
}

/**
 * Case-marking suffixes that Indian languages attach directly to a place name,
 * with no intervening space:
 *   কলকাতা + য়   → কলকাতায়   (Bengali locative)
 *   சென்னை + யில் → சென்னையில் (Tamil locative)
 *   અમદાવાદ + માં → અમદાવાદમાં (Gujarati locative)
 *
 * Matching has to tolerate an agglutinated tail. Exported because
 * `services/geo.js` applies the same stripping before a network lookup — the
 * geocoder has no more idea what "কলকাতায়" means than a plain index does.
 * Ordered longest first so the most specific suffix is removed.
 */
export const INDIC_SUFFIXES = [
  // Tamil
  'யிலிருந்து', 'யில்', 'இல்', 'ியில்', 'க்கு', 'ின்', 'ல்',
  // Malayalam
  'യിലേക്ക്', 'യിൽ', 'ിലേക്ക്', 'ിൽ', 'ിന്', 'ിലെ', 'ൽ',
  // Telugu
  'నుండి', 'లోని', 'లో', 'కి', 'కు',
  // Kannada
  'ದಲ್ಲಿ', 'ನಲ್ಲಿ', 'ಕ್ಕೆ', 'ಗೆ',
  // Gujarati
  'માંથી', 'માં', 'નું', 'ની', 'નો', 'ના', 'થી',
  // Bengali / Odia
  'তে', 'য়ে', 'য়', 'ের', 'এর', 'রে', 'ে',
  // Devanagari (Hindi / Marathi)
  'मध्ये', 'में', 'मे', 'हून', 'चा', 'ची', 'चे', 'ला', 'का', 'की', 'के',
  // Gurmukhi
  'ਵਿੱਚ', 'ਵਿਚ', 'ਤੋਂ', 'ਦਾ', 'ਦੀ', 'ਦੇ',
];

/** Remove one trailing case suffix, if present. */
export function stripIndicSuffix(token) {
  for (const suffix of INDIC_SUFFIXES) {
    if (token.length > suffix.length + 1 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return null;
}

/**
 * Scan a sentence for a seeded place name, preferring the longest match so
 * "new delhi" wins over "delhi".
 *
 * Two passes: a whole-string boundary match for multi-word and Latin names, then
 * a per-token match that tolerates attached Indic case markers.
 */
export function scanForPlace(text) {
  const haystack = norm(text);

  let best = null;
  for (const [key, record] of INDEX) {
    if (key.length < 3) continue;
    const boundary = new RegExp(`(^|[^\\p{L}])${escapeRegex(key)}($|[^\\p{L}])`, 'u');
    if (boundary.test(haystack) && (!best || key.length > best.key.length)) {
      best = { key, record };
    }
  }
  if (best) return best.record;

  // \p{M} is essential: Indic vowel signs are combining marks, not letters, so
  // omitting it would split every word at its first matra.
  const tokens = haystack.split(/[^\p{L}\p{N}\p{M}]+/u).filter((tok) => tok.length >= 3);
  for (const token of tokens) {
    const direct = INDEX.get(token);
    if (direct) return direct;

    let stem = stripIndicSuffix(token);
    for (let depth = 0; depth < 2 && stem; depth += 1) {
      const hit = INDEX.get(stem);
      if (hit) return hit;
      stem = stripIndicSuffix(stem);
    }
  }

  return null;
}

/**
 * Every distinct seeded place mentioned in a sentence.
 *
 * Used to detect compound questions — "compare Kolkata and Mumbai" needs a
 * different execution path from "weather in Kolkata", and two named places is the
 * cheapest reliable signal. Limited to the seed, so an exotic pair may route to
 * the deterministic path; the other complexity signals (comparative wording,
 * personal context) still catch those.
 */
export function scanAllPlaces(text) {
  const haystack = norm(text);
  const hits = [];

  for (const [key, record] of INDEX) {
    if (key.length < 3) continue;
    const boundary = new RegExp(`(^|[^\\p{L}])${escapeRegex(key)}($|[^\\p{L}])`, 'u');
    if (boundary.test(haystack)) hits.push({ key, record });
  }

  // Drop any hit whose key is a substring of a longer hit.
  const longest = hits.filter(
    (hit) => !hits.some((other) => other !== hit && other.key.includes(hit.key)),
  );

  const unique = new Map();
  for (const { record } of longest) unique.set(record.name, record);
  return [...unique.values()];
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------- localised display names -- */

/**
 * Native-script names for the seed, derived from the alias lists rather than
 * duplicated: each alias is written in exactly one script, and a script implies
 * the language(s) using it. Devanagari serves both Hindi and Marathi.
 *
 * For anything outside the seed, the geocoder supplies a localised name directly
 * (it honours `accept-language`), which is why this table no longer needs to be
 * comprehensive.
 */
const SCRIPT_TO_LANGS = [
  { re: /[\u0900-\u097F]/, langs: ['hi', 'mr'] },
  { re: /[\u0980-\u09FF]/, langs: ['bn'] },
  { re: /[\u0A00-\u0A7F]/, langs: ['pa'] },
  { re: /[\u0A80-\u0AFF]/, langs: ['gu'] },
  { re: /[\u0B80-\u0BFF]/, langs: ['ta'] },
  { re: /[\u0C00-\u0C7F]/, langs: ['te'] },
  { re: /[\u0C80-\u0CFF]/, langs: ['kn'] },
  { re: /[\u0D00-\u0D7F]/, langs: ['ml'] },
];

const NATIVE_NAMES = new Map();
for (const place of SEED_PLACES) {
  for (const alias of place.aliases ?? []) {
    const match = SCRIPT_TO_LANGS.find(({ re }) => re.test(alias));
    if (!match) continue;
    for (const lang of match.langs) {
      const key = `${place.name}|${lang}`;
      if (!NATIVE_NAMES.has(key)) NATIVE_NAMES.set(key, alias);
    }
  }
}

/**
 * Display name for a place in the given language.
 *
 * Prefers a name the geocoder returned in that language, then the seed table,
 * then English — so answers never contain a blank where a city should be.
 */
export function localisedPlaceName(place, lang = 'en') {
  if (!place) return '';
  // Hinglish is written in Latin script, so it keeps the English spelling.
  if (lang === 'en' || lang === 'hinglish') return place.name;
  if (place.localName) return place.localName;
  return NATIVE_NAMES.get(`${place.name}|${lang}`) ?? place.name;
}

/** True when a native-script spelling is available for this place and language. */
export function hasNativeName(place, lang) {
  if (!place || lang === 'en' || lang === 'hinglish') return false;
  return Boolean(place.localName) || NATIVE_NAMES.has(`${place.name}|${lang}`);
}
