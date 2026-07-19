/**
 * Pure, framework-free timing gate for pick submission (OB-038 / OB-039).
 *
 * Kept decorator- and Prisma-free so it can be exercised directly by the
 * unit-test runner (`node --experimental-strip-types`). The Nest service calls
 * {@link evaluatePickTiming} with the event's start time / status and the
 * requested pick type, then throws the matching HTTP error.
 *
 * The rule (see docs/LIVE-PICKS.md §3):
 *   - `pre_match` picks are rejected once the event has started (the OB-038
 *     kickoff cutoff) — this is the integrity moat for the pre-match book.
 *   - `live` (in-play) picks bypass the kickoff cutoff but are still rejected
 *     once the event has finished — you can't place an in-play wager on a game
 *     that's already over.
 */

import type { PickType } from '@overlay/shared';

/** Minimal event shape the timing gate needs. */
export interface PickTimingEvent {
  /** Kickoff time. `null`/invalid means the start time is unknown. */
  startTime: Date | null;
  /** Event lifecycle status, e.g. `scheduled` | `finished`. */
  status?: string;
 * Pure helpers for late-pick & cutoff hardening (OB-038).
 *
 * Kept free of Nest/Prisma so the config parsing and cutoff evaluation can be
 * unit-tested in isolation. The server clock is authoritative: a pick must land
 * a configurable number of minutes *before* kickoff (not merely before the
 * start-time), with a small clock-skew tolerance, and picks on events with a
 * missing or invalid start time are always rejected.
 */

/** Default lead time (minutes before kickoff) a pick must beat. */
export const DEFAULT_CUTOFF_MINUTES = 10;
/** Default clock-skew tolerance (seconds) granted in the tipster's favour. */
export const DEFAULT_CLOCK_SKEW_SECONDS = 60;

export interface CutoffConfig {
  /** Required lead time before kickoff, in milliseconds. */
  cutoffMs: number;
  /** Clock-skew grace applied in the tipster's favour, in milliseconds. */
  clockSkewMs: number;
}

export type PickTimingResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Decide whether a pick may be locked right now. Pure and deterministic — the
 * caller supplies `now` (defaults to the trusted server clock) so it can be
 * pinned in tests.
 */
export function evaluatePickTiming(
  pickType: PickType,
  event: PickTimingEvent,
  now: number = Date.now(),
): PickTimingResult {
  const start = event.startTime?.getTime();
  if (start === undefined || Number.isNaN(start)) {
    return { ok: false, reason: 'Event has no valid start time; pick rejected' };
  }

  const started = start <= now;
  const finished = event.status === 'finished';

  if (pickType === 'live') {
    // In-play picks bypass the kickoff cutoff, but the game must still be live.
    if (finished) {
      return {
        ok: false,
        reason: 'Event has already finished; live pick rejected',
      };
    }
    return { ok: true };
  }

  // Pre-match picks honour the OB-038 cutoff.
  if (started) {
    return {
      ok: false,
      reason: 'Event has already started; pick rejected',
    };
  }
 * Parse a non-negative number from an env string, falling back to `fallback`
 * when the value is missing, blank, non-numeric or negative.
 */
function parseNonNegative(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * Build the cutoff configuration from the environment. `PICK_CUTOFF_MINUTES`
 * sets how long before kickoff picks close (default 10); `PICK_CLOCK_SKEW_SECONDS`
 * sets the tolerance that absorbs small clock differences (default 60).
 */
export function resolveCutoffConfig(
  env: NodeJS.ProcessEnv = process.env,
): CutoffConfig {
  const cutoffMinutes = parseNonNegative(
    env.PICK_CUTOFF_MINUTES,
    DEFAULT_CUTOFF_MINUTES,
  );
  const clockSkewSeconds = parseNonNegative(
    env.PICK_CLOCK_SKEW_SECONDS,
    DEFAULT_CLOCK_SKEW_SECONDS,
  );
  return {
    cutoffMs: cutoffMinutes * 60_000,
    clockSkewMs: clockSkewSeconds * 1_000,
  };
}

/**
 * Decide whether a pick may be locked given the event's kickoff time and the
 * authoritative server clock (`now`, epoch ms). Rejects events with a
 * missing/invalid start time, and rejects picks that arrive at or after the
 * cutoff (kickoff − cutoff), with the clock-skew tolerance extending the
 * deadline slightly in the tipster's favour.
 */
export function evaluatePickCutoff(
  startTime: Date | null | undefined,
  now: number,
  config: CutoffConfig,
): PickTimingResult {
  if (
    !(startTime instanceof Date) ||
    Number.isNaN(startTime.getTime())
  ) {
    return {
      ok: false,
      reason: 'Event has no valid start time; pick rejected',
    };
  }

  const kickoff = startTime.getTime();
  const cutoffAt = kickoff - config.cutoffMs;
  const deadline = cutoffAt + config.clockSkewMs;

  if (now >= deadline) {
    if (now >= kickoff) {
      return {
        ok: false,
        reason: 'Event has already started; pick rejected',
      };
    }
    return {
      ok: false,
      reason: 'Pick cutoff has passed; pick rejected',
    };
  }

  return { ok: true };
}
