import { SUPPORTED_COMPETITIONS } from '../../packages/shared/src/competitions.ts';

export const ENABLED_COMPETITIONS = SUPPORTED_COMPETITIONS.filter((item) => item.enabled);
export const MARKETS = new Set(['1X2', 'btts', 'totals']);
export const MAX_EVIDENCE_BYTES = 256 * 1024;
export const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
export const MAX_DRAFT_OUTPUT_BYTES = 96 * 1024;
export const MIN_KICKOFF_LEAD_MINUTES = 60;

export function kickoffApprovalMarginMinutes(env = process.env) {
  const minutes = Number(env.AUTOMATION_MIN_KICKOFF_LEAD_MINUTES);
  return Number.isInteger(minutes) && minutes > 0 ? minutes : MIN_KICKOFF_LEAD_MINUTES;
}
export const MAX_TIP_LEAD_HOURS = 36;
export const MIN_TIP_LEAD_HOURS = 2;
export const TIP_DAILY_MAX = 5;
export const ARTICLE_DAILY_MAX = 5;
export const BANNED_PHRASES = [
  /\bguaranteed?\b/i, /\bsure\s+win\b/i, /\block\b/i, /\bbanker\b/i,
  /\brisk[- ]free\b/i, /\can't\s+lose\b/i, /\bcannot\s+lose\b/i,
  /\beasy\s+money\b/i, /\brecover\s+losses\b/i, /\bvalue\s+bet\b/i,
  /\bexpected\s+value\b/i, /\bwin\s+probabilit(?:y|ies)\b/i,
  /\bconfidence\s+(?:score|percentage|percent)\b/i, /\bfair\s+odds\b/i,
  /\bexpected\s+return\b/i, /\bprobabilit(?:y|ies)\b/i, /\bconfidence\b/i,
  /\b(?:profit|profitable|roi)\b/i, /\bstaking\s+(?:size|plan|advice)\b/i,
];

export function selectCompetitions(input = '') {
  const enabled = new Map(ENABLED_COMPETITIONS.map((item) => [item.key, item]));
  const names = new Map(ENABLED_COMPETITIONS.map((item) => [item.name.toLocaleLowerCase(), item]));
  if (!input.trim()) return [...ENABLED_COMPETITIONS];
  const requested = input.split(',').map((part) => part.trim()).filter(Boolean);
  if (!requested.length || requested.length > ENABLED_COMPETITIONS.length) throw new Error('Invalid competitions override');
  const selected = [];
  for (const value of requested) {
    const item = enabled.get(value.toLocaleLowerCase()) ?? names.get(value.toLocaleLowerCase());
    if (!item) throw new Error(`Competition is not enabled for automation: ${value}`);
    if (!selected.some((existing) => existing.key === item.key)) selected.push(item);
  }
  return selected;
}

export function normalizeName(value = '') {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function canonicalUrl(value) {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value);
}

export function isUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export function enforceSize(value, limit, label) {
  const bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > limit) throw new Error(`${label} exceeds ${limit} bytes (${bytes})`);
  return bytes;
}
