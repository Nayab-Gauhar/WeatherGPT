/**
 * Response templates — the natural-language "voice" of WeatherGPT.
 *
 * Each language exposes the same set of template functions. `tpl()` in
 * ./index.js resolves a key for the active language and silently falls back to
 * English when a language has not translated that particular sentence.
 */

import { bnGenitive, bnLocative, guSuffix } from './grammar.js';

export const TEMPLATES = {
  en: {
    currentIntro: (p) => `Here is the current weather information for ${p}:`,
    forecastIntro: (p, n) => `Here is the ${n}-day forecast for ${p}:`,
    dayIntro: (p, d) => `Here is the forecast for ${p} on ${d}:`,
    alertsIntro: (p, n) =>
      `${n} active weather ${n === 1 ? 'warning' : 'warnings'} for ${p}. Please read the advisory carefully:`,
    alertsNone: (p) => `There are no active weather warnings for ${p} at the moment.`,
    aqiIntro: (p) => `Here is the current air quality for ${p}:`,
    climateIntro: (p, y) => `Here is the climate trend for ${p} over the last ${y} years:`,
    modelIntro: (p) =>
      `Comparing numerical weather prediction models for ${p}. Wider spread means lower confidence:`,
    advisoryIntro: (p, s) => `Here is the ${s} advisory for ${p}:`,
    rainYes: (p, w, mm) =>
      `Yes — rain is expected in ${p} ${w}, with about ${mm} mm of accumulation.`,
    rainNo: (p, w) => `No significant rain is expected in ${p} ${w}.`,
    greeting: () =>
      'Namaste! I am WeatherGPT. Ask me about current weather, forecasts, warnings, air quality or climate trends for any location — in your own language, by typing or by voice.',
    notFound: (q) =>
      `I could not find a place called "${q}". Try a city, district or landmark name — for example "Nagpur", "Kutch" or "Shimla".`,
    fallback: () =>
      'I can help with current weather, forecasts, extreme-weather warnings, air quality, climate trends and sector advisories. Try asking about a specific place.',
    error: () =>
      'I could not reach the meteorological servers just now. Please check the connection and try again.',
    tomorrowWord: 'tomorrow',
    todayWord: 'today',
    next24: 'in the next 24 hours',
  },

  /**
   * Hinglish — Hindi phrasing in the Latin alphabet.
   *
   * Users who type "Kolkata ka mausam kaisa hai" are not asking for Devanagari
   * and are not asking for formal English; replying in either breaks the
   * register. Kept deliberately colloquial, the way the question was asked.
   */
  hinglish: {
    currentIntro: (p) => `${p} ka abhi ka mausam:`,
    forecastIntro: (p, n) => `${p} ke liye ${n} din ka anuman:`,
    dayIntro: (p, d) => `${d} ko ${p} ka anuman:`,
    alertsIntro: (p, n) => `${p} ke liye ${n} mausam chetavni hai. Salah dhyan se padhein:`,
    alertsNone: (p) => `${p} ke liye abhi koi mausam chetavni nahi hai.`,
    aqiIntro: (p) => `${p} ki abhi ki hawa ki quality:`,
    climateIntro: (p, y) => `Pichle ${y} saal mein ${p} ka jalvayu trend:`,
    modelIntro: (p) =>
      `${p} ke liye alag-alag mausam models ki tulna. Zyada antar matlab kam bharosa:`,
    advisoryIntro: (p, s) => `${p} ke liye ${s} salah:`,
    rainYes: (p, w, mm) => `Haan — ${p} mein ${w} barish ho sakti hai, lagbhag ${mm} mm.`,
    rainNo: (p, w) => `${p} mein ${w} khaas barish ki sambhavna nahi hai.`,
    greeting: () =>
      'Namaste! Main WeatherGPT hoon. Kisi bhi jagah ka mausam, anuman, chetavni, hawa ki quality ya jalvayu trend poochh sakte hain — likh kar ya bol kar, apni bhasha mein.',
    notFound: (q) =>
      `"${q}" naam ki jagah nahi mili. Sheher ya zile ka naam try karein — jaise "Nagpur", "Kutch" ya "Shimla".`,
    fallback: () =>
      'Main abhi ka mausam, anuman, chetavni, hawa ki quality, jalvayu trend aur kisan/viman/samudra salah mein madad kar sakta hoon. Kisi jagah ka naam bataiye.',
    error: () => 'Mausam server se connect nahi ho paya. Connection check karke phir try karein.',
    tomorrowWord: 'kal',
    todayWord: 'aaj',
    next24: 'agle 24 ghante mein',
  },

  hi: {
    currentIntro: (p) => `${p} के वर्तमान मौसम की जानकारी इस प्रकार है:`,
    forecastIntro: (p, n) => `${p} के लिए ${n} दिनों का पूर्वानुमान:`,
    dayIntro: (p, d) => `${d} को ${p} का पूर्वानुमान:`,
    alertsIntro: (p, n) => `${p} के लिए ${n} सक्रिय मौसम चेतावनी। कृपया सलाह ध्यान से पढ़ें:`,
    alertsNone: (p) => `${p} के लिए इस समय कोई सक्रिय मौसम चेतावनी नहीं है।`,
    aqiIntro: (p) => `${p} की वर्तमान वायु गुणवत्ता:`,
    climateIntro: (p, y) => `पिछले ${y} वर्षों में ${p} की जलवायु प्रवृत्ति:`,
    modelIntro: (p) =>
      `${p} के लिए संख्यात्मक मौसम पूर्वानुमान मॉडलों की तुलना। अधिक अंतर का अर्थ कम विश्वसनीयता:`,
    advisoryIntro: (p, s) => `${p} के लिए ${s} सलाह:`,
    rainYes: (p, w, mm) => `हाँ — ${p} में ${w} बारिश की संभावना है, लगभग ${mm} मिमी।`,
    rainNo: (p, w) => `${p} में ${w} किसी विशेष बारिश की संभावना नहीं है।`,
    greeting: () =>
      'नमस्ते! मैं WeatherGPT हूँ। किसी भी स्थान का मौसम, पूर्वानुमान, चेतावनी, वायु गुणवत्ता या जलवायु प्रवृत्ति पूछें — अपनी भाषा में, लिखकर या बोलकर।',
    notFound: (q) =>
      `"${q}" नाम का स्थान नहीं मिला। कृपया शहर या ज़िले का नाम आज़माएँ — जैसे "नागपुर", "कच्छ" या "शिमला"।`,
    fallback: () =>
      'मैं वर्तमान मौसम, पूर्वानुमान, चेतावनी, वायु गुणवत्ता, जलवायु प्रवृत्ति और क्षेत्रवार सलाह में मदद कर सकता हूँ। किसी स्थान का नाम बताकर पूछें।',
    error: () => 'मौसम सर्वर से संपर्क नहीं हो सका। कृपया कनेक्शन जाँचकर पुनः प्रयास करें।',
    tomorrowWord: 'कल',
    todayWord: 'आज',
    next24: 'अगले 24 घंटों में',
  },

  bn: {
    currentIntro: (p) => `${bnGenitive(p)} বর্তমান আবহাওয়ার তথ্য:`,
    forecastIntro: (p, n) => `${bnGenitive(p)} জন্য ${n} দিনের পূর্বাভাস:`,
    dayIntro: (p, d) => `${d} তারিখে ${bnGenitive(p)} পূর্বাভাস:`,
    alertsIntro: (p, n) => `${bnGenitive(p)} জন্য ${n}টি সক্রিয় আবহাওয়া সতর্কতা। পরামর্শ মন দিয়ে পড়ুন:`,
    alertsNone: (p) => `${bnGenitive(p)} জন্য এই মুহূর্তে কোনো সক্রিয় আবহাওয়া সতর্কতা নেই।`,
    aqiIntro: (p) => `${bnGenitive(p)} বর্তমান বায়ুর গুণমান:`,
    climateIntro: (p, y) => `গত ${y} বছরে ${bnGenitive(p)} জলবায়ু প্রবণতা:`,
    modelIntro: (p) => `${bnGenitive(p)} জন্য সংখ্যাগত আবহাওয়া মডেলের তুলনা। বেশি পার্থক্য মানে কম নিশ্চয়তা:`,
    advisoryIntro: (p, s) => `${bnGenitive(p)} জন্য ${s} পরামর্শ:`,
    rainYes: (p, w, mm) => `হ্যাঁ — ${bnLocative(p)} ${w} বৃষ্টির সম্ভাবনা আছে, প্রায় ${mm} মিমি।`,
    rainNo: (p, w) => `${bnLocative(p)} ${w} উল্লেখযোগ্য বৃষ্টির সম্ভাবনা নেই।`,
    greeting: () =>
      'নমস্কার! আমি WeatherGPT। যেকোনো জায়গার আবহাওয়া, পূর্বাভাস, সতর্কতা, বায়ুর গুণমান বা জলবায়ু প্রবণতা জিজ্ঞাসা করুন — নিজের ভাষায়, লিখে বা বলে।',
    notFound: (q) =>
      `"${q}" নামের কোনো জায়গা পাওয়া গেল না। শহর বা জেলার নাম লিখুন — যেমন "দুর্গাপুর", "পুরুলিয়া"।`,
    fallback: () =>
      'আমি বর্তমান আবহাওয়া, পূর্বাভাস, সতর্কতা, বায়ুর গুণমান, জলবায়ু প্রবণতা ও ক্ষেত্রভিত্তিক পরামর্শে সাহায্য করতে পারি।',
    error: () => 'আবহাওয়া সার্ভারে পৌঁছানো গেল না। সংযোগ দেখে আবার চেষ্টা করুন।',
    tomorrowWord: 'আগামীকাল',
    todayWord: 'আজ',
    next24: 'পরবর্তী ২৪ ঘণ্টায়',
  },

  ta: {
    currentIntro: (p) => `${p} பகுதியின் தற்போதைய வானிலை விவரம்:`,
    forecastIntro: (p, n) => `${p} பகுதிக்கான ${n} நாள் முன்னறிவிப்பு:`,
    dayIntro: (p, d) => `${d} அன்று ${p} பகுதியின் முன்னறிவிப்பு:`,
    alertsIntro: (p, n) => `${p} பகுதிக்கு ${n} வானிலை எச்சரிக்கை உள்ளது. ஆலோசனையை கவனமாகப் படியுங்கள்:`,
    alertsNone: (p) => `${p} பகுதிக்கு தற்போது எந்த வானிலை எச்சரிக்கையும் இல்லை.`,
    aqiIntro: (p) => `${p} பகுதியின் தற்போதைய காற்றின் தரம்:`,
    climateIntro: (p, y) => `கடந்த ${y} ஆண்டுகளில் ${p} பகுதியின் பருவநிலை போக்கு:`,
    modelIntro: (p) => `${p} பகுதிக்கான வானிலை மாதிரிகளின் ஒப்பீடு. அதிக வேறுபாடு குறைந்த உறுதி:`,
    advisoryIntro: (p, s) => `${p} பகுதிக்கான ${s} ஆலோசனை:`,
    rainYes: (p, w, mm) => `ஆம் — ${p} பகுதியில் ${w} மழை வாய்ப்பு உள்ளது, சுமார் ${mm} மி.மீ.`,
    rainNo: (p, w) => `${p} பகுதியில் ${w} குறிப்பிடத்தக்க மழை வாய்ப்பு இல்லை.`,
    greeting: () =>
      'வணக்கம்! நான் WeatherGPT. எந்த இடத்தின் வானிலை, முன்னறிவிப்பு, எச்சரிக்கை, காற்றின் தரம் அல்லது பருவநிலை போக்கையும் உங்கள் மொழியில் கேளுங்கள் — எழுதியோ பேசியோ.',
    notFound: (q) => `"${q}" என்ற இடம் கிடைக்கவில்லை. நகரம் அல்லது மாவட்டப் பெயரை முயலுங்கள்.`,
    fallback: () =>
      'தற்போதைய வானிலை, முன்னறிவிப்பு, எச்சரிக்கை, காற்றின் தரம், பருவநிலை போக்கு மற்றும் துறைவாரி ஆலோசனைகளில் உதவ முடியும்.',
    error: () => 'வானிலை சேவையகத்தை அணுக முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.',
    tomorrowWord: 'நாளை',
    todayWord: 'இன்று',
    next24: 'அடுத்த 24 மணி நேரத்தில்',
  },

  te: {
    currentIntro: (p) => `${p} ప్రాంతం ప్రస్తుత వాతావరణ వివరాలు:`,
    forecastIntro: (p, n) => `${p} ప్రాంతానికి ${n} రోజుల సూచన:`,
    dayIntro: (p, d) => `${d} నాడు ${p} ప్రాంతం సూచన:`,
    alertsIntro: (p, n) => `${p} ప్రాంతానికి ${n} వాతావరణ హెచ్చరికలు ఉన్నాయి. సూచనలను జాగ్రత్తగా చదవండి:`,
    alertsNone: (p) => `${p} ప్రాంతానికి ప్రస్తుతం ఎలాంటి వాతావరణ హెచ్చరికలు లేవు.`,
    aqiIntro: (p) => `${p} ప్రాంతం ప్రస్తుత గాలి నాణ్యత:`,
    climateIntro: (p, y) => `గత ${y} సంవత్సరాలలో ${p} ప్రాంతం వాతావరణ ధోరణి:`,
    modelIntro: (p) => `${p} ప్రాంతానికి వాతావరణ నమూనాల పోలిక. ఎక్కువ వ్యత్యాసం అంటే తక్కువ నిశ్చయత:`,
    advisoryIntro: (p, s) => `${p} ప్రాంతానికి ${s} సూచన:`,
    rainYes: (p, w, mm) => `అవును — ${p} ప్రాంతంలో ${w} వర్షం అవకాశం ఉంది, సుమారు ${mm} మి.మీ.`,
    rainNo: (p, w) => `${p} ప్రాంతంలో ${w} ప్రత్యేక వర్ష సూచన లేదు.`,
    greeting: () =>
      'నమస్కారం! నేను WeatherGPT. ఏ ప్రాంతం వాతావరణం, సూచన, హెచ్చరికలు, గాలి నాణ్యత లేదా వాతావరణ ధోరణి గురించి అయినా మీ భాషలో అడగండి — టైప్ చేసి లేదా మాట్లాడి.',
    notFound: (q) => `"${q}" అనే ప్రాంతం కనిపించలేదు. నగరం లేదా జిల్లా పేరు ప్రయత్నించండి.`,
    fallback: () =>
      'ప్రస్తుత వాతావరణం, సూచనలు, హెచ్చరికలు, గాలి నాణ్యత, వాతావరణ ధోరణులు మరియు రంగాల సూచనలలో సహాయం చేయగలను.',
    error: () => 'వాతావరణ సర్వర్‌ను చేరుకోలేకపోయాను. కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి.',
    tomorrowWord: 'రేపు',
    todayWord: 'ఈరోజు',
    next24: 'తదుపరి 24 గంటల్లో',
  },

  mr: {
    currentIntro: (p) => `${p} येथील सध्याचे हवामान:`,
    forecastIntro: (p, n) => `${p} येथील ${n} दिवसांचा अंदाज:`,
    dayIntro: (p, d) => `${d} रोजी ${p} येथील अंदाज:`,
    alertsIntro: (p, n) => `${p} येथे ${n} सक्रिय हवामान इशारे. कृपया सल्ला काळजीपूर्वक वाचा:`,
    alertsNone: (p) => `${p} येथे सध्या कोणतेही सक्रिय हवामान इशारे नाहीत.`,
    aqiIntro: (p) => `${p} येथील सध्याची हवेची गुणवत्ता:`,
    climateIntro: (p, y) => `गेल्या ${y} वर्षांतील ${p} येथील हवामान कल:`,
    modelIntro: (p) => `${p} येथील हवामान मॉडेलची तुलना. जास्त फरक म्हणजे कमी खात्री:`,
    advisoryIntro: (p, s) => `${p} येथील ${s} सल्ला:`,
    rainYes: (p, w, mm) => `होय — ${p} येथे ${w} पावसाची शक्यता आहे, सुमारे ${mm} मिमी.`,
    rainNo: (p, w) => `${p} येथे ${w} विशेष पावसाची शक्यता नाही.`,
    greeting: () =>
      'नमस्कार! मी WeatherGPT. कोणत्याही ठिकाणचे हवामान, अंदाज, इशारे, हवेची गुणवत्ता किंवा हवामान कल विचारा — तुमच्या भाषेत, लिहून किंवा बोलून.',
    notFound: (q) => `"${q}" नावाचे ठिकाण सापडले नाही. शहर किंवा जिल्ह्याचे नाव वापरा.`,
    fallback: () =>
      'मी सध्याचे हवामान, अंदाज, इशारे, हवेची गुणवत्ता, हवामान कल आणि क्षेत्रनिहाय सल्ला यात मदत करू शकतो.',
    error: () => 'हवामान सर्व्हरशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
    tomorrowWord: 'उद्या',
    todayWord: 'आज',
    next24: 'पुढील 24 तासांत',
  },

  gu: {
    currentIntro: (p) => `${guSuffix(p, 'નું')} હાલનું હવામાન:`,
    forecastIntro: (p, n) => `${p} માટે ${n} દિવસનું અનુમાન:`,
    alertsIntro: (p, n) => `${p} માટે ${n} સક્રિય હવામાન ચેતવણી. સલાહ ધ્યાનથી વાંચો:`,
    alertsNone: (p) => `${p} માટે હાલ કોઈ સક્રિય હવામાન ચેતવણી નથી.`,
    aqiIntro: (p) => `${guSuffix(p, 'ની')} હાલની હવાની ગુણવત્તા:`,
    climateIntro: (p, y) => `છેલ્લા ${y} વર્ષોમાં ${guSuffix(p, 'નો')} હવામાન પ્રવાહ:`,
    rainYes: (p, w, mm) => `હા — ${guSuffix(p, 'માં')} ${w} વરસાદની સંભાવના છે, લગભગ ${mm} મિમી.`,
    rainNo: (p, w) => `${guSuffix(p, 'માં')} ${w} ખાસ વરસાદની સંભાવના નથી.`,
    greeting: () =>
      'નમસ્તે! હું WeatherGPT છું. કોઈપણ જગ્યાનું હવામાન, અનુમાન, ચેતવણી કે હવાની ગુણવત્તા પૂછો — તમારી ભાષામાં.',
    notFound: (q) => `"${q}" નામની જગ્યા મળી નથી. શહેર કે જિલ્લાનું નામ આપો.`,
    tomorrowWord: 'કાલે',
    todayWord: 'આજે',
    next24: 'આગામી 24 કલાકમાં',
  },

  kn: {
    currentIntro: (p) => `${p} ಪ್ರದೇಶದ ಪ್ರಸ್ತುತ ಹವಾಮಾನ ಮಾಹಿತಿ:`,
    forecastIntro: (p, n) => `${p} ಪ್ರದೇಶಕ್ಕೆ ${n} ದಿನಗಳ ಮುನ್ಸೂಚನೆ:`,
    alertsIntro: (p, n) => `${p} ಪ್ರದೇಶಕ್ಕೆ ${n} ಸಕ್ರಿಯ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳಿವೆ. ಸಲಹೆಯನ್ನು ಗಮನವಿಟ್ಟು ಓದಿ:`,
    alertsNone: (p) => `${p} ಪ್ರದೇಶಕ್ಕೆ ಸದ್ಯಕ್ಕೆ ಯಾವುದೇ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ ಇಲ್ಲ.`,
    aqiIntro: (p) => `${p} ಪ್ರದೇಶದ ಪ್ರಸ್ತುತ ಗಾಳಿಯ ಗುಣಮಟ್ಟ:`,
    climateIntro: (p, y) => `ಕಳೆದ ${y} ವರ್ಷಗಳಲ್ಲಿ ${p} ಪ್ರದೇಶದ ಹವಾಮಾನ ಪ್ರವೃತ್ತಿ:`,
    rainYes: (p, w, mm) => `ಹೌದು — ${p} ಪ್ರದೇಶದಲ್ಲಿ ${w} ಮಳೆಯ ಸಾಧ್ಯತೆ ಇದೆ, ಸುಮಾರು ${mm} ಮಿ.ಮೀ.`,
    rainNo: (p, w) => `${p} ಪ್ರದೇಶದಲ್ಲಿ ${w} ವಿಶೇಷ ಮಳೆಯ ಸಾಧ್ಯತೆ ಇಲ್ಲ.`,
    greeting: () =>
      'ನಮಸ್ಕಾರ! ನಾನು WeatherGPT. ಯಾವುದೇ ಸ್ಥಳದ ಹವಾಮಾನ, ಮುನ್ಸೂಚನೆ, ಎಚ್ಚರಿಕೆ ಅಥವಾ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಕೇಳಿ — ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ.',
    notFound: (q) => `"${q}" ಎಂಬ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ನಗರ ಅಥವಾ ಜಿಲ್ಲೆಯ ಹೆಸರು ಪ್ರಯತ್ನಿಸಿ.`,
    tomorrowWord: 'ನಾಳೆ',
    todayWord: 'ಇಂದು',
    next24: 'ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ',
  },

  ml: {
    currentIntro: (p) => `${p} പ്രദേശത്തെ നിലവിലെ കാലാവസ്ഥ:`,
    forecastIntro: (p, n) => `${p} പ്രദേശത്തിന് ${n} ദിവസത്തെ പ്രവചനം:`,
    alertsIntro: (p, n) => `${p} പ്രദേശത്തിന് ${n} കാലാവസ്ഥാ മുന്നറിയിപ്പുകൾ ഉണ്ട്. നിർദ്ദേശം ശ്രദ്ധയോടെ വായിക്കുക:`,
    alertsNone: (p) => `${p} പ്രദേശത്തിന് ഇപ്പോൾ കാലാവസ്ഥാ മുന്നറിയിപ്പുകൾ ഇല്ല.`,
    aqiIntro: (p) => `${p} പ്രദേശത്തെ നിലവിലെ വായു ഗുണനിലവാരം:`,
    climateIntro: (p, y) => `കഴിഞ്ഞ ${y} വർഷത്തെ ${p} പ്രദേശത്തെ കാലാവസ്ഥാ പ്രവണത:`,
    rainYes: (p, w, mm) => `അതെ — ${p} പ്രദേശത്ത് ${w} മഴയ്ക്ക് സാധ്യതയുണ്ട്, ഏകദേശം ${mm} മി.മീ.`,
    rainNo: (p, w) => `${p} പ്രദേശത്ത് ${w} കാര്യമായ മഴയ്ക്ക് സാധ്യതയില്ല.`,
    greeting: () =>
      'നമസ്കാരം! ഞാൻ WeatherGPT. ഏത് സ്ഥലത്തിന്റെയും കാലാവസ്ഥ, പ്രവചനം, മുന്നറിയിപ്പ് അല്ലെങ്കിൽ വായു ഗുണനിലവാരം നിങ്ങളുടെ ഭാഷയിൽ ചോദിക്കൂ.',
    notFound: (q) => `"${q}" എന്ന സ്ഥലം കണ്ടെത്താനായില്ല. നഗരം അല്ലെങ്കിൽ ജില്ലയുടെ പേര് നൽകുക.`,
    tomorrowWord: 'നാളെ',
    todayWord: 'ഇന്ന്',
    next24: 'അടുത്ത 24 മണിക്കൂറിൽ',
  },

  pa: {
    currentIntro: (p) => `${p} ਦਾ ਮੌਜੂਦਾ ਮੌਸਮ:`,
    forecastIntro: (p, n) => `${p} ਲਈ ${n} ਦਿਨਾਂ ਦਾ ਅਨੁਮਾਨ:`,
    alertsIntro: (p, n) => `${p} ਲਈ ${n} ਸਰਗਰਮ ਮੌਸਮ ਚੇਤਾਵਨੀਆਂ ਹਨ। ਸਲਾਹ ਧਿਆਨ ਨਾਲ ਪੜ੍ਹੋ:`,
    alertsNone: (p) => `${p} ਲਈ ਇਸ ਵੇਲੇ ਕੋਈ ਮੌਸਮ ਚੇਤਾਵਨੀ ਨਹੀਂ ਹੈ।`,
    aqiIntro: (p) => `${p} ਦੀ ਮੌਜੂਦਾ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ:`,
    climateIntro: (p, y) => `ਪਿਛਲੇ ${y} ਸਾਲਾਂ ਵਿੱਚ ${p} ਦਾ ਜਲਵਾਯੂ ਰੁਝਾਨ:`,
    rainYes: (p, w, mm) => `ਹਾਂ — ${p} ਵਿੱਚ ${w} ਬਾਰਿਸ਼ ਦੀ ਸੰਭਾਵਨਾ ਹੈ, ਲਗਭਗ ${mm} ਮਿਮੀ।`,
    rainNo: (p, w) => `${p} ਵਿੱਚ ${w} ਖਾਸ ਬਾਰਿਸ਼ ਦੀ ਸੰਭਾਵਨਾ ਨਹੀਂ ਹੈ।`,
    greeting: () =>
      'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ WeatherGPT ਹਾਂ। ਕਿਸੇ ਵੀ ਥਾਂ ਦਾ ਮੌਸਮ, ਅਨੁਮਾਨ, ਚੇਤਾਵਨੀ ਜਾਂ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਪੁੱਛੋ — ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ।',
    notFound: (q) => `"${q}" ਨਾਂ ਦੀ ਥਾਂ ਨਹੀਂ ਮਿਲੀ। ਸ਼ਹਿਰ ਜਾਂ ਜ਼ਿਲ੍ਹੇ ਦਾ ਨਾਂ ਵਰਤੋ।`,
    tomorrowWord: 'ਕੱਲ੍ਹ',
    todayWord: 'ਅੱਜ',
    next24: 'ਅਗਲੇ 24 ਘੰਟਿਆਂ ਵਿੱਚ',
  },
};
