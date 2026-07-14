import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSports,
  formatSports,
  priceUnitsToCents,
  centsToPriceUnits,
  validateTipsterProfile,
  TIPSTER_PROFILE_LIMITS,
} from './tipster-profile.ts';

test('parseSports trims, drops empties and de-duplicates case-insensitively', () => {
  assert.deepEqual(parseSports('  Soccer , NBA, soccer ,,MLB '), [
    'Soccer',
    'NBA',
    'MLB',
  ]);
});

test('parseSports accepts an array input', () => {
  assert.deepEqual(parseSports(['Tennis', ' Tennis ', '']), ['Tennis']);
});

test('formatSports joins with a comma and space', () => {
  assert.equal(formatSports(['NBA', 'NFL']), 'NBA, NFL');
});

test('priceUnitsToCents converts whole and decimal amounts', () => {
  assert.equal(priceUnitsToCents('9.99'), 999);
  assert.equal(priceUnitsToCents('10'), 1000);
  assert.equal(priceUnitsToCents('0'), 0);
  assert.equal(priceUnitsToCents(' 5.5 '), 550);
});

test('priceUnitsToCents rejects invalid money strings', () => {
  assert.equal(priceUnitsToCents(''), null);
  assert.equal(priceUnitsToCents('abc'), null);
  assert.equal(priceUnitsToCents('-1'), null);
  assert.equal(priceUnitsToCents('1.234'), null);
  assert.equal(priceUnitsToCents('$5'), null);
});

test('centsToPriceUnits formats cents as currency units', () => {
  assert.equal(centsToPriceUnits(999), '9.99');
  assert.equal(centsToPriceUnits(1000), '10.00');
  assert.equal(centsToPriceUnits(0), '0');
});

test('validateTipsterProfile normalizes a valid draft', () => {
  const res = validateTipsterProfile({
    bio: '  Sharp NBA bettor.  ',
    sports: 'NBA, nba, NFL',
    price: '19.99',
  });
  assert.equal(res.valid, true);
  assert.deepEqual(res.payload, {
    bio: 'Sharp NBA bettor.',
    sports: ['NBA', 'NFL'],
    subscriptionPriceCents: 1999,
  });
});

test('validateTipsterProfile allows a free (0) subscription price', () => {
  const res = validateTipsterProfile({ bio: '', sports: '', price: '0' });
  assert.equal(res.valid, true);
  assert.equal(res.payload?.subscriptionPriceCents, 0);
  assert.deepEqual(res.payload?.sports, []);
});

test('validateTipsterProfile rejects an over-long bio', () => {
  const res = validateTipsterProfile({
    bio: 'x'.repeat(TIPSTER_PROFILE_LIMITS.bioMaxLength + 1),
    sports: '',
    price: '0',
  });
  assert.equal(res.valid, false);
  assert.equal(res.payload, undefined);
  assert.ok(res.errors.some((e) => e.includes('Bio')));
});

test('validateTipsterProfile rejects too many sports', () => {
  const sports = Array.from(
    { length: TIPSTER_PROFILE_LIMITS.maxSports + 1 },
    (_, i) => `sport${i}`,
  );
  const res = validateTipsterProfile({ bio: '', sports, price: '0' });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('sports')));
});

test('validateTipsterProfile rejects an invalid price', () => {
  const res = validateTipsterProfile({ bio: '', sports: '', price: 'free' });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.toLowerCase().includes('price')));
});

test('validateTipsterProfile rejects a price above the max', () => {
  const res = validateTipsterProfile({
    bio: '',
    sports: '',
    price: String(TIPSTER_PROFILE_LIMITS.maxPriceUnits + 1),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.toLowerCase().includes('price')));
});
