/**
 * Query-understanding engine.
 *
 * Converts a free-form question — typed or spoken, in any of the ten supported
 * languages — into a structured request the data layer can execute:
 *
 *   { lang, intent, sector, locationQuery, dayOffset, horizonDays, model }
 *
 * Design notes
 * ------------
 * This is a deterministic, lexicon-driven parser rather than a hosted LLM call.
 * That is a deliberate choice for this class of product:
 *   - it answers in tens of microseconds, so response latency is dominated by
 *     the meteorological fetch rather than by inference;
 *   - it never hallucinates a location or an intent, which matters when the
 *     output feeds disaster-warning dissemination;
 *   - it works offline and costs nothing per query, so it can be deployed at
 *     district scale.
 *
 * `services/llm.js` provides a drop-in adapter for a hosted model
 * (OpenAI / Llama / Gemini) for genuinely open-ended questions; when it is
 * configured, `parseQuery` is used as the fast path and as the fallback if the
 * model is unreachable. The rest of the application depends only on the shape
 * documented above, so either engine can drive it.
 */

import { SCRIPT_RANGES, DEFAULT_LANG } from '../i18n/languages.js';
import { scanForPlace } from '../data/places.js';

export const INTENTS = {
  CURRENT: 'current',
  FORECAST: 'forecast',
  RAIN: 'rain',
  ALERTS: 'alerts',
  AQI: 'aqi',
  CLIMATE: 'climate',
  MODELS: 'models',
  ADVISORY: 'advisory',
  GREETING: 'greeting',
  HELP: 'help',
  UNKNOWN: 'unknown',
};

/* ---------------------------------------------------------------- lexicons -- */

