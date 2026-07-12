import { Injectable } from '@nestjs/common';
import type {
  EventResult,
  MarketOdds,
  ProviderEvent,
  SportsDataProvider,
} from './sports-provider.interface';

/**
 * Deterministic in-memory provider for local dev, tests, and running the
 * settlement pipeline end-to-end BEFORE any paid vendor key is provisioned.
 * Swap for a real adapter by changing the SPORTS_API_PROVIDER binding.
 */
@Injectable()
export class MockSportsDataProvider implements SportsDataProvider {
  readonly name = 'mock';

  async getUpcomingEvents(sport: string): Promise<ProviderEvent[]> {
    const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return [
      {
        vendorEventId: 'mock-evt-1',
        sport,
        league: 'Mock League',
        home: 'Home FC',
        away: 'Away FC',
        startTime: inThreeHours,
      },
    ];
  }

  async getOdds(vendorEventId: string): Promise<MarketOdds[]> {
    void vendorEventId;
    return [
      { market: '1X2', prices: { home: 2.1, draw: 3.4, away: 3.6 } },
    ];
  }

  async getResult(vendorEventId: string): Promise<EventResult | null> {
    return {
      vendorEventId,
      raw: { winner: 'home' },
      grade(market, selection) {
        if (market !== '1X2') return 'void';
        return selection === 'home' ? 'won' : 'lost';
      },
    };
  }
}
