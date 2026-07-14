/**
 * Pure tipster onboarding logic for the guided setup wizard (OB-020).
 *
 * Kept free of Nest/Prisma (mirrors marketplace.ts / payouts.math.ts) so the
 * step-completion and publish-gate behaviour can be unit-tested in isolation.
 * The service reads the tipster's persisted fields and delegates the
 * "which steps are done / can they publish?" decision here.
 *
 * Progress is persisted implicitly: each step maps to stored Tipster fields, so
 * a tipster can leave and resume the wizard without losing progress.
 *
 * Steps, in the order the wizard presents them:
 *   1. profile      — display name, country and a direct-contact channel
 *   2. sports       — the sports they post picks for
 *   3. bio          — their pitch to subscribers
 *   4. pricing      — billing cadence (weekly/monthly) and price
 *   5. stripe       — connect Stripe payouts
 *   6. verification — OPTIONAL: socials + official document → "verified" badge
 *
 * Only the first five steps gate publishing. Verification is an optional trust
 * step that unlocks the verified badge and its marketplace advantages.
 */

export type OnboardingStepKey =
  | 'profile'
  | 'sports'
  | 'bio'
  | 'pricing'
  | 'stripe'
  | 'verification';

/** Ordered steps of the onboarding wizard. */
export const ONBOARDING_STEPS: readonly OnboardingStepKey[] = [
  'profile',
  'sports',
  'bio',
  'pricing',
  'stripe',
  'verification',
];

/** Steps that must be complete before a tipster may publish picks. */
export const REQUIRED_STEPS: readonly OnboardingStepKey[] = [
  'profile',
  'sports',
  'bio',
  'pricing',
  'stripe',
];

const STEP_LABELS: Record<OnboardingStepKey, string> = {
  profile: 'Your details',
  sports: 'Choose your sports',
  bio: 'Add your bio',
  pricing: 'Set your subscription price',
  stripe: 'Connect Stripe payouts',
  verification: 'Verify your identity',
};

/** The persisted tipster fields the wizard reads to compute progress. */
export interface TipsterOnboardingState {
  displayName: string | null;
  country: string | null;
  contactValue: string | null;
  bio: string | null;
  sports: string[];
  subscriptionPriceCents: number;
  stripeOnboarded: boolean;
  identityVerified: boolean;
}

export interface OnboardingStep {
  key: OnboardingStepKey;
  label: string;
  complete: boolean;
  /** Optional steps don't gate publishing (currently just `verification`). */
  optional: boolean;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  /** Completed count across the required steps only. */
  completedSteps: number;
  /** Number of required steps (excludes optional ones). */
  totalSteps: number;
  /** True once every REQUIRED step is complete. */
  complete: boolean;
  /** Publishing picks is gated on this (required steps only). */
  canPublish: boolean;
  /** Whether the optional verification step is done. */
  verified: boolean;
  /** First incomplete required step to guide the user to, or null when done. */
  nextStep: OnboardingStepKey | null;
}

function nonEmpty(value: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStepComplete(
  key: OnboardingStepKey,
  state: TipsterOnboardingState,
): boolean {
  switch (key) {
    case 'profile':
      return (
        nonEmpty(state.displayName) &&
        nonEmpty(state.country) &&
        nonEmpty(state.contactValue)
      );
    case 'sports':
      return (
        Array.isArray(state.sports) &&
        state.sports.some((s) => s.trim().length > 0)
      );
    case 'bio':
      return nonEmpty(state.bio);
    case 'pricing':
      return (
        Number.isFinite(state.subscriptionPriceCents) &&
        state.subscriptionPriceCents > 0
      );
    case 'stripe':
      return state.stripeOnboarded === true;
    case 'verification':
      return state.identityVerified === true;
    default:
      return false;
  }
}

/**
 * Compute the wizard's step-by-step completion state and whether the tipster
 * has satisfied every REQUIRED step needed to publish picks.
 */
export function computeOnboardingStatus(
  state: TipsterOnboardingState,
): OnboardingStatus {
  const steps: OnboardingStep[] = ONBOARDING_STEPS.map((key) => ({
    key,
    label: STEP_LABELS[key],
    complete: isStepComplete(key, state),
    optional: !REQUIRED_STEPS.includes(key),
  }));

  const requiredSteps = steps.filter((s) => !s.optional);
  const completedSteps = requiredSteps.filter((s) => s.complete).length;
  const complete = completedSteps === requiredSteps.length;
  const nextStep = requiredSteps.find((s) => !s.complete)?.key ?? null;
  const verified = isStepComplete('verification', state);

  return {
    steps,
    completedSteps,
    totalSteps: requiredSteps.length,
    complete,
    canPublish: complete,
    verified,
    nextStep,
  };
}

/** Convenience gate used by the picks service to block premature publishing. */
export function canPublishPicks(state: TipsterOnboardingState): boolean {
  return computeOnboardingStatus(state).canPublish;
}
