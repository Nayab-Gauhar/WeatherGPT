/**
 * Advisory generation — turns numbers into decisions.
 *
 * Two layers:
 *  1. `generalAdvisory()` — the short "what does this mean for me in the next
 *     24 hours" line shown under every current-weather answer.
 *  2. `sectorAdvisory()` — structured decision support for the four sectors
 *     named in the problem statement: agriculture, aviation, marine and urban /
 *     disaster management.
 */

import { isWet, conditionLabel } from '../data/wmo.js';
import { bnLocative } from '../i18n/grammar.js';

/* ------------------------------------------------- general 24-hour advisory -- */

const PHRASES = {
  en: {
    rainLight: (p) => `Light rain is possible in ${p} over the next 24 hours.`,
    rainModerate: (p) => `Light to moderate rain is expected in ${p} over the next 24 hours.`,
    rainHeavy: (p) => `Heavy rain is expected in ${p} over the next 24 hours.`,
    umbrella: 'Carry an umbrella.',
    waterlog: 'Some areas may experience waterlogging.',
    thunder: 'Thunderstorms with lightning are likely — stay indoors during activity.',
    hot: (t) => `Daytime temperature may reach ${t}°C. Stay hydrated and avoid direct sun at midday.`,
    cold: (t) => `Minimum temperature may fall to ${t}°C. Keep warm clothing ready.`,
    windy: (w) => `Winds gusting to ${w} km/h are expected. Secure loose objects outdoors.`,
    fog: 'Dense fog may reduce visibility sharply in the morning — drive carefully.',
    pleasant: (p) => `Conditions in ${p} look comfortable over the next 24 hours.`,
    dry: (p) => `No rain is expected in ${p} over the next 24 hours.`,
  },
  hi: {
    rainLight: (p) => `अगले 24 घंटों में ${p} में हल्की बारिश संभव है।`,
    rainModerate: (p) => `अगले 24 घंटों में ${p} में हल्की से मध्यम बारिश की संभावना है।`,
    rainHeavy: (p) => `अगले 24 घंटों में ${p} में भारी बारिश की संभावना है।`,
    umbrella: 'छाता साथ रखें।',
    waterlog: 'कुछ इलाकों में जलभराव हो सकता है।',
    thunder: 'गरज-चमक के साथ तूफान संभव — इस दौरान घर के अंदर रहें।',
    hot: (t) => `दिन का तापमान ${t}°C तक पहुँच सकता है। पानी पीते रहें और दोपहर में धूप से बचें।`,
    cold: (t) => `न्यूनतम तापमान ${t}°C तक गिर सकता है। गर्म कपड़े तैयार रखें।`,
    windy: (w) => `${w} किमी/घंटा तक की तेज हवाएँ चल सकती हैं। बाहरी सामान सुरक्षित करें।`,
    fog: 'सुबह घना कोहरा दृश्यता घटा सकता है — सावधानी से वाहन चलाएँ।',
    pleasant: (p) => `अगले 24 घंटों में ${p} का मौसम सुखद रहने की संभावना है।`,
    dry: (p) => `अगले 24 घंटों में ${p} में बारिश की संभावना नहीं है।`,
  },
  bn: {
    rainLight: (p) => `পরবর্তী ২৪ ঘণ্টায় ${bnLocative(p)} হালকা বৃষ্টি হতে পারে।`,
    rainModerate: (p) => `পরবর্তী ২৪ ঘণ্টায় ${bnLocative(p)} হালকা থেকে মাঝারি বৃষ্টির সম্ভাবনা রয়েছে।`,
    rainHeavy: (p) => `পরবর্তী ২৪ ঘণ্টায় ${bnLocative(p)} ভারী বৃষ্টির সম্ভাবনা রয়েছে।`,
    umbrella: 'ছাতা সঙ্গে রাখুন।',
    waterlog: 'কিছু এলাকায় জল জমতে পারে।',
    thunder: 'বজ্রঝড়ের সম্ভাবনা — সেই সময় ঘরের ভিতরে থাকুন।',
    hot: (t) => `দিনের তাপমাত্রা ${t}°C পর্যন্ত উঠতে পারে। পর্যাপ্ত জল পান করুন।`,
    cold: (t) => `সর্বনিম্ন তাপমাত্রা ${t}°C পর্যন্ত নামতে পারে। গরম পোশাক রাখুন।`,
    windy: (w) => `ঘণ্টায় ${w} কিমি পর্যন্ত দমকা হাওয়া বইতে পারে। খোলা জিনিস সুরক্ষিত রাখুন।`,
    fog: 'সকালে ঘন কুয়াশায় দৃশ্যমানতা কমতে পারে — সাবধানে গাড়ি চালান।',
    pleasant: (p) => `পরবর্তী ২৪ ঘণ্টায় ${bnLocative(p)} আবহাওয়া আরামদায়ক থাকবে।`,
    dry: (p) => `পরবর্তী ২৪ ঘণ্টায় ${bnLocative(p)} বৃষ্টির সম্ভাবনা নেই।`,
  },
  ta: {
    rainLight: (p) => `அடுத்த 24 மணி நேரத்தில் ${p} பகுதியில் லேசான மழை வாய்ப்பு உள்ளது.`,
    rainModerate: (p) => `அடுத்த 24 மணி நேரத்தில் ${p} பகுதியில் லேசான முதல் மிதமான மழை எதிர்பார்க்கப்படுகிறது.`,
    rainHeavy: (p) => `அடுத்த 24 மணி நேரத்தில் ${p} பகுதியில் கனமழை எதிர்பார்க்கப்படுகிறது.`,
    umbrella: 'குடையை எடுத்துச் செல்லுங்கள்.',
    waterlog: 'சில பகுதிகளில் நீர் தேங்கலாம்.',
    thunder: 'இடி மின்னலுடன் மழை வாய்ப்பு — அப்போது உள்ளே இருங்கள்.',
    hot: (t) => `பகல் வெப்பநிலை ${t}°C வரை உயரக்கூடும். நீர் அருந்திக் கொண்டிருங்கள்.`,
    cold: (t) => `குறைந்த வெப்பநிலை ${t}°C வரை குறையக்கூடும். கம்பளி ஆடைகள் தயாராக வைக்கவும்.`,
    windy: (w) => `மணிக்கு ${w} கிமீ வரை காற்று வீசக்கூடும். வெளிப்புற பொருட்களைப் பாதுகாக்கவும்.`,
    fog: 'காலையில் அடர் பனிமூட்டம் தெரிவுநிலையை குறைக்கலாம் — கவனமாக ஓட்டுங்கள்.',
    pleasant: (p) => `அடுத்த 24 மணி நேரத்தில் ${p} பகுதியில் வானிலை இதமாக இருக்கும்.`,
    dry: (p) => `அடுத்த 24 மணி நேரத்தில் ${p} பகுதியில் மழை வாய்ப்பு இல்லை.`,
  },
  te: {
    rainLight: (p) => `తదుపరి 24 గంటల్లో ${p} ప్రాంతంలో తేలికపాటి వర్షం సాధ్యం.`,
    rainModerate: (p) => `తదుపరి 24 గంటల్లో ${p} ప్రాంతంలో తేలిక నుంచి మోస్తరు వర్షం అంచనా.`,
    rainHeavy: (p) => `తదుపరి 24 గంటల్లో ${p} ప్రాంతంలో భారీ వర్షం అంచనా.`,
    umbrella: 'గొడుగు తీసుకెళ్లండి.',
    waterlog: 'కొన్ని ప్రాంతాల్లో నీరు నిలవవచ్చు.',
    thunder: 'ఉరుములు మెరుపులతో వర్షం సాధ్యం — ఆ సమయంలో ఇంటి లోపల ఉండండి.',
    hot: (t) => `పగటి ఉష్ణోగ్రత ${t}°C వరకు చేరవచ్చు. తగినంత నీరు తాగండి.`,
    cold: (t) => `కనిష్ఠ ఉష్ణోగ్రత ${t}°C వరకు పడిపోవచ్చు. వెచ్చని దుస్తులు సిద్ధం చేయండి.`,
    windy: (w) => `గంటకు ${w} కి.మీ వరకు గాలులు వీయవచ్చు. బయటి వస్తువులను భద్రపరచండి.`,
    fog: 'ఉదయం దట్టమైన పొగమంచు దృశ్యమానతను తగ్గించవచ్చు — జాగ్రత్తగా నడపండి.',
    pleasant: (p) => `తదుపరి 24 గంటల్లో ${p} ప్రాంతంలో వాతావరణం ఆహ్లాదంగా ఉంటుంది.`,
    dry: (p) => `తదుపరి 24 గంటల్లో ${p} ప్రాంతంలో వర్ష సూచన లేదు.`,
  },
  mr: {
    rainLight: (p) => `पुढील 24 तासांत ${p} येथे हलका पाऊस शक्य आहे.`,
    rainModerate: (p) => `पुढील 24 तासांत ${p} येथे हलका ते मध्यम पाऊस अपेक्षित आहे.`,
    rainHeavy: (p) => `पुढील 24 तासांत ${p} येथे मुसळधार पाऊस अपेक्षित आहे.`,
    umbrella: 'छत्री सोबत ठेवा.',
    waterlog: 'काही भागांत पाणी साचू शकते.',
    thunder: 'विजांसह वादळी पाऊस शक्य — त्या वेळी घरात राहा.',
    hot: (t) => `दिवसाचे तापमान ${t}°C पर्यंत जाऊ शकते. पुरेसे पाणी प्या.`,
    cold: (t) => `किमान तापमान ${t}°C पर्यंत घसरू शकते. उबदार कपडे तयार ठेवा.`,
    windy: (w) => `ताशी ${w} किमी वेगाने वारे वाहू शकतात. बाहेरील वस्तू सुरक्षित करा.`,
    fog: 'सकाळी दाट धुक्यामुळे दृश्यमानता कमी होऊ शकते — सावधपणे वाहन चालवा.',
    pleasant: (p) => `पुढील 24 तासांत ${p} येथील हवामान सुखद राहील.`,
    dry: (p) => `पुढील 24 तासांत ${p} येथे पावसाची शक्यता नाही.`,
  },
};

