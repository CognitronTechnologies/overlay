import Link from 'next/link';
import type { Metadata } from 'next';
import AuthAwareCTA from '../auth/AuthAwareCTA';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions — Overlay Bets',
  description:
    'Learn how Overlay Bets verifies tipsters, locks picks, calculates performance, handles subscriptions, and connects bettors with trusted sports analysts.',
  alternates: {
    canonical: '/faq',
  },
};

const faqItems = [
  {
    question: 'What is Overlay Bets?',
    answer:
      'Overlay Bets is a verified sports tipster marketplace that connects bettors with analysts who have proven records. Instead of relying on screenshots, claims, or unverifiable winning streaks, every pick is timestamped, cryptographically locked before kickoff, and evaluated using transparent long-term performance metrics.',
  },
  {
    question: 'How does Overlay Bets verify tipsters?',
    answer:
      'Every pick is submitted before the event begins, permanently timestamped, and cannot be edited afterwards. Performance statistics—including ROI, Yield, Win Rate and Closing Line Value—are calculated automatically from these verified records.',
  },
  {
    question: 'What does it mean that picks are cryptographically locked?',
    answer:
      'Each published pick receives a secure hash and server timestamp before kickoff. Any attempt to modify the selection, odds or stake afterwards would invalidate the verification record, making post-event editing impossible.',
  },
  {
    question: 'What is Closing Line Value (CLV)?',
    answer:
      'Closing Line Value measures whether a tipster consistently beats the market before kickoff. Positive CLV is widely regarded as one of the strongest indicators of genuine long-term betting skill.',
  },
  {
    question: 'How do bettors find tipsters?',
    answer:
      'Browse verified tipsters using transparent statistics including ROI, Yield, CLV, Win Rate, sample size, sports covered, subscriber count and historical performance instead of relying on marketing claims.',
  },
  {
    question: 'How do subscriptions work?',
    answer:
      'Subscribers gain access to a tipster’s premium picks immediately after they are locked. Subscription management, renewals and payments are handled securely through Overlay Bets.',
  },
  {
    question: 'How do tipsters get paid?',
    answer:
      'Tipsters earn recurring revenue from subscribers while Overlay Bets handles payment processing, subscription management, pick verification and platform infrastructure.',
  },
  {
    question: 'Does Overlay Bets place bets for users?',
    answer:
      'No. Overlay Bets is an information and analytics platform. We never accept bets, hold customer funds or operate as a bookmaker.',
  },
  {
    question: 'Can anyone become a tipster?',
    answer:
      'Anyone can apply. Verified status, however, is earned through transparent tracked performance and compliance with our platform standards.',
  },
  {
    question: 'What happens when a tipster loses?',
    answer:
      'Losses remain permanently visible. We never hide losing periods or reset records. Every verified pick contributes to a tipster’s long-term public statistics.',
  },
];

export default function FAQPage() {
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
          Frequently Asked Questions
        </h1>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.75,
            maxWidth: 680,
            marginBottom: '3rem',
          }}
        >
          Everything you need to know about Overlay Bets, verified tipsters,
          transparent performance tracking, subscriptions, and how we help
          bettors make evidence-based decisions.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '2rem',
        }}
      >
        {faqItems.map((item) => (
          <article
            key={item.question}
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
              {item.question}
            </h2>

            <p
              style={{
                margin: 0,
                color: 'var(--muted)',
                lineHeight: 1.8,
              }}
            >
              {item.answer}
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
          Start using verified betting data
        </h2>

        <p
          style={{
            color: 'var(--muted)',
            maxWidth: 620,
            margin: '0 auto 2rem',
            lineHeight: 1.7,
          }}
        >
          Whether you're looking for trustworthy tipsters or building your own
          reputation as an analyst, Overlay Bets gives you transparent,
          verifiable performance—not marketing claims.
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
          Still have questions?
        </p>

        <Link
          href="/contact"
          style={{
            color: 'var(--accent)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Contact our team →
        </Link>
      </section>
    </main>
  );
}