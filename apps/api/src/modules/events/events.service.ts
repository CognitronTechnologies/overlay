import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SPORTS_PROVIDER } from '../../integrations/sports/sports.module';
import type {
  MarketOdds,
  SportsDataProvider,
} from '../../integrations/sports/sports-provider.interface';
import { isValidProviderEvent, parseIngestSports } from './ingestion';

@Injectable()
export class EventsService {
  private readonly log = new Logger(EventsService.name);
  /** In-process odds cache to limit vendor credit spend (OB-045). */
  private static readonly CACHE_TTL_MS = 60_000;
  private readonly oddsCache = new Map<string, { odds: MarketOdds[]; at: number }>();

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
  async getEventOdds(eventId: string): Promise<{ market: string; prices: Record<string, number> }[]> {
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
}
