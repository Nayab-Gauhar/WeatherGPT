/**
 * Suggestion-chip labels.
 *
 * A chip carries a localised `label` for display and a canonical English
 * `query` that is fed to the parser, so follow-up suggestions resolve reliably
 * regardless of the interface language.
 */

const CHIPS = {
  en: {
    forecast7: 'Show 7-day forecast',
    rainTomorrow: 'Will it rain tomorrow?',
    aqi: (p) => `Air quality in ${p}`,
    warnings: 'Any weather warnings?',
    climate: 'Climate trend',
    agri: 'Farmer advisory',
    aviation: 'Aviation briefing',
    marine: 'Fishing conditions',
    urban: 'Urban flooding risk',
    models: 'Compare forecast models',
    currentAgain: (p) => `Current weather in ${p}`,
    tryKolkata: 'Weather in Kolkata',
    tryDelhi: 'Air quality in Delhi',
    tryFarmer: 'Crop advisory for farmers in Nagpur',
    tryCyclone: 'Cyclone warnings for Puri',
  },
  hi: {
    forecast7: '7 दिन का पूर्वानुमान',
    rainTomorrow: 'कल बारिश होगी?',
    aqi: (p) => `${p} की वायु गुणवत्ता`,
    warnings: 'कोई चेतावनी है?',
    climate: 'जलवायु प्रवृत्ति',
    agri: 'किसान सलाह',
    aviation: 'विमानन ब्रीफिंग',
    marine: 'मछली पकड़ने की स्थिति',
    urban: 'शहरी जलभराव जोखिम',
    models: 'मॉडल तुलना',
    currentAgain: (p) => `${p} का वर्तमान मौसम`,
    tryKolkata: 'कोलकाता का मौसम',
    tryDelhi: 'दिल्ली की वायु गुणवत्ता',
    tryFarmer: 'नागपुर के किसानों के लिए फसल सलाह',
    tryCyclone: 'पुरी के लिए चक्रवात चेतावनी',
  },
  bn: {
    forecast7: '৭ দিনের পূর্বাভাস',
    rainTomorrow: 'আগামীকাল বৃষ্টি হবে?',
    aqi: (p) => `${p}-এর বায়ুর গুণমান`,
    warnings: 'কোনো সতর্কতা আছে?',
    climate: 'জলবায়ু প্রবণতা',
    agri: 'কৃষক পরামর্শ',
    aviation: 'বিমান ব্রিফিং',
    marine: 'মাছ ধরার পরিস্থিতি',
    urban: 'শহরে জলাবদ্ধতার ঝুঁকি',
    models: 'মডেল তুলনা',
    currentAgain: (p) => `${p}-এর বর্তমান আবহাওয়া`,
    tryKolkata: 'কলকাতার আবহাওয়া',
    tryDelhi: 'দিল্লির বায়ুর গুণমান',
    tryFarmer: 'নাগপুরের কৃষকদের জন্য ফসল পরামর্শ',
    tryCyclone: 'পুরীর জন্য ঘূর্ণিঝড় সতর্কতা',
  },
  ta: {
    forecast7: '7 நாள் முன்னறிவிப்பு',
    rainTomorrow: 'நாளை மழை வருமா?',
    aqi: (p) => `${p} காற்றின் தரம்`,
    warnings: 'ஏதேனும் எச்சரிக்கை?',
    climate: 'பருவநிலை போக்கு',
    agri: 'விவசாயி ஆலோசனை',
    aviation: 'விமான அறிக்கை',
    marine: 'மீன்பிடி நிலை',
    urban: 'நகர வெள்ள அபாயம்',
    models: 'மாதிரி ஒப்பீடு',
    currentAgain: (p) => `${p} தற்போதைய வானிலை`,
    tryKolkata: 'சென்னை வானிலை',
    tryDelhi: 'டெல்லி காற்றின் தரம்',
    tryFarmer: 'கோயம்புத்தூர் விவசாயிகளுக்கு பயிர் ஆலோசனை',
    tryCyclone: 'புரி புயல் எச்சரிக்கை',
  },
  te: {
    forecast7: '7 రోజుల సూచన',
    rainTomorrow: 'రేపు వర్షం పడుతుందా?',
    aqi: (p) => `${p} గాలి నాణ్యత`,
    warnings: 'ఏమైనా హెచ్చరికలు?',
    climate: 'వాతావరణ ధోరణి',
    agri: 'రైతు సూచన',
    aviation: 'విమానయాన నివేదిక',
    marine: 'చేపలు పట్టే పరిస్థితి',
    urban: 'నగర వరద ముప్పు',
    models: 'నమూనాల పోలిక',
    currentAgain: (p) => `${p} ప్రస్తుత వాతావరణం`,
    tryKolkata: 'హైదరాబాద్ వాతావరణం',
    tryDelhi: 'ఢిల్లీ గాలి నాణ్యత',
    tryFarmer: 'విశాఖపట్నం రైతులకు పంట సూచన',
    tryCyclone: 'పురి తుఫాను హెచ్చరికలు',
  },
  mr: {
    forecast7: '7 दिवसांचा अंदाज',
    rainTomorrow: 'उद्या पाऊस पडेल?',
    aqi: (p) => `${p} ची हवेची गुणवत्ता`,
    warnings: 'काही इशारे आहेत?',
    climate: 'हवामान कल',
    agri: 'शेतकरी सल्ला',
    aviation: 'विमान माहिती',
    marine: 'मासेमारीची स्थिती',
    urban: 'शहरी पूर धोका',
    models: 'मॉडेल तुलना',
    currentAgain: (p) => `${p} चे सध्याचे हवामान`,
    tryKolkata: 'मुंबईचे हवामान',
    tryDelhi: 'दिल्लीची हवेची गुणवत्ता',
    tryFarmer: 'नागपूरच्या शेतकऱ्यांसाठी पीक सल्ला',
    tryCyclone: 'पुरीसाठी चक्रीवादळ इशारा',
  },
  gu: {
    forecast7: '7 દિવસનું અનુમાન',
    rainTomorrow: 'કાલે વરસાદ પડશે?',
    aqi: (p) => `${p} ની હવાની ગુણવત્તા`,
    warnings: 'કોઈ ચેતવણી છે?',
    climate: 'હવામાન પ્રવાહ',
    agri: 'ખેડૂત સલાહ',
  },
  kn: {
    forecast7: '7 ದಿನಗಳ ಮುನ್ಸೂಚನೆ',
    rainTomorrow: 'ನಾಳೆ ಮಳೆ ಬರುತ್ತದೆಯೇ?',
    aqi: (p) => `${p} ಗಾಳಿಯ ಗುಣಮಟ್ಟ`,
    warnings: 'ಯಾವುದೇ ಎಚ್ಚರಿಕೆ ಇದೆಯೇ?',
    climate: 'ಹವಾಮಾನ ಪ್ರವೃತ್ತಿ',
    agri: 'ರೈತ ಸಲಹೆ',
  },
  ml: {
    forecast7: '7 ദിവസ പ്രവചനം',
    rainTomorrow: 'നാളെ മഴ ഉണ്ടാകുമോ?',
    aqi: (p) => `${p} വായു ഗുണനിലവാരം`,
    warnings: 'എന്തെങ്കിലും മുന്നറിയിപ്പ്?',
    climate: 'കാലാവസ്ഥാ പ്രവണത',
    agri: 'കർഷക നിർദ്ദേശം',
  },
  pa: {
    forecast7: '7 ਦਿਨਾਂ ਦਾ ਅਨੁਮਾਨ',
    rainTomorrow: 'ਕੱਲ੍ਹ ਬਾਰਿਸ਼ ਹੋਵੇਗੀ?',
    aqi: (p) => `${p} ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ`,
    warnings: 'ਕੋਈ ਚੇਤਾਵਨੀ ਹੈ?',
    climate: 'ਜਲਵਾਯੂ ਰੁਝਾਨ',
    agri: 'ਕਿਸਾਨ ਸਲਾਹ',
  },
};

export function chipLabel(key, lang, ...args) {
  const value = CHIPS[lang]?.[key] ?? CHIPS.en[key];
  return typeof value === 'function' ? value(...args) : value;
}

/** Opening prompts shown before the first question. */
export function starterChips(lang) {
  return [
    { label: chipLabel('tryKolkata', lang), query: 'Weather in Kolkata' },
    { label: chipLabel('tryFarmer', lang), query: 'Crop advisory for farmers in Nagpur' },
    { label: chipLabel('tryCyclone', lang), query: 'Cyclone warnings for Puri' },
    { label: chipLabel('tryDelhi', lang), query: 'Air quality in Delhi' },
  ];
}
