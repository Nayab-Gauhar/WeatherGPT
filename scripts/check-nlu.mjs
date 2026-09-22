/**
 * Sanity harness for the query-understanding engine.
 * Run with: node scripts/check-nlu.mjs
 */
import { parseQuery, assessComplexity } from '../src/services/nlu.js';
import { parseCoordinates, wrapLongitude } from '../src/utils/coords.js';

/*
 * [query, intent, resolvedPlace|null, uiLang, expectedLocationQuery?]
 *
 * `resolvedPlace` is only expected for the twelve places in the offline seed.
 * Everywhere else the parser's job ends at *extracting* the place text — the
 * geocoder resolves it asynchronously — so those rows assert the 5th field
 * instead. This split is deliberate: it keeps the parser synchronous and
 * network-free while letting coverage extend to any place on earth.
 */
const CASES = [
  ['What is the weather in Kolkata?', 'current', 'Kolkata'],
  ['weather in Nagpur today', 'current', 'Nagpur'],
  ['Will it rain tomorrow?', 'rain', null],
  ['Show 7-day forecast', 'forecast', null],
  ['Air quality in Delhi', 'aqi', 'New Delhi'],
  ['any cyclone warning for Puri', 'alerts', null, 'en', 'Puri'],
  ['climate trend for Shimla over the years', 'climate', null, 'en', 'Shimla'],
  ['how accurate is the GFS model for Chennai', 'models', 'Chennai'],
  ['crop advisory for farmers in Ludhiana', 'advisory', null],
  ['aviation briefing for Mumbai airport', 'advisory', 'Mumbai'],
  ['is it safe for fishing near Kochi', 'advisory', 'Kochi'],
  ['waterlogging risk in Bengaluru', 'advisory', 'Bengaluru'],
  ['hello', 'greeting', null],
  ['Shimla', 'current', null, 'en', 'Shimla'],
  ['कोलकाता में मौसम कैसा है?', 'current', 'Kolkata', 'hi'],
  ['कल बारिश होगी क्या?', 'rain', null, 'hi'],
  ['दिल्ली में वायु प्रदूषण', 'aqi', 'New Delhi', 'hi'],
  ['किसान के लिए फसल सलाह', 'advisory', null, 'hi'],
  ['কলকাতায় আবহাওয়া কেমন?', 'current', 'Kolkata', 'bn'],
  ['আগামীকাল বৃষ্টি হবে?', 'rain', null, 'bn'],
  ['சென்னையில் வானிலை எப்படி?', 'current', 'Chennai', 'ta'],
  ['நாளை மழை வருமா?', 'rain', null, 'ta'],
  ['హైదరాబాద్ వాతావరణం', 'current', 'Hyderabad', 'te'],
  ['पुण्यात उद्या पाऊस पडेल का?', 'rain', null, 'mr'],
  ['ਅੰਮ੍ਰਿਤਸਰ ਦਾ ਮੌਸਮ', 'current', null, 'pa', 'ਅੰਮ੍ਰਿਤਸਰ'],
  ['ಬೆಂಗಳೂರು ಹವಾಮಾನ', 'current', 'Bengaluru', 'kn'],
  ['കൊച്ചിയിൽ മഴ ഉണ്ടാകുമോ?', 'rain', 'Kochi', 'ml'],
  ['અમદાવાદમાં તાપમાન', 'current', 'Ahmedabad', 'gu'],
  // Hinglish — Hindi typed in the Latin alphabet, how a large share of Indian
  // users actually write. Script detection alone reads this as English.
  ['Kolkata ka mausam kaisa hai?', 'current', 'Kolkata', 'en'],
  ['kal barish hogi kya', 'rain', null, 'en'],
  ['nagpur mein aaj garmi kitni hai', 'current', 'Nagpur', 'en'],
  ['delhi ka pradushan batao', 'aqi', 'New Delhi', 'en'],
  ['puri ke liye chakravat chetavni', 'alerts', null, 'en', 'puri'],
  ['kisan ke liye fasal salah chahiye', 'advisory', null, 'en'],
  ['shimla ka jalvayu trend', 'climate', null, 'en', 'shimla'],
];

let pass = 0;
let fail = 0;

