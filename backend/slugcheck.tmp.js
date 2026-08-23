// URL slugs. Used for human-readable store links (/store/kigali-coffee) instead
// of exposing raw ObjectIds in the address bar.

const MAX_SLUG_LENGTH = 60;

// Combining marks left behind by NFKD normalization (the accent in "Café" becomes
// "e" + U+0301 once decomposed, and only the mark needs dropping).
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Turns free text into a lowercase, hyphen-separated, URL-safe slug.
 * Accents are folded (Café → cafe) so a slug never needs percent-encoding.
 * Returns '' when the input has no usable characters (e.g. an emoji-only or
 * non-Latin name) — callers decide the fallback.
 */
function slugify(input: string): string {
  return String(input || '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, ''); // slice() can leave a trailing hyphen
}

module.exports={slugify};