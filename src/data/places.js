/**
 * Curated gazetteer.
 *
 * Purpose is twofold:
 *  1. Instant, offline resolution of the places users ask about most often —
 *     including native-script spellings that the upstream geocoder misses.
 *  2. Seed data for the globe's country labels.
 *
 * Anything not listed here is resolved live through the Open-Meteo geocoder,
 * so this is a fast path, not a limit.
 */

export const INDIA_PLACES = [
  {
    name: 'Kolkata',
    admin1: 'West Bengal',
    lat: 22.5726,
    lon: 88.3639,
    tz: 'Asia/Kolkata',
    aliases: ['calcutta', 'কলকাতা', 'कोलकाता', 'kolkatta'],
  },
  {
    name: 'New Delhi',
    admin1: 'Delhi',
    lat: 28.6139,
    lon: 77.209,
    tz: 'Asia/Kolkata',
    aliases: ['delhi', 'दिल्ली', 'नई दिल्ली', 'দিল্লি', 'ndls'],
  },
  {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    lat: 19.076,
    lon: 72.8777,
    tz: 'Asia/Kolkata',
    aliases: ['bombay', 'मुंबई', 'मुम्बई', 'মুম্বাই', 'மும்பை'],
  },
  {
    name: 'Chennai',
    admin1: 'Tamil Nadu',
    lat: 13.0827,
    lon: 80.2707,
    tz: 'Asia/Kolkata',
    aliases: ['madras', 'சென்னை', 'चेन्नई', 'চেন্নাই'],
  },
  {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    lat: 12.9716,
    lon: 77.5946,
    tz: 'Asia/Kolkata',
    aliases: ['bangalore', 'ಬೆಂಗಳೂರು', 'बेंगलुरु', 'பெங்களூரு'],
  },
  {
    name: 'Hyderabad',
    admin1: 'Telangana',
    lat: 17.385,
    lon: 78.4867,
    tz: 'Asia/Kolkata',
    aliases: ['హైదరాబాద్', 'हैदराबाद', 'হায়দ্রাবাদ'],
  },
  {
    name: 'Ahmedabad',
    admin1: 'Gujarat',
    lat: 23.0225,
    lon: 72.5714,
    tz: 'Asia/Kolkata',
    aliases: ['અમદાવાદ', 'अहमदाबाद', 'amdavad'],
  },
  {
    name: 'Pune',
    admin1: 'Maharashtra',
    lat: 18.5204,
    lon: 73.8567,
    tz: 'Asia/Kolkata',
    aliases: ['पुणे', 'poona'],
  },
  {
    name: 'Jaipur',
    admin1: 'Rajasthan',
    lat: 26.9124,
    lon: 75.7873,
    tz: 'Asia/Kolkata',
    aliases: ['जयपुर'],
  },
  {
    name: 'Lucknow',
    admin1: 'Uttar Pradesh',
    lat: 26.8467,
    lon: 80.9462,
    tz: 'Asia/Kolkata',
    aliases: ['लखनऊ'],
  },
  {
    name: 'Bhubaneswar',
    admin1: 'Odisha',
    lat: 20.2961,
    lon: 85.8245,
    tz: 'Asia/Kolkata',
    aliases: ['ଭୁବନେଶ୍ୱର', 'भुवनेश्वर'],
  },
  {
    name: 'Patna',
    admin1: 'Bihar',
    lat: 25.5941,
    lon: 85.1376,
    tz: 'Asia/Kolkata',
    aliases: ['पटना'],
  },
  {
    name: 'Guwahati',
    admin1: 'Assam',
    lat: 26.1445,
    lon: 91.7362,
    tz: 'Asia/Kolkata',
    aliases: ['गुवाहाटी', 'গুয়াহাটি'],
  },
  {
    name: 'Thiruvananthapuram',
    admin1: 'Kerala',
    lat: 8.5241,
    lon: 76.9366,
    tz: 'Asia/Kolkata',
    aliases: ['trivandrum', 'തിരുവനന്തപുരം', 'तिरुवनंतपुरम'],
  },
  {
    name: 'Kochi',
    admin1: 'Kerala',
    lat: 9.9312,
    lon: 76.2673,
    tz: 'Asia/Kolkata',
    aliases: ['cochin', 'കൊച്ചി', 'कोच्चि'],
  },
  {
    name: 'Nagpur',
    admin1: 'Maharashtra',
    lat: 21.1458,
    lon: 79.0882,
    tz: 'Asia/Kolkata',
    aliases: ['नागपूर', 'नागपुर'],
  },
  {
    name: 'Visakhapatnam',
    admin1: 'Andhra Pradesh',
    lat: 17.6868,
    lon: 83.2185,
    tz: 'Asia/Kolkata',
    aliases: ['vizag', 'విశాఖపట్నం', 'विशाखापत्तनम'],
  },
  {
    name: 'Chandigarh',
    admin1: 'Chandigarh',
    lat: 30.7333,
    lon: 76.7794,
    tz: 'Asia/Kolkata',
    aliases: ['चंडीगढ़', 'ਚੰਡੀਗੜ੍ਹ'],
  },
  {
    name: 'Shimla',
    admin1: 'Himachal Pradesh',
    lat: 31.1048,
    lon: 77.1734,
    tz: 'Asia/Kolkata',
    aliases: ['शिमला'],
  },
  {
    name: 'Srinagar',
    admin1: 'Jammu and Kashmir',
    lat: 34.0837,
    lon: 74.7973,
    tz: 'Asia/Kolkata',
    aliases: ['श्रीनगर'],
  },
  {
    name: 'Dehradun',
    admin1: 'Uttarakhand',
    lat: 30.3165,
    lon: 78.0322,
    tz: 'Asia/Kolkata',
    aliases: ['देहरादून'],
  },
  {
    name: 'Bhopal',
    admin1: 'Madhya Pradesh',
    lat: 23.2599,
    lon: 77.4126,
    tz: 'Asia/Kolkata',
    aliases: ['भोपाल'],
  },
  {
    name: 'Raipur',
    admin1: 'Chhattisgarh',
    lat: 21.2514,
    lon: 81.6296,
    tz: 'Asia/Kolkata',
    aliases: ['रायपुर'],
  },
  {
    name: 'Ranchi',
    admin1: 'Jharkhand',
    lat: 23.3441,
    lon: 85.3096,
    tz: 'Asia/Kolkata',
    aliases: ['रांची'],
  },
  {
    name: 'Coimbatore',
    admin1: 'Tamil Nadu',
    lat: 11.0168,
    lon: 76.9558,
    tz: 'Asia/Kolkata',
    aliases: ['கோயம்புத்தூர்', 'कोयंबटूर'],
  },
  {
    name: 'Madurai',
    admin1: 'Tamil Nadu',
    lat: 9.9252,
    lon: 78.1198,
    tz: 'Asia/Kolkata',
    aliases: ['மதுரை'],
  },
  {
    name: 'Varanasi',
    admin1: 'Uttar Pradesh',
    lat: 25.3176,
    lon: 82.9739,
    tz: 'Asia/Kolkata',
    aliases: ['banaras', 'kashi', 'वाराणसी', 'बनारस'],
  },
  {
    name: 'Amritsar',
    admin1: 'Punjab',
    lat: 31.634,
    lon: 74.8723,
    tz: 'Asia/Kolkata',
    aliases: ['ਅੰਮ੍ਰਿਤਸਰ', 'अमृतसर'],
  },
  {
    name: 'Surat',
    admin1: 'Gujarat',
    lat: 21.1702,
    lon: 72.8311,
    tz: 'Asia/Kolkata',
    aliases: ['સુરત', 'सूरत'],
  },
  {
    name: 'Indore',
    admin1: 'Madhya Pradesh',
    lat: 22.7196,
    lon: 75.8577,
    tz: 'Asia/Kolkata',
    aliases: ['इंदौर'],
  },
  {
    name: 'Puri',
    admin1: 'Odisha',
    lat: 19.8135,
    lon: 85.8312,
    tz: 'Asia/Kolkata',
    aliases: ['पुरी', 'ପୁରୀ'],
  },
  {
    name: 'Port Blair',
    admin1: 'Andaman and Nicobar Islands',
    lat: 11.6234,
    lon: 92.7265,
    tz: 'Asia/Kolkata',
    aliases: ['पोर्ट ब्लेयर'],
  },
  {
    name: 'Leh',
    admin1: 'Ladakh',
    lat: 34.1526,
    lon: 77.5771,
    tz: 'Asia/Kolkata',
    aliases: ['लेह'],
  },
  {
    name: 'Jodhpur',
    admin1: 'Rajasthan',
    lat: 26.2389,
    lon: 73.0243,
    tz: 'Asia/Kolkata',
    aliases: ['जोधपुर'],
  },
  {
    name: 'Cherrapunji',
    admin1: 'Meghalaya',
    lat: 25.3,
    lon: 91.7,
    tz: 'Asia/Kolkata',
    aliases: ['sohra', 'चेरापूंजी'],
  },
];

