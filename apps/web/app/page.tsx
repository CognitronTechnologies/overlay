import Link from 'next/link';
import type { Metadata } from 'next';
import FAQPreview from './FAQ';

export const metadata: Metadata = {
  title: 'Overlay Bets — Verified tipsters, ranked by real edge',
  description:
    'Find the overlay. Beat the close. Tipsters ranked by verified ROI and closing line value — every pick cryptographically locked before kickoff.',
};

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Verification />
      <Performance />
      <MarketplacePreview />
      <PricingCTA />
      <FAQPreview />
      <FinalCTA />
    </main>
  );
}


function Hero() {
  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: '3.5rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', lineHeight: 1.2, margin: '0 0 1.1rem', fontWeight: 600 }}>
        Find the overlay. Beat the close.
      </h1>

      <p style={{ fontSize: '1.05rem', lineHeight: 1.65, marginBottom: '1.1rem' }}>
        Overlay Bets is where sports tipsters build a track record they can’t fake.
        Every pick is locked and timestamped before kickoff, then settled automatically.
      </p>

      <p style={{ color: 'var(--muted)', lineHeight: 1.6, marginBottom: '2rem' }}>
        Browse verified tipsters ranked by real performance,
        closing line value and long-term edge.
      </p>

      <p style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap' }}>
        <Link href="/tipsters" className="btn btn--primary btn--lg">
          Browse tipsters
        </Link>

        <Link href="/tips" style={{ color:'var(--accent)' }}>
          Today’s free tips →
        </Link>
      </p>
    </section>
  );
}

function HowItWorks() {
  return (
    <section style={{ maxWidth:640, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h2>How Overlay Bets works</h2>

      <p>
        Tipsters publish picks. Overlay Bets locks them before kickoff,
        records the available odds, and tracks the outcome permanently.
      </p>

      <p>
        1. Pick submitted
        <br />
        2. Pick cryptographically locked
        <br />
        3. Match played
        <br />
        4. Result settled
        <br />
        5. Performance updated
      </p>
    </section>
  );
}


function Verification() {
  return (
    <section style={{ maxWidth:640, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h2>Every pick has a permanent record</h2>

      <p>
        Unlike traditional tipster platforms, historical picks cannot
        be edited, removed, or selectively displayed.
      </p>

      <p style={{ color:'var(--muted)' }}>
        What you see is the complete record:
        wins, losses, drawdowns and closing line value.
      </p>
    </section>
  );
}

function Performance() {
  return (
    <section style={{ maxWidth:640, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h2>Ranked by verified performance</h2>

      <p>
        Compare tipsters using the metrics that matter:
      </p>

      <ul>
        <li>Verified ROI</li>
        <li>Closing line value</li>
        <li>Win rate</li>
        <li>Historical consistency</li>
      </ul>
    </section>
  );
}

function MarketplacePreview() {
  return (
    <section style={{ maxWidth:640, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h2>Discover verified tipsters</h2>

      <p>
        Follow analysts who demonstrate a genuine edge,
        not just short-term results.
      </p>

      <Link href="/tipsters" style={{color:'var(--accent)'}}>
        Explore marketplace →
      </Link>
    </section>
  );
}

function PricingCTA() {
  return (
    <section style={{ maxWidth:640, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h2>Subscribe to the tipsters you trust</h2>

      <p>
        Each tipster sets their own subscription offering.
        Choose analysts based on verified performance.
      </p>
    </section>
  );
}

const questions = [
  {
    question: 'How are picks verified?',
    answer:
      'Every pick is locked before kickoff with a timestamped record. Results are settled automatically after the event.',
  },
  {
    question: 'Can tipsters change their previous picks?',
    answer:
      'No. Once a pick is locked, the original record remains available including the result and performance history.',
  },
  {
    question: 'What is closing line value?',
    answer:
      'Closing line value measures whether a tipster consistently beats the final market price before an event begins.',
  },
  {
    question: 'How do tipster subscriptions work?',
    answer:
      'Each tipster defines their own subscription offering. Users can choose analysts based on verified performance.',
  },
];

function FinalCTA() {
  return (
    <section style={{ maxWidth:640, margin:'0 auto', padding:'3rem 1.5rem' }}>
      <h2>Find your edge.</h2>

      <p>
        Explore verified tipsters and follow real performance.
      </p>

      <Link href="/signup" className="btn btn--primary btn--lg">
        Create an account
      </Link>
    </section>
  );
}