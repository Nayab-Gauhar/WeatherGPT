/**
 * Supported languages.
 *
 * `bcp47` drives Web Speech recognition + synthesis, `script` is used by the
 * NLU language detector, and `digits` lets us localise numerals where the
 * language conventionally uses its own digit set (we keep Latin digits for
 * legibility of temperatures, which is standard practice in IMD bulletins).
 */
export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English', bcp47: 'en-IN', script: 'latin' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', bcp47: 'hi-IN', script: 'devanagari' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', bcp47: 'bn-IN', script: 'bengali' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', bcp47: 'ta-IN', script: 'tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', bcp47: 'te-IN', script: 'telugu' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', bcp47: 'mr-IN', script: 'devanagari' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', bcp47: 'gu-IN', script: 'gujarati' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', bcp47: 'kn-IN', script: 'kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam', bcp47: 'ml-IN', script: 'malayalam' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi', bcp47: 'pa-IN', script: 'gurmukhi' },
];

export const DEFAULT_LANG = 'en';

export const LANG_CODES = LANGUAGES.map((l) => l.code);

const BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code) {
  return BY_CODE[code] ?? BY_CODE[DEFAULT_LANG];
}

/** Unicode ranges used to detect the script a user typed in. */
export const SCRIPT_RANGES = [
  { script: 'devanagari', re: /[\u0900-\u097F]/ },
  { script: 'bengali', re: /[\u0980-\u09FF]/ },
  { script: 'gurmukhi', re: /[\u0A00-\u0A7F]/ },
  { script: 'gujarati', re: /[\u0A80-\u0AFF]/ },
  { script: 'tamil', re: /[\u0B80-\u0BFF]/ },
  { script: 'telugu', re: /[\u0C00-\u0C7F]/ },
  { script: 'kannada', re: /[\u0C80-\u0CFF]/ },
  { script: 'malayalam', re: /[\u0D00-\u0D7F]/ },
];
