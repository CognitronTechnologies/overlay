import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SPORTS_PROVIDER } from '../../integrations/sports/sports.module';
import type {
  MarketOdds,
  ProviderMarketInfo,
  ProviderSport,
  SportsDataProvider,
} from '../../integrations/sports/sports-provider.interface';
import { isValidProviderEvent, parseIngestSports } from './ingestion';
import {
  normalizeEventQuery,
  resolveSportKeysForGroup,
  sportGroupIndex,
  toEventSummary,
  type EventSummary,
  type RawEventQuery,
} from './events.query';

@Injectable()
export class EventsService {
  private readonly log = new Logger(EventsService.name);
  /** In-process odds cache to limit vendor credit spend (OB-045). */
  private static readonly CACHE_TTL_MS = 60_000;
  private readonly oddsCache = new Map<string, { odds: MarketOdds[]; at: number }>();
  private readonly inventoryCache = new Map<string, { markets: ProviderMarketInfo[]; at: number }>();
  private sportsCache: { sports: ProviderSport[]; at: number } | null = null;
  private static readonly SPORTS_CACHE_TTL_MS = 15 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SPORTS_PROVIDER) private readonly provider: SportsDataProvider,
  ) {}

  /**
   * Pull upcoming fixtures from the active provider and upsert them by
   * vendorEventId. Called by the ingest-events worker or an admin endpoint.
   * Malformed vendor rows (missing ids/teams/start time) are skipped so a
   * partial upstream response can't corrupt the fixtures table.
   */
  async ingest(sport: string): Promise<number> {
    const events = await this.provider.getUpcomingEvents(sport);
    const valid = events.filter(isValidProviderEvent);
    const skipped = events.length - valid.length;
    if (skipped > 0) {
      this.log.warn(`Ingest ${sport}: skipped ${skipped} invalid event(s)`);
    }
    for (const e of valid) {
      await this.prisma.event.upsert({
        where: { vendorEventId: e.vendorEventId },
        create: {
          vendorEventId: e.vendorEventId,
          sport: e.sport,
          league: e.league,
          home: e.home,
          away: e.away,
          startTime: e.startTime,
        },
        update: { startTime: e.startTime, status: 'scheduled' },
      });
    }
    return valid.length;
  }

  /**
   * Ingest every sport configured via INGEST_SPORTS (comma-separated vendor
   * sport keys). Per-sport failures are isolated so one bad vendor call doesn't
   * abort the rest. Returns a per-sport summary for logging/observability.
   */
  async ingestConfigured(): Promise<
    { sport: string; ingested?: number; error?: string }[]
  > {
    const sports = parseIngestSports(process.env.INGEST_SPORTS);
    const results: { sport: string; ingested?: number; error?: string }[] = [];
    for (const sport of sports) {
      try {
        const ingested = await this.ingest(sport);
        results.push({ sport, ingested });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.log.error(`Ingest ${sport} failed: ${error}`);
        results.push({ sport, error });
      }
    }
    return results;
  }

  /** Upcoming events available for tipsters to pick, with optional filters. */
  listUpcoming(
    opts: { sport?: string; league?: string; q?: string; limit?: number } = {},
  ) {
    const where: Prisma.EventWhereInput = {
      startTime: { gt: new Date() },
      status: 'scheduled',
    };
    if (opts.sport) where.sport = opts.sport;
    if (opts.league) where.league = opts.league;
    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { home: { contains: q, mode: 'insensitive' } },
        { away: { contains: q, mode: 'insensitive' } },
        { league: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: Math.min(opts.limit ?? 100, 200),
    });
  }

  /** Distinct sports + leagues across upcoming events, for the pick filters. */
  async filters(): Promise<{ sports: string[]; leagues: Record<string, string[]> }> {
    const rows = await this.prisma.event.findMany({
      where: { startTime: { gt: new Date() }, status: 'scheduled' },
      select: { sport: true, league: true },
    });
    const sports = [...new Set(rows.map((r) => r.sport))].sort();
    const leagues: Record<string, string[]> = {};
    for (const r of rows) {
      if (!r.league) continue;
      (leagues[r.sport] ??= []).push(r.league);
    }
    for (const s of Object.keys(leagues)) {
      leagues[s] = [...new Set(leagues[s])].sort();
    }
    return { sports, leagues };
  }

  /**
   * Live markets/odds for one event (OB-045), for the odds-driven pick form.
   * Cached in-process for CACHE_TTL to avoid burning vendor credits on repeated
   * lookups while a tipster browses.
   */
  async getEventOdds(eventId: string): Promise<MarketOdds[]> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const cached = this.oddsCache.get(eventId);
    if (cached && Date.now() - cached.at < EventsService.CACHE_TTL_MS) {
      return cached.odds;
    }
    const odds = await this.provider.getOdds(event.vendorEventId);
    this.oddsCache.set(eventId, { odds, at: Date.now() });
    return odds;
  }

  async providerSports(): Promise<ProviderSport[]> {
    if (this.sportsCache && Date.now() - this.sportsCache.at < EventsService.SPORTS_CACHE_TTL_MS) return this.sportsCache.sports;
    const sports = this.provider.getSports ? await this.provider.getSports() : [];
    this.sportsCache = { sports, at: Date.now() };
    return sports;
  }

  /**
   * Bettor-facing event discovery (Phase 3). DB-only (no vendor calls, so it is
   * quota-free and paginatable) with generic multi-sport filtering: a `group`
   * filter is resolved to concrete sport keys via the cached provider catalog,
   * so it becomes an indexed `sport IN (...)` predicate. Odds/bookmaker
   * comparison is deliberately NOT here — it is an on-demand, per-event detail
   * call ({@link getEventDetail}) to keep vendor credit spend bounded.
   */
  async listEvents(
    raw: RawEventQuery,
  ): Promise<{ events: EventSummary[]; total: number; limit: number; offset: number }> {
    const q = normalizeEventQuery(raw);
    const now = Date.now();
    const nowDate = new Date(now);

    const where: Prisma.EventWhereInput = {};

    // Lifecycle status → persisted predicates.
    if (q.status === 'upcoming') {
      where.status = 'scheduled';
      where.startTime = { gt: nowDate };
    } else if (q.status === 'live') {
      where.status = { not: 'finished' };
      where.startTime = { lte: nowDate };
    } else if (q.status === 'completed') {
      where.status = 'finished';
    }

    // Commence-time window (merged with any status-derived startTime bound).
    if (q.startFrom || q.startTo) {
      where.startTime = {
        ...(typeof where.startTime === 'object' ? where.startTime : {}),
        ...(q.startFrom ? { gte: q.startFrom } : {}),
        ...(q.startTo ? { lte: q.startTo } : {}),
      };
    }

    // Sport / group. `group` wins and expands to its sport keys via the catalog.
    const catalog = await this.providerSports();
    if (q.group) {
      const keys = resolveSportKeysForGroup(q.group, catalog);
      where.sport = { in: keys };
    } else if (q.sport) {
      where.sport = q.sport;
    }
    if (q.league) where.league = q.league;

    if (q.q) {
      where.OR = [
        { home: { contains: q.q, mode: 'insensitive' } },
        { away: { contains: q.q, mode: 'insensitive' } },
        { league: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startTime: q.status === 'completed' ? 'desc' : 'asc' },
        skip: q.offset,
        take: q.limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    const groups = sportGroupIndex(catalog);
    return {
      events: rows.map((r) => toEventSummary(r, now, groups)),
      total,
      limit: q.limit,
      offset: q.offset,
    };
  }

  /**
   * On-demand bettor-facing event detail (Phase 3): the normalized event
   * summary plus its featured markets (best price + per-bookmaker offers),
   * served from the same in-process odds cache as the pick form to bound vendor
   * credit spend. Optional `bookmaker` / `market` narrow the returned offers.
   */
  async getEventDetail(
    id: string,
    opts: { bookmaker?: string; market?: string } = {},
  ): Promise<{ event: EventSummary; markets: MarketOdds[] }> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    const catalog = await this.providerSports();
    const summary = toEventSummary(event, Date.now(), sportGroupIndex(catalog));

    let markets = await this.getEventOdds(id);
    if (opts.market) {
      markets = markets.filter((m) => m.market === opts.market);
    }
    if (opts.bookmaker) {
      const book = opts.bookmaker.toLowerCase();
      markets = markets
        .map((m) => ({
          ...m,
          offers: (m.offers ?? []).filter((o) => o.bookmaker.toLowerCase() === book),
        }))
        .filter((m) => (m.offers?.length ?? 0) > 0);
    }
    return { event: summary, markets };
  }

  /**
   * On-demand market inventory for one event (Phase 3): every market on offer
   * (featured + props + period + alternate), classified so the UI can show
   * props read-only and mark which markets are pickable. Costs one vendor
   * credit, so it is cached in-process like the odds lookup. Returns [] when the
   * provider can't list per-event markets.
   */
  async getEventMarketInventory(id: string): Promise<ProviderMarketInfo[]> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (!this.provider.getMarketInventory) return [];

    const cached = this.inventoryCache.get(id);
    if (cached && Date.now() - cached.at < EventsService.CACHE_TTL_MS) {
      return cached.markets;
    }
    const markets = await this.provider.getMarketInventory(event.vendorEventId);
    this.inventoryCache.set(id, { markets, at: Date.now() });
    return markets;
  }
}
