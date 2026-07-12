import { Injectable, Logger } from '@nestjs/common';
import type {
  EventResult,
  MarketOdds,
  ProviderEvent,
  SportsDataProvider,
} from './sports-provider.interface';

/**
 * The Odds API adapter — primary source for pre-match + closing odds.
 * https://the-odds-api.com/  (confirm endpoints/quota against live docs)
 *
 * NOTE: v1 skeleton. Endpoint shapes are sketched from the vendor's v4 API and
 * must be validated during integration. Kept behind SportsDataProvider so the
 * rest of the system is unaffected by vendor specifics.
 */
@Injectable()
export class TheOddsApiProvider implements SportsDataProvider {
  readonly name = 'the-odds-api';
  private readonly log = new Logger(TheOddsApiProvider.name);
  private readonly base = 'https://api.the-odds-api.com/v4';

  private get apiKey(): string {
    const key = process.env.SPORTS_API_KEY;
    if (!key) throw new Error('SPORTS_API_KEY is not set');
    return key;
  }

  async getUpcomingEvents(sport: string): Promise<ProviderEvent[]> {
    const url = `${this.base}/sports/${sport}/events?apiKey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`the-odds-api events ${res.status}`);
    const data = (await res.json()) as Array<{
      id: string;
      sport_key: string;
      sport_title: string;
      home_team: string;
      away_team: string;
      commence_time: string;
    }>;
    return data.map((e) => ({
      vendorEventId: e.id,
      sport: e.sport_key,
      league: e.sport_title,
      home: e.home_team,
      away: e.away_team,
      startTime: new Date(e.commence_time),
    }));
  }

  async getOdds(vendorEventId: string): Promise<MarketOdds[]> {
    // TODO: map /sports/{sport}/odds response (bookmakers[].markets[].outcomes[])
    // into aggregated MarketOdds. Requires the sport key alongside the event id.
    this.log.warn(`getOdds not yet implemented for ${vendorEventId}`);
    return [];
  }

  async getResult(vendorEventId: string): Promise<EventResult | null> {
    // TODO: map /sports/{sport}/scores response into EventResult with grade().
    this.log.warn(`getResult not yet implemented for ${vendorEventId}`);
    return null;
  }
}