const LEX = {
  en: {
    current: ['weather', 'temperature', 'temp', 'how hot', 'how cold', 'right now', 'currently', 'humidity', 'conditions', 'outside'],
    forecast: ['forecast', 'next week', 'this week', 'coming days', 'week ahead', '7 day', '7-day', 'seven day', '10 day', 'next few days', 'outlook'],
    rain: ['rain', 'raining', 'rainfall', 'umbrella', 'monsoon', 'shower', 'showers', 'precipitation', 'drizzle', 'wet'],
    alerts: ['alert', 'alerts', 'warning', 'warnings', 'cyclone', 'flood', 'flooding', 'storm', 'danger', 'emergency', 'heat wave', 'heatwave', 'cold wave', 'severe', 'extreme'],
    aqi: ['air quality', 'aqi', 'pollution', 'polluted', 'pm2.5', 'pm 2.5', 'pm10', 'smog', 'breathe'],
    climate: ['climate', 'trend', 'trends', 'historical', 'history', 'average', 'normal', 'anomaly', 'last 10 years', 'last decade', 'warming', 'over the years'],
    models: ['model', 'models', 'gfs', 'ecmwf', 'icon', 'wrf', 'nwp', 'ensemble', 'confidence', 'agreement', 'how accurate', 'reliable'],
    greeting: ['hello', 'hi', 'hey', 'namaste', 'good morning', 'good evening', 'who are you', 'what can you do'],
    help: ['help', 'how do i', 'what can you', 'commands', 'features'],
    sectors: {
      agriculture: ['farmer', 'farming', 'crop', 'crops', 'agriculture', 'agri', 'sowing', 'harvest', 'irrigation', 'spray', 'spraying', 'pesticide', 'field', 'paddy', 'wheat', 'kharif', 'rabi'],
      aviation: ['aviation', 'flight', 'flights', 'airport', 'pilot', 'metar', 'taf', 'runway', 'landing', 'takeoff', 'aircraft'],
      marine: ['marine', 'fishing', 'fisherman', 'fishermen', 'sea', 'boat', 'ocean', 'sail', 'sailing', 'harbour', 'harbor', 'wave height'],
      urban: ['city', 'urban', 'traffic', 'waterlogging', 'waterlogged', 'municipal', 'disaster', 'drainage', 'commute', 'smart city'],
    },
    today: ['today', 'tonight'],
    tomorrow: ['tomorrow'],
    dayAfter: ['day after tomorrow', 'day after'],
  },

  hi: {
    current: ['मौसम', 'तापमान', 'गर्मी', 'ठंड', 'अभी', 'वर्तमान', 'आर्द्रता', 'कैसा है'],
    forecast: ['पूर्वानुमान', 'अनुमान', 'अगले', 'सप्ताह', 'हफ्ते', 'आने वाले दिन', 'सात दिन'],
    rain: ['बारिश', 'वर्षा', 'बरसात', 'छाता', 'मानसून', 'बौछार', 'भीगना'],
    alerts: ['चेतावनी', 'अलर्ट', 'बाढ़', 'चक्रवात', 'तूफान', 'खतरा', 'आपदा', 'लू', 'शीत लहर', 'भीषण'],
    aqi: ['वायु गुणवत्ता', 'प्रदूषण', 'हवा खराब', 'धुंध', 'सांस'],
    climate: ['जलवायु', 'प्रवृत्ति', 'ऐतिहासिक', 'औसत', 'सामान्य', 'बदलाव', 'पिछले साल', 'दशक'],
    models: ['मॉडल', 'सटीक', 'विश्वसनीय', 'सहमति'],
    greeting: ['नमस्ते', 'नमस्कार', 'हैलो', 'हाय', 'कौन हो', 'क्या कर सकते'],
    help: ['मदद', 'सहायता', 'कैसे'],
    sectors: {
      agriculture: ['किसान', 'खेती', 'फसल', 'कृषि', 'बुवाई', 'कटाई', 'सिंचाई', 'छिड़काव', 'कीटनाशक', 'खेत', 'धान', 'गेहूं'],
      aviation: ['विमान', 'उड़ान', 'हवाई अड्डा', 'पायलट', 'रनवे'],
      marine: ['मछली', 'मछुआरा', 'समुद्र', 'नाव', 'मछली पकड़'],
      urban: ['शहर', 'यातायात', 'जलभराव', 'नगर निगम', 'आपदा प्रबंधन', 'ट्रैफिक'],
    },
    today: ['आज', 'आज रात'],
    tomorrow: ['कल'],
    dayAfter: ['परसों'],
  },

  bn: {
    current: ['আবহাওয়া', 'তাপমাত্রা', 'গরম', 'ঠান্ডা', 'এখন', 'বর্তমান', 'আর্দ্রতা', 'কেমন'],
    forecast: ['পূর্বাভাস', 'আগামী', 'সপ্তাহ', 'সাত দিন', 'পরের দিন'],
    rain: ['বৃষ্টি', 'বর্ষা', 'ছাতা', 'মৌসুমি', 'ভিজে'],
    alerts: ['সতর্কতা', 'সতর্ক', 'বন্যা', 'ঘূর্ণিঝড়', 'ঝড়', 'বিপদ', 'দুর্যোগ', 'তাপপ্রবাহ', 'শৈত্যপ্রবাহ'],
    aqi: ['বায়ুর গুণমান', 'দূষণ', 'ধোঁয়াশা', 'শ্বাস'],
    climate: ['জলবায়ু', 'প্রবণতা', 'ঐতিহাসিক', 'গড়', 'স্বাভাবিক', 'পরিবর্তন', 'দশক'],
    models: ['মডেল', 'নির্ভরযোগ্য', 'সঠিক'],
    greeting: ['নমস্কার', 'হ্যালো', 'হাই', 'কে তুমি', 'কী করতে পারো'],
    help: ['সাহায্য', 'কীভাবে'],
    sectors: {
      agriculture: ['চাষি', 'কৃষক', 'ফসল', 'কৃষি', 'বীজ', 'সেচ', 'স্প্রে', 'ধান', 'গম', 'খেত'],
      aviation: ['বিমান', 'উড়ান', 'বিমানবন্দর', 'পাইলট'],
      marine: ['মাছ', 'জেলে', 'সমুদ্র', 'নৌকা', 'মৎস্য'],
      urban: ['শহর', 'যানজট', 'জলাবদ্ধতা', 'পৌরসভা', 'দুর্যোগ ব্যবস্থাপনা'],
    },
    today: ['আজ', 'আজ রাতে'],
    tomorrow: ['আগামীকাল', 'কাল'],
    dayAfter: ['পরশু'],
  },

  ta: {
    current: ['வானிலை', 'வெப்பநிலை', 'வெயில்', 'குளிர்', 'இப்போது', 'தற்போது', 'ஈரப்பதம்', 'எப்படி'],
    forecast: ['முன்னறிவிப்பு', 'அடுத்த', 'வாரம்', 'ஏழு நாள்', 'வரும் நாட்கள்'],
    rain: ['மழை', 'குடை', 'பருவமழை', 'தூறல்'],
    alerts: ['எச்சரிக்கை', 'வெள்ளம்', 'புயல்', 'சூறாவளி', 'ஆபத்து', 'பேரிடர்', 'வெப்ப அலை'],
    aqi: ['காற்றின் தரம்', 'மாசு', 'காற்று மாசுபாடு', 'சுவாசம்'],
    climate: ['பருவநிலை', 'போக்கு', 'சராசரி', 'வரலாற்று', 'மாற்றம்', 'பத்தாண்டு'],
    models: ['மாதிரி', 'துல்லியம்', 'நம்பகம்'],
    greeting: ['வணக்கம்', 'ஹலோ', 'யார் நீ', 'என்ன செய்ய'],
    help: ['உதவி', 'எப்படி'],
    sectors: {
      agriculture: ['விவசாயி', 'பயிர்', 'வேளாண்', 'விதைப்பு', 'அறுவடை', 'நீர்ப்பாசனம்', 'தெளிப்பு', 'நெல்', 'வயல்'],
      aviation: ['விமானம்', 'விமான நிலையம்', 'பைலட்'],
      marine: ['மீன்', 'மீனவர்', 'கடல்', 'படகு'],
      urban: ['நகரம்', 'போக்குவரத்து', 'நீர் தேக்கம்', 'மாநகராட்சி', 'பேரிடர் மேலாண்மை'],
    },
    today: ['இன்று', 'இன்று இரவு'],
    tomorrow: ['நாளை'],
    dayAfter: ['நாளை மறுநாள்'],
  },

  te: {
    current: ['వాతావరణం', 'ఉష్ణోగ్రత', 'వేడి', 'చలి', 'ఇప్పుడు', 'ప్రస్తుతం', 'తేమ', 'ఎలా'],
    forecast: ['సూచన', 'అంచనా', 'తదుపరి', 'వారం', 'ఏడు రోజుల', 'రాబోయే'],
    rain: ['వర్షం', 'గొడుగు', 'రుతుపవన', 'జల్లు'],
    alerts: ['హెచ్చరిక', 'వరద', 'తుఫాను', 'ప్రమాదం', 'విపత్తు', 'వడగాలులు'],
    aqi: ['గాలి నాణ్యత', 'కాలుష్యం', 'పొగ', 'శ్వాస'],
    climate: ['వాతావరణ ధోరణి', 'సగటు', 'చారిత్రక', 'మార్పు', 'దశాబ్దం'],
    models: ['నమూనా', 'ఖచ్చితత్వం', 'నమ్మకం'],
    greeting: ['నమస్కారం', 'హలో', 'ఎవరు నువ్వు', 'ఏమి చేయగలవు'],
    help: ['సహాయం', 'ఎలా'],
    sectors: {
      agriculture: ['రైతు', 'పంట', 'వ్యవసాయం', 'విత్తనం', 'కోత', 'నీటిపారుదల', 'పిచికారీ', 'వరి', 'పొలం'],
      aviation: ['విమానం', 'విమానాశ్రయం', 'పైలట్'],
      marine: ['చేప', 'మత్స్యకార', 'సముద్రం', 'పడవ'],
      urban: ['నగరం', 'ట్రాఫిక్', 'నీరు నిలవడం', 'మున్సిపల్', 'విపత్తు నిర్వహణ'],
    },
    today: ['ఈరోజు', 'ఈ రాత్రి'],
    tomorrow: ['రేపు'],
    dayAfter: ['ఎల్లుండి'],
  },

  mr: {
    current: ['हवामान', 'तापमान', 'उकाडा', 'थंडी', 'आता', 'सध्या', 'आर्द्रता', 'कसे'],
    forecast: ['अंदाज', 'पुढील', 'आठवडा', 'सात दिवस', 'येणारे दिवस'],
    rain: ['पाऊस', 'छत्री', 'मान्सून', 'सरी'],
    alerts: ['इशारा', 'पूर', 'चक्रीवादळ', 'वादळ', 'धोका', 'आपत्ती', 'उष्णतेची लाट'],
    aqi: ['हवेची गुणवत्ता', 'प्रदूषण', 'धूर', 'श्वास'],
    climate: ['हवामान कल', 'सरासरी', 'ऐतिहासिक', 'बदल', 'दशक'],
    models: ['मॉडेल', 'अचूक', 'विश्वासार्ह'],
    greeting: ['नमस्कार', 'हॅलो', 'कोण आहेस', 'काय करू शकतोस'],
    help: ['मदत', 'कसे'],
    sectors: {
      agriculture: ['शेतकरी', 'पीक', 'शेती', 'पेरणी', 'कापणी', 'सिंचन', 'फवारणी', 'भात', 'शिवार'],
      aviation: ['विमान', 'विमानतळ', 'वैमानिक'],
      marine: ['मासे', 'मच्छीमार', 'समुद्र', 'नाव'],
      urban: ['शहर', 'वाहतूक', 'पाणी साचणे', 'महापालिका', 'आपत्ती व्यवस्थापन'],
    },
    today: ['आज', 'आज रात्री'],
    tomorrow: ['उद्या'],
    dayAfter: ['परवा'],
  },

  gu: {
    current: ['હવામાન', 'તાપમાન', 'ગરમી', 'ઠંડી', 'હાલ', 'અત્યારે', 'ભેજ'],
    forecast: ['અનુમાન', 'આગામી', 'સપ્તાહ', 'સાત દિવસ'],
    rain: ['વરસાદ', 'છત્રી', 'ચોમાસું', 'ઝાપટું'],
    alerts: ['ચેતવણી', 'પૂર', 'વાવાઝોડું', 'ખતરો', 'આપત્તિ'],
    aqi: ['હવાની ગુણવત્તા', 'પ્રદૂષણ'],
    climate: ['હવામાન પ્રવાહ', 'સરેરાશ', 'ઐતિહાસિક', 'બદલાવ'],
    models: ['મોડેલ', 'સચોટ'],
    greeting: ['નમસ્તે', 'હેલો', 'કોણ છો'],
    help: ['મદદ'],
    sectors: {
      agriculture: ['ખેડૂત', 'પાક', 'ખેતી', 'વાવણી', 'સિંચાઈ', 'છંટકાવ'],
      aviation: ['વિમાન', 'એરપોર્ટ'],
      marine: ['માછલી', 'માછીમાર', 'દરિયો', 'હોડી'],
      urban: ['શહેર', 'ટ્રાફિક', 'પાણી ભરાવો', 'આપત્તિ વ્યવસ્થાપન'],
    },
    today: ['આજે'],
    tomorrow: ['કાલે'],
    dayAfter: ['પરમ દિવસે'],
  },

  kn: {
    current: ['ಹವಾಮಾನ', 'ತಾಪಮಾನ', 'ಸೆಕೆ', 'ಚಳಿ', 'ಈಗ', 'ಪ್ರಸ್ತುತ', 'ಆರ್ದ್ರತೆ'],
    forecast: ['ಮುನ್ಸೂಚನೆ', 'ಮುಂದಿನ', 'ವಾರ', 'ಏಳು ದಿನ'],
    rain: ['ಮಳೆ', 'ಛತ್ರಿ', 'ಮುಂಗಾರು', 'ತುಂತುರು'],
    alerts: ['ಎಚ್ಚರಿಕೆ', 'ಪ್ರವಾಹ', 'ಚಂಡಮಾರುತ', 'ಅಪಾಯ', 'ವಿಪತ್ತು'],
    aqi: ['ಗಾಳಿಯ ಗುಣಮಟ್ಟ', 'ಮಾಲಿನ್ಯ'],
    climate: ['ಹವಾಮಾನ ಪ್ರವೃತ್ತಿ', 'ಸರಾಸರಿ', 'ಐತಿಹಾಸಿಕ', 'ಬದಲಾವಣೆ'],
    models: ['ಮಾದರಿ', 'ನಿಖರ'],
    greeting: ['ನಮಸ್ಕಾರ', 'ಹಲೋ', 'ಯಾರು ನೀನು'],
    help: ['ಸಹಾಯ'],
    sectors: {
      agriculture: ['ರೈತ', 'ಬೆಳೆ', 'ಕೃಷಿ', 'ಬಿತ್ತನೆ', 'ನೀರಾವರಿ', 'ಸಿಂಪರಣೆ'],
      aviation: ['ವಿಮಾನ', 'ವಿಮಾನ ನಿಲ್ದಾಣ'],
      marine: ['ಮೀನು', 'ಮೀನುಗಾರ', 'ಸಮುದ್ರ', 'ದೋಣಿ'],
      urban: ['ನಗರ', 'ಸಂಚಾರ', 'ನೀರು ನಿಲುಗಡೆ', 'ವಿಪತ್ತು ನಿರ್ವಹಣೆ'],
    },
    today: ['ಇಂದು'],
    tomorrow: ['ನಾಳೆ'],
    dayAfter: ['ನಾಡಿದ್ದು'],
  },

  ml: {
    current: ['കാലാവസ്ഥ', 'താപനില', 'ചൂട്', 'തണുപ്പ്', 'ഇപ്പോൾ', 'ആർദ്രത'],
    forecast: ['പ്രവചനം', 'അടുത്ത', 'ആഴ്ച', 'ഏഴു ദിവസം'],
    rain: ['മഴ', 'കുട', 'മൺസൂൺ', 'ചാറ്റൽ'],
    alerts: ['മുന്നറിയിപ്പ്', 'വെള്ളപ്പൊക്കം', 'ചുഴലിക്കാറ്റ്', 'അപകടം', 'ദുരന്തം'],
    aqi: ['വായു ഗുണനിലവാരം', 'മലിനീകരണം'],
    climate: ['കാലാവസ്ഥാ പ്രവണത', 'ശരാശരി', 'ചരിത്രപരം', 'മാറ്റം'],
    models: ['മോഡൽ', 'കൃത്യത'],
    greeting: ['നമസ്കാരം', 'ഹലോ', 'ആരാണ്'],
    help: ['സഹായം'],
    sectors: {
      agriculture: ['കർഷകൻ', 'വിള', 'കൃഷി', 'വിതയ്ക്കൽ', 'നനയ്ക്കൽ', 'തളിക്കൽ'],
      aviation: ['വിമാനം', 'വിമാനത്താവളം'],
      marine: ['മീൻ', 'മത്സ്യത്തൊഴിലാളി', 'കടൽ', 'വള്ളം'],
      urban: ['നഗരം', 'ട്രാഫിക്', 'വെള്ളക്കെട്ട്', 'ദുരന്ത നിവാരണം'],
    },
    today: ['ഇന്ന്'],
    tomorrow: ['നാളെ'],
    dayAfter: ['മറ്റന്നാൾ'],
  },

  pa: {
    current: ['ਮੌਸਮ', 'ਤਾਪਮਾਨ', 'ਗਰਮੀ', 'ਠੰਢ', 'ਹੁਣ', 'ਨਮੀ'],
    forecast: ['ਅਨੁਮਾਨ', 'ਅਗਲੇ', 'ਹਫ਼ਤਾ', 'ਸੱਤ ਦਿਨ'],
    rain: ['ਬਾਰਿਸ਼', 'ਛਤਰੀ', 'ਮੌਨਸੂਨ', 'ਕਿਣਮਿਣ'],
    alerts: ['ਚੇਤਾਵਨੀ', 'ਹੜ੍ਹ', 'ਤੂਫ਼ਾਨ', 'ਖ਼ਤਰਾ', 'ਆਪਦਾ'],
    aqi: ['ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ', 'ਪ੍ਰਦੂਸ਼ਣ'],
    climate: ['ਜਲਵਾਯੂ ਰੁਝਾਨ', 'ਔਸਤ', 'ਇਤਿਹਾਸਕ', 'ਤਬਦੀਲੀ'],
    models: ['ਮਾਡਲ', 'ਸਹੀ'],
    greeting: ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'ਹੈਲੋ', 'ਕੌਣ ਹੋ'],
    help: ['ਮਦਦ'],
    sectors: {
      agriculture: ['ਕਿਸਾਨ', 'ਫ਼ਸਲ', 'ਖੇਤੀ', 'ਬੀਜਾਈ', 'ਸਿੰਚਾਈ', 'ਛਿੜਕਾਅ'],
      aviation: ['ਜਹਾਜ਼', 'ਹਵਾਈ ਅੱਡਾ'],
      marine: ['ਮੱਛੀ', 'ਮਛੇਰਾ', 'ਸਮੁੰਦਰ', 'ਕਿਸ਼ਤੀ'],
      urban: ['ਸ਼ਹਿਰ', 'ਟ੍ਰੈਫਿਕ', 'ਪਾਣੀ ਭਰਨਾ', 'ਆਪਦਾ ਪ੍ਰਬੰਧਨ'],
    },
    today: ['ਅੱਜ'],
    tomorrow: ['ਕੱਲ੍ਹ'],
    dayAfter: ['ਪਰਸੋਂ'],
  },
};

