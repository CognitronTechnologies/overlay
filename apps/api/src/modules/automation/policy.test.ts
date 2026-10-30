import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertEditorialTransitionWon,
  assertExpiryBeforeKickoffMargin,
  assertTipFreshForApproval,
  assertTipDateMatchesKickoff,
  automationAuthOutcome,
  automationTipCapWhere,
  bearerTokenMatches,
  canEditEditorialStatus,
  editorialReviewTransition,
  idempotentResult,
  isWithinDailyCap,
  kickoffApprovalMarginMinutes,
  manualTipSchedule,
  editableArticleVersionWhere,
  editableFreeTipVersionWhere,
  reviewArticleVersionWhere,
  reviewFreeTipVersionWhere,
  parseDateOnly,
  publicFreeTipFilter,
  sanitizeMarkdown,
  sanitizeText,
  tipDateFromKickoff,
  requireSanitizedText,
  validateKickoff,
  validateMarket,
  validateOdds,
  validateSourceCount,
  validateSelection,
  DraftPolicyError,
} from './policy.ts';

const source = { url: 'https://example.test/a', title: 'Evidence', publisher: 'Publisher', retrievedAt: '2026-10-30T00:00:00Z', kind: 'news' as const };

test('automation bearer auth is disabled without a configured token and rejects user tokens', () => {
  assert.equal(bearerTokenMatches('Bearer x', undefined), false);
  assert.equal(bearerTokenMatches(undefined, 'secret'), false);
  assert.equal(bearerTokenMatches('Bearer user-jwt', 'machine-secret'), false);
  assert.equal(bearerTokenMatches('Bearer machine-secret', 'machine-secret'), true);
  assert.equal(bearerTokenMatches('Bearer abc.def.ghi', 'abc.def.ghi'), false);
  assert.equal(automationAuthOutcome('Bearer x', undefined), 'disabled');
  assert.equal(automationAuthOutcome(undefined, 'machine-secret'), 'unauthorized');
  assert.equal(automationAuthOutcome('Bearer machine-secret', 'machine-secret'), 'authorized');
});

test('article/tip source minima are enforced', () => {
  assert.doesNotThrow(() => validateSourceCount([source], 1));
  assert.throws(() => validateSourceCount([], 1), (error: unknown) => error instanceof DraftPolicyError && error.code === 'SOURCES_REQUIRED');
  assert.throws(() => validateSourceCount([source], 2), (error: unknown) => error instanceof DraftPolicyError && error.code === 'SOURCES_REQUIRED');
});

test('automated markets and decimal odds are tightly constrained', () => {
  assert.equal(validateMarket('1X2'), true);
  assert.equal(validateMarket('btts'), true);
  assert.equal(validateMarket('totals'), true);
  assert.equal(validateMarket('correct_score'), false);
  assert.equal(validateSelection('btts', 'yes', 'Arsenal vs Chelsea'), true);
  assert.equal(validateSelection('btts', 'draw', 'Arsenal vs Chelsea'), false);
  assert.equal(validateSelection('totals', 'Over 2.5', 'Arsenal vs Chelsea'), true);
  assert.equal(validateSelection('1X2', 'Arsenal', 'Arsenal vs Chelsea'), true);
  assert.equal(validateOdds(1.01), true);
  assert.equal(validateOdds(1), false);
  assert.equal(validateOdds(Infinity), false);
  assert.equal(validateOdds(1001), false);
});

