import { Module } from '@nestjs/common';
import { MockSportsDataProvider } from './mock.provider';
import { TheOddsApiProvider } from './the-odds-api.provider';
import { ApiFootballProvider } from './api-football.provider';
import type { SportsDataProvider } from './sports-provider.interface';

/** DI token for the active sports-data provider. */
export const SPORTS_PROVIDER = Symbol('SPORTS_PROVIDER');

@Module({
  providers: [
    MockSportsDataProvider,
    TheOddsApiProvider,
    ApiFootballProvider,
    {
      provide: SPORTS_PROVIDER,
      inject: [MockSportsDataProvider, TheOddsApiProvider, ApiFootballProvider],
      useFactory: (
        mock: MockSportsDataProvider,
        theOdds: TheOddsApiProvider,
        apiFootball: ApiFootballProvider,
      ): SportsDataProvider => {
        switch (process.env.SPORTS_API_PROVIDER) {
          case 'the-odds-api':
            return theOdds;
          case 'api-football':
            return apiFootball;
          default:
            return mock;
        }
      },
    },
  ],
  exports: [SPORTS_PROVIDER],
})
export class SportsModule {}
