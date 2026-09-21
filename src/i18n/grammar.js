/**
 * Grammatical helpers for inserting a place name into a sentence.
 *
 * Indian languages mark case on the noun rather than with a separate word, so
 * naive interpolation produces text a native speaker immediately reads as
 * machine-generated: "কলকাতা-এর আবহাওয়া" instead of "কলকাতার আবহাওয়া".
 *
 * Two strategies are used, chosen per language:
 *
 *  1. Real inflection where the morphology is regular enough to be safe.
 *     Bengali qualifies: the genitive and locative endings depend only on
 *     whether the name ends in a vowel or a consonant.
 *
 *  2. A case-free carrier noun where it is not. Tamil, Malayalam and Kannada
 *     take a following word meaning "area/region" ("சென்னை பகுதியில்"), which is
 *     both idiomatic and invariant, so no name ever gets mangled. Marathi uses
 *     "येथील / येथे" ("of / at that place") the same way.
 *
 * Names that are not in the expected script (e.g. "London" inside a Bengali
 * sentence) fall back to a hyphenated particle, which is the convention Bengali
 * publications themselves use for foreign words.
 */

// Bengali independent vowels and dependent vowel signs.
const BN_VOWEL = /[\u0985-\u0994\u09BE-\u09CC\u09CE]/;
// Bengali consonants, including the additional ড় ঢ় য়.
const BN_CONSONANT = /[\u0995-\u09B9\u09DC-\u09DF\u09F0\u09F1]/;

const lastChar = (s) => [...String(s)].pop() ?? '';

/**
 * Bengali genitive ("of X").
 *   কলকাতা → কলকাতার · হায়দ্রাবাদ → হায়দ্রাবাদের · London → London-এর
 */
export function bnGenitive(place) {
  const ch = lastChar(place);
  if (BN_VOWEL.test(ch)) return `${place}র`;
  if (BN_CONSONANT.test(ch)) return `${place}ের`;
  return `${place}-এর`;
}

/**
 * Bengali locative ("in X").
 *   কলকাতা → কলকাতায় · হায়দ্রাবাদ → হায়দ্রাবাদে · London → London-এ
 */
export function bnLocative(place) {
  const ch = lastChar(place);
  if (BN_VOWEL.test(ch)) return `${place}য়`;
  if (BN_CONSONANT.test(ch)) return `${place}ে`;
  return `${place}-এ`;
}

/**
 * Gujarati attaches its genitive directly to a native name but needs a space
 * after a Latin one.
 */
export function guSuffix(place, suffix) {
  return /[\u0A80-\u0AFF]$/u.test(String(place)) ? `${place}${suffix}` : `${place} ${suffix}`;
}
