/**
 * Sanity harness for the query-understanding engine.
 * Run with: node scripts/check-nlu.mjs
 */
import { parseQuery } from '../src/services/nlu.js';

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

console.log(`\n${pass} passed, ${fail} failed, ${CASES.length} total`);
process.exit(fail > 0 ? 1 : 0);
