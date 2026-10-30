import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dedupeSlug, findCompetition, readingTimeMinutes, slugify } from '@overlay/shared';
import { PrismaService } from '../../prisma.service';
import { ARTICLE_LIST_CACHE } from '../../common/cache/cache.module';
import { Inject } from '@nestjs/common';
import type { EntityCache } from '../../common/cache/entity-cache';
import type { ArticleDraftDto, FreeTipDraftDto, FinishRunDto, StartRunDto } from './automation.dto';
import {
  DraftPolicyError,
  automationTipCapWhere,
  assertExpiryBeforeKickoffMargin,
  kickoffApprovalMarginMinutes,
  isWithinDailyCap,
  idempotentResult,
  parseDateOnly,
  sanitizeMarkdown,
  sanitizeText,
  requireSanitizedText,
  validateKickoff,
  validateMarket,
  validateOdds,
  validateSourceCount,
  validateSelection,
} from './policy';

const DEFAULT_DAILY_CAP = 5;
const MAXIMUM_DAILY_CAP = 100;

function positiveInt(value: string | undefined, fallback: number, allowZero = false): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= (allowZero ? 0 : 1) ? number : fallback;
}

function mappedPolicyError(error: DraftPolicyError): BadRequestException {
  return new BadRequestException({ code: error.code, message: error.message });
}

