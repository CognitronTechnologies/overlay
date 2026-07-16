import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { parseStripeWebhook } from './stripe-webhook.ts';

const SECRET = 'whsec_test_secret';

/** Build a valid `stripe-signature` header for a raw body, as Stripe does. */
function sign(rawBody: string, secret = SECRET, t = 1_700_000_000): string {
  const v1 = createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex');
  return `t=${t},v1=${v1}`;
}

test('rejects a webhook when no signature header is present', () => {
  const body = JSON.stringify({ type: 'checkout.session.completed' });
  assert.equal(parseStripeWebhook(body, {}, SECRET), null);
});

test('rejects a webhook with a tampered body (signature mismatch)', () => {
  const body = JSON.stringify({ type: 'checkout.session.completed' });
  const header = sign(body);
  const tampered = body.replace('checkout', 'CHECKOUT');
  assert.equal(
    parseStripeWebhook(tampered, { 'stripe-signature': header }, SECRET),
    null,
  );
});

test('rejects when the webhook secret is not configured', () => {
  const body = JSON.stringify({ type: 'checkout.session.completed' });
  assert.equal(
    parseStripeWebhook(body, { 'stripe-signature': sign(body) }, undefined),
    null,
  );
});

test('maps a verified checkout.session.completed to an activated event', () => {
  const body = JSON.stringify({
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    data: {
      object: {
        id: 'cs_123',
        client_reference_id: 'user_1:tipster_9',
        subscription: 'sub_abc',
        amount_total: 1500,
      },
    },
  });
  const evt = parseStripeWebhook(body, { 'stripe-signature': sign(body) }, SECRET);
  assert.ok(evt);
  assert.equal(evt.type, 'activated');
  assert.equal(evt.userId, 'user_1');
  assert.equal(evt.tipsterId, 'tipster_9');
  assert.equal(evt.providerSubscriptionId, 'sub_abc');
  assert.equal(evt.amountCents, 1500);
  assert.equal(evt.reference, 'stripe:checkout:cs_123');
});

test('maps customer.subscription.deleted to a canceled event via metadata', () => {
  const body = JSON.stringify({
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_abc',
        metadata: { userId: 'user_1', tipsterId: 'tipster_9' },
        current_period_end: 1_700_100_000,
      },
    },
  });
  const evt = parseStripeWebhook(body, { 'stripe-signature': sign(body) }, SECRET);
  assert.ok(evt);
  assert.equal(evt.type, 'canceled');
  assert.equal(evt.userId, 'user_1');
  assert.equal(evt.tipsterId, 'tipster_9');
});

test('maps a past_due subscription update and a refund reversal', () => {
  const pastDue = JSON.stringify({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_abc',
        status: 'past_due',
        metadata: { userId: 'u', tipsterId: 't' },
      },
    },
  });
  assert.equal(
    parseStripeWebhook(pastDue, { 'stripe-signature': sign(pastDue) }, SECRET)
      ?.type,
    'past_due',
  );

  const refund = JSON.stringify({
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_1',
        payment_intent: 'pi_1',
        amount_refunded: 1500,
        metadata: { userId: 'u', tipsterId: 't' },
      },
    },
  });
  const evt = parseStripeWebhook(refund, { 'stripe-signature': sign(refund) }, SECRET);
  assert.equal(evt?.type, 'refunded');
  assert.equal(evt?.amountCents, 1500);
});

test('ignores the first invoice but records recurring renewals', () => {
  const firstInvoice = JSON.stringify({
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_1',
        billing_reason: 'subscription_create',
        subscription: 'sub_abc',
        subscription_details: { metadata: { userId: 'u', tipsterId: 't' } },
      },
    },
  });
  assert.equal(
    parseStripeWebhook(firstInvoice, { 'stripe-signature': sign(firstInvoice) }, SECRET),
    null,
  );

  const renewal = JSON.stringify({
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_2',
        billing_reason: 'subscription_cycle',
        subscription: 'sub_abc',
        amount_paid: 1500,
        subscription_details: { metadata: { userId: 'u', tipsterId: 't' } },
      },
    },
  });
  const evt = parseStripeWebhook(renewal, { 'stripe-signature': sign(renewal) }, SECRET);
  assert.equal(evt?.type, 'activated');
  assert.equal(evt?.amountCents, 1500);
  assert.equal(evt?.reference, 'stripe:invoice:in_2');
});

test('ignores unrelated event types', () => {
  const body = JSON.stringify({ type: 'payout.paid', data: { object: {} } });
  assert.equal(
    parseStripeWebhook(body, { 'stripe-signature': sign(body) }, SECRET),
    null,
  );
});
