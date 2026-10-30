import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  isoDateToUtc,
  parseIsoDate,
  toIsoDate,
  todayIsoDate,
} from '@overlay/shared';
import type { FreeTip, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type { CreateFreeTipDto } from './dto/create-free-tip.dto';
import type { UpdateFreeTipDto } from './dto/update-free-tip.dto';
import { buildFreeTipsForDate, toPublicFreeTip } from './free-tips';
import { DraftPolicyError, manualTipSchedule, publicFreeTipFilter, requireSanitizedText, sanitizeText } from '../automation/policy';
import type { AuthUser } from '../../common/crypto';

@Injectable()
export class FreeTipsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public per-date listing (OB-150): the ungated free "bets of the day" for a
   * single calendar day, ordered by admin sort then creation time. An unknown
   * or malformed `date` falls back to today so the hub always renders. Days
   * with no tips return an empty list (the UI shows an empty state).
   */
  async listByDate(date?: string) {
    const now = new Date();
    await this.prisma.freeTip.updateMany({
      where: { status: 'pending', OR: [{ kickoffAt: { lte: now } }, { expiresAt: { lte: now } }] },
      data: { status: 'expired' },
    });
    const iso = parseIsoDate(date) ?? todayIsoDate();
    const rows = await this.prisma.freeTip.findMany({
      where: publicFreeTipFilter(isoDateToUtc(iso), now),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return buildFreeTipsForDate(iso, rows);
  }

  /** Distinct calendar days that currently have at least one free tip. */
  async listDates(): Promise<string[]> {
    const rows = await this.prisma.freeTip.findMany({
      where: publicFreeTipFilter(),
      distinct: ['tipDate'],
      select: { tipDate: true },
      orderBy: { tipDate: 'desc' },
    });
    return rows.map((r) => toIsoDate(r.tipDate));
  }

  // ---- admin management ----

  /** Admin list across every day, newest day first. */
  async listAll() {
    const rows = await this.prisma.freeTip.findMany({
      orderBy: [{ tipDate: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toAdminFreeTip(row));
  }

  async create(dto: CreateFreeTipDto, actor: AuthUser) {
    let data: Prisma.FreeTipUncheckedCreateInput;
    try {
      const schedule = manualTipSchedule(dto.kickoffAt, dto.date);
      if (dto.odds !== undefined && (!Number.isFinite(dto.odds) || dto.odds <= 1)) {
        throw new DraftPolicyError('INVALID_ODDS', 'odds must be greater than 1');
      }
      data = {
        status: 'pending' as const,
        origin: 'manual' as const,
        ...schedule,
        sport: requireSanitizedText(dto.sport, 'Sport'),
        league: dto.league ? sanitizeText(dto.league) || null : null,
        match: requireSanitizedText(dto.match, 'Match'),
        market: requireSanitizedText(dto.market, 'Market'),
        selection: requireSanitizedText(dto.selection, 'Selection'),
        odds: dto.odds ?? null,
        analysis: dto.analysis ? sanitizeText(dto.analysis) || null : null,
        sortOrder: dto.sortOrder ?? 0,
        ...(dto.rationale ? { rationale: {
          rationale: requireSanitizedText(dto.rationale.rationale, 'Rationale'),
          counterarguments: dto.rationale.counterarguments.map(sanitizeText),
        } } : {}),
      };
    } catch (error) {
      if (error instanceof DraftPolicyError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const item = await tx.freeTip.create({ data });
      // FreeTip has no creator column; retain attribution in the existing audit provenance.
      await tx.auditLog.create({ data: {
        actor: actor.userId, action: 'free-tip.create', entity: 'FreeTip', entityId: item.id,
        payload: { createdById: actor.userId, origin: 'manual', status: 'pending' },
      } });
      return item;
    });
    return this.toAdminFreeTip(row);
  }

  async update(id: string, _dto: UpdateFreeTipDto) {
    const existing = await this.prisma.freeTip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Free tip not found');
    throw new ConflictException({ code: 'USE_EDITORIAL_QUEUE', message: 'Edit free tips through the Editorial Queue' });
  }

  private toAdminFreeTip(row: FreeTip) {
    return { ...toPublicFreeTip(row), status: row.status, origin: row.origin, kickoffAt: row.kickoffAt, expiresAt: row.expiresAt };
  }

  async remove(id: string) {
    const existing = await this.prisma.freeTip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Free tip not found');
    if (existing.origin !== 'manual') {
      throw new ConflictException({ code: 'USE_EDITORIAL_QUEUE', message: 'Manage automation tips through the Editorial Queue' });
    }
    await this.prisma.freeTip.delete({ where: { id, origin: 'manual' } });
    return { deleted: true };
  }
}
