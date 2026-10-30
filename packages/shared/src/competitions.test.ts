import assert from 'node:assert/strict';
import test from 'node:test';
import { findCompetition, isEnabledCompetition, SUPPORTED_COMPETITIONS } from './competitions.ts';

test('phase one English competitions enabled and all phase two competitions disabled', () => {
  assert.deepEqual(SUPPORTED_COMPETITIONS.filter((item) => item.phase === 1 && item.enabled).map((item) => item.name), [
    'Premier League', 'Championship', 'League One', 'League Two', 'FA Cup', 'EFL Cup',
  ]);
  assert.equal(SUPPORTED_COMPETITIONS.filter((item) => item.phase === 2 && item.enabled).length, 0);
  assert.equal(isEnabledCompetition('La Liga'), false);
  assert.equal(findCompetition('premier-league')?.name, 'Premier League');
});
