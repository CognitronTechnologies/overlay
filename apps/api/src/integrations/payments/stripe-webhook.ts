// Pure Stripe webhook verification + event mapping. No Nest/SDK deps, so it's
// unit-testable under node's type-stripping test runner and reused by the
// StripePaymentProvider. Security-critical: the signature check here is what
// stops a forged webhook from granting entitlement or moving money.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SubscriptionEvent } from './payment-provider.interface';

const PROVIDER = 'stripe';

/** Minimal shape of the Stripe webhook envelope + objects we consume. */
interface StripeObject {
  id?: string;
  client_reference_id?: string;
  subscription?: string;
  payment_intent?: string;
  amount_total?: number;
  amount_paid?: number;
  amount_refunded?: number;
  billing_reason?: string;
  status?: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  subscription_details?: { metadata?: Record<string, string> };
  lines?: { data?: { metadata?: Record<string, string> }[] };
}

interface StripeEvent {
  type?: string;
  created?: number;
  data?: { object?: StripeObject };
}

/**
 * Verify a Stripe webhook signature without the SDK: the `stripe-signature`
 * header is `t=<timestamp>,v1=<hex hmac>`; the signed payload is
 * `<timestamp>.<rawBody>` HMAC-SHA256'd with the endpoint secret, compared in
 * constant time. Mirrors `stripe.webhooks.constructEvent`.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()];
    }),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex');
  try {
    const a = Buffer.from(parts.v1, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function metaFromObject(obj: {
  metadata?: Record<string, string>;
}): { userId: string; tipsterId: string } | null {
  const m = obj.metadata ?? {};
  return m.userId && m.tipsterId
    ? { userId: m.userId, tipsterId: m.tipsterId }
    : null;
}

function metaFromInvoice(obj: {
  subscription_details?: { metadata?: Record<string, string> };
  lines?: { data?: { metadata?: Record<string, string> }[] };
}): { userId: string; tipsterId: string } | null {
  const fromDetails = obj.subscription_details?.metadata;
  if (fromDetails?.userId && fromDetails?.tipsterId) {
    return { userId: fromDetails.userId, tipsterId: fromDetails.tipsterId };
  }
  const fromLine = obj.lines?.data?.[0]?.metadata;
  if (fromLine?.userId && fromLine?.tipsterId) {
    return { userId: fromLine.userId, tipsterId: fromLine.tipsterId };
  }
  return null;
}

/** Map a verified Stripe event to our normalized SubscriptionEvent. */
export function mapStripeEvent(event: StripeEvent): SubscriptionEvent | null {
  const occurredAt = event.created ? new Date(event.created * 1000) : undefined;
  switch (event.type) {
    case 'checkout.session.completed': {
      // Initial payment: identity via client_reference_id "userId:tipsterId".
      const obj: StripeObject = event.data?.object ?? {};
      const [userId, tipsterId] = (obj.client_reference_id ?? '').split(':');
      if (!userId || !tipsterId) return null;
      return {
        type: 'activated',
        userId,
        tipsterId,
        provider: PROVIDER,
        providerSubscriptionId: String(obj.subscription ?? obj.id ?? ''),
        amountCents:
          typeof obj.amount_total === 'number' ? obj.amount_total : undefined,
        reference: `stripe:checkout:${obj.id}`,
        occurredAt,
      };
    }
    case 'invoice.paid': {
      // Recurring renewals only — the first invoice is covered by checkout above.
      const obj: StripeObject = event.data?.object ?? {};
      if (obj.billing_reason && obj.billing_reason !== 'subscription_cycle') {
        return null;
      }
      const meta = metaFromInvoice(obj);
      if (!meta) return null;
      return {
        type: 'activated',
        userId: meta.userId,
        tipsterId: meta.tipsterId,
        provider: PROVIDER,
        providerSubscriptionId: String(obj.subscription ?? ''),
        amountCents:
          typeof obj.amount_paid === 'number' ? obj.amount_paid : undefined,
        reference: `stripe:invoice:${obj.id}`,
        occurredAt,
      };
    }
    case 'customer.subscription.updated': {
      const obj: StripeObject = event.data?.object ?? {};
      const meta = metaFromObject(obj);
      if (!meta) return null;
      const type =
        obj.status === 'past_due' || obj.status === 'unpaid'
          ? 'past_due'
          : obj.status === 'canceled'
            ? 'canceled'
            : 'activated';
      return {
        type,
        userId: meta.userId,
        tipsterId: meta.tipsterId,
        provider: PROVIDER,
        providerSubscriptionId: String(obj.id ?? ''),
        currentPeriodEnd: obj.current_period_end
          ? new Date(obj.current_period_end * 1000)
          : undefined,
        occurredAt,
      };
    }
    case 'customer.subscription.deleted': {
      const obj: StripeObject = event.data?.object ?? {};
      const meta = metaFromObject(obj);
      if (!meta) return null;
      return {
        type: 'canceled',
        userId: meta.userId,
        tipsterId: meta.tipsterId,
        provider: PROVIDER,
        providerSubscriptionId: String(obj.id ?? ''),
        currentPeriodEnd: obj.current_period_end
          ? new Date(obj.current_period_end * 1000)
          : undefined,
        occurredAt,
      };
    }
    case 'charge.refunded': {
      // Reverse the collected revenue in the funds ledger.
      const obj: StripeObject = event.data?.object ?? {};
      const meta = metaFromObject(obj);
      if (!meta) return null;
      const refunded =
        typeof obj.amount_refunded === 'number' ? obj.amount_refunded : 0;
      return {
        type: 'refunded',
        userId: meta.userId,
        tipsterId: meta.tipsterId,
        provider: PROVIDER,
        providerSubscriptionId: String(obj.payment_intent ?? obj.id ?? ''),
        amountCents: refunded,
        reference: `stripe:refund:${obj.id}`,
        occurredAt,
      };
    }
    default:
      return null;
  }
}

/**
 * Verify + parse a raw Stripe webhook into a normalized SubscriptionEvent, or
 * null if the secret is missing, the signature is invalid, or the event isn't
 * one we act on.
 */
export function parseStripeWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string | undefined,
): SubscriptionEvent | null {
  if (!secret) return null;
  if (!verifyStripeSignature(rawBody, headers['stripe-signature'], secret)) {
    return null;
  }
  try {
    return mapStripeEvent(JSON.parse(rawBody) as StripeEvent);
  } catch {
    return null;
  }
}
