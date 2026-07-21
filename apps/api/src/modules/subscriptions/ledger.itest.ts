// Integration test: exercises the funds ledger against a REAL Postgres, then
// runs the collected-revenue → payout math end-to-end. Unlike the pure unit
// tests, this needs a database — it runs in CI against a `postgres` service and
// locally against the docker-compose DB (`npm run db:up` first).
//
// DATABASE_URL is honored; it defaults to the local compose connection so the
// test works out of the box in dev.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  recordPayment,
  grossCollectedForPeriod,
  periodOf,
} from './ledger.ts';
import { computeNetFromGross } from '../payouts/payouts.math.ts';
import type { SubscriptionEvent } from '../../integrations/payments/payment-provider.interface.ts';

process.env.DATABASE_URL ??= 'postgresql://overlay:overlay@localhost:5432/overlay?schema=public';

const prisma = new PrismaClient();

// Unique per run so parallel/re-runs never collide, and cleanup is scoped.
// A tipster's primary key IS its tipsterId (Tipster.userId), so we create a
// backing User + Tipster under that id; the subscriber is a separate user id
// (Payment.userId has no FK, so it needs no row).
const tag = randomUUID().slice(0, 8);
const tipsterId = `it_tipster_${tag}`;
const subscriberId = `it_user_${tag}`;
const period = periodOf(new Date());

function activated(
  reference: string,
  amountCents?: number,
): SubscriptionEvent {
  return {
    type: 'activated',
    userId: subscriberId,
    tipsterId,
    provider: 'stripe',
    providerSubscriptionId: reference,
    reference,
    amountCents,
    occurredAt: new Date(),
  };
}

before(async () => {
  await prisma.$connect();
  // Backing user + tipster keyed by tipsterId so the price-fallback path resolves.
  await prisma.user.create({
    data: { id: tipsterId, email: `${tipsterId}@itest.local`, role: 'tipster' },
  });
  await prisma.tipster.create({
    data: { userId: tipsterId, subscriptionPriceCents: 1000 },
  });
});

after(async () => {
  await prisma.payment.deleteMany({ where: { tipsterId } });
  await prisma.tipster.deleteMany({ where: { userId: tipsterId } });
  await prisma.user.deleteMany({ where: { id: tipsterId } });
  await prisma.$disconnect();
});

test('records a collected payment and sums it for the period', async () => {
  await recordPayment(prisma, activated('it:cs_1', 1500), 1);
  const gross = await grossCollectedForPeriod(prisma, tipsterId, period);
  assert.equal(gross, 1500);
});

test('re-delivered webhook (duplicate reference) does not double-count', async () => {
  await recordPayment(prisma, activated('it:cs_1', 1500), 1); // same ref again
  const gross = await grossCollectedForPeriod(prisma, tipsterId, period);
  assert.equal(gross, 1500); // still 1500, not 3000
});

test('a second distinct payment adds to collected revenue', async () => {
  await recordPayment(prisma, activated('it:cs_2', 1500), 1);
  const gross = await grossCollectedForPeriod(prisma, tipsterId, period);
  assert.equal(gross, 3000);
});

test('a refund reverses collected revenue', async () => {
  await recordPayment(prisma, activated('it:cs_2', 1500), -1); // refund cs_2
  const gross = await grossCollectedForPeriod(prisma, tipsterId, period);
  assert.equal(gross, 1500);
});

test('falls back to the tipster price when the webhook omits the amount', async () => {
  await recordPayment(prisma, activated('it:cs_3'), 1); // no amountCents → price 1000
  const gross = await grossCollectedForPeriod(prisma, tipsterId, period);
  assert.equal(gross, 2500); // 1500 (cs_1) + 1000 (cs_3)
});

test('payout is computed from collected revenue, never subscriber count', async () => {
  const gross = await grossCollectedForPeriod(prisma, tipsterId, period);
  const { grossCents, feeCents, netCents } = computeNetFromGross(gross, 0.25);
  assert.equal(grossCents, 2500);
  assert.equal(feeCents, 625);
  assert.equal(netCents, 1875);
  assert.ok(netCents <= grossCents, 'never pays out more than collected');
});
