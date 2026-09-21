import { UI } from './ui.js';
import { TEMPLATES } from './templates.js';
import { DEFAULT_LANG, LANGUAGES, getLanguage } from './languages.js';

export { LANGUAGES, DEFAULT_LANG, getLanguage };

/**
 * Resolve a UI label. Falls back to English, then to the key itself, so a
 * missing translation can never render as `undefined`.
 */
export function t(key, lang = DEFAULT_LANG) {
  const table = UI[lang];
  if (table && table[key] != null) return table[key];
  const en = UI[DEFAULT_LANG];
  return en[key] ?? key;
}

/**
 * Resolve a response template function and apply it.
 * `tpl('currentIntro', 'hi', 'Kolkata')`
 */
export function tpl(key, lang, ...args) {
  const table = TEMPLATES[lang];
  const fn = table?.[key] ?? TEMPLATES[DEFAULT_LANG][key];
  if (typeof fn === 'function') return fn(...args);
  return fn ?? '';
}

/** Raw (non-function) template word, e.g. `word('tomorrowWord', 'hi')`. */
export function word(key, lang) {
  const table = TEMPLATES[lang];
  return table?.[key] ?? TEMPLATES[DEFAULT_LANG][key] ?? '';
}

/** Percentage of UI keys translated — surfaced in the settings panel. */
export function coverage(lang) {
  const total = Object.keys(UI[DEFAULT_LANG]).length;
  const done = Object.keys(UI[lang] ?? {}).length;
  return Math.round((done / total) * 100);
}
