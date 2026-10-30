import { BANNED_PHRASES } from './policy.mjs';
import { isDeepStrictEqual } from 'node:util';

export const COPYEDIT_BANNED_PHRASES = [
  /evidence supplied to us/i,
  /this section is our own reading/i,
  /this draft relies only on/i,
  /should be reviewed by an editor/i,
  /research date\s*\(utc\)/i,
  /sources\s*:\s*[^\n]*$/im,
  /\bevidence bundles?\b/i,
  /\bfeed summaries?\b/i,
  /\bsnippets?\b/i,
  /\bthis draft\b/i,
  /\bAI\b/i,
  /\breviewers?\b/i,
  /\bresearch date\b/i,
  /\bsupplied to us\b/i,
];

export const COPYEDIT_BANNED_HEADINGS = [
  /^\s{0,3}#{1,6}\s*(?:confirmed|reported|what remains unknown|commentary(?:\s+and)?\s+analysis|sources)\s*#*\s*$/im,
];

const URL_PATTERN = /https?:\/\/[^\s)\]]+/gi;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/gi;
const NUMBER_PATTERN = /\b\d{1,4}(?:[-–: ]\d{1,4})+(?:\/\d{1,4})?\b|\b\d+(?:[.,]\d+)?%?\b|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\b/gi;
const WORD_PATTERN = /\p{L}+(?:['\u2019]\p{L}+)?/gu;
const CAPITAL_TOKEN_PATTERN = /(?<![\p{L}\p{N}])\p{Lu}[\p{L}]*(?:['\u2019]\p{L}+)?(?![\p{L}\p{N}])/gu;
const FUNCTION_WORDS = new Set(`a an and are as at be because before but by can could did do does for from
  had has have he her here hers herself him himself his how i if in into is it its itself may might must
  no nor not of on or our ours ourselves shall she should since so some such than that the their theirs
  them themselves then there these they this those through to under until up us was we were what when
  where which while who whom whose why will with without would you your yours yourself yourselves
  aboard about above across after against along alongside amid among around behind below beneath beside
  besides between beyond despite down during except inside like near off onto outside over past per
  round throughout towards upon via within according although both each either enough every few fewer
  less many more most much neither several all another any other none anybody anyone anything
  everybody everyone everything nobody someone somebody something otherwise however meanwhile
  nevertheless nonetheless therefore thus yet whether`.split(/\s+/));
const SENTENCE_OPENERS = new Set(`away early finally further later next nothing once open overall rather
  readers still today additionally consequently conversely currently equally eventually importantly
  indeed instead likewise notably previously recently similarly subsequently ultimately arguably
  apparently certainly clearly potentially reportedly questions answers analysis outlook reaction
  response result results context concerns implications impact summary preview review report reports
  background conclusion conclusions performance performances victory defeat draw progress attention
  focus pressure preparation preparations assessment availability form fitness injuries selection
  opportunity opportunities challenge challenges changes decisions expectations uncertainty`.split(/\s+/));
const ARTICLE_BANNED_PHRASES = BANNED_PHRASES.filter((phrase) => phrase.source !== '\\bconfidence\\b');
const WORDS = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;

function articleText(draft) {
  return [draft?.title, draft?.excerpt, draft?.body].filter((value) => typeof value === 'string').join('\n');
}

function urlSet(text, sources = []) {
  return new Set([...String(text ?? '').matchAll(URL_PATTERN)].map(([url]) => url.replace(/[.,;:]+$/, '')).concat(sources.map((source) => source.url)));
}

function numberSet(text) {
  return new Set(String(text ?? '').match(NUMBER_PATTERN) ?? []);
}

function normalizedWord(token) {
  return token.toLowerCase().replace(/['\u2019]s$/, '');
}

function wordSet(text) {
  return new Set([...String(text ?? '').matchAll(WORD_PATTERN)].map(([word]) => normalizedWord(word)));
}

function capitalizedTokens(text) {
  const tokens = new Set();
  const words = [...String(text ?? '').matchAll(CAPITAL_TOKEN_PATTERN)];
  const isStart = (index) => /(?:^|[.!?]\s+|\n)[\s#>*\d.)\-"\u201c\u2018'(\[]*$/u.test(text.slice(0, index));
  const midSentence = new Set(words.filter((match) => !isStart(match.index)).map(([word]) => normalizedWord(word)));
  for (const match of words) {
    const token = normalizedWord(match[0]);
    if (FUNCTION_WORDS.has(token)) continue;
    if (isStart(match.index) && SENTENCE_OPENERS.has(token) && !midSentence.has(token)) continue;
    // Unknown sentence-initial words remain candidates: silently skipping them would admit new names.
    tokens.add(token);
  }
  return tokens;
}

function evidenceText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return Object.values(value).map(evidenceText).join('\n');
  return '';
}

function quoteSet(text) {
  const quotes = new Set();
  for (const match of text.matchAll(/"([^"\n]+)"|\u201c([^\u201d]+)\u201d|\u2018([^\u2019]+)\u2019|(?:^|[\s(])'([^'\n]+)'(?=$|[\s.,!?;)])/gm)) {
    quotes.add((match[1] ?? match[2] ?? match[3] ?? match[4]).replace(/\s+/g, ' ').trim());
  }
  return quotes;
}

export function factPreservationErrors(before, after, evidence) {
  const errors = [];
  if (!before || typeof before !== 'object' || !after || typeof after !== 'object') return ['Copy edit did not return an article object'];
  const originalFields = Object.keys(before).filter((field) => field !== 'reviewerWarnings').sort();
  const editedFields = Object.keys(after).filter((field) => field !== 'reviewerWarnings').sort();
  if (!isDeepStrictEqual(originalFields, editedFields)) errors.push('Copy edit added or removed an article field');
  if (typeof after.title !== 'string' || after.title.length < 1 || after.title.length > 160) errors.push('Copy edit produced an invalid API headline');
  if (after.excerpt !== undefined && (typeof after.excerpt !== 'string' || after.excerpt.length > 300)) errors.push('Copy edit produced an invalid API excerpt');
  if (typeof after.body !== 'string' || after.body.length < 1 || after.body.length > 50_000) errors.push('Copy edit produced an invalid API body');
  for (const field of ['dedupeKey', 'category', 'tags', 'sources']) {
    if (!isDeepStrictEqual(before[field], after[field])) errors.push(`Copy edit changed ${field}`);
  }
  const priorText = articleText(before);
  const editedText = articleText(after);
  const priorUrls = urlSet(priorText, before.sources ?? []);
  const editedUrls = urlSet(editedText, after.sources ?? []);
  if (priorUrls.size !== editedUrls.size || [...priorUrls].some((url) => !editedUrls.has(url))) errors.push('Copy edit changed the set of URLs');
  const knownNumbers = numberSet(priorText);
  for (const value of numberSet(editedText)) if (!knownNumbers.has(value)) errors.push(`Copy edit introduced a new number, score, or date (${value})`);
  const sourceText = `${priorText}\n${evidenceText(before.tags ?? [])}\n${evidenceText(before.sources ?? [])}\n${evidenceText(evidence)}`;
  const knownNames = wordSet(sourceText);
  for (const token of capitalizedTokens(editedText)) if (!knownNames.has(token)) errors.push(`Copy edit introduced a proper-noun token not found in the draft or evidence (${token})`);
  const knownQuotes = quoteSet(sourceText);
  for (const quote of quoteSet(editedText)) if (!knownQuotes.has(quote)) errors.push(`Copy edit introduced or changed a quote (${quote})`);
  return [...new Set(errors)];
}

export function copyLintArticle(draft) {
  const warnings = [];
  const text = articleText(draft);
  if (typeof draft?.title !== 'string' || draft.title.length < 45 || draft.title.length > 80) warnings.push('headline must be 45–80 characters');
  if (typeof draft?.excerpt !== 'string' || WORDS(draft.excerpt) < 35 || WORDS(draft.excerpt) > 60) warnings.push('excerpt must be 35–60 words');
  if (WORDS(draft?.body) < 350 || WORDS(draft?.body) > 650) warnings.push('body must be 350–650 words');
  const linkedText = text.replace(MARKDOWN_LINK_PATTERN, '');
  URL_PATTERN.lastIndex = 0;
  if (URL_PATTERN.test(linkedText)) warnings.push('raw URLs must be formatted as Markdown links');
  URL_PATTERN.lastIndex = 0;
  const bodyLinks = [...String(draft?.body ?? '').matchAll(MARKDOWN_LINK_PATTERN)];
  for (const source of draft?.sources ?? []) {
    const count = bodyLinks.filter(([, url]) => url === source.url).length;
    if (count !== 1) warnings.push('every source URL must appear exactly once as a Markdown link');
  }
  if (/\bEFL Cup\b/i.test(text)) warnings.push('use Carabao Cup consistently; do not call it EFL Cup in public copy');
  for (const pattern of COPYEDIT_BANNED_PHRASES) if (pattern.test(text)) warnings.push(`contains banned meta language (${pattern})`);
  for (const pattern of COPYEDIT_BANNED_HEADINGS) if (pattern.test(draft?.body ?? '')) warnings.push(`contains a banned audit heading (${pattern})`);
  for (const pattern of ARTICLE_BANNED_PHRASES) if (pattern.test(text)) warnings.push(`contains prohibited betting language (${pattern})`);
  return [...new Set(warnings.map((warning) => `Copy lint: ${warning}`))];
}

function addWarnings(draft, warnings) {
  return { ...draft, reviewerWarnings: [...new Set([...(draft.reviewerWarnings ?? []), ...warnings.map((warning) => warning.slice(0, 300))])].slice(0, 20) };
}

export function prepareCopyEditedDrafts(original, candidate, evidence) {
  if (!Array.isArray(original) || !Array.isArray(candidate)) throw new Error('Copy edit requires arrays of validated and edited drafts');
  if (candidate.length !== original.length) {
    const reason = `Copy edit changed draft count (${original.length} to ${candidate.length})`;
    const lintWarnings = [];
    const drafts = original.map((draft, index) => {
      const warnings = copyLintArticle(draft);
      lintWarnings.push(...warnings.map((warning) => ({ index: index + 1, warning })));
      return addWarnings(draft, [`Copy edit rejected: ${reason}`, ...warnings]);
    });
    return { drafts, rejected: [reason], lintWarnings };
  }
  const rejected = [];
  const lintWarnings = [];
  const drafts = original.map((before, index) => {
    const after = candidate[index];
    const errors = factPreservationErrors(before, after, evidence);
    if (errors.length) {
      const reason = errors.join('; ');
      const warnings = copyLintArticle(before);
      rejected.push({ index: index + 1, reason });
      lintWarnings.push(...warnings.map((warning) => ({ index: index + 1, warning })));
      return addWarnings(before, [`Copy edit rejected: ${reason}`, ...warnings]);
    }
    const warnings = copyLintArticle(after);
    lintWarnings.push(...warnings.map((warning) => ({ index: index + 1, warning })));
    const editedFields = ['title', 'excerpt', 'body', 'slug'].filter((field) => !isDeepStrictEqual(before[field], after[field]));
    const editNote = (after.reviewerWarnings ?? []).find((warning) => typeof warning === 'string' && warning.startsWith('Copy edit:'))?.slice(0, 200)
      ?? (editedFields.length ? `Copy edit: revised ${editedFields.join(', ')}.` : 'Copy edit: no safe style changes identified.');
    return addWarnings({ ...after, reviewerWarnings: before.reviewerWarnings ?? [] }, [editNote, ...warnings]);
  });
  return { drafts, rejected, lintWarnings };
}