test('kickoff freshness rejects passed and too-close fixtures', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  assert.doesNotThrow(() => validateKickoff(new Date('2026-10-30T11:00:00Z'), now, 60));
  assert.throws(() => validateKickoff(new Date('2026-10-30T10:59:59Z'), now, 60), (error: unknown) => error instanceof DraftPolicyError && error.code === 'KICKOFF_TOO_CLOSE');
  assert.throws(() => validateKickoff(new Date('2026-10-30T09:00:00Z'), now), (error: unknown) => error instanceof DraftPolicyError && error.code === 'KICKOFF_PASSED');
  assert.throws(() => assertTipFreshForApproval(new Date('2026-10-30T09:00:00Z'), null, now), (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_STALE');
  assert.throws(() => assertTipFreshForApproval(null, new Date('2026-10-30T09:00:00Z'), now), (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_EXPIRED');
});

test('daily cap allows zero and rejects submissions at the cap', () => {
  assert.equal(isWithinDailyCap(0, 0), false);
  assert.equal(isWithinDailyCap(4, 5), true);
  assert.equal(isWithinDailyCap(5, 5), false);
});

test('dedupe returns the already-created item without requesting another insert', () => {
  const existing = { id: 'existing-draft', status: 'pending' };
  assert.deepEqual(idempotentResult(existing), { item: existing, duplicate: true });
  assert.equal(idempotentResult(null), null);
});

test('review status transitions only allow draft/pending to published or rejected', () => {
  assert.equal(canEditEditorialStatus('pending'), true);
  assert.equal(editorialReviewTransition('draft', 'approve'), 'published');
  assert.equal(editorialReviewTransition('pending', 'reject'), 'rejected');
  assert.equal(editorialReviewTransition('published', 'reject'), null);
  assert.equal(editorialReviewTransition('expired', 'approve'), null);
});

test('public free-tip query always filters to published and text sanitation strips HTML', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  const cutoff = [{ kickoffAt: null }, { kickoffAt: { gt: now } }];
  assert.deepEqual(publicFreeTipFilter(new Date('2026-10-30T00:00:00Z'), now), { status: 'published', tipDate: new Date('2026-10-30T00:00:00Z'), OR: cutoff });
  assert.deepEqual(publicFreeTipFilter(undefined, now), { status: 'published', OR: cutoff });
  assert.equal(sanitizeText('<script>alert(1)</script><b>Text</b>'), 'Text');
  assert.equal(sanitizeMarkdown('[click](javascript:alert(1))'), '[click](#)');
});

test('date-only parser rejects impossible dates', () => {
  assert.equal(parseDateOnly('2026-10-30')?.toISOString(), '2026-10-30T00:00:00.000Z');
  assert.equal(parseDateOnly('2026-02-31'), null);
});


test('authentication rejects empty, whitespace-only, and near-match machine credentials', () => {
  const expected = 'machine-secret';
  for (const token of ['', ' ', '\t', '  \t ']) {
    assert.equal(bearerTokenMatches(`Bearer ${token}`, token), false);
  }
  assert.equal(bearerTokenMatches(`Bearer ${expected}x`, expected), false);
  assert.equal(bearerTokenMatches(`Bearer ${expected}`, ` ${expected}`), false);
});

test('markdown sanitization blocks javascript, data, and vbscript links', () => {
  for (const scheme of ['javascript', 'data', 'vbscript']) {
    assert.equal(sanitizeMarkdown(`[click](${scheme}:alert(1))`), '[click](#)');
  }
});

test('freshness boundaries expire exactly at kickoff or expiry time', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  assert.throws(() => assertTipFreshForApproval(now, null, now), (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_STALE');
  assert.throws(() => assertTipFreshForApproval(null, now, now), (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_EXPIRED');
});

test('conditional editorial transition allows one reviewer and conflicts for the concurrent loser', () => {
  let status = 'pending';
  const conditionalUpdate = (next: string) => {
    const count = status === 'pending' ? (status = next, 1) : 0;
    assertEditorialTransitionWon(count);
  };

  assert.doesNotThrow(() => conditionalUpdate('published'));
  assert.throws(
    () => conditionalUpdate('rejected'),
    (error: unknown) => error instanceof DraftPolicyError && error.code === 'EDITORIAL_STATUS_CONFLICT',
  );
  assert.equal(status, 'published');
});

test('expiry validation accepts the configured kickoff margin and rejects later expiry', () => {
  const kickoff = new Date('2026-10-31T12:00:00Z');
  const cutoff = new Date('2026-10-31T11:00:00Z');
  assert.equal(kickoffApprovalMarginMinutes(''), 60);
  assert.equal(kickoffApprovalMarginMinutes('90'), 90);
  assert.doesNotThrow(() => assertExpiryBeforeKickoffMargin(kickoff, cutoff, 60));
  assert.doesNotThrow(() => assertExpiryBeforeKickoffMargin(kickoff, new Date('2026-10-31T10:59:00Z'), 60));
  for (const expiry of [new Date('2026-10-31T11:00:01Z'), kickoff]) {
    assert.throws(
      () => assertExpiryBeforeKickoffMargin(kickoff, expiry, 60),
      (error: unknown) => error instanceof DraftPolicyError && error.code === 'INVALID_EXPIRY',
    );
  }
});

test('approval enforces both expiry time and kickoff approval margin', () => {
  const kickoff = new Date('2026-10-31T12:00:00Z');
  const expiry = new Date('2026-10-31T11:00:00Z');
  assert.doesNotThrow(() => assertTipFreshForApproval(kickoff, expiry, new Date('2026-10-31T10:30:00Z'), 60));
  assert.throws(
    () => assertTipFreshForApproval(kickoff, expiry, expiry, 60),
    (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_EXPIRED',
  );
  assert.throws(
    () => assertTipFreshForApproval(kickoff, null, new Date('2026-10-31T11:00:01Z'), 60),
    (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_STALE',
  );
});

test('required content must remain non-empty after sanitization', () => {
  for (const [field, value] of [
    ['Article title', '  '],
    ['Article body', '<script></script>'],
    ['Match', '<b> </b>'],
    ['Selection', '\t'],
    ['Analysis', '\u0000 '],
    ['Source title', '<i></i>'],
    ['Source publisher', '   '],
  ] as const) {
    assert.throws(
      () => requireSanitizedText(value, field, field === 'Article body'),
      (error: unknown) => error instanceof DraftPolicyError && error.code === 'INVALID_CONTENT',
      `${field} should be rejected when sanitation empties it`,
    );
  }
  assert.equal(requireSanitizedText('  Verified source  ', 'Source title'), 'Verified source');
});


test('daily cap counts every automation-origin tip for the date, including rejected items', () => {
  const tipDate = new Date('2026-10-30T00:00:00.000Z');
  assert.deepEqual(automationTipCapWhere(tipDate), { tipDate, origin: 'automation' });
  assert.equal('status' in automationTipCapWhere(tipDate), false);
});

test('kickoff edits recompute UTC tipDate and approval rejects a mismatched tipDate', () => {
  const kickoff = new Date('2026-11-01T00:30:00+02:00');
  const tipDate = tipDateFromKickoff(kickoff);
  assert.equal(tipDate.toISOString(), '2026-10-31T00:00:00.000Z');
  assert.doesNotThrow(() => assertTipDateMatchesKickoff(tipDate, kickoff));
  assert.throws(
    () => assertTipDateMatchesKickoff(new Date('2026-11-01T00:00:00Z'), kickoff),
    (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_DATE_MISMATCH',
  );
});

test('editorial edits and reviews include the read version in conditional updates', () => {
  const updatedAt = new Date('2026-10-30T10:00:00Z');
  const editableWhere = { id: 'item-1', status: { in: ['draft', 'pending'] }, updatedAt };
  const reviewWhere = { id: 'item-1', status: 'pending', updatedAt };
  assert.deepEqual(editableArticleVersionWhere('item-1', updatedAt), editableWhere);
  assert.deepEqual(editableFreeTipVersionWhere('item-1', updatedAt), editableWhere);
  assert.deepEqual(reviewArticleVersionWhere('item-1', 'pending', updatedAt), reviewWhere);
  assert.deepEqual(reviewFreeTipVersionWhere('item-1', 'pending', updatedAt), reviewWhere);
});


test('manual kickoff schedule uses the automation approval margin and derives the UTC day', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  const schedule = manualTipSchedule('2026-10-31T00:30:00+03:00', '2026-10-30', now, 60);
  assert.equal(schedule.tipDate.toISOString(), '2026-10-30T00:00:00.000Z');
  assert.equal(schedule.kickoffAt.toISOString(), '2026-10-30T21:30:00.000Z');
  assert.equal(schedule.expiresAt.toISOString(), '2026-10-30T20:30:00.000Z');
  assert.doesNotThrow(() => manualTipSchedule('2026-10-30T11:00:00Z', undefined, now, 60));
  assert.equal(manualTipSchedule('2026-10-30T12:00:00Z', undefined, now, 90).expiresAt.toISOString(), '2026-10-30T10:30:00.000Z');
});

test('manual kickoff validation rejects malformed, passed, too-close and mismatched date values', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  for (const kickoff of ['2026-10-30T09:00:00Z', now.toISOString(), '2026-10-30T10:59:59.999Z']) {
    assert.throws(() => manualTipSchedule(kickoff, undefined, now, 60), (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_KICKOFF_TOO_SOON');
  }
  for (const kickoff of ['', 'bad', '2026-10-31']) {
    assert.throws(() => manualTipSchedule(kickoff, undefined, now, 60), (error: unknown) => error instanceof DraftPolicyError && error.code === 'INVALID_KICKOFF');
  }
  assert.throws(() => manualTipSchedule('2026-10-31T00:30:00+03:00', '2026-10-31', now, 60), (error: unknown) => error instanceof DraftPolicyError && error.code === 'TIP_DATE_MISMATCH');
});