function cleanSources(sources: NonNullable<ArticleDraftDto['sources']>) {
  try {
    return sources.map((source) => ({
      url: source.url,
      title: requireSanitizedText(source.title, 'Source title').slice(0, 300),
      publisher: requireSanitizedText(source.publisher, 'Source publisher').slice(0, 120),
      retrievedAt: new Date(source.retrievedAt).toISOString(),
      kind: source.kind,
    }));
  } catch (error) {
    if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
    throw error;
  }
}

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARTICLE_LIST_CACHE) private readonly articleCache: EntityCache,
  ) {}

  async createArticleDraft(dto: ArticleDraftDto) {
    const existing = await this.prisma.article.findUnique({ where: { dedupeKey: dto.dedupeKey } });
    const duplicate = idempotentResult(existing);
    if (duplicate) return duplicate;
    try {
      validateSourceCount(dto.sources ?? [], 1);
    } catch (error) {
      if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
      throw error;
    }
    let title: string;
    let body: string;
    let excerpt: string;
    try {
      title = requireSanitizedText(dto.title, 'Article title').slice(0, 160);
      body = requireSanitizedText(dto.body, 'Article body', true).slice(0, 50_000);
      excerpt = dto.excerpt === undefined
        ? body.slice(0, 240)
        : requireSanitizedText(dto.excerpt, 'Article excerpt').slice(0, 300);
    } catch (error) {
      if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
      throw error;
    }
    const baseSlug = slugify(sanitizeText(dto.slug ?? title));
    if (!baseSlug) throw new BadRequestException({ code: 'INVALID_SLUG', message: 'A publishable slug could not be generated' });
    const taken = new Set((await this.prisma.article.findMany({ where: { slug: { startsWith: baseSlug }, locale: 'en' }, select: { slug: true } })).map((row) => row.slug));
    const slug = dedupeSlug(baseSlug, taken);
    if (dto.automationRunId) await this.assertRunExists(dto.automationRunId);
    const data = {
      slug,
      title,
      body,
      excerpt,
      tags: (dto.tags ?? []).map((tag) => sanitizeText(tag).slice(0, 40)).filter(Boolean),
      status: 'pending' as const,
      category: dto.category ?? 'news',
      readingMinutes: readingTimeMinutes(body),
      authorId: null,
      origin: 'automation' as const,
      sources: cleanSources(dto.sources ?? []) as Prisma.InputJsonValue,
      reviewerWarnings: (dto.reviewerWarnings ?? []).map((warning) => sanitizeText(warning).slice(0, 300)).filter(Boolean),
      automationRunId: dto.automationRunId ?? null,
      dedupeKey: dto.dedupeKey,
    };
    try {
      const item = await this.prisma.article.create({ data });
      if (dto.automationRunId) await this.prisma.automationRun.update({ where: { id: dto.automationRunId }, data: { createdCount: { increment: 1 } } });
      await this.articleCache.invalidate();
      return { item, duplicate: false };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.prisma.article.findUnique({ where: { dedupeKey: dto.dedupeKey } });
        if (duplicate) return { item: duplicate, duplicate: true };
        throw new ConflictException({ code: 'DUPLICATE_SLUG', message: 'An article already uses this slug' });
      }
      throw error;
    }
  }

  async createFreeTipDraft(dto: FreeTipDraftDto) {
    const existing = await this.prisma.freeTip.findUnique({ where: { dedupeKey: dto.dedupeKey } });
    const duplicate = idempotentResult(existing);
    if (duplicate) return duplicate;
    try {
      validateSourceCount(dto.sources ?? [], 2);
    } catch (error) {
      if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
      throw error;
    }
    let sport: string;
    let match: string;
    let selection: string;
    let analysis: string;
    try {
      sport = requireSanitizedText(dto.sport, 'Sport');
      match = requireSanitizedText(dto.match, 'Match').slice(0, 160);
      selection = requireSanitizedText(dto.selection, 'Selection').slice(0, 160);
      analysis = requireSanitizedText(dto.analysis, 'Analysis').slice(0, 2000);
    } catch (error) {
      if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
      throw error;
    }
    const configuredCompetition = findCompetition(dto.league);
    const competition = configuredCompetition?.enabled ? configuredCompetition.name : null;
    if (!competition) throw new BadRequestException({ code: 'COMPETITION_DISABLED', message: 'Competition is not enabled for automation ingestion' });
    if (sport.toLowerCase() !== 'soccer' && sport.toLowerCase() !== 'football') {
      throw new BadRequestException({ code: 'UNSUPPORTED_SPORT', message: 'Automated free tips currently support soccer only' });
    }
    if (!validateMarket(dto.market)) throw new BadRequestException({ code: 'UNSUPPORTED_MARKET', message: 'Market must be 1X2, btts, or totals' });
    if (!validateSelection(dto.market, selection, match)) throw new BadRequestException({ code: 'INVALID_SELECTION', message: 'Selection does not match the selected market' });
    if (!validateOdds(dto.odds)) throw new BadRequestException({ code: 'INVALID_ODDS', message: 'Decimal odds must be greater than 1 and at most 1000' });
    const tipDate = parseDateOnly(dto.tipDate);
    if (!tipDate) throw new BadRequestException({ code: 'INVALID_TIP_DATE', message: 'tipDate must be a real YYYY-MM-DD date' });
    let kickoff = new Date(dto.kickoffAt);
    if (!Number.isFinite(kickoff.getTime())) throw new BadRequestException({ code: 'INVALID_KICKOFF', message: 'kickoffAt must be a valid ISO date-time' });
    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new BadRequestException({ code: 'EVENT_NOT_FOUND', message: 'eventId does not identify a known fixture' });
      kickoff = event.startTime;
    }
    const leadMinutes = kickoffApprovalMarginMinutes();
    try {
      validateKickoff(kickoff, new Date(), leadMinutes);
    } catch (error) {
      if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
      throw error;
    }
    if (kickoff.toISOString().slice(0, 10) !== dto.tipDate) throw new BadRequestException({ code: 'TIP_DATE_MISMATCH', message: 'tipDate must match the UTC kickoff date' });
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) throw new BadRequestException({ code: 'TIP_EXPIRED', message: 'expiresAt must be in the future' });
    if (expiresAt) {
      try {
        assertExpiryBeforeKickoffMargin(kickoff, expiresAt, leadMinutes);
      } catch (error) {
        if (error instanceof DraftPolicyError) throw mappedPolicyError(error);
        throw error;
      }
    }
    if (dto.automationRunId) await this.assertRunExists(dto.automationRunId);

    const cap = Math.min(positiveInt(process.env.AUTOMATION_FREE_TIPS_DAILY_CAP, DEFAULT_DAILY_CAP, true), MAXIMUM_DAILY_CAP);

    const itemData = {
      tipDate,
      sport: 'soccer',
      league: competition,
      match,
      market: dto.market,
      selection,
      odds: dto.odds,
      analysis,
      status: 'pending' as const,
      origin: 'automation' as const,
      sources: cleanSources(dto.sources!) as Prisma.InputJsonValue,
      reviewerWarnings: (dto.reviewerWarnings ?? []).map((warning) => sanitizeText(warning).slice(0, 300)).filter(Boolean),
      automationRunId: dto.automationRunId ?? null,
      dedupeKey: dto.dedupeKey,
      eventId: dto.eventId ?? null,
      kickoffAt: kickoff,
      expiresAt,
      oddsProvider: dto.oddsProvider ? sanitizeText(dto.oddsProvider).slice(0, 120) : null,
      oddsRetrievedAt: dto.oddsRetrievedAt ? new Date(dto.oddsRetrievedAt) : null,
      rationale: dto.rationale ? { rationale: sanitizeText(dto.rationale.rationale).slice(0, 4000), counterarguments: dto.rationale.counterarguments.map((text) => sanitizeText(text).slice(0, 1000)) } as Prisma.InputJsonValue : Prisma.JsonNull,
    };
    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const count = await tx.freeTip.count({ where: automationTipCapWhere(tipDate) });
        if (!isWithinDailyCap(count, cap)) throw new ConflictException({ code: 'DAILY_CAP_REACHED', message: `At most ${cap} automated free-tip drafts are allowed per date` });
        return tx.freeTip.create({ data: itemData });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (dto.automationRunId) await this.prisma.automationRun.update({ where: { id: dto.automationRunId }, data: { createdCount: { increment: 1 } } });
      return { item, duplicate: false };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.prisma.freeTip.findUnique({ where: { dedupeKey: dto.dedupeKey } });
        if (duplicate) return { item: duplicate, duplicate: true };
      }
      if (this.isSerializationFailure(error)) throw new ConflictException({ code: 'DAILY_CAP_RACE', message: 'Daily draft cap was reached by a concurrent submission; retry with the same dedupeKey' });
      throw error;
    }
  }

  async startRun(dto: StartRunDto) {
    const existing = dto.externalRunId ? await this.prisma.automationRun.findUnique({ where: { workflowName_externalRunId: { workflowName: dto.workflowName, externalRunId: dto.externalRunId } } }) : null;
    if (existing) return { run: existing, duplicate: true };
    const run = await this.prisma.automationRun.create({ data: { workflowName: sanitizeText(dto.workflowName), externalRunId: dto.externalRunId ?? null, externalRunUrl: dto.externalRunUrl ?? null } });
    return { run, duplicate: false };
  }

  async finishRun(id: string, dto: FinishRunDto) {
    const run = await this.prisma.automationRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException({ code: 'RUN_NOT_FOUND', message: 'Automation run not found' });
    if (run.finishedAt) return { run, duplicate: true };
    const updated = await this.prisma.automationRun.update({ where: { id }, data: { status: dto.status, finishedAt: new Date(), createdCount: dto.createdCount ?? run.createdCount, rejectedCount: dto.rejectedCount ?? run.rejectedCount, errorSummary: dto.errorSummary ? sanitizeText(dto.errorSummary).slice(0, 2000) : null } });
    return { run: updated, duplicate: false };
  }

  private async assertRunExists(id: string) {
    if (!(await this.prisma.automationRun.findUnique({ where: { id }, select: { id: true } }))) {
      throw new BadRequestException({ code: 'RUN_NOT_FOUND', message: 'automationRunId does not identify a known run' });
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isSerializationFailure(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }
}
