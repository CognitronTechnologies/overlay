import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidProviderEvent, parseIngestSports } from './ingestion.ts';
import type { ProviderEvent } from '../../integrations/sports/sports-provider.interface.ts';

function event(over: Partial<ProviderEvent> = {}): ProviderEvent {
  return {
    vendorEventId: 'soccer_epl:evt1',
    sport: 'soccer_epl',
    league: 'EPL',
    home: 'Arsenal',
    away: 'Chelsea',
    startTime: new Date('2030-01-01T12:00:00Z'),
    ...over,
  };
}

test('parseIngestSports: splits, trims, dedupes, drops empties', () => {
  assert.deepEqual(
    parseIngestSports('soccer_epl, basketball_nba , soccer_epl,,'),
    ['soccer_epl', 'basketball_nba'],
  );
  assert.deepEqual(parseIngestSports(''), []);
  assert.deepEqual(parseIngestSports(undefined), []);
  assert.deepEqual(parseIngestSports('   '), []);
});

test('isValidProviderEvent: accepts a well-formed event', () => {
  assert.equal(isValidProviderEvent(event()), true);
});

test('isValidProviderEvent: rejects missing ids / blank teams', () => {
  assert.equal(isValidProviderEvent(event({ vendorEventId: '' })), false);
  assert.equal(isValidProviderEvent(event({ home: '  ' })), false);
  assert.equal(isValidProviderEvent(event({ away: '' })), false);
  assert.equal(isValidProviderEvent(event({ sport: '' })), false);
});

test('isValidProviderEvent: rejects an invalid start time', () => {
  assert.equal(
    isValidProviderEvent(event({ startTime: new Date('not-a-date') })),
    false,
  );
});
