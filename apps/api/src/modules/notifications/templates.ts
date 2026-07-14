// Transactional email templates and notification fan-out helpers. These are
// pure and provider-agnostic (only type imports at runtime), so any Notifier
// can send them and they can be unit-tested with a mocked provider.

import type { EmailMessage, Notifier } from './notifier.interface';

/** An email template minus the recipient (filled in at send time). */
export type EmailTemplate = Omit<EmailMessage, 'to'>;

const APP_NAME = 'Overlay Bets';

/** Email-address verification link sent on sign-up. */
export function verificationEmail(params: { verifyUrl: string }): EmailTemplate {
  return {
    subject: `Verify your ${APP_NAME} email`,
    body:
      `Welcome to ${APP_NAME}! Confirm your email address to activate your account:\n\n` +
      `${params.verifyUrl}\n\n` +
      `If you didn't create this account, you can safely ignore this message.`,
  };
}

/** Password-reset link sent from the "forgot password" flow. */
export function passwordResetEmail(params: {
  resetUrl: string;
}): EmailTemplate {
  return {
    subject: `Reset your ${APP_NAME} password`,
    body:
      `We received a request to reset your ${APP_NAME} password. ` +
      `Use the link below to choose a new one:\n\n` +
      `${params.resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  };
}

/** Payment receipt sent after a successful subscription charge. */
export function receiptEmail(params: {
  tipsterName: string;
  amountCents: number;
  currency?: string;
  periodEnd?: Date;
}): EmailTemplate {
  const amount = formatAmount(params.amountCents, params.currency);
  const period = params.periodEnd
    ? ` Your subscription is active until ${params.periodEnd
        .toISOString()
        .slice(0, 10)}.`
    : '';
  return {
    subject: `Your ${APP_NAME} receipt`,
    body:
      `Thanks for subscribing to ${params.tipsterName}. ` +
      `You were charged ${amount}.${period}`,
  };
}

/** Digest of a newly posted pick, sent to a tipster's subscribers. */
export function newPickDigestEmail(params: {
  market: string;
  selection: string;
  oddsAtPick: number;
}): EmailTemplate {
  return {
    subject: 'New pick posted',
    body: `${params.market}: ${params.selection} @ ${params.oddsAtPick}`,
  };
}

function formatAmount(cents: number, currency = 'USD'): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export interface NewPickNotification {
  tipsterId: string;
  market: string;
  selection: string;
  oddsAtPick: number;
}

/** A resolved subscriber to notify. */
export interface NotificationRecipient {
  userId: string;
  email: string;
}

/**
 * Render the "new pick" digest once and fan it out to every recipient over both
 * channels. The Notifier is injected so callers (and tests) control transport.
 */
export async function dispatchNewPick(
  notifier: Notifier,
  pick: NewPickNotification,
  recipients: NotificationRecipient[],
): Promise<void> {
  const template = newPickDigestEmail(pick);
  await Promise.all(
    recipients.flatMap((r) => [
      notifier.sendEmail({
        to: r.email,
        subject: template.subject,
        body: template.body,
      }),
      notifier.sendPush({
        userId: r.userId,
        title: template.subject,
        body: template.body,
      }),
    ]),
  );
}
