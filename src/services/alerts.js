/**
 * Early-warning engine.
 *
 * Derives colour-coded warnings from the live forecast using the threshold
 * structure IMD publishes for its impact-based warning system:
 *
 *   Green  — no action, no significant weather
 *   Yellow — be updated / watch
 *   Orange — be prepared / alert
 *   Red    — take action / warning
 *
 * Rainfall classes follow IMD's 24-hour categories (heavy 64.5–115.5 mm,
 * very heavy 115.6–204.4 mm, extremely heavy > 204.4 mm). Wind, heat, cold and
 * fog thresholds follow the corresponding IMD criteria, simplified where the
 * criterion depends on station normals we do not query per request.
 *
 * In a production deployment this module would be replaced by (or reconciled
 * with) authoritative CAP/WIS 2.0 warning feeds; the same output shape is used
 * either way so the UI does not change.
 */

export const LEVELS = {
  green: { key: 'green', rank: 0, color: 'var(--green)', action: 'No action' },
  yellow: { key: 'yellow', rank: 1, color: 'var(--yellow)', action: 'Be updated' },
  orange: { key: 'orange', rank: 2, color: 'var(--orange)', action: 'Be prepared' },
  red: { key: 'red', rank: 3, color: 'var(--red)', action: 'Take action' },
};

