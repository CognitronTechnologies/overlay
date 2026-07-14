import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRIES,
  countryByCode,
  countryLabel,
  countryName,
  flagEmoji,
} from './countries.ts';

test('flagEmoji: converts an alpha-2 code to regional indicator symbols', () => {
  assert.equal(flagEmoji('GB'), '🇬🇧');
  assert.equal(flagEmoji('us'), '🇺🇸'); // case-insensitive
  assert.equal(flagEmoji('ES'), '🇪🇸');
});

test('flagEmoji: returns empty string for invalid input', () => {
  assert.equal(flagEmoji(''), '');
  assert.equal(flagEmoji(null), '');
  assert.equal(flagEmoji('USA'), '');
  assert.equal(flagEmoji('1A'), '');
});

test('countryByCode: resolves known codes case-insensitively', () => {
  assert.equal(countryByCode('gb')?.name, 'United Kingdom');
  assert.equal(countryByCode('GB')?.dial, '+44');
  assert.equal(countryByCode('ZZ'), undefined);
});

test('countryName: falls back to the raw value when unknown', () => {
  assert.equal(countryName('IE'), 'Ireland');
  assert.equal(countryName('Narnia'), 'Narnia');
  assert.equal(countryName(null), '');
});

test('countryLabel: prefixes the flag when the code is valid', () => {
  assert.equal(countryLabel('GB'), '🇬🇧 United Kingdom');
  assert.equal(countryLabel('Narnia'), 'Narnia');
});

test('COUNTRIES: codes are unique, uppercase alpha-2 with dial codes', () => {
  const seen = new Set<string>();
  for (const c of COUNTRIES) {
    assert.match(c.code, /^[A-Z]{2}$/, `bad code: ${c.code}`);
    assert.ok(!seen.has(c.code), `duplicate code: ${c.code}`);
    seen.add(c.code);
    assert.match(c.dial, /^\+\d{1,4}$/, `bad dial for ${c.code}: ${c.dial}`);
    assert.ok(c.name.length > 0);
  }
});
