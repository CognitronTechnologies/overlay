import type { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isSettleableMarket } from '@overlay/shared';

export function bearerTokenMatches(
  authorization: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken || !authorization) return false;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(match[1])) return false;
  const supplied = createHash('sha256').update(match[1], 'utf8').digest();
  const expected = createHash('sha256').update(expectedToken, 'utf8').digest();
  return timingSafeEqual(supplied, expected);
}

export function automationAuthOutcome(authorization: string | undefined, token: string | undefined): 'disabled' | 'authorized' | 'unauthorized' {
  if (!token) return 'disabled';
  return bearerTokenMatches(authorization, token) ? 'authorized' : 'unauthorized';
}

export const AUTOMATION_TIP_MARKETS = ['1X2', 'btts', 'totals'] as const;
export type AutomationTipMarket = (typeof AUTOMATION_TIP_MARKETS)[number];

export type DraftSource = {
  url: string;
  title: string;
  publisher: string;
  retrievedAt: string;
  kind: 'news' | 'official' | 'match' | 'odds' | 'other';
};

export function validateSourceCount(sources: DraftSource[], minimum: number): void {
  if (!Array.isArray(sources) || sources.length < minimum) {
    throw new DraftPolicyError('SOURCES_REQUIRED', `At least ${minimum} source(s) are required`);
  }
}

export function validateMarket(market: string): market is AutomationTipMarket {
  return (AUTOMATION_TIP_MARKETS as readonly string[]).includes(market) && isSettleableMarket(market);
}

export function validateSelection(market: AutomationTipMarket, selection: string, match: string): boolean {
  const normalized = selection.trim().toLocaleLowerCase();
  if (market === 'btts') return ['yes', 'no'].includes(normalized);
  if (market === 'totals') return /^(over|under)\s+\d+(?:\.\d+)?(?:\s+goals?)?$/.test(normalized);
  if (['home', 'draw', 'away', '1', 'x', '2'].includes(normalized)) return true;
  const teams = match.split(/\s+(?:vs?\.?|v|at|@)\s+/i).map((team) => team.trim().toLocaleLowerCase());
  return teams.length === 2 && teams.includes(normalized);
}

export function validateOdds(odds: number): boolean {
  return Number.isFinite(odds) && odds > 1 && odds <= 1000;
}

export function validateKickoff(
  kickoff: Date,
  now = new Date(),
  minimumLeadMinutes = 60,
): void {
  if (!Number.isFinite(kickoff.getTime())) {
    throw new DraftPolicyError('INVALID_KICKOFF', 'kickoffAt must be a valid ISO date-time');
  }
  if (kickoff.getTime() <= now.getTime()) {
    throw new DraftPolicyError('KICKOFF_PASSED', 'Fixture kickoff has already passed');
  }
  if (kickoff.getTime() - now.getTime() < minimumLeadMinutes * 60_000) {
    throw new DraftPolicyError('KICKOFF_TOO_CLOSE', `Fixture kickoff must be at least ${minimumLeadMinutes} minutes away`);
  }
}

export function isWithinDailyCap(count: number, cap: number): boolean {
  return cap >= 0 && count < cap;
}

export function automationTipCapWhere(tipDate: Date) {
  return { tipDate, origin: 'automation' as const };
}

export function editableArticleVersionWhere(id: string, updatedAt: Date): Prisma.ArticleWhereInput {
  return { id, status: { in: ['draft', 'pending'] }, updatedAt };
}

export function editableFreeTipVersionWhere(id: string, updatedAt: Date): Prisma.FreeTipWhereInput {
  return { id, status: { in: ['draft', 'pending'] }, updatedAt };
}

export function reviewArticleVersionWhere(
  id: string,
  status: string,
  updatedAt: Date,
): Prisma.ArticleWhereInput {
  return { id, status: status as Prisma.ArticleWhereInput['status'], updatedAt };
}

export function reviewFreeTipVersionWhere(
  id: string,
  status: string,
  updatedAt: Date,
): Prisma.FreeTipWhereInput {
  return { id, status: status as Prisma.FreeTipWhereInput['status'], updatedAt };
}

export function sanitizeText(value: string): string {
  return value
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

export function sanitizeMarkdown(value: string): string {
  return sanitizeText(value)
    .replace(/\]\(\s*(?:javascript|data|vbscript):[^)]*(?:\)[^)]*)*\)/gi, '](#)')
    .replace(/\b(?:javascript|data|vbscript)\s*:/gi, '#');
}