/** Warning type + level labels, with graceful English fallback. */
const TEXT = {
  en: {
    levels: { yellow: 'Yellow — Be updated', orange: 'Orange — Be prepared', red: 'Red — Take action' },
    types: {
      heavy_rain: 'Heavy Rainfall',
      very_heavy_rain: 'Very Heavy Rainfall',
      extreme_rain: 'Extremely Heavy Rainfall',
      thunderstorm: 'Thunderstorm & Lightning',
      squall: 'Squally Winds',
      gale: 'Gale Force Winds',
      heat_wave: 'Heat Wave',
      severe_heat: 'Severe Heat Wave',
      cold_wave: 'Cold Wave',
      dense_fog: 'Dense Fog',
      poor_air: 'Poor Air Quality',
      urban_flood: 'Urban Flooding Risk',
    },
    actions: {
      heavy_rain: 'Avoid low-lying and waterlogged stretches. Allow extra travel time.',
      very_heavy_rain:
        'Localised flooding and traffic disruption likely. Avoid non-essential travel and stay away from riverbanks.',
      extreme_rain:
        'Flooding and landslides possible. Move to higher ground if advised, follow district administration instructions.',
      thunderstorm:
        'Move indoors. Do not shelter under trees or near electric poles. Unplug sensitive appliances.',
      squall: 'Secure loose objects and hoardings. Avoid staying under temporary structures.',
      gale: 'Suspend fishing and small-boat operations. Secure outdoor structures.',
      heat_wave:
        'Avoid outdoor exposure between 12 PM and 4 PM. Drink water frequently, cover head and use ORS.',
      severe_heat:
        'High risk of heat stroke. Stop outdoor labour during peak hours, watch for cramps, dizziness or fainting.',
      cold_wave:
        'Protect against prolonged cold exposure. Check on elderly, children and livestock; guard against carbon monoxide from indoor heating.',
      dense_fog:
        'Drive with low beams and fog lamps, keep large gaps. Expect flight and train delays.',
      poor_air:
        'Limit outdoor exertion. Sensitive groups should keep relief medication available and prefer N95 masks outdoors.',
      urban_flood:
        'Waterlogging likely in underpasses and drains. Avoid parking in basements and low-lying areas.',
    },
  },
  hi: {
    levels: {
      yellow: 'पीला — सतर्क रहें',
      orange: 'नारंगी — तैयार रहें',
      red: 'लाल — कार्रवाई करें',
    },
    types: {
      heavy_rain: 'भारी वर्षा',
      very_heavy_rain: 'अति भारी वर्षा',
      extreme_rain: 'अत्यधिक भारी वर्षा',
      thunderstorm: 'गरज-चमक के साथ तूफान',
      squall: 'झोंकेदार तेज हवाएँ',
      gale: 'प्रचंड हवाएँ',
      heat_wave: 'लू (हीट वेव)',
      severe_heat: 'भीषण लू',
      cold_wave: 'शीत लहर',
      dense_fog: 'घना कोहरा',
      poor_air: 'खराब वायु गुणवत्ता',
      urban_flood: 'शहरी जलभराव का खतरा',
    },
    actions: {
      heavy_rain: 'निचले और जलभराव वाले रास्तों से बचें। यात्रा में अतिरिक्त समय रखें।',
      very_heavy_rain:
        'स्थानीय जलभराव और यातायात बाधा संभव। अनावश्यक यात्रा टालें और नदी किनारों से दूर रहें।',
      extreme_rain:
        'बाढ़ और भूस्खलन की आशंका। निर्देश मिलने पर ऊँचे स्थान पर जाएँ, जिला प्रशासन के निर्देश मानें।',
      thunderstorm: 'घर के अंदर रहें। पेड़ या बिजली के खंभे के नीचे न रुकें। उपकरण अनप्लग करें।',
      squall: 'खुली वस्तुएँ और होर्डिंग सुरक्षित करें। अस्थायी ढाँचों के नीचे न रहें।',
      gale: 'मछली पकड़ना और छोटी नौकाओं का संचालन रोकें। बाहरी ढाँचे सुरक्षित करें।',
      heat_wave: 'दोपहर 12 से 4 बजे तक बाहर न निकलें। बार-बार पानी पिएँ, सिर ढकें, ओआरएस लें।',
      severe_heat:
        'लू लगने का गंभीर खतरा। पीक घंटों में बाहरी श्रम बंद करें; ऐंठन, चक्कर या बेहोशी पर ध्यान दें।',
      cold_wave:
        'लंबे समय तक ठंड से बचाव करें। बुजुर्ग, बच्चों और पशुओं का ध्यान रखें; अंगीठी से कार्बन मोनोऑक्साइड का खतरा।',
      dense_fog: 'फॉग लैंप के साथ धीमे चलाएँ, पर्याप्त दूरी रखें। उड़ान/ट्रेन देरी संभव।',
      poor_air:
        'बाहरी परिश्रम सीमित करें। संवेदनशील व्यक्ति दवा साथ रखें और बाहर N95 मास्क पहनें।',
      urban_flood: 'अंडरपास और नालों में जलभराव संभव। बेसमेंट व निचले स्थानों पर वाहन न रखें।',
    },
  },
  bn: {
    levels: {
      yellow: 'হলুদ — সতর্ক থাকুন',
      orange: 'কমলা — প্রস্তুত থাকুন',
      red: 'লাল — ব্যবস্থা নিন',
    },
    types: {
      heavy_rain: 'ভারী বৃষ্টিপাত',
      very_heavy_rain: 'অতি ভারী বৃষ্টিপাত',
      extreme_rain: 'অত্যধিক ভারী বৃষ্টিপাত',
      thunderstorm: 'বজ্রঝড় ও বিদ্যুৎ চমক',
      squall: 'দমকা ঝোড়ো হাওয়া',
      gale: 'প্রবল ঝোড়ো হাওয়া',
      heat_wave: 'তাপপ্রবাহ',
      severe_heat: 'তীব্র তাপপ্রবাহ',
      cold_wave: 'শৈত্যপ্রবাহ',
      dense_fog: 'ঘন কুয়াশা',
      poor_air: 'খারাপ বায়ুর গুণমান',
      urban_flood: 'শহরে জলাবদ্ধতার আশঙ্কা',
    },
    actions: {
      heavy_rain: 'নিচু ও জলমগ্ন রাস্তা এড়িয়ে চলুন। যাত্রায় বাড়তি সময় রাখুন।',
      very_heavy_rain:
        'স্থানীয় জলাবদ্ধতা ও যানজটের সম্ভাবনা। অপ্রয়োজনীয় যাত্রা এড়ান, নদীতীর থেকে দূরে থাকুন।',
      extreme_rain:
        'বন্যা ও ভূমিধসের আশঙ্কা। নির্দেশ পেলে উঁচু জায়গায় যান, জেলা প্রশাসনের নির্দেশ মানুন।',
      thunderstorm: 'ঘরের ভিতরে থাকুন। গাছ বা বিদ্যুতের খুঁটির নিচে দাঁড়াবেন না।',
      squall: 'খোলা জিনিস ও হোর্ডিং সুরক্ষিত করুন। অস্থায়ী কাঠামোর নিচে থাকবেন না।',
      gale: 'মাছ ধরা ও ছোট নৌকা চলাচল বন্ধ রাখুন।',
      heat_wave: 'দুপুর ১২টা থেকে ৪টা পর্যন্ত বাইরে যাবেন না। বারবার জল পান করুন, মাথা ঢাকুন।',
      severe_heat: 'হিট স্ট্রোকের গুরুতর ঝুঁকি। ব্যস্ত সময়ে বাইরের কাজ বন্ধ রাখুন।',
      cold_wave: 'দীর্ঘ সময় ঠান্ডা থেকে বাঁচুন। বয়স্ক, শিশু ও গবাদি পশুর খেয়াল রাখুন।',
      dense_fog: 'ফগ ল্যাম্প ব্যবহার করে ধীরে চালান। উড়ান ও ট্রেন দেরি হতে পারে।',
      poor_air: 'বাইরের পরিশ্রম কমান। সংবেদনশীল ব্যক্তিরা ওষুধ সঙ্গে রাখুন, N95 মাস্ক পরুন।',
      urban_flood: 'আন্ডারপাস ও নর্দমায় জল জমতে পারে। বেসমেন্টে গাড়ি রাখবেন না।',
    },
  },
  ta: {
    levels: {
      yellow: 'மஞ்சள் — கவனமாக இருங்கள்',
      orange: 'ஆரஞ்சு — தயாராக இருங்கள்',
      red: 'சிவப்பு — நடவடிக்கை எடுங்கள்',
    },
    types: {
      heavy_rain: 'கனமழை',
      very_heavy_rain: 'மிக கனமழை',
      extreme_rain: 'அதி கனமழை',
      thunderstorm: 'இடி மின்னலுடன் மழை',
      squall: 'பலத்த சூறைக் காற்று',
      gale: 'கடும் புயல் காற்று',
      heat_wave: 'வெப்ப அலை',
      severe_heat: 'கடும் வெப்ப அலை',
      cold_wave: 'குளிர் அலை',
      dense_fog: 'அடர் பனிமூட்டம்',
      poor_air: 'மோசமான காற்றுத் தரம்',
      urban_flood: 'நகர வெள்ள அபாயம்',
    },
    actions: {
      heavy_rain: 'தாழ்வான, நீர் தேங்கிய பகுதிகளைத் தவிர்க்கவும். பயணத்திற்கு கூடுதல் நேரம் ஒதுக்கவும்.',
      very_heavy_rain: 'வெள்ளம் மற்றும் போக்குவரத்து பாதிப்பு சாத்தியம். தேவையற்ற பயணத்தைத் தவிர்க்கவும்.',
      extreme_rain: 'வெள்ளம், நிலச்சரிவு அபாயம். அறிவுறுத்தப்பட்டால் உயரமான இடத்திற்கு செல்லவும்.',
      thunderstorm: 'உள்ளே இருங்கள். மரம் அல்லது மின் கம்பத்தின் அடியில் நிற்க வேண்டாம்.',
      squall: 'தளர்வான பொருட்களைப் பாதுகாக்கவும். தற்காலிக அமைப்புகளின் கீழ் இருக்க வேண்டாம்.',
      gale: 'மீன்பிடித்தல் மற்றும் சிறு படகு இயக்கத்தை நிறுத்தவும்.',
      heat_wave: 'நண்பகல் 12 முதல் 4 மணி வரை வெளியில் செல்ல வேண்டாம். அடிக்கடி நீர் அருந்தவும்.',
      severe_heat: 'வெப்பத் தாக்க அபாயம் அதிகம். உச்ச நேரத்தில் வெளிப்புற வேலையை நிறுத்தவும்.',
      cold_wave: 'நீண்ட நேரம் குளிரில் இருப்பதைத் தவிர்க்கவும். முதியவர், குழந்தைகளைக் கவனிக்கவும்.',
      dense_fog: 'மூடுபனி விளக்குகளுடன் மெதுவாக ஓட்டவும். விமான, ரயில் தாமதம் சாத்தியம்.',
      poor_air: 'வெளிப்புற உடற்பணியைக் குறைக்கவும். N95 முகக்கவசம் பயன்படுத்தவும்.',
      urban_flood: 'சுரங்கப்பாதைகளில் நீர் தேங்கும். தாழ்வான இடங்களில் வாகனம் நிற்க வேண்டாம்.',
    },
  },
  te: {
    levels: {
      yellow: 'పసుపు — అప్రమత్తంగా ఉండండి',
      orange: 'నారింజ — సిద్ధంగా ఉండండి',
      red: 'ఎరుపు — చర్య తీసుకోండి',
    },
    types: {
      heavy_rain: 'భారీ వర్షం',
      very_heavy_rain: 'అతి భారీ వర్షం',
      extreme_rain: 'అత్యధిక భారీ వర్షం',
      thunderstorm: 'ఉరుములు మెరుపులతో వర్షం',
      squall: 'బలమైన ఈదురు గాలులు',
      gale: 'తీవ్ర గాలులు',
      heat_wave: 'వడగాలులు',
      severe_heat: 'తీవ్ర వడగాలులు',
      cold_wave: 'శీతల గాలులు',
      dense_fog: 'దట్టమైన పొగమంచు',
      poor_air: 'నాణ్యత లేని గాలి',
      urban_flood: 'నగర వరద ముప్పు',
    },
    actions: {
      heavy_rain: 'లోతట్టు, నీరు నిలిచే ప్రాంతాలను నివారించండి. ప్రయాణానికి అదనపు సమయం కేటాయించండి.',
      very_heavy_rain: 'స్థానిక వరదలు, రాకపోకల అంతరాయం సాధ్యం. అనవసర ప్రయాణాలు వాయిదా వేయండి.',
      extreme_rain: 'వరదలు, కొండచరియలు విరిగిపడే ప్రమాదం. సూచించినప్పుడు ఎత్తైన ప్రాంతాలకు తరలండి.',
      thunderstorm: 'ఇంటి లోపల ఉండండి. చెట్లు, విద్యుత్ స్తంభాల కింద నిలవద్దు.',
      squall: 'వదులుగా ఉన్న వస్తువులను భద్రపరచండి. తాత్కాలిక నిర్మాణాల కింద ఉండవద్దు.',
      gale: 'చేపలు పట్టడం, చిన్న పడవల రాకపోకలు నిలిపివేయండి.',
      heat_wave: 'మధ్యాహ్నం 12 నుంచి 4 వరకు బయటకు వెళ్లవద్దు. తరచుగా నీరు తాగండి.',
      severe_heat: 'వడదెబ్బ ప్రమాదం ఎక్కువ. గరిష్ఠ వేళల్లో బహిరంగ పనులు ఆపండి.',
      cold_wave: 'ఎక్కువ సమయం చలిలో ఉండవద్దు. వృద్ధులు, పిల్లలు, పశువులను కాపాడండి.',
      dense_fog: 'ఫాగ్ లైట్లతో నెమ్మదిగా నడపండి. విమాన, రైలు ఆలస్యం సాధ్యం.',
      poor_air: 'బహిరంగ శ్రమ తగ్గించండి. N95 మాస్క్ ఉపయోగించండి.',
      urban_flood: 'అండర్‌పాస్‌లలో నీరు నిలుస్తుంది. లోతట్టు ప్రాంతాల్లో వాహనాలు నిలపవద్దు.',
    },
  },
  mr: {
    levels: {
      yellow: 'पिवळा — सतर्क राहा',
      orange: 'नारिंगी — तयार राहा',
      red: 'लाल — कार्यवाही करा',
    },
    types: {
      heavy_rain: 'मुसळधार पाऊस',
      very_heavy_rain: 'अतिमुसळधार पाऊस',
      extreme_rain: 'अतिवृष्टी',
      thunderstorm: 'विजांसह वादळी पाऊस',
      squall: 'सोसाट्याचा वारा',
      gale: 'प्रचंड वारे',
      heat_wave: 'उष्णतेची लाट',
      severe_heat: 'तीव्र उष्णतेची लाट',
      cold_wave: 'थंडीची लाट',
      dense_fog: 'दाट धुके',
      poor_air: 'खराब हवेची गुणवत्ता',
      urban_flood: 'शहरी पूरस्थितीचा धोका',
    },
    actions: {
      heavy_rain: 'सखल व पाणी साचलेले रस्ते टाळा. प्रवासासाठी जादा वेळ ठेवा.',
      very_heavy_rain: 'स्थानिक पूर व वाहतूक कोंडी संभव. अनावश्यक प्रवास टाळा.',
      extreme_rain: 'पूर व दरड कोसळण्याचा धोका. सूचना मिळाल्यास उंच ठिकाणी जा.',
      thunderstorm: 'घरात राहा. झाडाखाली किंवा विजेच्या खांबाजवळ थांबू नका.',
      squall: 'सुटे सामान व फलक सुरक्षित करा. तात्पुरत्या बांधकामाखाली राहू नका.',
      gale: 'मासेमारी व लहान बोटी बंद ठेवा.',
      heat_wave: 'दुपारी 12 ते 4 बाहेर पडू नका. वारंवार पाणी प्या, डोके झाका.',
      severe_heat: 'उष्माघाताचा मोठा धोका. ऐन दुपारी बाहेरचे काम बंद ठेवा.',
      cold_wave: 'दीर्घकाळ थंडीत राहू नका. ज्येष्ठ, लहान मुले व जनावरांची काळजी घ्या.',
      dense_fog: 'फॉग लॅम्प वापरून हळू चालवा. विमान व रेल्वे उशीर संभव.',
      poor_air: 'बाहेरील श्रम कमी करा. N95 मास्क वापरा.',
      urban_flood: 'भुयारी मार्गात पाणी साचेल. सखल भागात वाहन उभे करू नका.',
    },
  },
};

