import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_STEPS,
  REQUIRED_STEPS,
  canPublishPicks,
  computeOnboardingStatus,
  type TipsterOnboardingState,
} from './onboarding.ts';

/** A fully-onboarded, verified tipster; override individual fields per test. */
function state(over: Partial<TipsterOnboardingState> = {}): TipsterOnboardingState {
  return {
    displayName: 'Sharp Sam',
    country: 'GB',
    contactValue: '@sharpsam',
    bio: 'Data-driven soccer sharp.',
    sports: ['soccer'],
    subscriptionPriceCents: 1999,
    stripeOnboarded: true,
    identityVerified: true,
    ...over,
  };
}

test('computeOnboardingStatus: brand-new tipster has no completed steps', () => {
  const status = computeOnboardingStatus({
    displayName: null,
    country: null,
    contactValue: null,
    bio: null,
    sports: [],
    subscriptionPriceCents: 0,
    stripeOnboarded: false,
    identityVerified: false,
  });
  assert.equal(status.completedSteps, 0);
  assert.equal(status.totalSteps, REQUIRED_STEPS.length);
  assert.equal(status.complete, false);
  assert.equal(status.canPublish, false);
  assert.equal(status.verified, false);
  assert.equal(status.nextStep, 'profile');
  assert.ok(status.steps.every((s) => !s.complete));
  // The wizard still surfaces every step, including the optional one.
  assert.equal(status.steps.length, ONBOARDING_STEPS.length);
});

test('computeOnboardingStatus: fully-onboarded tipster can publish and is verified', () => {
  const status = computeOnboardingStatus(state());
  assert.equal(status.completedSteps, REQUIRED_STEPS.length);
  assert.equal(status.complete, true);
  assert.equal(status.canPublish, true);
  assert.equal(status.verified, true);
  assert.equal(status.nextStep, null);
  assert.ok(status.steps.every((s) => s.complete));
});

test('verification is optional: unverified tipster can still publish', () => {
  const status = computeOnboardingStatus(state({ identityVerified: false }));
  assert.equal(status.canPublish, true);
  assert.equal(status.complete, true);
  assert.equal(status.verified, false);
  assert.equal(status.nextStep, null);
  const verificationStep = status.steps.find((s) => s.key === 'verification');
  assert.equal(verificationStep?.optional, true);
  assert.equal(verificationStep?.complete, false);
});

test('computeOnboardingStatus: nextStep points at the first incomplete step in order', () => {
  assert.equal(
    computeOnboardingStatus(state({ displayName: '  ' })).nextStep,
    'profile',
  );
  assert.equal(computeOnboardingStatus(state({ sports: [] })).nextStep, 'sports');
  assert.equal(computeOnboardingStatus(state({ bio: '  ' })).nextStep, 'bio');
  assert.equal(
    computeOnboardingStatus(state({ subscriptionPriceCents: 0 })).nextStep,
    'pricing',
  );
  assert.equal(
    computeOnboardingStatus(state({ stripeOnboarded: false })).nextStep,
    'stripe',
  );
});

test('computeOnboardingStatus: earliest incomplete step wins when several are missing', () => {
  const status = computeOnboardingStatus(
    state({ subscriptionPriceCents: 0, stripeOnboarded: false }),
  );
  assert.equal(status.nextStep, 'pricing');
  assert.equal(status.completedSteps, 3);
});

test('profile step requires name, country and a contact channel', () => {
  assert.equal(canPublishPicks(state({ displayName: '' })), false);
  assert.equal(canPublishPicks(state({ country: '  ' })), false);
  assert.equal(canPublishPicks(state({ contactValue: null })), false);
  assert.equal(canPublishPicks(state()), true);
});

test('bio step ignores whitespace-only bios', () => {
  assert.equal(canPublishPicks(state({ bio: '   ' })), false);
  assert.equal(canPublishPicks(state({ bio: '' })), false);
  assert.equal(canPublishPicks(state({ bio: 'x' })), true);
});

test('sports step requires at least one non-empty sport', () => {
  assert.equal(canPublishPicks(state({ sports: [] })), false);
  assert.equal(canPublishPicks(state({ sports: ['  '] })), false);
  assert.equal(canPublishPicks(state({ sports: ['tennis'] })), true);
});

test('pricing step requires a positive subscription price', () => {
  assert.equal(canPublishPicks(state({ subscriptionPriceCents: 0 })), false);
  assert.equal(canPublishPicks(state({ subscriptionPriceCents: -5 })), false);
  assert.equal(canPublishPicks(state({ subscriptionPriceCents: 1 })), true);
});

test('canPublishPicks: blocks until Stripe onboarding is done (verification aside)', () => {
  assert.equal(canPublishPicks(state({ stripeOnboarded: false })), false);
  assert.equal(canPublishPicks(state({ identityVerified: false })), true);
  assert.equal(canPublishPicks(state()), true);
});
