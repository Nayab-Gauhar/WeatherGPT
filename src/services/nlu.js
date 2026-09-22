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
 * This is Tier 1 of a two-tier stack: a deterministic, lexicon-driven parser
 * rather than a model call. For questions with a recognisable shape that is
 * strictly better:
 *   - it answers in tens of microseconds, so latency is dominated by the
 *     meteorological fetch rather than by inference;
 *   - it never hallucinates a location or an intent, which matters when the
 *     output feeds disaster-warning dissemination;
 *   - it works offline and costs nothing per query, so it can be deployed at
 *     district scale.
 *
 * Its ceiling is structural, though: a single `location` field cannot express
 * "compare Kolkata and Mumbai". `assessComplexity()` at the bottom of this file
 * detects the questions that exceed it and hands them to Tier 2
 * (`services/llm/`), which uses tool calling and can. Tier 1 remains the
 * fallback whenever Tier 2 is unavailable.
 */

import { SCRIPT_RANGES, DEFAULT_LANG } from '../i18n/languages.js';
import { scanForPlace, scanAllPlaces, INDIC_SUFFIXES } from '../data/places.js';
import { parseCoordinates } from '../utils/coords.js';

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

  /**
   * Hinglish — Hindi (and other Indian languages) typed in the Latin alphabet.
   *
   * This is how a very large share of Indian users actually write: "Kolkata ka
   * mausam kaisa hai", "kal barish hogi kya". Because it is Latin script, script
   * detection alone reads it as English and every keyword lookup misses, so it
   * needs its own lexicon rather than being folded into `en`.
   *
   * Spelling is not standardised, so common variants are listed side by side
   * (mausam / mosam, barish / baarish, garmi / garam).
   */
  hinglish: {
    current: ['mausam', 'mosam', 'mausham', 'tapman', 'taapman', 'garmi', 'garam', 'thand',
      'thandi', 'sardi', 'abhi', 'kaisa', 'kaisi', 'kaise', 'haal', 'nami', 'humidity'],
    forecast: ['anuman', 'agle', 'agla', 'hafte', 'hafta', 'saat din', 'aane wale', 'aage'],
    rain: ['barish', 'baarish', 'barsat', 'barsaat', 'chhata', 'chhatri', 'chatri', 'monsoon',
      'mausami', 'bheeg', 'paani girega'],
    alerts: ['chetavni', 'chetawni', 'alert', 'baadh', 'badh', 'toofan', 'tufan', 'chakravat',
      'khatra', 'aapda', 'apda', 'loo', 'sheet lahar'],
    aqi: ['pradushan', 'pradooshan', 'hawa kharab', 'dhuaan', 'dhuan', 'saans', 'pollution'],
    climate: ['jalvayu', 'ausat', 'samanya', 'badlav', 'pichle saal', 'dashak', 'itihas'],
    models: ['model', 'sahi', 'satik', 'bharosa', 'kitna sahi'],
    greeting: ['namaste', 'namaskar', 'hello ji', 'kaun ho', 'kya kar sakte', 'madad karo'],
    help: ['madad', 'sahayata', 'kaise karu'],
    sectors: {
      agriculture: ['kisan', 'kheti', 'fasal', 'phasal', 'krishi', 'buvai', 'bijai', 'katai',
        'sinchai', 'chidkav', 'chhidkav', 'keetnashak', 'khet', 'dhan', 'gehun', 'gehu'],
      aviation: ['vimaan', 'viman', 'udaan', 'hawai adda', 'flight', 'pilot'],
      marine: ['machhli', 'machli', 'macchi', 'samudra', 'samundar', 'nav', 'naav', 'mallah'],
      urban: ['shehar', 'shahar', 'yatayat', 'traffic', 'jalbharav', 'jal bharav', 'nagar nigam'],
    },
    today: ['aaj', 'aj', 'aaj raat'],
    tomorrow: ['kal', 'kl'],
    dayAfter: ['parson', 'parso'],
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

/**
 * Romanised Indian-language markers — grammatical words, not weather vocabulary.
 *
 * Function words are the reliable signal. Content words like "mausam" already
 * appear in the Hinglish lexicon, but a sentence is Hinglish because of its
 * *grammar* ("Kolkata **ka** mausam **kaisa hai**"), and grammar words are what
 * distinguish it from an English sentence that happens to name an Indian thing.
 */
const HINGLISH_MARKERS = [
  'hai', 'hain', 'hai', 'hoga', 'hogi', 'honge', 'tha', 'thi', 'rahega', 'rahegi',
  'kya', 'kaisa', 'kaisi', 'kaise', 'kitna', 'kitni', 'kab', 'kahan', 'kaun',
  'batao', 'bataiye', 'bata', 'mujhe', 'mera', 'meri', 'mere', 'humara',
  'ka', 'ki', 'ke', 'ko', 'mein', 'mai', 'nahi', 'nahin', 'karo', 'chahiye',
  'aaj', 'kal', 'parson', 'abhi', 'ahe', 'nahi ahe', 'kasa', 'konta',
];

/**
 * Detect the language of a query.
 *
 * Script identifies the nine Indic languages directly. Latin script needs more
 * care, because it covers both English and Hinglish — and defaulting Hinglish to
 * English means every keyword lookup misses and the user gets a fallback message
 * for a perfectly clear question.
 */
export function detectLanguage(text, preferred = DEFAULT_LANG) {
  const hit = SCRIPT_RANGES.find(({ re }) => re.test(text));

  if (!hit) {
    if (!/[a-z]/i.test(text)) return preferred;
    // Two markers, or one marker in a short phrase, is enough: "Kolkata ka
    // mausam" is three words and unambiguous, while a single stray "ka" inside a
    // long English sentence is not.
    const haystack = ` ${text.toLowerCase()} `;
    const markers = HINGLISH_MARKERS.filter((m) => containsTerm(haystack, m)).length;
    const words = text.trim().split(/\s+/).length;
    if (markers >= 2 || (markers === 1 && words <= 5)) return 'hinglish';
    return looksEnglish(text) ? 'en' : preferred === 'en' ? 'en' : preferred;
  }

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
 * Matches "<place><case marker>" in any Indic script, whether the marker is
 * attached ("কলকাতায়") or spaced ("ਅੰਮ੍ਰਿਤਸਰ ਦਾ").
 *
 * Built from the shared suffix list rather than a second hand-written
 * alternation, which had drifted out of sync and omitted most Gurmukhi markers.
 *
 * The trailing lookahead replaces `\b`, which is defined on ASCII word
 * characters and silently fails after Indic letters and vowel signs — the reason
 * "ਅੰਮ੍ਰਿਤਸਰ ਦਾ ਮੌਸਮ" previously yielded no location at all.
 */
const INDIC_POSTPOSITION_RE = new RegExp(
  `([\\u0900-\\u0D7F][\\u0900-\\u0D7F\\s]{1,30}?)\\s*(?:${INDIC_SUFFIXES.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  ).join('|')})(?![\\p{L}\\p{M}])`,
  'u',
);

/**
 * Pull a place name out of the sentence.
 * Order: curated gazetteer scan (handles native scripts and aliases) →
 * preposition patterns → Indic postposition patterns → capitalised residue.
 */
export function extractLocation(text, lang = 'en') {
  /*
   * A pasted coordinate pair is itself a location. Checked first because
   * "22.57, 88.36" has no name for any other rule to find, and people genuinely
   * paste positions from maps and field reports.
   */
  const coords = parseCoordinates(text);
  if (coords) {
    return { place: null, query: text.trim(), method: 'coordinates', coordinates: coords };
  }

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

  // Indic postpositions: "नागपुर में", "কলকাতায়", "சென்னையில்", "ਅੰਮ੍ਰਿਤਸਰ ਦਾ"
  const postposition = text.match(INDIC_POSTPOSITION_RE);
  if (postposition) {
    const candidate = postposition[1].trim();
    const known = scanForPlace(candidate);
    if (known) return { place: known, query: known.name, method: 'gazetteer' };
    const cleaned = cleanCandidate(candidate, lang);
    if (cleaned) return { place: null, query: cleaned, method: 'postposition' };
  }

  /*
   * Romanised postpositions: "nagpur ka mausam", "puri mein barish".
   *
   * Hinglish is written in the Latin alphabet, so neither the Indic pattern above
   * nor the capitalised-token rule below reliably applies — users typically type
   * place names in lower case. The case marker that follows the place is the
   * dependable cue.
   */
  const romanPost = text.match(
    /\b([a-z][a-z\s'-]{2,28}?)\s+(?:ka|ki|ke|ko|mein|me|ma|mai)\b/i,
  );
  if (romanPost) {
    const cleaned = cleanCandidate(romanPost[1], lang);
    if (cleaned && !HINGLISH_MARKERS.includes(cleaned.toLowerCase())) {
      const known = scanForPlace(cleaned);
      if (known) return { place: known, query: known.name, method: 'gazetteer' };
      return { place: null, query: cleaned, method: 'roman-postposition' };
    }
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

  /*
   * Final fallback for Indic scripts: the longest word that is not a known
   * keyword.
   *
   * Many languages place a bare noun beside the place with no case marker at all
   * — "കോഴിക്കോട്ട് മഴ" (Kozhikode rain), "पुणे पाऊस" — so the postposition
   * pattern above finds nothing and the capitalised-token rule cannot help
   * outside the Latin alphabet. Removing the words we recognise as weather
   * vocabulary usually leaves exactly the place name.
   */
  const indicTokens = text
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((token) => /[\u0900-\u0D7F]/.test(token) && token.length >= 3);

  if (indicTokens.length) {
    const noise = noiseTerms(lang);
    const residual = indicTokens
      .filter((token) => !noise.some((n) => containsTerm(token.toLowerCase(), n.toLowerCase())))
      .sort((a, b) => b.length - a.length);
    if (residual.length) return { place: null, query: residual[0], method: 'residual-token' };
  }

  return { place: null, query: null, method: 'none' };
}

/**
 * Function words — verbs, copulas, question words and pronouns.
 *
 * Needed because the residual-token heuristic picks the longest unrecognised
 * word, and without this list "बारिश होगी क्या?" ("will it rain?") offered
 * "होगी" ("will be") as a place name and sent it to the geocoder.
 */
const INDIC_STOPWORDS = [
  // Devanagari (Hindi / Marathi)
  'है', 'हैं', 'था', 'थी', 'थे', 'होगा', 'होगी', 'होंगे', 'हुआ', 'रहा', 'रही', 'रहे',
  'रहेगा', 'रहेगी', 'क्या', 'कैसा', 'कैसी', 'कैसे', 'कितना', 'कितनी', 'कब', 'कहाँ',
  'बताओ', 'बताइए', 'मुझे', 'मेरा', 'मेरी', 'मेरे', 'नहीं', 'और', 'लिए', 'साथ',
  'आहे', 'नाही', 'काय', 'कसे', 'कशी', 'कसा', 'सांगा', 'पडेल', 'होईल', 'किती',
  // Bengali
  'আছে', 'ছিল', 'হবে', 'হয়', 'হচ্ছে', 'কেমন', 'কি', 'কী', 'কত', 'কখন', 'কোথায়',
  'বলুন', 'আমার', 'আমি', 'এবং', 'না', 'জন্য',
  // Tamil
  'உள்ளது', 'இருக்கிறது', 'இருக்கும்', 'எப்படி', 'என்ன', 'எவ்வளவு', 'எப்போது',
  'வருமா', 'சொல்லுங்கள்', 'எனக்கு',
  // Telugu
  'ఉంది', 'ఉంటుంది', 'ఎలా', 'ఏమి', 'ఎంత', 'ఎప్పుడు', 'చెప్పండి', 'పడుతుందా', 'నాకు',
  // Kannada
  'ಇದೆ', 'ಇರುತ್ತದೆ', 'ಹೇಗೆ', 'ಏನು', 'ಎಷ್ಟು', 'ಯಾವಾಗ', 'ಹೇಳಿ', 'ನನಗೆ',
  // Malayalam
  'ഉണ്ട്', 'ഉണ്ടാകുമോ', 'എങ്ങനെ', 'എന്ത്', 'എത്ര', 'എപ്പോൾ', 'പറയുക', 'എനിക്ക്',
  // Gujarati
  'છે', 'હશે', 'કેવું', 'શું', 'કેટલું', 'ક્યારે', 'કહો', 'મને', 'પડશે',
  // Gurmukhi
  'ਹੈ', 'ਹਨ', 'ਹੋਵੇਗਾ', 'ਕਿਵੇਂ', 'ਕੀ', 'ਕਿੰਨਾ', 'ਕਦੋਂ', 'ਦੱਸੋ', 'ਮੈਨੂੰ',
];

/** Weather vocabulary and function words that must never be read as a place. */
function noiseTerms(lang) {
  const lex = LEX[lang] ?? LEX.en;
  return [
    ...(lex.current ?? []), ...(lex.forecast ?? []), ...(lex.rain ?? []), ...(lex.alerts ?? []),
    ...(lex.aqi ?? []), ...(lex.climate ?? []), ...(lex.models ?? []),
    ...(lex.today ?? []), ...(lex.tomorrow ?? []), ...(lex.dayAfter ?? []),
    // Sector vocabulary is a common false positive: "kisan ke liye fasal salah"
    // ("crop advice for farmers") offered "kisan" — farmer — as a place name.
    ...Object.values(lex.sectors ?? {}).flat(),
    ...INDIC_STOPWORDS,
    'district', 'city', 'town', 'village', 'area', 'region',
  ];
}

/**
 * Strip intent keywords from a candidate place string.
 *
 * Uses the shared boundary-aware matcher rather than `\b`, which is defined on
 * ASCII word characters and therefore never fired for Indic keywords.
 */
function cleanCandidate(raw, lang) {
  let out = String(raw).trim();

  for (const term of noiseTerms(lang)) {
    const escaped = escapeRegex(term);
    const pattern = /^[\x20-\x7F]+$/.test(term)
      ? new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'gi')
      : new RegExp(`(^|[^\\p{L}\\p{M}])${escaped}($|[^\\p{L}\\p{M}])`, 'gu');
    out = out.replace(pattern, '$1 $2');
  }

  out = out.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  return out.length >= 2 ? out : null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ parser -- */

/**
 * Boundary-aware term matching, used by every lexicon check in this file.
 *
 * Plain `includes()` is unsafe in both scripts this parser handles, and the
 * failures are not hypothetical:
 *
 *   - "hi" (a greeting) occurs inside "s**hi**mla" and "Del**hi**", so bare place
 *     names were being classified as greetings.
 *   - "या" (Hindi "or") occurs inside "क्या", the ordinary question marker, so
 *     "कल बारिश होगी क्या?" was treated as a comparison.
 *
 * Boundaries must exclude combining marks as well as letters: "क्या" is
 * क + ् + य + ा, so the character preceding "या" is a virama — a Mark, not a
 * Letter. Checking only `\p{L}` would still match.
 *
 * Terms that carry their own padding (" vs ") are matched literally, since the
 * spaces are the boundary.
 */
function containsTerm(haystack, term) {
  if (/^\s|\s$/.test(term)) return haystack.includes(term);

  const escaped = escapeRegex(term);
  // ASCII terms use alphanumeric boundaries so "temp" does not match
  // "temperature" — both are listed separately where both are wanted.
  if (/^[\x20-\x7F]+$/.test(term)) {
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(haystack);
  }
  return new RegExp(`(^|[^\\p{L}\\p{M}])${escaped}($|[^\\p{L}\\p{M}])`, 'u').test(haystack);
}

const hasAny = (haystack, terms) => terms.some((term) => containsTerm(haystack, term));

function countHits(haystack, words = []) {
  let hits = 0;
  const matched = [];
  for (const w of words) {
    if (containsTerm(haystack, w.toLowerCase())) {
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

  /*
   * A named place always outranks a greeting.
   *
   * Previously this was gated on the greeting's score, which meant a bare
   * "Shimla" stayed classified as a greeting. Whatever the scores, a message
   * containing a location is a weather question.
   */
  if (intent === INTENTS.GREETING && (location.place || location.query)) {
    intent = INTENTS.CURRENT;
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

/* ------------------------------------------------------- routing decision -- */

/**
 * Words that signal a question this parser cannot fully represent.
 *
 * Comparison needs more than one location, and a fixed extraction schema has
 * only one location field. Personal context ("I have asthma", "for my wedding")
 * needs the answer reasoned *about* the data rather than merely reported. Both
 * belong on the language-model path.
 */
const COMPARATIVE = [
  'compare', 'comparison', 'versus', ' vs ', 'better', 'worse', 'difference', 'differ',
  'or should', 'which one', 'which is', 'between', 'both', 'rather than', 'instead of',
  // Bare "than" plus comparative adjectives: "is this September wetter than
  // normal" is a comparison even though no second place is named.
  ' than ', 'wetter', 'drier', 'dryer', 'hotter', 'colder', 'warmer', 'cooler',
  'heavier', 'stronger', 'more rain', 'less rain',
  'तुलना', 'बेहतर', 'में से', 'से ज्यादा', 'से अधिक', 'কোনটি', 'তুলনা', 'ভালো',
  'ஒப்பீடு', 'சிறந்த', 'పోలిక', 'మంచిది', 'तुलनेत', 'चांगले',
];


/**
 * Terms anchoring a question in the observed past, and in the forecast future.
 *
 * A query touching both needs two different datasets — the climate archive and
 * the forecast — so it cannot be served by a single handler. This is the signal
 * that catches "is this September wetter than normal, and will next week
 * continue the trend?", which scores high confidence on the climate intent and
 * would otherwise be answered only halfway.
 */
const HISTORICAL = [
  'normal', 'average', 'usual', 'typical', 'trend', 'historical', 'historically',
  'last year', 'last month', 'past', 'previous', 'record', 'compared to', 'so far',
  'सामान्य', 'औसत', 'पिछले', 'प्रवृत्ति', 'স্বাভাবিক', 'গড়', 'সাধারণ',
  'சராசரி', 'வழக்கமான', 'సగటు', 'సాధారణ', 'सरासरी',
];

const FUTURE = [
  'will', 'going to', 'next week', 'next month', 'coming', 'tomorrow', 'forecast',
  'ahead', 'continue', 'expect', 'later',
  'होगा', 'होगी', 'अगले', 'कल', 'आगे', 'হবে', 'আগামী', 'পরবর্তী',
  'வருமா', 'நாளை', 'அடுத்த', 'రేపు', 'తదుపరి', 'उद्या', 'पुढील',
];

const PERSONAL_CONTEXT = [
  'i have', 'i am', "i'm", 'my ', 'we have', 'we are', 'should i', 'can i', 'is it safe',
  'is it ok', 'good idea', 'advise me', 'help me', 'suggest', 'recommend', 'plan',
  'asthma', 'allergy', 'wedding', 'travel', 'trip', 'journey', 'match', 'event',
  'मुझे', 'मेरा', 'मेरी', 'मेरे', 'क्या मैं', 'सलाह', 'आमार', 'আমার', 'আমি',
  'எனக்கு', 'என்', 'నాకు', 'నా ', 'मला', 'माझा', 'माझी',
];

const REASONING = [
  'why', 'how come', 'what does it mean', 'explain', 'because', 'reason',
  'क्यों', 'कारण', 'समझाएं', 'কেন', 'কারণ', 'ஏன்', 'ఎందుకు', 'का कारण',
];

/**
 * Decide whether a query needs the language-model path.
 *
 * Runs on the deterministic parse, so routing itself costs nothing.
 *
 * @param {string} text raw query
 * @param {object} parsed result of `parseQuery`
 * @returns {{ needsLlm: boolean, reasons: string[], places: object[] }}
 */
export function assessComplexity(text, parsed) {
  const haystack = ` ${String(text ?? '').toLowerCase().normalize('NFKC')} `;
  const reasons = [];

  const places = scanAllPlaces(text);
  if (places.length > 1) reasons.push('multiple-locations');

  if (hasAny(haystack, COMPARATIVE)) reasons.push('comparative');
  if (hasAny(haystack, PERSONAL_CONTEXT)) reasons.push('personal-context');
  if (hasAny(haystack, REASONING)) reasons.push('explanation');

  // Past *and* future in one question means two datasets, so no single
  // deterministic handler can answer it completely.
  if (hasAny(haystack, HISTORICAL) && hasAny(haystack, FUTURE)) {
    reasons.push('spans-past-and-future');
  }

  // Two clauses joined by "and" where the second starts its own question.
  if (/\band\s+(will|is|are|was|were|can|could|should|do|does|did|what|how|why|when)\b/.test(haystack)) {
    reasons.push('conjoined-clauses');
  }

  // The parser could not classify it at all.
  if (parsed.intent === INTENTS.UNKNOWN) reasons.push('unclassified');

  // Weak classification on a sentence long enough to carry real nuance.
  const wordCount = String(text ?? '').trim().split(/\s+/).length;
  if (parsed.confidence < 0.7 && wordCount >= 6) reasons.push('low-confidence');

  // Two distinct question clauses — "is it wetter than normal, and will it continue?"
  if ((text.match(/\?/g) ?? []).length > 1) reasons.push('multi-clause');

  return { needsLlm: reasons.length > 0, reasons, places };
}

export const __testables = { LEX, cleanCandidate, extractDayOffset, extractHorizon };