function ph(lang, key, ...args) {
  const fn = PHRASES[lang]?.[key] ?? PHRASES.en[key];
  return typeof fn === 'function' ? fn(...args) : fn;
}

/**
 * Compose the short advisory paragraph for the next 24 hours.
 * @returns {{ icon: string, text: string, tone: string }}
 */
export function generalAdvisory(forecast, placeName, lang = 'en') {
  const next24 = (forecast.hourly ?? []).slice(forecast.hourlyIndexNow ?? 0, (forecast.hourlyIndexNow ?? 0) + 24);
  const totalRain = next24.reduce((sum, h) => sum + (h.precip ?? 0), 0);
  const maxPop = Math.max(0, ...next24.map((h) => h.pop ?? 0));
  const hasThunder = next24.some((h) => [95, 96, 99].includes(h.code));
  const hasFog = next24.some((h) => [45, 48].includes(h.code));
  const maxGust = Math.max(0, ...next24.map((h) => h.gust ?? 0));
  const today = forecast.daily?.[0] ?? {};

  const parts = [];
  let icon = 'sun';
  let tone = 'info';

  if (totalRain >= 25 || maxPop >= 80) {
    parts.push(ph(lang, 'rainHeavy', placeName), ph(lang, 'umbrella'), ph(lang, 'waterlog'));
    icon = 'umbrella';
    tone = 'warn';
  } else if (totalRain >= 2.5 || maxPop >= 45) {
    parts.push(ph(lang, 'rainModerate', placeName), ph(lang, 'umbrella'));
    if (totalRain >= 10) parts.push(ph(lang, 'waterlog'));
    icon = 'umbrella';
  } else if (maxPop >= 25 || next24.some((h) => isWet(h.code))) {
    parts.push(ph(lang, 'rainLight', placeName), ph(lang, 'umbrella'));
    icon = 'umbrella';
  }

  if (hasThunder) {
    parts.push(ph(lang, 'thunder'));
    icon = 'thunder';
    tone = 'warn';
  }

  if ((today.tmax ?? 0) >= 38) {
    parts.push(ph(lang, 'hot', Math.round(today.tmax)));
    if (icon === 'sun') icon = 'heat';
    tone = 'warn';
  } else if ((today.tmin ?? 99) <= 8) {
    parts.push(ph(lang, 'cold', Math.round(today.tmin)));
    if (icon === 'sun') icon = 'cold';
  }

  if (maxGust >= 40) {
    parts.push(ph(lang, 'windy', Math.round(maxGust)));
    if (icon === 'sun') icon = 'wind';
  }

  if (hasFog) {
    parts.push(ph(lang, 'fog'));
    if (icon === 'sun') icon = 'fog';
  }

  if (!parts.length) {
    const comfy = (today.tmax ?? 30) <= 33 && (today.tmin ?? 20) >= 12;
    parts.push(comfy ? ph(lang, 'pleasant', placeName) : ph(lang, 'dry', placeName));
  }

  return { icon, tone, text: parts.join(' ') };
}

