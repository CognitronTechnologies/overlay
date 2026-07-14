/**
 * Pure logic for the admin pick/settlement oversight console (OB-029).
 *
 * Kept free of Nest/Prisma (mirrors users-query.ts) so the parse → clamp
 * behaviour, void-reason validation and the void orchestration can be
 * unit-tested in isolation. The service layer wires Prisma + the stats engine
 * into {@link voidPickWorkflow}.
 */

import type { Prisma } from '@prisma/client';

export const DEFAULT_SETTLEMENTS_LIMIT = 50;
export const MAX_SETTLEMENTS_LIMIT = 200;
export const MAX_VOID_REASON_LENGTH = 500;

/** Settled (non-pending) pick outcomes the oversight view can filter by. */
export type SettlementStatusFilter = 'won' | 'lost' | 'void';
const SETTLEMENT_STATUSES: readonly SettlementStatusFilter[] = [
  'won',
  'lost',
  'void',
];

/** Raw string params as received from the query string. */
export type RawSettlementsQuery = Partial<
  Record<'status' | 'take' | 'skip', string>
>;

/** Normalized, validated query — safe to hand straight to the DB layer. */
export interface SettlementsQuery {
  status: SettlementStatusFilter | null;
  take: number;
  skip: number;
}

function toInt(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Parse/clamp untrusted query-string params into a safe
 * {@link SettlementsQuery}. Invalid values fall back to defaults rather than
 * throwing so the page always renders. An unknown status collapses to `null`
 * (no filter — show all settled outcomes).
 */
export function normalizeSettlementsQuery(
  raw: RawSettlementsQuery = {},
): SettlementsQuery {
  const statusRaw = raw.status?.trim().toLowerCase();
  const status =
    statusRaw && (SETTLEMENT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as SettlementStatusFilter)
      : null;

  const takeRaw = toInt(raw.take);
  const take =
    takeRaw != null && takeRaw >= 1
      ? Math.min(takeRaw, MAX_SETTLEMENTS_LIMIT)
      : DEFAULT_SETTLEMENTS_LIMIT;

  const skipRaw = toInt(raw.skip);
  const skip = skipRaw != null && skipRaw >= 0 ? skipRaw : 0;

  return { status, take, skip };
}

/** Raised when an admin submits a void with no (or an over-long) reason. */
export class InvalidVoidReasonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVoidReasonError';
  }
}

/** Raised when the target pick does not exist. */
export class PickNotFoundError extends Error {
  constructor(message = 'Pick not found') {
    super(message);
    this.name = 'PickNotFoundError';
  }
}

/** Raised when the target pick has already been voided (idempotency guard). */
export class PickAlreadyVoidError extends Error {
  constructor(message = 'Pick is already voided') {
    super(message);
    this.name = 'PickAlreadyVoidError';
  }
}

/**
 * Trim + validate an admin-supplied void reason. A reason is mandatory (the
 * void is audited) and bounded so a stray paste can't bloat the audit payload.
 */
export function normalizeVoidReason(reason: unknown): string {
  if (typeof reason !== 'string') {
    throw new InvalidVoidReasonError('A void reason is required');
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new InvalidVoidReasonError('A void reason is required');
  }
  if (trimmed.length > MAX_VOID_REASON_LENGTH) {
    throw new InvalidVoidReasonError(
      `Void reason must be at most ${MAX_VOID_REASON_LENGTH} characters`,
    );
  }
  return trimmed;
}

/** Minimal pick shape the void workflow reasons about. */
export interface VoidablePick {
  id: string;
  tipsterId: string;
  status: string;
}

/** Audit-log `data` payload describing a manual void. */
export interface VoidAuditEntry {
  actor: string;
  action: 'pick.voided';
  entity: 'Pick';
  entityId: string;
  payload: Prisma.InputJsonObject;
}

/**
 * Build the append-only audit entry for a manual void. Records the actor, the
 * reason and the previous status so the action is fully reconstructable.
 */
export function buildVoidAuditEntry(args: {
  actorId: string;
  pick: VoidablePick;
  reason: string;
}): VoidAuditEntry {
  return {
    actor: `admin:${args.actorId}`,
    action: 'pick.voided',
    entity: 'Pick',
    entityId: args.pick.id,
    payload: { reason: args.reason, previousStatus: args.pick.status },
  };
}

/** Side-effecting dependencies the void workflow needs, injected by the service. */
export interface VoidPickDeps {
  /** Load the target pick (or null if missing). */
  getPick: (pickId: string) => Promise<VoidablePick | null>;
  /** Atomically flip the pick to `void` and append the audit entry. */
  applyVoid: (args: {
    pickId: string;
    audit: VoidAuditEntry;
  }) => Promise<void>;
  /** Recompute the affected tipster's materialized stats. */
  recomputeStats: (tipsterId: string) => Promise<void>;
}

/** Result of a completed void: the affected tipster + the audit entry written. */
export interface VoidPickResult {
  pick: VoidablePick;
  audit: VoidAuditEntry;
}

/**
 * Orchestrate a manual void: validate the reason, load + guard the pick, apply
 * the void together with its audit entry, then recompute the tipster's stats.
 * Pure of Nest/Prisma so the "void writes audit + recomputes stats" contract is
 * unit-testable with in-memory fakes.
 */
export async function voidPickWorkflow(
  deps: VoidPickDeps,
  input: { actorId: string; pickId: string; reason: unknown },
): Promise<VoidPickResult> {
  const reason = normalizeVoidReason(input.reason);
  const pick = await deps.getPick(input.pickId);
  if (!pick) throw new PickNotFoundError();
  if (pick.status === 'void') throw new PickAlreadyVoidError();

  const audit = buildVoidAuditEntry({ actorId: input.actorId, pick, reason });
  await deps.applyVoid({ pickId: pick.id, audit });
  await deps.recomputeStats(pick.tipsterId);

  return { pick, audit };
}
