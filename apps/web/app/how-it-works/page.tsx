import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works — Verified Tipsters & Sports Betting Analytics | Overlay Bets',

  description:
    'Learn how Overlay Bets connects bettors with verified tipsters through locked picks, transparent performance tracking, Closing Line Value (CLV), subscriptions and automated tipster payouts.',

  keywords: [
    'verified tipsters',
    'tipster marketplace',
    'sports betting analytics',
    'closing line value',
    'CLV',
    'ROI tracking',
    'sports picks',
    'betting subscriptions',
    'tipster payouts',
  ],

  alternates: {
    canonical: '/how-it-works',
  },

  openGraph: {
    title: 'How Overlay Bets Works',
    description:
      'Discover verified sports tipsters, follow proven analysts, and understand how Overlay Bets creates trust through locked picks and transparent performance.',
    url: '/how-it-works',
    type: 'website',
    images: [
      {
        url: '/overlay.png',
        alt: 'Overlay Bets',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'How Overlay Bets Works',
    description:
      'A verified marketplace connecting bettors with trusted sports tipsters.',
    images: ['/overlay.png'],
  },
};


export default function HowItWorksPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '3.5rem 1.5rem' }}>

      {/* Hero */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h1
          style={{
            fontSize: '2.2rem',
            lineHeight: 1.2,
            marginBottom: '1rem',
            fontWeight: 600,
          }}
        >
          Connecting bettors with verified betting edge.
        </h1>

        <p
          style={{
            fontSize: '1.1rem',
            lineHeight: 1.7,
            marginBottom: '1rem',
          }}
        >
          Overlay Bets is a verified tipster marketplace built to solve one of
          the biggest problems in sports betting: knowing who to trust.
        </p>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          Bettors discover proven analysts. Tipsters build a transparent
          reputation, grow their audience, and get rewarded for delivering
          genuine value.
        </p>
      </section>


      {/* Marketplace */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          A marketplace built for both sides
        </h2>

        <Feature
          title="For bettors"
          text="Find tipsters based on verified performance metrics instead of screenshots, marketing claims, or short-term results. Compare records, follow analysts, and access picks from people who have demonstrated real market understanding."
        />

        <Feature
          title="For tipsters"
          text="Turn your betting expertise into a sustainable business. Build a public track record, attract subscribers, and earn from your knowledge without relying on social media hype."
        />

        <Feature
          title="For Overlay Bets"
          text="We provide the technology, verification, marketplace, and payment infrastructure that connects both sides. Our platform earns through a small commission when tipsters generate subscriber revenue."
        />
      </section>


      {/* Trust */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Trust starts before kickoff
        </h2>

        <p style={{ lineHeight: 1.7 }}>
          Every pick published on Overlay Bets is locked and timestamped before
          an event begins.
        </p>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          This prevents results from being rewritten after the outcome is known.
          Performance history reflects what actually happened when the pick was
          available.
        </p>

        <Feature
          title="Immutable pick records"
          text="Published picks are cryptographically secured so the history remains transparent."
        />

        <Feature
          title="Automatic settlement"
          text="Results are tracked and settled into verified performance statistics."
        />

        <Feature
          title="Real performance metrics"
          text="ROI, yield, drawdowns and Closing Line Value help identify sustainable edge."
        />
      </section>


      {/* Subscriber journey */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          How bettors use Overlay Bets
        </h2>

        <Feature
          title="1. Discover"
          text="Browse verified tipsters ranked by performance, sports covered and betting history."
        />

        <Feature
          title="2. Subscribe"
          text="Choose analysts whose approach matches your goals and access their premium picks."
        />

        <Feature
          title="3. Follow performance"
          text="Track results over time with transparent statistics instead of relying on promises."
        />
      </section>


      {/* Tipster journey */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          How tipsters grow on Overlay Bets
        </h2>

        <Feature
          title="Create a verified record"
          text="Every published pick contributes to a transparent performance history."
        />

        <Feature
          title="Build your subscriber base"
          text="Convert your reputation into recurring subscription revenue from bettors who value your analysis."
        />

        <Feature
          title="Receive automatic payouts"
          text="Subscriber revenue is processed through the platform, with tipsters receiving scheduled payouts according to the payout cycle."
        />
      </section>


      {/* Economics */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          A fair marketplace model
        </h2>

        <p style={{ lineHeight: 1.7 }}>
          Overlay Bets succeeds when both bettors and tipsters succeed.
        </p>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          Instead of charging tipsters upfront, we operate through a small
          marketplace fee from successful subscriptions. This keeps incentives
          aligned: better tipsters attract more subscribers, and bettors get
          access to better information.
        </p>
      </section>


      {/* CTA */}
      <section
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '2rem',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Ready to find verified edge?
        </h2>

        <p
          style={{
            color: 'var(--muted)',
            marginBottom: '1.5rem',
          }}
        >
          Explore analysts with transparent records or start building your own
          verified reputation.
        </p>


        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link
            href="/tipsters"
            className="btn btn--primary btn--lg"
          >
            Browse tipsters
          </Link>

          <Link href="/signup">
            Become a tipster
          </Link>
        </div>

      </section>

    </main>
  );
}


function Feature({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        padding: '1.25rem 0',
      }}
    >
      <h3
        style={{
          fontSize: '1.1rem',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          color: 'var(--muted)',
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}