/* ------------------------------------------------------- sector advisories -- */

const SECTOR_TITLES = {
  en: {
    agriculture: 'Agro-meteorological Advisory',
    aviation: 'Aviation Weather Briefing',
    marine: 'Marine & Fishermen Advisory',
    urban: 'Urban & Disaster Management Advisory',
  },
  hi: {
    agriculture: 'कृषि-मौसम सलाह',
    aviation: 'विमानन मौसम ब्रीफिंग',
    marine: 'समुद्री एवं मछुआरा सलाह',
    urban: 'शहरी एवं आपदा प्रबंधन सलाह',
  },
  bn: {
    agriculture: 'কৃষি-আবহাওয়া পরামর্শ',
    aviation: 'বিমান আবহাওয়া ব্রিফিং',
    marine: 'সমুদ্র ও মৎস্যজীবী পরামর্শ',
    urban: 'শহর ও দুর্যোগ ব্যবস্থাপনা পরামর্শ',
  },
  ta: {
    agriculture: 'வேளாண் வானிலை ஆலோசனை',
    aviation: 'விமான வானிலை அறிக்கை',
    marine: 'கடல் மற்றும் மீனவர் ஆலோசனை',
    urban: 'நகர மற்றும் பேரிடர் மேலாண்மை ஆலோசனை',
  },
  te: {
    agriculture: 'వ్యవసాయ వాతావరణ సూచన',
    aviation: 'విమానయాన వాతావరణ నివేదిక',
    marine: 'సముద్ర మరియు మత్స్యకార సూచన',
    urban: 'నగర మరియు విపత్తు నిర్వహణ సూచన',
  },
  mr: {
    agriculture: 'कृषी-हवामान सल्ला',
    aviation: 'विमान हवामान माहिती',
    marine: 'सागरी व मच्छीमार सल्ला',
    urban: 'शहरी व आपत्ती व्यवस्थापन सल्ला',
  },
};