/* ------------------------------------------------------ language detection -- */

/** Detect the language of a query from its script, with English as default. */
export function detectLanguage(text, preferred = DEFAULT_LANG) {
  const hit = SCRIPT_RANGES.find(({ re }) => re.test(text));
  if (!hit) return /[a-z]/i.test(text) ? (preferred === 'en' ? 'en' : looksEnglish(text) ? 'en' : preferred) : preferred;

  // Devanagari is shared by Hindi and Marathi — disambiguate with marker words,
  // otherwise honour the language the user selected in the UI.
  if (hit.script === 'devanagari') {
    if (/(आहे|काय|कसे|पाऊस|उद्या|परवा|शेतकरी|हवामान)/.test(text)) return 'mr';
    if (/(है|क्या|कैसा|बारिश|कल|परसों|किसान|मौसम)/.test(text)) return 'hi';
    return preferred === 'mr' ? 'mr' : 'hi';
  }

  const map = {
    bengali: 'bn',
    tamil: 'ta',
    telugu: 'te',
    gujarati: 'gu',
    kannada: 'kn',
    malayalam: 'ml',
    gurmukhi: 'pa',
  };
  return map[hit.script] ?? preferred;
}

/** Heuristic: does a Latin-script string read as English rather than transliteration? */
function looksEnglish(text) {
  return /\b(the|is|what|will|how|in|weather|forecast|rain|tomorrow|today|air|show|temperature)\b/i.test(text);
}

