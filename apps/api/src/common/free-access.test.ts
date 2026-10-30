import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPaymentsEnabled,
  assertPayoutsEnabled,
  isFreeAccessMode,
} from './free-access.ts';

const responseCode = (error: unknown) =>
  (error as { getResponse(): { code: string } }).getResponse().code;

test('free access mode is opt-in and recognizes only the literal true value', () => {
  assert.equal(isFreeAccessMode({}), false);
  assert.equal(isFreeAccessMode({ FREE_ACCESS_MODE: 'false' }), false);
  assert.equal(isFreeAccessMode({ FREE_ACCESS_MODE: 'true' }), true);
});

test('checkout is permitted when free access is off and blocked with a stable code when on', () => {
  assert.doesNotThrow(() => assertPaymentsEnabled({ FREE_ACCESS_MODE: 'false' }));
  assert.throws(
    () => assertPaymentsEnabled({ FREE_ACCESS_MODE: 'true' }),
    (error) => responseCode(error) === 'PAYMENTS_DISABLED',
  );
});

test('payout operations are permitted when free access is off and blocked when on', () => {
  assert.doesNotThrow(() => assertPayoutsEnabled({ FREE_ACCESS_MODE: 'false' }));
  assert.throws(
    () => assertPayoutsEnabled({ FREE_ACCESS_MODE: 'true' }),
    (error) => responseCode(error) === 'PAYOUTS_DISABLED',
  );
});