export const WORLD_PLACES = [
  { name: 'London', admin1: 'England', country: 'United Kingdom', lat: 51.5072, lon: -0.1276 },
  { name: 'New York', admin1: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
  { name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Dubai', admin1: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708 },
  { name: 'Singapore', admin1: '', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Sydney', admin1: 'NSW', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { name: 'Colombo', admin1: '', country: 'Sri Lanka', lat: 6.9271, lon: 79.8612 },
  { name: 'Kathmandu', admin1: '', country: 'Nepal', lat: 27.7172, lon: 85.324 },
  { name: 'Dhaka', admin1: '', country: 'Bangladesh', lat: 23.8103, lon: 90.4125 },
];

/** Country labels drawn on the 3D globe (matches the reference design). */
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
  { text: 'Sudan', lat: 15, lon: 30, size: 0.5 },
  { text: 'Mongolia', lat: 46, lon: 104, size: 0.55 },
  { text: 'Myanmar', lat: 21, lon: 96, size: 0.5 },
  { text: 'Thailand', lat: 15, lon: 101, size: 0.5 },
];

const ALL = [...INDIA_PLACES, ...WORLD_PLACES];

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[.,!?;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Lookup index: every name + alias (normalised) -> place record. */
const INDEX = new Map();
for (const place of ALL) {
  const record = {
    name: place.name,
    admin1: place.admin1 ?? '',
    country: place.country ?? 'India',
    countryCode: place.country ? '' : 'IN',
    latitude: place.lat,
    longitude: place.lon,
    timezone: place.tz ?? 'auto',
    source: 'gazetteer',
  };
  INDEX.set(norm(place.name), record);
  for (const alias of place.aliases ?? []) INDEX.set(norm(alias), record);
}

/** Exact (normalised) match against the curated gazetteer. */
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
 * Matching therefore has to tolerate an agglutinated tail. Ordered longest
 * first so the most specific suffix is removed.
 */
const INDIC_SUFFIXES = [
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
function stripIndicSuffix(token) {
  for (const suffix of INDIC_SUFFIXES) {
    if (token.length > suffix.length + 1 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return null;
}

/**
 * Scan a free-form sentence for any known place name, preferring the longest
 * match so "new delhi" wins over "delhi".
 *
 * Two passes:
 *  1. whole-string boundary match — handles multi-word names and Latin script;
 *  2. token match with suffix stripping — handles agglutinated Indic forms.
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

  // Pass 2 — per-token, tolerating attached case markers.
  // \p{M} is essential here: Indic vowel signs are combining marks, not letters,
  // so omitting it would split every word at its first matra.
  const tokens = haystack.split(/[^\p{L}\p{N}\p{M}]+/u).filter((tok) => tok.length >= 3);
  for (const token of tokens) {
    const direct = INDEX.get(token);
    if (direct) return direct;

    let stem = stripIndicSuffix(token);
    // A name can carry a stacked suffix (e.g. சென்னை + யில் handled in one go,
    // but கொச்சி + യിൽ style forms may need a second pass).
    for (let depth = 0; depth < 2 && stem; depth += 1) {
      const hit = INDEX.get(stem);
      if (hit) return hit;
      stem = stripIndicSuffix(stem);
    }
  }

  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const PLACE_NAMES = ALL.map((p) => p.name);

/* ------------------------------------------------- localised display names -- */

/**
 * Native-script display names, derived from the alias lists rather than
 * duplicated by hand: each alias is already written in exactly one script, and
 * a script implies the language(s) that use it. So "কলকাতা" becomes the Bengali
 * label for Kolkata automatically, and adding an alias for search also improves
 * how the name is rendered back to the user.
 *
 * Devanagari serves both Hindi and Marathi, so it is registered for both.
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

/** `${englishName}|${lang}` -> native name */
const NATIVE_NAMES = new Map();

for (const place of ALL) {
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
 * Returns the English name when no native spelling is known, so answers never
 * contain a blank where a city should be.
 */
export function localisedPlaceName(place, lang = 'en') {
  if (!place) return '';
  if (lang === 'en') return place.name;
  return NATIVE_NAMES.get(`${place.name}|${lang}`) ?? place.name;
}

/** True when a native-script spelling exists for this place and language. */
export function hasNativeName(place, lang) {
  return Boolean(place && lang !== 'en' && NATIVE_NAMES.has(`${place.name}|${lang}`));
}
