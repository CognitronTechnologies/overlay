import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type TipsterStatus = 'active' | 'suspended';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** High-level platform metrics for the admin dashboard. */
  async dashboard() {
    const [
      users,
      tipsters,
      activeSubscriptions,
      picks,
      settledPicks,
      pendingPayouts,
      publishedArticles,
      draftArticles,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tipster.count(),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.pick.count(),
      this.prisma.pick.count({ where: { status: { not: 'pending' } } }),
      this.prisma.payout.count({ where: { status: 'pending' } }),
      this.prisma.article.count({ where: { status: 'published' } }),
      this.prisma.article.count({ where: { status: 'draft' } }),
    ]);

    const grossPendingPayoutCents = await this.prisma.payout.aggregate({
      where: { status: 'pending' },
      _sum: { amountCents: true },
    });

    return {
      users,
      tipsters,
      activeSubscriptions,
      picks,
      settledPicks,
      pendingPayouts,
      grossPendingPayoutCents: grossPendingPayoutCents._sum.amountCents ?? 0,
      publishedArticles,
      draftArticles,
    };
  }

  listUsers(opts: { take?: number; skip?: number } = {}) {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.take ?? 50, 100),
      skip: opts.skip ?? 0,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        tipster: { select: { status: true } },
      },
    });
  }

  async setUserRole(
    actorId: string,
    userId: string,
    role: 'user' | 'tipster' | 'admin',
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { role },
      });
      // Promoting to tipster provisions a tipster profile if absent.
      if (role === 'tipster') {
        await tx.tipster.upsert({
          where: { userId },
          create: { userId, sports: [] },
          update: {},
        });
      }
      await tx.auditLog.create({
        data: {
          actor: `admin:${actorId}`,
          action: 'user.role_changed',
          entity: 'User',
          entityId: userId,
          payload: { role },
        },
      });
      return updated;
    });
  }

  /** Suspend or reinstate a tipster (hides them from leaderboard/marketplace). */
  async setTipsterStatus(
    actorId: string,
    tipsterId: string,
    status: TipsterStatus,
  ) {
    const tipster = await this.prisma.tipster.findUnique({
      where: { userId: tipsterId },
    });
    if (!tipster) throw new NotFoundException('Tipster not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tipster.update({
        where: { userId: tipsterId },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          actor: `admin:${actorId}`,
          action: `tipster.${status === 'suspended' ? 'suspended' : 'reinstated'}`,
          entity: 'Tipster',
          entityId: tipsterId,
          payload: { status },
        },
      });
      return updated;
    });
  }

  listAuditLog(opts: { entity?: string; take?: number; skip?: number } = {}) {
    return this.prisma.auditLog.findMany({
      where: opts.entity ? { entity: opts.entity } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.take ?? 100, 200),
      skip: opts.skip ?? 0,
    });
  }
}
