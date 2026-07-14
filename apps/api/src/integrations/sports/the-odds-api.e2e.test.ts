import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickClv, type SettledPick } from '@overlay/shared';
import {
  gradeFromScores,
  mapEvents,
  mapOdds,
  type OddsApiEvent,
  type OddsApiEventOdds,
  type OddsApiScoreEvent,
} from './the-odds-api.mapper.ts';

/**
 * End-to-end validation over realistic recorded The Odds API payload shapes
 * (OB-045): fixtures → closing-odds snapshot → grade → CLV. Uses the pure
 * mapper + shared CLV so it runs without a live key or network.
 */

const eventPayload: OddsApiEvent = {
  id: 'e5f1c2d3a4b5',
  sport_key: 'soccer_epl',
  sport_title: 'EPL',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  commence_time: '2026-08-15T14:00:00Z',
};

const oddsPayload: OddsApiEventOdds = {
  ...eventPayload,
  bookmakers: [
    {
      key: 'pinnacle',
      markets: [
        {
          key: 'h2h',
          outcomes: [
            { name: 'Arsenal', price: 1.95 },
            { name: 'Chelsea', price: 4.1 },
            { name: 'Draw', price: 3.6 },
          ],
        },
      ],
    },
    {
      key: 'betfair_ex_eu',
      markets: [
        {
          key: 'h2h',
          outcomes: [
            { name: 'Arsenal', price: 2.0 }, // best home (closing)
            { name: 'Chelsea', price: 4.2 }, // best away
            { name: 'Draw', price: 3.7 }, // best draw
          ],
        },
      ],
    },
  ],
};

const scorePayload: OddsApiScoreEvent = {
  id: 'e5f1c2d3a4b5',
  completed: true,
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  scores: [
    { name: 'Arsenal', score: '2' },
    { name: 'Chelsea', score: '1' },
  ],
};

test('recorded fixture: ingest → closing odds → grade → CLV', () => {
  // Ingest maps to our event shape.
  const [event] = mapEvents([eventPayload]);
  assert.equal(event.home, 'Arsenal');
  assert.equal(event.sport, 'soccer_epl');

  // Closing snapshot: best price per selection across books, 3-way → 1X2.
  const [closing] = mapOdds(oddsPayload);
  assert.equal(closing.market, '1X2');
  assert.equal(closing.prices.home, 2.0);
  assert.equal(closing.prices.away, 4.2);
  assert.equal(closing.prices.draw, 3.7);

  // Grade a home pick against the final score.
  const outcome = gradeFromScores(scorePayload, '1X2', 'home');
  assert.equal(outcome, 'won');

  // CLV: a tipster who locked 2.10 beat the 2.00 close → positive CLV.
  const pick: SettledPick = {
    oddsAtPick: 2.1,
    stakeUnits: 1,
    status: 'won',
    closingOdds: closing.prices.home,
  };
  const clv = pickClv(pick);
  assert.ok(clv !== null && clv > 0, `expected positive CLV, got ${clv}`);
});

test('recorded fixture: away pick loses, negative CLV when worse than close', () => {
  const outcome = gradeFromScores(scorePayload, '1X2', 'away');
  assert.equal(outcome, 'lost');

  const pick: SettledPick = {
    oddsAtPick: 4.0, // locked worse than the 4.2 close
    stakeUnits: 1,
    status: 'lost',
    closingOdds: 4.2,
  };
  const clv = pickClv(pick);
  assert.ok(clv !== null && clv < 0, `expected negative CLV, got ${clv}`);
});