for (const [query, wantIntent, wantPlace, uiLang = 'en', wantQuery] of CASES) {
  const r = parseQuery(query, { lang: uiLang });
  const gotPlace = r.place?.name ?? null;
  const intentOk = r.intent === wantIntent;
  const placeOk = wantPlace == null ? true : gotPlace === wantPlace;
  const queryOk = wantQuery == null ? true : (r.locationQuery ?? '').includes(wantQuery);
  const ok = intentOk && placeOk && queryOk;
  if (ok) pass += 1;
  else fail += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${query}\n      lang=${r.lang} intent=${r.intent}${intentOk ? '' : ` (want ${wantIntent})`}` +
      ` place=${gotPlace ?? '—'}${placeOk ? '' : ` (want ${wantPlace})`}` +
      ` query=${JSON.stringify(r.locationQuery)}${queryOk ? '' : ` (want ${wantQuery})`}` +
      ` sector=${r.sector ?? '—'} day=${r.dayOffset ?? '—'} horizon=${r.horizonDays ?? '—'} conf=${r.confidence.toFixed(2)}`,
  );
}

/* ---------------------------------------------------------------- routing -- */

/**
 * Tier 1 vs Tier 2 routing.
 *
 * These exist because a genuine bug slipped through: "is this September wetter
 * than normal in Nagpur, and will next week continue?" scored high confidence on
 * the climate intent, stayed on the deterministic path, and answered only the
 * first half of the question. Cheap to assert, expensive to notice by hand.
 */
const ROUTING = [
  // [query, shouldEscalateToLlm]
  ['weather in Kolkata', false],
  ['7 day forecast for Pune', false],
  ['will it rain tomorrow', false],
  ['air quality in Delhi', false],
  ['climate trend for Shimla', false],
  ['any warnings for Puri', false],
  ['कोलकाता में मौसम कैसा है?', false],
  ['कल बारिश होगी क्या?', false],
  ['কলকাতায় আবহাওয়া কেমন?', false],

  ['Compare rainfall in Kolkata and Mumbai this week', true],
  ['Is Delhi or Jaipur hotter right now?', true],
  ['I have asthma and want to jog tomorrow morning in Delhi. Good idea?', true],
  ['Is this September wetter than normal in Nagpur, and will next week continue the trend?', true],
  ['Why is it so humid in Chennai?', true],
  ['Should I water my paddy field this week in Nagpur?', true],
  ['my daughter has a wedding in Jaipur next week, will the weather hold?', true],
];

console.log('\n--- routing (Tier 1 deterministic vs Tier 2 language model) ---');
for (const [query, wantLlm] of ROUTING) {
  const parsed = parseQuery(query, { lang: 'en' });
  const { needsLlm, reasons } = assessComplexity(query, parsed);
  const ok = needsLlm === wantLlm;
  if (ok) pass += 1;
  else fail += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  [${needsLlm ? 'TIER-2' : 'TIER-1'}${ok ? '' : ` want TIER-${wantLlm ? 2 : 1}`}] ${query}` +
      (reasons.length ? `\n        reasons: ${reasons.join(', ')}` : ''),
  );
}

/* ------------------------------------------------------- language detection -- */

/*
 * Hinglish detection has two failure modes and both matter: missing it sends a
 * clear question to the fallback message, while over-firing makes an English
 * user receive romanised Hindi.
 */
const LANGS = [
  ['Kolkata ka mausam kaisa hai?', 'hinglish'],
  ['kal barish hogi kya', 'hinglish'],
  ['mujhe kisan salah chahiye', 'hinglish'],
  ['aaj shimla mein thand hai', 'hinglish'],
  ['What is the weather in Kolkata?', 'en'],
  ['Show 7-day forecast', 'en'],
  ['air quality in Delhi', 'en'],
  ['Is it going to rain in Karachi tomorrow', 'en'],
  ['Compare Delhi and Mumbai rainfall', 'en'],
  ['कोलकाता में मौसम कैसा है?', 'hi'],
  ['কলকাতায় আবহাওয়া কেমন?', 'bn'],
  ['சென்னையில் வானிலை எப்படி?', 'ta'],
];

console.log('\n--- language detection (Hinglish vs English vs native scripts) ---');
for (const [query, wantLang] of LANGS) {
  const got = parseQuery(query, { lang: 'en' }).lang;
  const ok = got === wantLang;
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${got}${ok ? '' : ` want ${wantLang}`}] ${query}`);
}

/* --------------------------------------------------------------- coordinates -- */

/*
 * Coordinate parsing has to be permissive about format and strict about intent:
 * people paste positions from maps in half a dozen notations, but an ordinary
 * sentence containing two numbers must never be read as one.
 */
const COORDS = [
  ['22.57, 88.36', true],
  ['22.57 88.36', true],
  ['22.57N 88.36E', true],
  ['lat 22.57 lon 88.36', true],
  ["12°58'30\"N 77°35'00\"E", true],
  ['-33.87, 151.21', true],
  ['7 day forecast', false],
  ['Show 7-day forecast', false],
  ['weather in Kolkata', false],
  ['kal barish hogi kya', false],
  ['next 24 hours', false],
  ['2 3', false],
  ['95.0, 88.0', false],   // latitude out of range — reject, do not clamp
  ['22.5, 200.0', false],  // longitude out of range
];

console.log('\n--- coordinate parsing ---');
for (const [query, shouldParse] of COORDS) {
  const got = parseCoordinates(query);
  const ok = Boolean(got) === shouldParse;
  if (ok) pass += 1;
  else fail += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${shouldParse ? 'coords' : 'prose '} ${JSON.stringify(query)}` +
      (got ? ` -> ${got.latitude}, ${got.longitude}` : ''),
  );
}

// Longitude must wrap rather than be rejected: dragging a map east past the
// antimeridian legitimately produces values beyond 180.
const WRAP = [[190, -170], [-190, 170], [360, 0], [181, -179], [88.36, 88.36]];
for (const [input, want] of WRAP) {
  const got = wrapLongitude(input);
  const ok = got === want;
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  wrapLongitude(${input}) = ${got}${ok ? '' : ` want ${want}`}`);
}

const total = CASES.length + ROUTING.length + LANGS.length + COORDS.length + WRAP.length;
console.log(`\n${pass} passed, ${fail} failed, ${total} total`);
process.exit(fail > 0 ? 1 : 0);
