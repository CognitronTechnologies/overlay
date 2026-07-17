import type { Metadata } from 'next';
import NewsletterForm from './NewsletterForm';

export const metadata: Metadata = {
  title: 'Newsletter — Overlay Bets',
  description:
    'Subscribe to the Overlay Bets newsletter for marketplace updates, sports betting analytics, verified tipster insights, and platform announcements.',
  alternates: {
    canonical: '/newsletter',
  },
};

export default function NewsletterPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '3.5rem 1.5rem',
      }}
    >
      <section
        style={{
          marginBottom: '2.5rem',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            lineHeight: 1.2,
            marginBottom: '1rem',
            fontWeight: 600,
          }}
        >
          Join the Overlay Bets Newsletter
        </h1>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          Stay ahead of the market with product updates, educational articles,
          Closing Line Value insights, verified tipster stories, and new
          features as we build the most transparent sports tipping platform.
        </p>
      </section>

      <NewsletterForm />
    </main>
  );
}