export function requireSanitizedText(value: string, field: string, markdown = false): string {
  const sanitized = markdown ? sanitizeMarkdown(value) : sanitizeText(value);
  if (!sanitized) throw new DraftPolicyError('INVALID_CONTENT', `${field} must contain text`);
  return sanitized;
}

export class DraftPolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DraftPolicyError';
  }
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}


export function idempotentResult<T>(existing: T | null | undefined): { item: T; duplicate: true } | null {
  return existing ? { item: existing, duplicate: true } : null;
}

export function canEditEditorialStatus(status: string): boolean {
  return status === 'draft' || status === 'pending';
}

export function editorialReviewTransition(status: string, decision: 'approve' | 'reject'): string | null {
  if (!canEditEditorialStatus(status)) return null;
  return decision === 'approve' ? 'published' : 'rejected';
}

export const DEFAULT_KICKOFF_APPROVAL_MARGIN_MINUTES = 60;

export function kickoffApprovalMarginMinutes(
  value: string | undefined = process.env.AUTOMATION_MIN_KICKOFF_LEAD_MINUTES,
): number {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0
    ? minutes
    : DEFAULT_KICKOFF_APPROVAL_MARGIN_MINUTES;
}

export function assertExpiryBeforeKickoffMargin(
  kickoff: Date | null,
  expiresAt: Date | null,
  marginMinutes = kickoffApprovalMarginMinutes(),
): void {
  if (!kickoff || !expiresAt) return;
  const latestExpiry = kickoff.getTime() - marginMinutes * 60_000;
  if (expiresAt.getTime() > latestExpiry) {
    throw new DraftPolicyError(
      'INVALID_EXPIRY',
      `expiresAt must be at least ${marginMinutes} minutes before kickoffAt`,
    );
  }
}

export function tipDateFromKickoff(kickoff: Date): Date {
  const utcDate = kickoff.toISOString().slice(0, 10);
  return new Date(`${utcDate}T00:00:00.000Z`);
}

export function assertTipDateMatchesKickoff(tipDate: Date, kickoff: Date): void {
  if (tipDate.toISOString().slice(0, 10) !== kickoff.toISOString().slice(0, 10)) {
    throw new DraftPolicyError('TIP_DATE_MISMATCH', 'tipDate must match the UTC kickoff date');
  }
}

export function assertEditorialTransitionWon(updatedCount: number): void {
  if (updatedCount !== 1) {
    throw new DraftPolicyError('EDITORIAL_STATUS_CONFLICT', 'Editorial item was already changed by another review');
  }
}

export function assertTipFreshForApproval(
  kickoff: Date | null,
  expiresAt: Date | null,
  now = new Date(),
  marginMinutes = kickoffApprovalMarginMinutes(),
): void {
  assertExpiryBeforeKickoffMargin(kickoff, expiresAt, marginMinutes);
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    throw new DraftPolicyError('TIP_EXPIRED', 'Tip has expired and cannot be published');
  }
  if (kickoff && now.getTime() > kickoff.getTime() - marginMinutes * 60_000) {
    throw new DraftPolicyError('TIP_STALE', `Tip must be approved at least ${marginMinutes} minutes before kickoff`);
  }
}

export function manualTipSchedule(
  kickoffAt: string,
  date?: string,
  now = new Date(),
  marginMinutes = kickoffApprovalMarginMinutes(),
): { kickoffAt: Date; tipDate: Date; expiresAt: Date } {
  const kickoff = new Date(kickoffAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(kickoffAt) || !Number.isFinite(kickoff.getTime())) {
    throw new DraftPolicyError('INVALID_KICKOFF', 'kickoffAt must be an ISO date-time');
  }
  if (kickoff.getTime() <= now.getTime() || kickoff.getTime() - now.getTime() < marginMinutes * 60_000) {
    throw new DraftPolicyError('TIP_KICKOFF_TOO_SOON', `kickoffAt must be at least ${marginMinutes} minutes in the future`);
  }
  const tipDate = tipDateFromKickoff(kickoff);
  if (date !== undefined && date !== tipDate.toISOString().slice(0, 10)) {
    throw new DraftPolicyError('TIP_DATE_MISMATCH', 'date must match the UTC kickoff date');
  }
  return { kickoffAt: kickoff, tipDate, expiresAt: new Date(kickoff.getTime() - marginMinutes * 60_000) };
}

export function publicFreeTipFilter(date?: Date, now = new Date()): Prisma.FreeTipWhereInput {
  return {
    status: 'published',
    ...(date ? { tipDate: date } : {}),
    OR: [{ kickoffAt: null }, { kickoffAt: { gt: now } }],
  };
}
