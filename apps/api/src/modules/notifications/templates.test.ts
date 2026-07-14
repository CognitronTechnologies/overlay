import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newPickDigestEmail,
  passwordResetEmail,
  receiptEmail,
  verificationEmail,
} from './templates.ts';

test('verificationEmail: subject and body include the verify URL', () => {
  const t = verificationEmail({ verifyUrl: 'https://overlay.bet/verify?t=abc' });
  assert.match(t.subject, /verify/i);
  assert.ok(t.body.includes('https://overlay.bet/verify?t=abc'));
});

test('passwordResetEmail: subject and body include the reset URL', () => {
  const t = passwordResetEmail({ resetUrl: 'https://overlay.bet/reset?t=xyz' });
  assert.match(t.subject, /reset/i);
  assert.ok(t.body.includes('https://overlay.bet/reset?t=xyz'));
});

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
