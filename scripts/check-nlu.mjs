/**
 * Sanity harness for the query-understanding engine.
 * Run with: node scripts/check-nlu.mjs
 */
import { parseQuery, assessComplexity } from '../src/services/nlu.js';

const CASES = [
  // [query, expected intent, expected place (or null), preferred UI language]
  ['What is the weather in Kolkata?', 'current', 'Kolkata'],
  ['weather in Nagpur today', 'current', 'Nagpur'],
  ['Will it rain tomorrow?', 'rain', null],
  ['Show 7-day forecast', 'forecast', null],
  ['Air quality in Delhi', 'aqi', 'New Delhi'],
  ['any cyclone warning for Puri', 'alerts', 'Puri'],
  ['climate trend for Shimla over the years', 'climate', 'Shimla'],
  ['how accurate is the GFS model for Chennai', 'models', 'Chennai'],
  ['crop advisory for farmers in Ludhiana', 'advisory', null],
  ['aviation briefing for Mumbai airport', 'advisory', 'Mumbai'],
  ['is it safe for fishing near Kochi', 'advisory', 'Kochi'],
  ['waterlogging risk in Bengaluru', 'advisory', 'Bengaluru'],
  ['hello', 'greeting', null],
  ['Shimla', 'current', 'Shimla'],
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
  ['ਅੰਮ੍ਰਿਤਸਰ ਦਾ ਮੌਸਮ', 'current', 'Amritsar', 'pa'],
  ['ಬೆಂಗಳೂರು ಹವಾಮಾನ', 'current', 'Bengaluru', 'kn'],
  ['കൊച്ചിയിൽ മഴ ഉണ്ടാകുമോ?', 'rain', 'Kochi', 'ml'],
  ['અમદાવાદમાં તાપમાન', 'current', 'Ahmedabad', 'gu'],
];

let pass = 0;
let fail = 0;

for (const [query, wantIntent, wantPlace, uiLang = 'en'] of CASES) {
  const r = parseQuery(query, { lang: uiLang });
  const gotPlace = r.place?.name ?? null;
  const intentOk = r.intent === wantIntent;
  const placeOk = wantPlace == null ? true : gotPlace === wantPlace;
  const ok = intentOk && placeOk;
  if (ok) pass += 1;
  else fail += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${query}\n      lang=${r.lang} intent=${r.intent}${intentOk ? '' : ` (want ${wantIntent})`}` +
      ` place=${gotPlace ?? '—'}${placeOk ? '' : ` (want ${wantPlace})`}` +
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

const total = CASES.length + ROUTING.length;
console.log(`\n${pass} passed, ${fail} failed, ${total} total`);
process.exit(fail > 0 ? 1 : 0);