/* ----------------------------------------------------------- location text -- */

const EN_TRAILERS =
  'today|tomorrow|tonight|now|right now|this week|next week|weather|forecast|please|currently|for me';

/**
 * Pull a place name out of the sentence.
 * Order: curated gazetteer scan (handles native scripts and aliases) →
 * preposition patterns → Indic postposition patterns → capitalised residue.
 */
export function extractLocation(text, lang = 'en') {
  const gazetteer = scanForPlace(text);
  if (gazetteer) return { place: gazetteer, query: gazetteer.name, method: 'gazetteer' };

  // "... in Nagpur", "... for Kutch district", "at Sohra"
  const prep = text.match(
    new RegExp(`\\b(?:in|at|for|of|near|around)\\s+([A-Za-z][A-Za-z\\s.'-]{1,40}?)(?=\\s+(?:${EN_TRAILERS})\\b|[?.,!]|$)`, 'i'),
  );
  if (prep) {
    const cleaned = cleanCandidate(prep[1], lang);
    if (cleaned) return { place: null, query: cleaned, method: 'preposition' };
  }

  // Indic postpositions: "नागपुर में", "কলকাতায়", "சென்னையில்", "ನಗರದಲ್ಲಿ"
  const postposition = text.match(
    /([\u0900-\u0D7F][\u0900-\u0D7F\s]{1,30}?)\s*(?:में|मे|का|की|के|ला|मध्ये|चा|ची|এ|তে|য়|এর|র|ইল|இல்|ல்|க்கு|లో|కి|ನಲ್ಲಿ|ದಲ್ಲಿ|ൽ|ില്|ਵਿੱਚ|માં)\b/u,
  );
  if (postposition) {
    const candidate = postposition[1].trim();
    const known = scanForPlace(candidate);
    if (known) return { place: known, query: known.name, method: 'gazetteer' };
    const cleaned = cleanCandidate(candidate, lang);
    if (cleaned) return { place: null, query: cleaned, method: 'postposition' };
  }

  // Capitalised token(s) that are not sentence-initial keywords.
  const caps = [...text.matchAll(/\b([A-Z][a-z]{2,})\b/g)].map((m) => m[1]);
  const stop = new Set([
    'What', 'Will', 'Show', 'Tell', 'Give', 'How', 'Is', 'Are', 'Does', 'Weather', 'Forecast',
    'Rain', 'Today', 'Tomorrow', 'Air', 'Quality', 'Climate', 'Alert', 'Alerts', 'Warning',
    'Please', 'Next', 'Week', 'Model', 'Models',
  ]);
  const candidate = caps.find((c) => !stop.has(c));
  if (candidate) return { place: null, query: candidate, method: 'capitalised' };

  return { place: null, query: null, method: 'none' };
}

