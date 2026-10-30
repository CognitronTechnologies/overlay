import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readingTimeMinutes } from '@overlay/shared';
import { PrismaService } from '../../prisma.service';
import type { AuthUser } from '../../common/crypto';
import { ARTICLE_LIST_CACHE } from '../../common/cache/cache.module';
import { Inject } from '@nestjs/common';
import type { EntityCache } from '../../common/cache/entity-cache';
import { EDITORIAL_STATUSES, EDITORIAL_TYPES, type EditorialType, type EditorialEditDto } from './editorial.dto';
import {
  assertEditorialTransitionWon,
  assertExpiryBeforeKickoffMargin,
  assertTipDateMatchesKickoff,
  assertTipFreshForApproval,
  editableArticleVersionWhere,
  editableFreeTipVersionWhere,
  canEditEditorialStatus,
  DraftPolicyError,
  requireSanitizedText,
  sanitizeMarkdown,
  sanitizeText,
  reviewArticleVersionWhere,
  reviewFreeTipVersionWhere,
  tipDateFromKickoff,
  kickoffApprovalMarginMinutes,
} from './policy';

function assertTransitionWon(count: number): void {
  try {
    assertEditorialTransitionWon(count);
  } catch (error) {
    if (error instanceof DraftPolicyError) {
      throw new ConflictException({ code: error.code, message: error.message });
    }
    throw error;
  }
}

function requireEditorialText(value: string, field: string, markdown = false): string {
  try {
    return requireSanitizedText(value, field, markdown);
  } catch (error) {
    if (error instanceof DraftPolicyError) {
      throw new BadRequestException({ code: error.code, message: error.message });
    }
    throw error;
  }
}

function assertValidExpiry(kickoff: Date | null, expiresAt: Date | null): void {
  try {
    assertExpiryBeforeKickoffMargin(kickoff, expiresAt);
  } catch (error) {
    if (error instanceof DraftPolicyError) {
      throw new BadRequestException({ code: error.code, message: error.message });
    }
    throw error;
  }
}

