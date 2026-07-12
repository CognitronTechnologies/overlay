// Pure content/SEO helpers for the blog/articles feature.
// No dependencies, no Nest — unit-tested with Node's native type stripping.

/**
 * Convert an arbitrary title into a URL-safe slug.
 *  - lowercased, ASCII-folded where trivial, non-alphanumerics collapsed to '-'
 *  - no leading/trailing/duplicate hyphens
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/['"]/g, '') // drop quotes/apostrophes entirely
    .replace(/[^a-z0-9]+/g, '-') // everything else -> hyphen
    .replace(/^-+|-+$/g, '') // trim hyphens
    .slice(0, 80)
    .replace(/-+$/g, ''); // re-trim if slice landed on a hyphen
}

/** Average adult silent reading speed (words per minute). */
const WORDS_PER_MINUTE = 225;

/** Count words in a plaintext/markdown body (markdown syntax stripped-ish). */
export function countWords(body: string): number {
  const text = body
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ') // code spans/blocks
    .replace(/[#>*_~\-]+/g, ' ') // md punctuation
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Estimated reading time in whole minutes (minimum 1 for any content). */
export function readingTimeMinutes(body: string): number {
  const words = countWords(body);
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Build a short plain-text excerpt for meta descriptions / cards.
 * Strips markdown, collapses whitespace, and cuts on a word boundary.
 */
export function excerpt(body: string, maxLen = 160): string {
  const text = body
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[#>*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  const clipped = text.slice(0, maxLen);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : maxLen).trimEnd()}…`;
}

/** Ensure slug uniqueness given a set of taken slugs, appending -2, -3, … */
export function dedupeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