/** Strip intent keywords from a candidate place string. */
function cleanCandidate(raw, lang) {
  const lex = LEX[lang] ?? LEX.en;
  const noise = [
    ...(lex.current ?? []), ...(lex.forecast ?? []), ...(lex.rain ?? []), ...(lex.alerts ?? []),
    ...(lex.aqi ?? []), ...(lex.climate ?? []), ...(lex.models ?? []),
    ...(lex.today ?? []), ...(lex.tomorrow ?? []), ...(lex.dayAfter ?? []),
    'district', 'city', 'town', 'village', 'area', 'region',
  ];
  let out = raw.trim();
  for (const n of noise) {
    out = out.replace(new RegExp(`\\b${escapeRegex(n)}\\b`, 'gi'), ' ');
  }
  out = out.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  return out.length >= 2 ? out : null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ parser -- */

function countHits(haystack, words = []) {
  let hits = 0;
  const matched = [];
  for (const w of words) {
    if (haystack.includes(w.toLowerCase())) {
      hits += 1;
      matched.push(w);
    }
  }
  return { hits, matched };
}

/** Relative day offset (0 = today) mentioned in the query, else null. */
function extractDayOffset(haystack, lex) {
  if (countHits(haystack, lex.dayAfter).hits) return 2;
  if (countHits(haystack, lex.tomorrow).hits) return 1;
  if (countHits(haystack, lex.today).hits) return 0;

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const found = weekdays.findIndex((d) => haystack.includes(d));
  if (found >= 0) {
    const todayDow = new Date().getDay();
    return (found - todayDow + 7) % 7 || 7;
  }

  const inDays = haystack.match(/in\s+(\d{1,2})\s+days?/);
  if (inDays) return Math.min(Number(inDays[1]), 15);

  return null;
}

/** Requested forecast length in days, else null. */
function extractHorizon(haystack) {
  const explicit = haystack.match(/(\d{1,2})[\s-]*(?:day|days|दिन|দিন|நாள்|రోజు|ದಿನ|ദിവസ|ਦਿਨ)/);
  if (explicit) return Math.min(Math.max(Number(explicit[1]), 1), 16);
  if (/(week|weekly|सप्ताह|हफ्ते|সপ্তাহ|வாரம்|వారం|आठवडा|ਹਫ਼ਤਾ|ವಾರ|ആഴ്ച)/.test(haystack)) return 7;
  return null;
}

/** Explicit NWP model mentioned in the query. */
function extractModel(haystack) {
  if (/\b(gfs|ncep)\b/.test(haystack)) return 'gfs_seamless';
  if (/\b(ecmwf|ifs)\b/.test(haystack)) return 'ecmwf_ifs025';
  if (/\b(icon|dwd)\b/.test(haystack)) return 'icon_seamless';
  return null;
}

/**
 * Main entry point.
 *
 * @param {string} text raw user query
 * @param {{ lang?: string, context?: { place?: object|null, lang?: string } }} options
 */
export function parseQuery(text, { lang: preferred = DEFAULT_LANG, context = {} } = {}) {
  const raw = (text ?? '').trim();
  const lang = detectLanguage(raw, preferred);
  const lex = LEX[lang] ?? LEX.en;
  const haystack = raw.toLowerCase().normalize('NFKC');

  // Score every intent; also check the English lexicon so mixed-script or
  // transliterated queries ("Kolkata ka weather") still resolve.
  const enLex = LEX.en;
  const score = (key) => countHits(haystack, lex[key]).hits + countHits(haystack, enLex[key]).hits;

  const scores = {
    [INTENTS.ALERTS]: score('alerts') * 3,
    [INTENTS.AQI]: score('aqi') * 3,
    [INTENTS.CLIMATE]: score('climate') * 3,
    [INTENTS.MODELS]: score('models') * 3,
    [INTENTS.RAIN]: score('rain') * 2,
    [INTENTS.FORECAST]: score('forecast') * 2,
    [INTENTS.CURRENT]: score('current'),
    [INTENTS.GREETING]: score('greeting') * 2,
    [INTENTS.HELP]: score('help'),
  };

  // Sector detection (drives the advisory intent).
  let sector = null;
  let sectorHits = 0;
  for (const [name, words] of Object.entries(lex.sectors ?? {})) {
    const hits = countHits(haystack, words).hits + countHits(haystack, enLex.sectors[name]).hits;
    if (hits > sectorHits) {
      sectorHits = hits;
      sector = name;
    }
  }
  if (sector) scores[INTENTS.ADVISORY] = sectorHits * 3;

  const dayOffset = extractDayOffset(haystack, { ...enLex, ...lex });
  const horizonDays = extractHorizon(haystack);
  const model = extractModel(haystack);

  // A bare "tomorrow?" style follow-up is a forecast request.
  if (dayOffset != null && dayOffset > 0 && !scores[INTENTS.RAIN]) {
    scores[INTENTS.FORECAST] = (scores[INTENTS.FORECAST] ?? 0) + 2;
  }
  if (horizonDays) scores[INTENTS.FORECAST] = (scores[INTENTS.FORECAST] ?? 0) + 2;
  if (model) scores[INTENTS.MODELS] = (scores[INTENTS.MODELS] ?? 0) + 2;

  const ranked = Object.entries(scores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  let intent = ranked[0]?.[0] ?? INTENTS.UNKNOWN;
  const topScore = ranked[0]?.[1] ?? 0;

  const location = extractLocation(raw, lang);

  // A message that is only a place name means "current weather there".
  if (intent === INTENTS.UNKNOWN && (location.place || location.query)) intent = INTENTS.CURRENT;

  // Greeting should not win when the user also named a place or a weather term.
  if (intent === INTENTS.GREETING && (location.place || topScore < 2)) {
    if (location.place || location.query) intent = INTENTS.CURRENT;
  }

  const resolvedPlace = location.place ?? null;
  const usedContext = !resolvedPlace && !location.query && Boolean(context.place);

  return {
    raw,
    lang,
    intent,
    sector: intent === INTENTS.ADVISORY ? sector : sectorHits > 0 ? sector : null,
    place: resolvedPlace ?? (usedContext ? context.place : null),
    locationQuery: location.query,
    locationMethod: usedContext ? 'context' : location.method,
    dayOffset,
    horizonDays,
    model,
    usedContext,
    confidence: Math.min(1, 0.35 + topScore * 0.18 + (resolvedPlace || location.query ? 0.25 : 0)),
    scores,
  };
}

export const __testables = { LEX, cleanCandidate, extractDayOffset, extractHorizon };
