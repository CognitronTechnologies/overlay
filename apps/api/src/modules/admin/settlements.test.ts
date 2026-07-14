import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTLEMENTS_LIMIT,
  MAX_SETTLEMENTS_LIMIT,
  MAX_VOID_REASON_LENGTH,
  InvalidVoidReasonError,
  PickAlreadyVoidError,
  PickNotFoundError,
  buildVoidAuditEntry,
  normalizeSettlementsQuery,
  normalizeVoidReason,
  voidPickWorkflow,
  type VoidAuditEntry,
  type VoidablePick,
} from './settlements.ts';

test('normalizeSettlementsQuery: sane defaults for empty input', () => {
  assert.deepEqual(normalizeSettlementsQuery(), {
    status: null,
    take: DEFAULT_SETTLEMENTS_LIMIT,
    skip: 0,
  });
});

test('normalizeSettlementsQuery: parses status/take/skip', () => {
  const q = normalizeSettlementsQuery({ status: 'WON', take: '10', skip: '20' });
  assert.equal(q.status, 'won');
  assert.equal(q.take, 10);
  assert.equal(q.skip, 20);
});

test('normalizeSettlementsQuery: unknown status collapses to null', () => {
  assert.equal(normalizeSettlementsQuery({ status: 'pending' }).status, null);
  assert.equal(normalizeSettlementsQuery({ status: 'nonsense' }).status, null);
});

test('normalizeSettlementsQuery: clamps and falls back on invalid values', () => {
  const q = normalizeSettlementsQuery({ take: '9999', skip: '-5' });
  assert.equal(q.take, MAX_SETTLEMENTS_LIMIT);
  assert.equal(q.skip, 0);

  const bad = normalizeSettlementsQuery({ take: 'x', skip: 'y' });
  assert.equal(bad.take, DEFAULT_SETTLEMENTS_LIMIT);
  assert.equal(bad.skip, 0);
});

test('normalizeVoidReason: trims a valid reason', () => {
  assert.equal(normalizeVoidReason('  wrong result feed  '), 'wrong result feed');
});

test('normalizeVoidReason: rejects empty/blank/non-string', () => {
  assert.throws(() => normalizeVoidReason(''), InvalidVoidReasonError);
  assert.throws(() => normalizeVoidReason('   '), InvalidVoidReasonError);
  assert.throws(() => normalizeVoidReason(undefined), InvalidVoidReasonError);
  assert.throws(() => normalizeVoidReason(42), InvalidVoidReasonError);
});

test('normalizeVoidReason: rejects over-long reason', () => {
  assert.throws(
    () => normalizeVoidReason('x'.repeat(MAX_VOID_REASON_LENGTH + 1)),
    InvalidVoidReasonError,
  );
  assert.equal(
    normalizeVoidReason('x'.repeat(MAX_VOID_REASON_LENGTH)).length,
    MAX_VOID_REASON_LENGTH,
  );
});

test('buildVoidAuditEntry: records actor, reason and previous status', () => {
  const entry = buildVoidAuditEntry({
    actorId: 'admin-1',
    pick: { id: 'pick-1', tipsterId: 'tip-1', status: 'won' },
    reason: 'settled on wrong score',
  });
  assert.deepEqual(entry, {
    actor: 'admin:admin-1',
    action: 'pick.voided',
    entity: 'Pick',
    entityId: 'pick-1',
    payload: { reason: 'settled on wrong score', previousStatus: 'won' },
  });
});

test('voidPickWorkflow: writes audit + recomputes stats', async () => {
  const pick: VoidablePick = {
    id: 'pick-1',
    tipsterId: 'tip-1',
    status: 'won',
  };
  const applied: { pickId: string; audit: VoidAuditEntry }[] = [];
  const recomputed: string[] = [];

  const result = await voidPickWorkflow(
    {
      getPick: async () => pick,
      applyVoid: async (args) => {
        applied.push(args);
      },
      recomputeStats: async (tipsterId) => {
        recomputed.push(tipsterId);
      },
    },
    { actorId: 'admin-1', pickId: 'pick-1', reason: '  bad data feed  ' },
  );

  // Audit written exactly once, with the trimmed reason + previous status.
  assert.equal(applied.length, 1);
  assert.equal(applied[0].pickId, 'pick-1');
  assert.equal(applied[0].audit.action, 'pick.voided');
  assert.equal(applied[0].audit.payload.reason, 'bad data feed');
  assert.equal(applied[0].audit.payload.previousStatus, 'won');
  // Stats recomputed for the affected tipster.
  assert.deepEqual(recomputed, ['tip-1']);
  assert.equal(result.pick.tipsterId, 'tip-1');
});

test('voidPickWorkflow: rejects a missing reason before touching the DB', async () => {
  let touched = false;
  await assert.rejects(
    voidPickWorkflow(
      {
        getPick: async () => {
          touched = true;
          return null;
        },
        applyVoid: async () => {},
        recomputeStats: async () => {},
      },
      { actorId: 'admin-1', pickId: 'pick-1', reason: '   ' },
    ),
    InvalidVoidReasonError,
  );
  assert.equal(touched, false);
});

test('voidPickWorkflow: throws when the pick is missing', async () => {
  await assert.rejects(
    voidPickWorkflow(
      {
        getPick: async () => null,
        applyVoid: async () => {},
        recomputeStats: async () => {},
      },
      { actorId: 'admin-1', pickId: 'nope', reason: 'valid reason' },
    ),
    PickNotFoundError,
  );
});

test('voidPickWorkflow: guards against re-voiding (no audit, no recompute)', async () => {
  let applyCalls = 0;
  let recomputeCalls = 0;
  await assert.rejects(
    voidPickWorkflow(
      {
        getPick: async () => ({
          id: 'pick-1',
          tipsterId: 'tip-1',
          status: 'void',
        }),
        applyVoid: async () => {
          applyCalls += 1;
        },
        recomputeStats: async () => {
          recomputeCalls += 1;
        },
      },
      { actorId: 'admin-1', pickId: 'pick-1', reason: 'valid reason' },
    ),
    PickAlreadyVoidError,
  );
  assert.equal(applyCalls, 0);
  assert.equal(recomputeCalls, 0);
});
