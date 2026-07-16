import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newPickDigestEmail,
  receiptEmail,
} from './templates.ts';

test('receiptEmail: renders amount, tipster and optional period', () => {
  const t = receiptEmail({
    tipsterName: 'Ada',
    amountCents: 1999,
    periodEnd: new Date('2026-01-31T00:00:00Z'),
  });
  assert.match(t.subject, /receipt/i);
  assert.ok(t.body.includes('Ada'));
  assert.ok(t.body.includes('19.99 USD'));
  assert.ok(t.body.includes('2026-01-31'));
});

test('receiptEmail: omits period line when periodEnd is absent', () => {
  const t = receiptEmail({ tipsterName: 'Ada', amountCents: 500 });
  assert.ok(t.body.includes('5.00 USD'));
  assert.ok(!t.body.includes('active until'));
});

test('newPickDigestEmail: encodes market, selection and odds', () => {
  const t = newPickDigestEmail({
    market: 'Match Odds',
    selection: 'Home',
    oddsAtPick: 2.1,
  });
  assert.equal(t.subject, 'New pick posted');
  assert.equal(t.body, 'Match Odds: Home @ 2.1');
});
