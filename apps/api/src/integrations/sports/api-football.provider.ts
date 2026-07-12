import { Injectable, Logger } from '@nestjs/common';
import type {
  EventResult,
  MarketOdds,
  ProviderEvent,
  SportsDataProvider,
} from './sports-provider.interface';

/**
 * API-Football (API-Sports) adapter — primary source for fixtures + results,
 * used for auto-grading settlement across many leagues.
 * https://www.api-football.com/  (confirm endpoints/quota against live docs)
 *
 * NOTE: v1 skeleton. Used as the settlement source; The Odds API scores can be
 * cross-checked against it before public launch (see docs/VENDOR-SPIKE.md).
 */
@Injectable()
export class ApiFootballProvider implements SportsDataProvider {
  readonly name = 'api-football';
  private readonly log = new Logger(ApiFootballProvider.name);

  async getUpcomingEvents(sport: string): Promise<ProviderEvent[]> {
    this.log.warn(`getUpcomingEvents not yet implemented for ${sport}`);
    return [];
  }

  async getOdds(vendorEventId: string): Promise<MarketOdds[]> {
    this.log.warn(`getOdds not yet implemented for ${vendorEventId}`);
    return [];
  }

  async getResult(vendorEventId: string): Promise<EventResult | null> {
    this.log.warn(`getResult not yet implemented for ${vendorEventId}`);
    return null;
  }
}
