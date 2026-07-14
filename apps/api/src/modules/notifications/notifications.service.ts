import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { NOTIFIER, type Notifier } from './notifier.interface';
import {
  dispatchNewPick,
  passwordResetEmail,
  receiptEmail,
  verificationEmail,
  type NewPickNotification,
} from './templates';

export type { NewPickNotification };

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  /**
   * Fan out a "new pick" notification to a tipster's active subscribers.
   * In production this is enqueued (dispatch-notifications) rather than awaited
   * inline; the interface stays the same.
   */
  async notifyNewPick(pick: NewPickNotification): Promise<void> {
    const subs = await this.prisma.subscription.findMany({
      where: { tipsterId: pick.tipsterId, status: 'active' },
      include: { user: true },
    });

    const recipients = subs.map((sub) => ({
      userId: sub.userId,
      email: sub.user.email,
    }));

    await dispatchNewPick(this.notifier, pick, recipients);
  }

  /** Send an email-verification link to a newly registered user. */
  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.notifier.sendEmail({ to, ...verificationEmail({ verifyUrl }) });
  }

  /** Send a password-reset link. */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.notifier.sendEmail({ to, ...passwordResetEmail({ resetUrl }) });
  }

  /** Send a payment receipt after a successful subscription charge. */
  async sendReceiptEmail(
    to: string,
    receipt: {
      tipsterName: string;
      amountCents: number;
      currency?: string;
      periodEnd?: Date;
    },
  ): Promise<void> {
    await this.notifier.sendEmail({ to, ...receiptEmail(receipt) });
  }
}
