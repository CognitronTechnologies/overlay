import Link from 'next/link';
import type { Metadata } from 'next';
import AuthAwareCTA from '../auth/AuthAwareCTA';

export const metadata: Metadata = {
  title: 'Tipster Verification Process — Overlay Bets',
  description:
    'Learn how Overlay Bets verifies sports tipsters through cryptographically locked picks, transparent performance tracking, ROI, Yield, Closing Line Value, and long-term historical results.',
  alternates: {
    canonical: '/verification',
  },
};

const verificationSteps = [
  {
    title: '1. Picks are recorded before kickoff',
    description:
      'Every pick submitted through Overlay Bets is recorded with the exact information available when it is published. This creates a permanent timeline proving what was recommended before an event begins.',
  },
  {
    title: '2. Picks are cryptographically locked',
    description:
      'Once published, every pick is secured using a cryptographic verification record. This prevents edits, deleted losses, or rewritten betting histories after the final result is known.',
  },
  {
    title: '3. Results are automatically tracked',
    description:
      'Performance is calculated from verified settled picks rather than screenshots or self-reported records. Wins, losses, voids, ROI, Yield and historical consistency are all measured objectively.',
  },
  {
    title: '4. Skill is measured beyond win rate',
    description:
      'Winning percentage alone rarely tells the full story. Overlay Bets also tracks Closing Line Value (CLV), profitability, sample size, drawdowns, yield and long-term consistency to evaluate genuine betting skill.',
  },
  {
    title: '5. Reputation is earned through transparency',
    description:
      'Subscribers can evaluate every tipster using public historical data instead of marketing claims. Trust is built through verified performance over hundreds or thousands of picks.',
  },
];

export default function VerificationPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '3.5rem 1.5rem',
      }}
    >
      <section>
        <h1
          style={{
            fontSize: '2.4rem',
            lineHeight: 1.15,
            marginBottom: '1rem',
          }}
        >
          How Overlay Bets verifies tipsters
        </h1>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.75,
            maxWidth: 680,
            marginBottom: '3rem',
          }}
        >
          Overlay Bets was built around a simple principle: sports predictions
          should be judged by evidence—not screenshots, selective records or
          marketing claims. Our verification process creates transparent,
          measurable performance histories that bettors can trust.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '2rem',
        }}
      >
        {verificationSteps.map((step) => (
          <article
            key={step.title}
            style={{
              paddingBottom: '2rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h2
              style={{
                fontSize: '1.15rem',
                marginBottom: '.75rem',
              }}
            >
              {step.title}
            </h2>

            <p
              style={{
                margin: 0,
                color: 'var(--muted)',
                lineHeight: 1.8,
              }}
            >
              {step.description}
            </p>
          </article>
        ))}
      </section>

      <section
        style={{
          marginTop: '5rem',
          padding: '3rem',
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '1.75rem',
            marginBottom: '1rem',
          }}
        >
          Trust performance backed by evidence
        </h2>

        <p
          style={{
            color: 'var(--muted)',
            maxWidth: 620,
            margin: '0 auto 2rem',
            lineHeight: 1.7,
          }}
        >
          Browse verified tipsters whose records are built from transparent,
          timestamped picks—not screenshots or unverifiable winning streaks.
          Every statistic is backed by historical data you can inspect for
          yourself.
        </p>

        <AuthAwareCTA />
      </section>

      <section
        style={{
          marginTop: '4rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: 'var(--muted)',
            marginBottom: '.75rem',
          }}
        >
          Want to learn more about our methodology?
        </p>

        <Link
          href="/faq"
          style={{
            color: 'var(--accent)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Read the FAQs →
        </Link>
      </section>
    </main>
  );
}