function text(lang, group, key) {
  return TEXT[lang]?.[group]?.[key] ?? TEXT.en[group][key] ?? key;
}

/* --------------------------------------------------------------- criteria -- */

function rainClass(mm) {
  if (mm == null) return null;
  if (mm > 204.4) return { type: 'extreme_rain', level: 'red' };
  if (mm > 115.5) return { type: 'very_heavy_rain', level: 'orange' };
  if (mm > 64.5) return { type: 'heavy_rain', level: 'yellow' };
  return null;
}

function windClass(gustKmh) {
  if (gustKmh == null) return null;
  if (gustKmh >= 88) return { type: 'gale', level: 'red' };
  if (gustKmh >= 62) return { type: 'gale', level: 'orange' };
  if (gustKmh >= 40) return { type: 'squall', level: 'yellow' };
  return null;
}

function heatClass(tmax, feelsMax) {
  const peak = Math.max(tmax ?? -99, feelsMax ?? -99);
  if (peak >= 46) return { type: 'severe_heat', level: 'red' };
  if (peak >= 43) return { type: 'severe_heat', level: 'orange' };
  if (peak >= 40) return { type: 'heat_wave', level: 'yellow' };
  return null;
}

function coldClass(tmin) {
  if (tmin == null) return null;
  if (tmin <= 2) return { type: 'cold_wave', level: 'red' };
  if (tmin <= 4) return { type: 'cold_wave', level: 'orange' };
  if (tmin <= 7) return { type: 'cold_wave', level: 'yellow' };
  return null;
}

