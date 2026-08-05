import Link from 'next/link';
import BackLink from '../BackLink';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Betting Glossary — CLV, EV & More — Overlay Picks',
  description:
    'Plain-English definitions of the betting terms that matter — closing line value, expected value, the overlay, bankroll, staking and more.',
  alternates: { canonical: '/glossary' },
};

type Term = {
  term: string;
  short: string;
  body: string;
};

const terms: Term[] = [
  {
    term: 'Overlay',
    short: 'Value on your side',
    body: 'A bet where the odds on offer imply a lower probability than the true chance of the outcome. Betting overlays consistently is the only long-run edge — it is where our name comes from.',
  },
  {
    term: 'Closing Line Value (CLV)',
    short: 'Beating the closing odds',
    body: 'The difference between the odds you took and the final (closing) odds just before the event starts. Consistently beating the close is the single best predictor of long-term profit, because the closing line is the sharpest price the market produces.',
  },
  {
    term: 'Expected Value (EV)',
    short: 'The math behind a bet',
    body: 'The average amount a bet would win or lose if it were repeated many times. A +EV bet makes money over time; a -EV bet loses. EV = (probability of winning × amount won) − (probability of losing × amount staked).',
  },
  {
    term: 'Edge',
    short: 'Your percentage advantage',
    body: 'How much better your estimated probability is than the price implies, expressed as a percentage. A 5% edge means that, on average, you expect to make 5 units of profit for every 100 staked at those odds.',
  },
  {
    term: 'Implied Probability',
    short: 'What the odds are saying',
    body: 'The probability an outcome will happen according to the odds. For decimal odds it is simply 1 ÷ odds. Compare it against your own estimate to spot an overlay.',
  },
  {
    term: 'Vig / Overround',
    short: 'The bookmaker margin',
    body: "Also called the juice or margin. The bookmaker's built-in profit — the amount by which the implied probabilities of all outcomes sum to more than 100%. Lower vig means better prices for you.",
  },
  {
    term: 'Bankroll',
    short: 'Your betting fund',
    body: 'The total amount of money you have set aside for betting, separate from everyday finances. Disciplined bankroll management is what keeps variance from wiping you out.',
  },
  {
    term: 'Staking / Unit',
    short: 'How much to bet',
    body: 'A staking plan decides how much of your bankroll to risk on each bet. A unit is a fixed fraction of your bankroll (often 1%), so results can be compared regardless of bankroll size.',
  },
  {
    term: 'Kelly Criterion',
    short: 'Optimal stake sizing',
    body: 'A formula that sizes each stake in proportion to your edge and the odds, maximising long-run bankroll growth. Many bettors use a fraction (e.g. half-Kelly) to reduce swings.',
  },
  {
    term: 'Yield / ROI',
    short: 'Profit per amount staked',
    body: 'Yield (return on investment) is total profit divided by total amount staked, as a percentage. It measures how efficiently a tipster turns stakes into profit — more meaningful than raw profit alone.',
  },
  {
    term: 'Variance',
    short: 'Short-term swings',
    body: 'The natural ups and downs of results around their expected value. Even a +EV strategy loses over short stretches — variance is why a long, verified track record matters.',
  },
  {
    term: 'Sharp',
    short: 'A winning bettor',
    body: 'A professional or highly skilled bettor whose action moves the odds. When sharps bet, bookmakers adjust prices — following the sharp money is a way to find value.',
  },
];

const cardStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: 12,
  padding: '1.25rem 1.4rem',
} as const;

export default function GlossaryPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p style={{ margin: 0 }}>
        <BackLink href="/">Overlay Picks</BackLink>
      </p>
      <h1 style={{ fontSize: '2.3rem', marginBottom: '0.25rem' }}>
        Betting Glossary
      </h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '1.05rem' }}>
        The terms that actually matter — in plain English. Know what you are
        looking at before you place a bet.
      </p>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          marginTop: '2rem',
        }}
      >
        {terms.map((t) => (
          <section key={t.term} style={cardStyle} id={slugify(t.term)}>
            <h2
              style={{
                margin: '0 0 0.15rem',
                fontSize: '1.3rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '0.6rem',
              }}
            >
              {t.term}
              <span
                style={{
                  fontFamily:
                    "var(--font-mono, ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, Consolas, monospace)",
                  fontSize: '0.72rem',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                {t.short}
              </span>
            </h2>
            <p
              style={{
                color: 'var(--fg)',
                lineHeight: 1.7,
                margin: '0.5rem 0 0',
              }}
            >
              {t.body}
            </p>
          </section>
        ))}
      </div>

      <div
        style={{
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)',
          color: 'var(--muted)',
        }}
      >
        Ready to put it into practice?{' '}
        <Link href="/tips" style={{ color: 'var(--accent)' }}>
          Browse today&rsquo;s picks
        </Link>{' '}
        or{' '}
        <Link href="/tools/odds-calculator" style={{ color: 'var(--accent)' }}>
          try the calculator
        </Link>
        .
      </div>
    </main>
  );
}

function slugify(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
