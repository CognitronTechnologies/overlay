import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canDisplayBookmaker,
  canDisplayOffer,
  resolveAffiliateDestination,
  isOfferActive,
} from './affiliate.ts';

const bookmaker = {
  id: 'bookmaker-1',
  destinationUrl: 'https://bookmaker.example',
  trackingParams: 'aff_id=overlay&utm_source=overlay',
  supportedCountries: ['KE', 'UG'],
  isActive: true,
};

const inactiveBookmaker = {
  ...bookmaker,
  isActive: false,
};

const activeOffer = {
  id: 'offer-1',
  destinationUrl: 'https://bookmaker.example/welcome',
  isActive: true,
  startsAt: null,
  endsAt: null,
};

const futureOffer = {
  ...activeOffer,
  startsAt: new Date('2099-01-01'),
};

const expiredOffer = {
  ...activeOffer,
  endsAt: new Date('2020-01-01'),
};

test('active bookmaker is displayed inside supported country', () => {
  assert.equal(
    canDisplayBookmaker(bookmaker, 'KE'),
    true,
  );
});

test('bookmaker is hidden outside supported countries', () => {
  assert.equal(
    canDisplayBookmaker(bookmaker, 'GB'),
    false,
  );
});

test('inactive bookmaker is never displayed', () => {
  assert.equal(
    canDisplayBookmaker(inactiveBookmaker, 'KE'),
    false,
  );
});

test('offer without schedule is active', () => {
  assert.equal(
    isOfferActive(activeOffer),
    true,
  );
});

test('offer with future start date is inactive', () => {
  assert.equal(
    isOfferActive(futureOffer),
    false,
  );
});

test('expired offer is inactive', () => {
  assert.equal(
    isOfferActive(expiredOffer),
    false,
  );
});

test('visible bookmaker + active offer may be displayed', () => {
  assert.equal(
    canDisplayOffer(bookmaker, activeOffer, 'KE'),
    true,
  );
});

test('inactive offer is hidden', () => {
  assert.equal(
    canDisplayOffer(bookmaker, expiredOffer, 'KE'),
    false,
  );
});

test('offer hidden when bookmaker is geo-blocked', () => {
  assert.equal(
    canDisplayOffer(bookmaker, activeOffer, 'GB'),
    false,
  );
});

test('tracking parameters are appended to destination url', () => {
  assert.equal(
    resolveAffiliateDestination(bookmaker),
    'https://bookmaker.example?aff_id=overlay&utm_source=overlay',
  );
});

test('tracking parameters are appended using ampersand when query already exists', () => {
  assert.equal(
    resolveAffiliateDestination({
      ...bookmaker,
      destinationUrl: 'https://bookmaker.example?promo=1',
    }),
    'https://bookmaker.example?promo=1&aff_id=overlay&utm_source=overlay',
  );
});

test('missing tracking parameters returns destination unchanged', () => {
  assert.equal(
    resolveAffiliateDestination({
      ...bookmaker,
      trackingParams: null,
    }),
    'https://bookmaker.example',
  );
});

test('missing destination returns null', () => {
  assert.equal(
    resolveAffiliateDestination({
      ...bookmaker,
      destinationUrl: null,
    }),
    null,
  );
});