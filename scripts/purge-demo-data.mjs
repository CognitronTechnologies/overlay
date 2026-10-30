import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_ARTICLE_SLUGS = ['world-cup-final-preview'];
const DEMO_FREE_TIPS = [
  { sport: 'Football', league: 'Premier League', match: 'Arsenal vs Chelsea', market: '1X2', selection: 'Arsenal to win', analysis: 'Home side in strong form; opponent missing two key defenders.' },
  { sport: 'Football', league: 'La Liga', match: 'Sevilla vs Valencia', market: 'Over/Under 2.5', selection: 'Under 2.5 goals', analysis: 'Both teams low-scoring at home this season.' },
  { sport: 'Basketball', league: 'NBA', match: 'Celtics vs Heat', market: 'Moneyline', selection: 'Celtics', analysis: 'Rest advantage and a dominant home record.' },
];
const demoFreeTipWhere = { OR: DEMO_FREE_TIPS };
const SEEDED_EVENT_IDS = [
  'seed-evt-epl-1', 'seed-evt-epl-2', 'seed-evt-nba-1',
  ...Array.from({ length: 12 }, (_, i) => `seed-past-soccer-${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `seed-past-nba-${i + 1}`),
];

async function buildPlan(db) {
  const users = await db.user.findMany({
    where: { role: 'tipster', email: { endsWith: '@overlay.local' } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const ids = userIds;
  const tipsterWhere = { tipsterId: { in: ids } };
  const userWhere = { userId: { in: ids } };
  const relatedAccounts = {
    OR: [tipsterWhere, userWhere],
  };
  const articleWhere = {
    OR: [
      { slug: { in: DEMO_ARTICLE_SLUGS } },
      { authorId: { in: ids } },
    ],
  };
  const [orphanedSeedEvents, counts] = await Promise.all([
    db.event.findMany({
      where: {
        vendorEventId: { in: SEEDED_EVENT_IDS },
        picks: { every: { tipsterId: { in: ids } } },
        freeTips: { none: {} },
      },
      select: { id: true },
    }),
    Promise.all([
      db.pick.count({ where: tipsterWhere }),
      db.subscription.count({ where: relatedAccounts }),
      db.follow.count({ where: relatedAccounts }),
      db.tipsterStats.count({ where: tipsterWhere }),
      db.payout.count({ where: tipsterWhere }),
      db.payment.count({ where: relatedAccounts }),
      db.tipsterReport.count({ where: { OR: [{ tipsterId: { in: ids } }, { reporterId: { in: ids } }] } }),
      db.tipDropAnnouncement.count({ where: tipsterWhere }),
      db.notificationPreference.count({ where: userWhere }),
      db.pushSubscription.count({ where: userWhere }),
      db.article.count({ where: articleWhere }),
      db.freeTip.count({ where: demoFreeTipWhere }),
    ]),
  ]);
  const [picks, subscriptions, follows, stats, payouts, payments, reports,
    announcements, notificationPreferences, pushSubscriptions, articles, freeTips] = counts;
  return {
    userIds,
    eventIds: orphanedSeedEvents.map((event) => event.id),
    counts: {
      demoTipsters: userIds.length,
      picks,
      subscriptions,
      follows,
      tipsterStats: stats,
      payouts,
      payments,
      reports,
      announcements,
      notificationPreferences,
      pushSubscriptions,
      demoArticles: articles,
      demoFreeTips: freeTips,
      unreferencedSeedEvents: orphanedSeedEvents.length,
    },
  };
}

async function purge(db, plan) {
  const ids = plan.userIds;
  const articleWhere = {
    OR: [
      { slug: { in: DEMO_ARTICLE_SLUGS } },
      { authorId: { in: ids } },
    ],
  };
  const relatedAccounts = { OR: [{ tipsterId: { in: ids } }, { userId: { in: ids } }] };
  await db.pick.deleteMany({ where: { tipsterId: { in: ids } } });
  await db.subscription.deleteMany({ where: relatedAccounts });
  await db.follow.deleteMany({ where: relatedAccounts });
  await db.payout.deleteMany({ where: { tipsterId: { in: ids } } });
  await db.payment.deleteMany({ where: relatedAccounts });
  await db.tipsterReport.deleteMany({
    where: { OR: [{ tipsterId: { in: ids } }, { reporterId: { in: ids } }] },
  });
  await db.tipDropAnnouncement.deleteMany({ where: { tipsterId: { in: ids } } });
  await db.tipsterStats.deleteMany({ where: { tipsterId: { in: ids } } });
  await db.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
  await db.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
  await db.article.deleteMany({ where: articleWhere });
  await db.freeTip.deleteMany({ where: demoFreeTipWhere });
  if (plan.eventIds.length) {
    await db.event.deleteMany({ where: { id: { in: plan.eventIds } } });
  }
  await db.tipster.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  return plan.counts;
}

async function main() {
  const plan = await buildPlan(prisma);
  console.log('Demo data purge plan:');
  console.log(JSON.stringify(plan.counts, null, 2));
  if (!process.argv.includes('--confirm')) {
    console.log('DRY RUN: no records deleted. Pass --confirm to delete these demo records.');
    return;
  }
  const deleted = await prisma.$transaction(async (tx) => {
    const currentPlan = await buildPlan(tx);
    return purge(tx, currentPlan);
  });
  console.log('Deleted demo records:');
  console.log(JSON.stringify(deleted, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
