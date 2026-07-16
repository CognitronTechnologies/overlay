// Pure funds-ledger logic, parameterized over a Prisma client so it can be
// exercised directly against a real database in an integration test without
// booting Nest (whose decorators can't run under Node's type-stripping runner).
// The SubscriptionsService delegates to these; see docs/ARCHITECTURE.md §4.

import type { PrismaClient } from '@prisma/client';
import type { SubscriptionEvent } from '../../integrations/payments/payment-provider.interface';

/** Minimal Prisma surface the ledger needs (PrismaService/PrismaClient satisfy it). */
export type LedgerDb = Pick<PrismaClient, 'payment' | 'tipster'>;

/** YYYY-MM period key (UTC) a payment/payout is attributed to. */
export function periodOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Idempotently record a collected payment (+1) or refund reversal (-1) in the
 * funds ledger. The USD amount falls back to the tipster's stored price when
 * the provider webhook omits it. Duplicate references are no-ops (the unique
 * constraint + upsert make re-delivered webhooks safe).
 */
export async function recordPayment(
  db: LedgerDb,
  evt: SubscriptionEvent,
  sign: 1 | -1,
): Promise<void> {
  const reference =
    (evt.reference ?? evt.providerSubscriptionId) + (sign < 0 ? ':refund' : '');

  let amount = evt.amountCents;
  if (amount == null) {
    const tipster = await db.tipster.findUnique({
      where: { userId: evt.tipsterId },
      select: { subscriptionPriceCents: true },
    });
    amount = tipster?.subscriptionPriceCents ?? 0;
  }
  const amountCents = sign * Math.abs(Math.round(amount));
  if (amountCents === 0) return;

  const occurredAt = evt.occurredAt ?? new Date();
  await db.payment.upsert({
    where: { reference },
    create: {
      userId: evt.userId,
      tipsterId: evt.tipsterId,
      provider: evt.provider,
      reference,
      amountCents,
      period: periodOf(occurredAt),
      createdAt: occurredAt,
    },
    update: {}, // already recorded → no-op (idempotent on the unique reference)
  });
}

/**
 * Gross revenue actually collected for a tipster in a period (USD cents),
 * summed from the ledger (payments minus refunds), clamped to >= 0. Payouts are
 * computed from this so the platform can only pay out money it truly received.
 */
export async function grossCollectedForPeriod(
  db: LedgerDb,
  tipsterId: string,
  period: string,
): Promise<number> {
  const agg = await db.payment.aggregate({
    where: { tipsterId, period },
    _sum: { amountCents: true },
  });
  return Math.max(0, agg._sum.amountCents ?? 0);
}