export const SECTORS = ['agriculture', 'aviation', 'marine', 'urban'];

/**
 * @returns {{ sector: string, title: string, headline: string, points: Array<{label:string, value:string, note:string}> }}
 */
export function sectorAdvisory(sector, forecast, place, { lang = 'en', air = null } = {}) {
  const title = SECTOR_TITLES[lang]?.[sector] ?? SECTOR_TITLES.en[sector];
  const builder = BUILDERS[sector] ?? BUILDERS.agriculture;
  const built = builder(forecast, place, { lang, air });
  return { sector, title, ...built };
}

const next = (forecast, hours) => {
  const start = forecast.hourlyIndexNow ?? 0;
  return (forecast.hourly ?? []).slice(start, start + hours);
};

const sum = (list, key) => list.reduce((a, h) => a + (h[key] ?? 0), 0);
const maxOf = (list, key) => Math.max(0, ...list.map((h) => h[key] ?? 0));

const BUILDERS = {
  agriculture(forecast, place, { lang }) {
    const h24 = next(forecast, 24);
    const h72 = next(forecast, 72);
    const rain24 = sum(h24, 'precip');
    const rain72 = sum(h72, 'precip');
    const gust = maxOf(h24, 'gust');
    const humidity = h24.length ? Math.round(sum(h24, 'humidity') / h24.length) : null;
    const tmax = forecast.daily?.[0]?.tmax;
    const dryWindow = findDryWindow(h72);

    const points = [];

    points.push({
      label: 'Irrigation',
      value: rain72 >= 15 ? 'Defer' : rain72 >= 5 ? 'Reduce' : 'Proceed as planned',
      note:
        rain72 >= 15
          ? `About ${Math.round(rain72)} mm of rain is expected in 72 hours — postpone irrigation to conserve water and avoid root rot.`
          : rain72 >= 5
            ? `Light rain (~${Math.round(rain72)} mm) expected in 72 hours; irrigate lightly if soil is dry.`
            : 'No significant rain expected in 72 hours. Maintain the normal irrigation schedule, preferably early morning.',
    });

    points.push({
      label: 'Spraying',
      value: rain24 >= 2.5 || gust >= 25 ? 'Not advised' : dryWindow ? 'Favourable' : 'Use caution',
      note:
        rain24 >= 2.5
          ? 'Rain will wash off foliar sprays. Wait for a dry spell of at least 6 hours after application.'
          : gust >= 25
            ? `Winds gusting to ${Math.round(gust)} km/h will cause spray drift. Postpone chemical application.`
            : dryWindow
              ? `A dry window is available from ${fmtHour(dryWindow.start)} to ${fmtHour(dryWindow.end)} — suitable for spraying.`
              : 'Conditions are marginal. Spray only in calm, dry hours.',
    });

    points.push({
      label: 'Harvest & threshing',
      value: rain72 >= 10 ? 'Advance / protect' : 'Normal',
      note:
        rain72 >= 10
          ? 'Harvest mature crops early and store produce under cover on raised platforms. Cover threshing floors.'
          : 'Weather is suitable for harvesting, drying and threshing operations.',
    });

    if (humidity != null && humidity >= 80 && (tmax ?? 0) >= 25) {
      points.push({
        label: 'Pest & disease',
        value: 'Elevated risk',
        note: `Humidity around ${humidity}% with warm days favours fungal blight and stem borer. Scout fields and consult the local KVK before treatment.`,
      });
    }

    if ((tmax ?? 0) >= 40) {
      points.push({
        label: 'Heat stress',
        value: 'Protect crops & livestock',
        note: `Maximum temperature near ${Math.round(tmax)}°C. Mulch beds, irrigate in the evening, and provide shade and drinking water to livestock.`,
      });
    }

    return {
      headline:
        rain72 >= 15
          ? `Wet spell ahead at ${place.name} — plan field operations around the rain.`
          : `Largely dry spell at ${place.name} — favourable for routine field operations.`,
      points,
      lang,
    };
  },

  aviation(forecast, place, { lang }) {
    const h12 = next(forecast, 12);
    const c = forecast.current;
    const minVis = Math.min(...h12.map((h) => h.visibility ?? Infinity));
    const gust = maxOf(h12, 'gust');
    const thunder = h12.some((h) => [95, 96, 99].includes(h.code));
    const visKm = Number.isFinite(minVis) ? minVis / 1000 : null;

    const flightCategory = (() => {
      if (visKm == null) return 'UNKNOWN';
      if (visKm < 0.8) return 'LIFR';
      if (visKm < 1.6) return 'IFR';
      if (visKm < 5) return 'MVFR';
      return 'VFR';
    })();

    const points = [
      {
        label: 'Surface wind',
        value: `${c.windCompass} ${Math.round(c.windSpeed ?? 0)} km/h${gust >= 30 ? `, gust ${Math.round(gust)}` : ''}`,
        note:
          gust >= 50
            ? 'Strong gusts — expect significant crosswind component and possible operational limits for light aircraft.'
            : gust >= 30
              ? 'Moderate gusts. Review crosswind limits for the active runway.'
              : 'Wind within routine operating limits.',
      },
      {
        label: 'Visibility / category',
        value: visKm != null ? `${visKm.toFixed(1)} km · ${flightCategory}` : flightCategory,
        note:
          flightCategory === 'LIFR' || flightCategory === 'IFR'
            ? 'Instrument approach mandatory; low-visibility procedures likely in force. Expect holding and diversions.'
            : flightCategory === 'MVFR'
              ? 'Marginal VFR. Carry alternate fuel and monitor trend TAFs.'
              : 'Visual conditions expected.',
      },
      {
        label: 'Convective activity',
        value: thunder ? 'CB / TS forecast' : 'None significant',
        note: thunder
          ? 'Thunderstorms in the vicinity — anticipate deviations, turbulence, wind shear on approach and possible ground stops.'
          : 'No convective activity indicated in the next 12 hours.',
      },
      {
        label: 'QNH / pressure',
        value: c.pressure ? `${c.pressure} hPa` : 'n/a',
        note: 'Set altimeter to the latest QNH before descent.',
      },
    ];

    return {
      headline: `${place.name} terminal area — ${flightCategory}${thunder ? ' with convective activity' : ''}.`,
      points,
      lang,
    };
  },

  marine(forecast, place, { lang }) {
    const h24 = next(forecast, 24);
    const gust = maxOf(h24, 'gust');
    const wind = maxOf(h24, 'wind');
    const thunder = h24.some((h) => [95, 96, 99].includes(h.code));
    const rain = sum(h24, 'precip');

    // Beaufort scale from sustained wind speed (km/h).
    const beaufort = (() => {
      const kmh = wind;
      const table = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
      let b = 0;
      while (b < table.length && kmh >= table[b]) b += 1;
      return b;
    })();

    const safe = gust < 45 && !thunder;

    const points = [
      {
        label: 'Wind & sea state',
        value: `Beaufort ${beaufort} · gusts to ${Math.round(gust)} km/h`,
        /*
         * The note has to agree with the "Fishing operations" verdict below.
         * Beaufort is derived from *sustained* wind, so a calm-looking sea state
         * can still coincide with a thunderstorm warning; saying "suitable for
         * routine operations" directly above "not advised" would be worse than
         * saying nothing, so convective risk is called out here too.
         */
        note:
          beaufort >= 7
            ? 'Rough to very rough sea. Small and mechanised boats should remain in harbour.'
            : beaufort >= 5
              ? 'Moderate to rough sea. Experienced crews only; carry life jackets and a working radio.'
              : thunder
                ? 'Sea state is moderate at present, but squalls associated with thunderstorms can raise it sharply within minutes.'
                : 'Slight to moderate sea. Suitable for routine fishing operations.',
      },
      {
        label: 'Fishing operations',
        value: safe ? 'Permitted with caution' : 'Not advised',
        note: safe
          ? 'Venture out with standard safety gear. Monitor VHF and INCOIS bulletins before sailing.'
          : 'Suspend fishing and return to the nearest harbour. Secure boats above the high-water line.',
      },
      {
        label: 'Squall / thunderstorm',
        value: thunder ? 'Likely' : 'Not indicated',
        note: thunder
          ? 'Sudden squalls possible with little warning — lower masts and stay off the deck during activity.'
          : 'No thunderstorm activity expected in the next 24 hours.',
      },
      {
        label: 'Visibility & rain',
        value: rain >= 10 ? `${Math.round(rain)} mm expected` : 'Largely dry',
        note:
          rain >= 10
            ? 'Heavy rain will cut visibility at sea. Use navigation lights and radar reflectors.'
            : 'Visibility expected to remain workable.',
      },
    ];

    return {
      headline: safe
        ? `Sea conditions off ${place.name} are workable for the next 24 hours.`
        : `Adverse sea conditions off ${place.name} — fishing not advised.`,
      points,
      lang,
    };
  },

  urban(forecast, place, { lang, air }) {
    const h24 = next(forecast, 24);
    const rain24 = sum(h24, 'precip');
    const peakHour = maxOf(h24, 'precip');
    const gust = maxOf(h24, 'gust');
    const tmax = forecast.daily?.[0]?.tmax;

    const points = [
      {
        label: 'Waterlogging & drainage',
        value: peakHour >= 20 ? 'High risk' : rain24 >= 25 ? 'Moderate risk' : 'Low risk',
        note:
          peakHour >= 20
            ? `Up to ${Math.round(peakHour)} mm in a single hour can overwhelm storm drains. Pre-position pumps at known flooding points and clear inlet gratings.`
            : rain24 >= 25
              ? `About ${Math.round(rain24)} mm over 24 hours. Monitor underpasses and low-lying colonies.`
              : 'Drainage load expected to stay within capacity.',
      },
      {
        label: 'Traffic & transit',
        value: rain24 >= 10 || gust >= 40 ? 'Disruption likely' : 'Normal',
        note:
          rain24 >= 10 || gust >= 40
            ? 'Expect slower traffic, signal outages and localised diversions. Advise staggered office hours where possible.'
            : 'No weather-related disruption expected.',
      },
      {
        label: 'Public safety',
        value: gust >= 50 ? 'Inspect structures' : 'Routine',
        note:
          gust >= 50
            ? `Gusts to ${Math.round(gust)} km/h — inspect hoardings, scaffolding, old trees and temporary pandals.`
            : 'No structural wind risk indicated.',
      },
    ];

    if (air?.aqi != null) {
      points.push({
        label: 'Air quality',
        value: `US AQI ${Math.round(air.aqi)} · PM2.5 ${Math.round(air.pm25 ?? 0)} µg/m³`,
        note:
          air.aqi > 200
            ? 'Consider restricting construction dust and open burning; issue a health advisory for sensitive groups.'
            : air.aqi > 100
              ? 'Moderate pollution. Sensitive groups should limit prolonged outdoor exertion.'
              : 'Air quality is within acceptable limits.',
      });
    }

    if ((tmax ?? 0) >= 40) {
      points.push({
        label: 'Heat action plan',
        value: 'Activate',
        note: `Maximum near ${Math.round(tmax)}°C. Open cooling centres, ensure drinking-water points and shift outdoor municipal work away from 12–4 PM.`,
      });
    }

    return {
      headline:
        peakHour >= 20 || rain24 >= 25
          ? `${place.name} civic agencies should prepare for rain-related disruption.`
          : `No major civic weather risk expected at ${place.name}.`,
      points,
      lang,
    };
  },
};

/** First run of >= 6 consecutive dry, low-wind hours. */
function findDryWindow(hours) {
  let run = [];
  for (const h of hours) {
    const dry = (h.precip ?? 0) < 0.2 && (h.pop ?? 0) < 30 && (h.gust ?? 0) < 25;
    if (dry) {
      run.push(h);
      if (run.length >= 6) return { start: run[0].time, end: run.at(-1).time };
    } else {
      run = [];
    }
  }
  return null;
}

function fmtHour(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Short spoken summary used by the text-to-speech layer. */
export function speechSummary(forecast, placeName, lang = 'en') {
  const c = forecast.current;
  const cond = conditionLabel(c.code, lang);
  const advisory = generalAdvisory(forecast, placeName, lang);
  return `${placeName}: ${Math.round(c.temp)} degrees, ${cond}. ${advisory.text}`;
}