/* ----------------------------------------------------------------- engine -- */

/**
 * @param {object} forecast normalised bundle from openMeteo.fetchForecast
 * @param {object} [options] { lang, air, place }
 * @returns {{ level: string, alerts: Array, summaryLevel: object }}
 */
export function deriveAlerts(forecast, { lang = 'en', air = null } = {}) {
  const alerts = [];
  const push = (spec) => alerts.push(spec);

  const days = forecast.daily ?? [];

  days.slice(0, 5).forEach((day, i) => {
    const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : day.date;

    const rain = rainClass(day.rain);
    if (rain) {
      push({
        ...rain,
        dayIndex: i,
        when,
        date: day.date,
        metric: `${Math.round(day.rain)} mm in 24 h`,
        value: day.rain,
      });
    }

    const wind = windClass(day.gustMax);
    if (wind) {
      push({
        ...wind,
        dayIndex: i,
        when,
        date: day.date,
        metric: `gusts to ${Math.round(day.gustMax)} km/h`,
        value: day.gustMax,
      });
    }

    const heat = heatClass(day.tmax, day.feelsMax);
    if (heat) {
      push({
        ...heat,
        dayIndex: i,
        when,
        date: day.date,
        metric: `max ${Math.round(day.tmax)}°C, feels ${Math.round(day.feelsMax ?? day.tmax)}°C`,
        value: day.tmax,
      });
    }

    const cold = coldClass(day.tmin);
    if (cold) {
      push({
        ...cold,
        dayIndex: i,
        when,
        date: day.date,
        metric: `min ${Math.round(day.tmin)}°C`,
        value: day.tmin,
      });
    }

    // Thunderstorm / hail from the daily representative code.
    if ([95, 96, 99].includes(day.code)) {
      push({
        type: 'thunderstorm',
        level: day.code === 95 ? 'yellow' : 'orange',
        dayIndex: i,
        when,
        date: day.date,
        metric: day.code === 95 ? 'thunderstorm likely' : 'thunderstorm with hail likely',
        value: day.code,
      });
    }

    // Dense fog from the daily code or very low visibility in that day's hours.
    if ([45, 48].includes(day.code)) {
      const dayHours = (forecast.hourly ?? []).filter((h) => h.time.startsWith(day.date));
      const minVis = Math.min(...dayHours.map((h) => h.visibility ?? Infinity));
      const level = minVis < 200 ? 'orange' : 'yellow';
      push({
        type: 'dense_fog',
        level,
        dayIndex: i,
        when,
        date: day.date,
        metric: Number.isFinite(minVis) ? `visibility down to ${Math.round(minVis)} m` : 'dense fog likely',
        value: minVis,
      });
    }
  });

  // Urban flooding: intense short-duration rain regardless of 24 h total.
  const peakHourRain = Math.max(0, ...(forecast.hourly ?? []).slice(0, 24).map((h) => h.precip ?? 0));
  if (peakHourRain >= 20) {
    push({
      type: 'urban_flood',
      level: peakHourRain >= 40 ? 'orange' : 'yellow',
      dayIndex: 0,
      when: 'today',
      date: forecast.daily?.[0]?.date,
      metric: `${Math.round(peakHourRain)} mm in a single hour`,
      value: peakHourRain,
    });
  }

  // Air quality warning, when AQI data is available.
  if (air?.aqi != null && air.aqi > 150) {
    push({
      type: 'poor_air',
      level: air.aqi > 250 ? 'red' : air.aqi > 200 ? 'orange' : 'yellow',
      dayIndex: 0,
      when: 'today',
      date: forecast.daily?.[0]?.date,
      metric: `US AQI ${Math.round(air.aqi)}, PM2.5 ${Math.round(air.pm25 ?? 0)} µg/m³`,
      value: air.aqi,
    });
  }

  // Keep the most severe instance of each warning type.
  const strongest = new Map();
  for (const a of alerts) {
    const existing = strongest.get(a.type);
    if (!existing || LEVELS[a.level].rank > LEVELS[existing.level].rank) strongest.set(a.type, a);
  }

  const localised = [...strongest.values()]
    .sort((a, b) => LEVELS[b.level].rank - LEVELS[a.level].rank || a.dayIndex - b.dayIndex)
    .map((a) => ({
      ...a,
      id: `${a.type}-${a.date}`,
      title: text(lang, 'types', a.type),
      levelLabel: text(lang, 'levels', a.level),
      action: text(lang, 'actions', a.type),
      color: LEVELS[a.level].color,
    }));

  const topRank = localised.reduce((max, a) => Math.max(max, LEVELS[a.level].rank), 0);
  const level = Object.values(LEVELS).find((l) => l.rank === topRank)?.key ?? 'green';

  return { level, alerts: localised, count: localised.length };
}

/** Localised level label for the "all clear" state and badges. */
export function levelLabel(level, lang = 'en') {
  if (level === 'green') return lang === 'en' ? 'Green — No action' : text(lang, 'levels', 'yellow');
  return text(lang, 'levels', level);
}

export const __testables = { rainClass, windClass, heatClass, coldClass };
