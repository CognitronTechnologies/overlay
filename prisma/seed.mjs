// Seed script — run with: node prisma/seed.mjs
// Requires `npm run prisma:generate` first and DATABASE_URL to be set.
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function readingMinutes(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@overlay.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-now';

const ARTICLES = [
  {
    slug: 'what-is-closing-line-value',
    title: 'What Is Closing Line Value (CLV) and Why It Predicts Long-Term Profit',
    tags: ['clv', 'strategy', 'fundamentals'],
    excerpt:
      'Closing line value measures whether you beat the market before it corrected. It is the single best leading indicator of a betting edge.',
    body: `## The one metric sharps actually track

Closing line value (CLV) compares the odds you got when you placed a bet to the
final odds right before the event started — the **closing line**.

If you consistently take prices better than the close, you are, on average,
getting **positive expected value**. The closing line is the market's most
efficient estimate of true probability, because it reflects all money and
information up to kickoff.

## How to calculate CLV

\`\`\`
CLV = (odds_at_bet / closing_odds) - 1
\`\`\`

- You bet a team at **2.10**.
- The line closes at **1.90**.
- CLV = 2.10 / 1.90 - 1 = **+10.5%**.

You beat the close by more than ten percent. Do that repeatedly and profit
follows, even across losing runs.

## Why CLV beats short-term ROI

ROI over a few hundred bets is dominated by variance. CLV is measurable on
**every** bet — win or lose — so it converges far faster. That is why Overlay
ranks tipsters on verified CLV, not just win rate.`,
  },
  {
    slug: 'expected-value-betting-explained',
    title: 'Expected Value Betting Explained: Finding the Overlay',
    tags: ['ev', 'strategy', 'fundamentals'],
    excerpt:
      'An overlay is a bet where the offered odds are longer than the true probability warrants. Here is how to spot one.',
    body: `## What "overlay" means

An **overlay** is a bet whose offered odds imply a probability *lower* than the
true probability of the outcome. In other words, the bookmaker is paying you
more than the risk deserves. That gap is your edge.

## Expected value in one formula

\`\`\`
EV = (p_true * (odds - 1)) - (1 - p_true)
\`\`\`

If your estimated true probability is 55% and the odds are 2.00:

- EV = 0.55 * 1.00 - 0.45 = **+0.10 per unit** (a 10% edge).

Positive EV is the whole game. Everything else — bankroll, CLV, staking — is how
you survive variance long enough to realize it.

## Where overlays come from

- Slow-moving soft books
- Overreactions to public narratives
- Injury/lineup news the price hasn't absorbed yet

Find them, bet them, and track your CLV to confirm you were right.`,
  },
  {
    slug: 'bankroll-management-kelly-criterion',
    title: 'Bankroll Management: Staking, Units, and the Kelly Criterion',
    tags: ['bankroll', 'strategy', 'risk'],
    excerpt:
      'A positive edge still busts you if you stake badly. Learn unit sizing and a practical, fractional-Kelly approach.',
    body: `## Edge without discipline goes broke

Even a genuine +EV bettor can lose their entire bankroll by staking too much on
each bet. Bankroll management is how you turn an edge into realized profit.

## Units, not dollars

Track everything in **units** — typically 1% of your bankroll. A "3-unit" bet is
three percent of your roll. This normalizes performance across bankroll sizes and
is exactly how Overlay records tipster stakes.

## The Kelly criterion

Kelly tells you the growth-optimal fraction to stake given your edge:

\`\`\`
f = (b * p - q) / b
\`\`\`

where \`b\` = odds - 1, \`p\` = true win probability, \`q\` = 1 - p.

Because your probability estimates are noisy, most pros bet **quarter- or
half-Kelly** to cut variance. Smaller, steadier, still growing.`,
  },
];

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'admin' },
    create: {
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: hashPassword(ADMIN_PASSWORD),
    },
  });
  console.log(`Admin user: ${admin.email}`);

  for (const a of ARTICLES) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        tags: a.tags,
        readingMinutes: readingMinutes(a.body),
        status: 'published',
      },
      create: {
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        tags: a.tags,
        readingMinutes: readingMinutes(a.body),
        status: 'published',
        publishedAt: new Date(),
        authorId: admin.id,
      },
    });
    console.log(`Article: ${a.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