function parsePage(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

@Injectable()
export class EditorialService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARTICLE_LIST_CACHE) private readonly articleCache: EntityCache,
  ) {}

  async list(query: { type?: string; status?: string; origin?: string; page?: string; pageSize?: string }) {
    await this.expirePendingTips();
    if (query.type && !(EDITORIAL_TYPES as readonly string[]).includes(query.type)) throw new BadRequestException('type must be article or free-tip');
    if (query.status && !(EDITORIAL_STATUSES as readonly string[]).includes(query.status)) throw new BadRequestException('Unsupported editorial status');
    if (query.origin && !['manual', 'automation'].includes(query.origin)) throw new BadRequestException('origin must be manual or automation');
    const page = parsePage(query.page, 1, 100);
    const pageSize = parsePage(query.pageSize, 25, 100);
    const articleStatus = query.status && query.status !== 'expired' ? query.status as Prisma.EnumArticleStatusFilter['equals'] : undefined;
    const freeTipStatus = query.status && query.status !== 'archived' ? query.status as Prisma.EnumFreeTipStatusFilter['equals'] : undefined;
    const origin = query.origin as Prisma.EnumContentOriginFilter['equals'] | undefined;
    const articleWhere: Prisma.ArticleWhereInput = { ...(articleStatus ? { status: articleStatus } : {}), ...(origin ? { origin } : {}) };
    const freeTipWhere: Prisma.FreeTipWhereInput = { ...(freeTipStatus ? { status: freeTipStatus } : {}), ...(origin ? { origin } : {}) };
    const [articles, tips, articleCount, tipCount] = await Promise.all([
      (!query.type || query.type === 'article') && query.status !== 'expired' ? this.prisma.article.findMany({ where: articleWhere, include: { automationRun: true }, orderBy: { updatedAt: 'desc' }, take: page * pageSize }) : [],
      (!query.type || query.type === 'free-tip') && query.status !== 'archived' ? this.prisma.freeTip.findMany({ where: freeTipWhere, include: { automationRun: true }, orderBy: { updatedAt: 'desc' }, take: page * pageSize }) : [],
      (!query.type || query.type === 'article') && query.status !== 'expired' ? this.prisma.article.count({ where: articleWhere }) : 0,
      (!query.type || query.type === 'free-tip') && query.status !== 'archived' ? this.prisma.freeTip.count({ where: freeTipWhere }) : 0,
    ]);
    const items = [
      ...articles.map((item) => ({ type: 'article' as const, item })),
      ...tips.map((item) => ({ type: 'free-tip' as const, item })),
    ].sort((a, b) => b.item.updatedAt.getTime() - a.item.updatedAt.getTime());
    const total = articleCount + tipCount;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(type: string, id: string) {
    const editorialType = this.requireType(type);
    const item = editorialType === 'article'
      ? await this.prisma.article.findUnique({ where: { id }, include: { automationRun: true } })
      : await this.prisma.freeTip.findUnique({ where: { id }, include: { automationRun: true, event: true } });
    if (!item) throw new NotFoundException('Editorial item not found');
    return { type: editorialType, item };
  }

  async edit(type: string, id: string, dto: EditorialEditDto, actor: AuthUser) {
    const editorialType = this.requireType(type);
    if (editorialType === 'article') {
      const existing = await this.prisma.article.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Editorial item not found');
      this.assertEditable(existing.status);
      if (dto.slug && dto.slug !== existing.slug) {
        const collision = await this.prisma.article.findFirst({ where: { slug: dto.slug, locale: existing.locale, id: { not: id } }, select: { id: true } });
        if (collision) throw new ConflictException('Slug is already in use');
      }
      const title = dto.title !== undefined ? requireEditorialText(dto.title, 'Article title').slice(0, 160) : undefined;
      const body = dto.body !== undefined ? requireEditorialText(dto.body, 'Article body', true).slice(0, 50_000) : undefined;
      const excerpt = dto.excerpt !== undefined ? requireEditorialText(dto.excerpt, 'Article excerpt').slice(0, 300) : undefined;
      const slug = dto.slug !== undefined ? requireEditorialText(dto.slug, 'Article slug').slice(0, 80) : undefined;
      const data: Prisma.ArticleUpdateInput = {
        ...(title !== undefined ? { title } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(body !== undefined ? { body, readingMinutes: readingTimeMinutes(body) } : {}),
        ...(excerpt !== undefined ? { excerpt } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags.map((tag) => sanitizeText(tag).slice(0, 40)) } : {}),
      };
      const result = await this.prisma.$transaction(async (tx) => {
        const update = await tx.article.updateMany({
          where: editableArticleVersionWhere(id, existing.updatedAt),
          data,
        });
        assertTransitionWon(update.count);
        const item = await tx.article.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Editorial item not found');
        await tx.auditLog.create({ data: { actor: actor.userId, action: 'editorial.edit', entity: 'Article', entityId: id, payload: { changedFields: Object.keys(dto) } as Prisma.InputJsonValue } });
        return item;
      });
      await this.articleCache.invalidate();
      return { type: editorialType, item: result };
    }

    const existing = await this.prisma.freeTip.findUnique({ where: { id }, include: { event: true } });
    if (!existing) throw new NotFoundException('Editorial item not found');
    this.assertEditable(existing.status);
    const requestedKickoff = dto.kickoffAt !== undefined ? new Date(dto.kickoffAt) : existing.kickoffAt;
    const effectiveKickoff = existing.event?.startTime ?? requestedKickoff;
    const effectiveExpiry = dto.expiresAt !== undefined ? new Date(dto.expiresAt)
      : existing.origin === 'manual' && dto.kickoffAt !== undefined && effectiveKickoff
        ? new Date(effectiveKickoff.getTime() - kickoffApprovalMarginMinutes() * 60_000) : existing.expiresAt;
    assertValidExpiry(effectiveKickoff, effectiveExpiry);
    const data: Prisma.FreeTipUpdateInput = {
      ...(dto.sport !== undefined ? { sport: requireEditorialText(dto.sport, 'Sport').slice(0, 60) } : {}),
      ...(dto.league !== undefined ? { league: sanitizeText(dto.league).slice(0, 120) || null } : {}),
      ...(dto.match !== undefined ? { match: requireEditorialText(dto.match, 'Match').slice(0, 160) } : {}),
      ...(dto.market !== undefined ? { market: requireEditorialText(dto.market, 'Market').slice(0, 120) } : {}),
      ...(dto.selection !== undefined ? { selection: requireEditorialText(dto.selection, 'Selection').slice(0, 160) } : {}),
      ...(dto.odds !== undefined ? { odds: dto.odds } : {}),
      ...(dto.analysis !== undefined ? { analysis: requireEditorialText(dto.analysis, 'Analysis').slice(0, 2000) } : {}),
      ...(dto.kickoffAt !== undefined ? { kickoffAt: effectiveKickoff, tipDate: tipDateFromKickoff(effectiveKickoff!) } : {}),
      ...(dto.expiresAt !== undefined || (existing.origin === 'manual' && dto.kickoffAt !== undefined) ? { expiresAt: effectiveExpiry } : {}),
      ...(dto.rationale !== undefined ? { rationale: dto.rationale as Prisma.InputJsonValue } : {}),
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const update = await tx.freeTip.updateMany({
        where: editableFreeTipVersionWhere(id, existing.updatedAt),
        data,
      });
      assertTransitionWon(update.count);
      const item = await tx.freeTip.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Editorial item not found');
      await tx.auditLog.create({ data: { actor: actor.userId, action: 'editorial.edit', entity: 'FreeTip', entityId: id, payload: { changedFields: Object.keys(dto) } as Prisma.InputJsonValue } });
      return item;
    });
    return { type: editorialType, item: result };
  }

  async approve(type: string, id: string, actor: AuthUser) {
    const editorialType = this.requireType(type);
    const now = new Date();
    if (editorialType === 'article') {
      const existing = await this.prisma.article.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Editorial item not found');
      this.assertReviewable(existing.status);
      const item = await this.prisma.$transaction(async (tx) => {
        const transition = await tx.article.updateMany({
          where: reviewArticleVersionWhere(id, existing.status, existing.updatedAt),
          data: { status: 'published', publishedAt: existing.publishedAt ?? now, reviewedBy: actor.userId, reviewedAt: now, rejectionReason: null },
        });
        assertTransitionWon(transition.count);
        const published = await tx.article.findUnique({ where: { id } });
        if (!published) throw new NotFoundException('Editorial item not found');
        await tx.auditLog.create({ data: { actor: actor.userId, action: 'editorial.approve', entity: 'Article', entityId: id, payload: { from: existing.status, to: 'published' } } });
        return published;
      });
      await this.articleCache.invalidate();
      return { type: editorialType, item };
    }

    const existing = await this.prisma.freeTip.findUnique({ where: { id }, include: { event: true } });
    if (!existing) throw new NotFoundException('Editorial item not found');
    this.assertReviewable(existing.status);
    const kickoff = existing.event?.startTime ?? existing.kickoffAt;
    try {
      if (kickoff) assertTipDateMatchesKickoff(existing.tipDate, kickoff);
      else throw new DraftPolicyError('TIP_DATE_MISMATCH', 'kickoffAt is required to verify tipDate');
      assertTipFreshForApproval(kickoff, existing.expiresAt, now);
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw new ConflictException({ code: error.code, message: error.message });
      throw error;
    }
    const item = await this.prisma.$transaction(async (tx) => {
      const transition = await tx.freeTip.updateMany({
        where: reviewFreeTipVersionWhere(id, existing.status, existing.updatedAt),
        data: { status: 'published', reviewedBy: actor.userId, reviewedAt: now, rejectionReason: null, kickoffAt: kickoff },
      });
      assertTransitionWon(transition.count);
      const published = await tx.freeTip.findUnique({ where: { id } });
      if (!published) throw new NotFoundException('Editorial item not found');
      const creation = existing.origin === 'manual' ? await tx.auditLog.findFirst({
        where: { entity: 'FreeTip', entityId: id, action: 'free-tip.create' },
        orderBy: { createdAt: 'asc' }, select: { actor: true },
      }) : null;
      await tx.auditLog.create({ data: { actor: actor.userId, action: 'editorial.approve', entity: 'FreeTip', entityId: id,
        payload: { from: existing.status, to: 'published', createdById: creation?.actor ?? null, approvedById: actor.userId },
      } });
      return published;
    });
    return { type: editorialType, item };
  }

  async reject(type: string, id: string, reason: string, actor: AuthUser) {
    const editorialType = this.requireType(type);
    const cleanReason = sanitizeText(reason).slice(0, 1000);
    if (!cleanReason) throw new BadRequestException('Rejection reason is required');
    if (editorialType === 'article') {
      const existing = await this.prisma.article.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Editorial item not found');
      this.assertReviewable(existing.status);
      const item = await this.prisma.$transaction(async (tx) => {
        const transition = await tx.article.updateMany({
          where: reviewArticleVersionWhere(id, existing.status, existing.updatedAt),
          data: { status: 'rejected', reviewedBy: actor.userId, reviewedAt: new Date(), rejectionReason: cleanReason },
        });
        assertTransitionWon(transition.count);
        const rejected = await tx.article.findUnique({ where: { id } });
        if (!rejected) throw new NotFoundException('Editorial item not found');
        await tx.auditLog.create({ data: { actor: actor.userId, action: 'editorial.reject', entity: 'Article', entityId: id, payload: { from: existing.status, to: 'rejected', reason: cleanReason } } });
        return rejected;
      });
      await this.articleCache.invalidate();
      return { type: editorialType, item };
    }
    const existing = await this.prisma.freeTip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Editorial item not found');
    this.assertReviewable(existing.status);
    const item = await this.prisma.$transaction(async (tx) => {
      const transition = await tx.freeTip.updateMany({
        where: reviewFreeTipVersionWhere(id, existing.status, existing.updatedAt),
        data: { status: 'rejected', reviewedBy: actor.userId, reviewedAt: new Date(), rejectionReason: cleanReason },
      });
      assertTransitionWon(transition.count);
      const rejected = await tx.freeTip.findUnique({ where: { id } });
      if (!rejected) throw new NotFoundException('Editorial item not found');
      await tx.auditLog.create({ data: { actor: actor.userId, action: 'editorial.reject', entity: 'FreeTip', entityId: id, payload: { from: existing.status, to: 'rejected', reason: cleanReason } } });
      return rejected;
    });
    return { type: editorialType, item };
  }

  async expirePendingTips() {
    const now = new Date();
    return this.prisma.freeTip.updateMany({ where: { status: 'pending', OR: [{ kickoffAt: { lte: now } }, { expiresAt: { lte: now } }] }, data: { status: 'expired' } });
  }

  private requireType(type: string): EditorialType {
    if (!(EDITORIAL_TYPES as readonly string[]).includes(type)) throw new BadRequestException('type must be article or free-tip');
    return type as EditorialType;
  }

  private assertEditable(status: string) {
    if (!canEditEditorialStatus(status)) throw new ConflictException({ code: 'EDITORIAL_STATUS_CONFLICT', message: 'Only draft or pending items can be edited' });
  }

  private assertReviewable(status: string): asserts status is 'draft' | 'pending' {
    if (!canEditEditorialStatus(status)) throw new ConflictException({ code: 'EDITORIAL_STATUS_CONFLICT', message: 'Only draft or pending items can be reviewed' });
  }
}
