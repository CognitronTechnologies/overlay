import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Overlay Bets — Verified tipsters, ranked by real edge',
  description:
    'Find the overlay. Beat the close. Tipsters ranked by verified ROI and closing line value — every pick cryptographically locked before kickoff.',
};

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Locked before kickoff',
    body: 'Every pick is hashed and timestamped the moment it is posted — it can never be edited, deleted or backdated.',
  },
  {
    title: 'Verified, not screenshots',
    body: 'Records are settled automatically from results data. What you see is the real track record, closing line value included.',
  },
  {
    title: 'Ranked by real edge',
    body: 'Tipsters are ordered by verified yield and CLV, not follower counts or cherry-picked wins.',
  },
];

export default function Home() {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <section style={{ maxWidth: 680 }}>
        <h1 style={{ fontSize: '2.8rem', lineHeight: 1.1, margin: '0 0 0.75rem' }}>
          Find the overlay. Beat the close.
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.15rem', margin: '0 0 1.75rem' }}>
          Sports tipsters ranked by{' '}
          <strong style={{ color: 'var(--fg)' }}>verified</strong> ROI and
          closing line value — every pick cryptographically locked before
          kickoff. Real edge, not screenshots.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link href="/tipsters" className="btn btn--primary btn--lg">
            Browse tipsters
          </Link>
          <Link href="/tips" className="btn btn--secondary btn--lg">
            Today’s free tips
          </Link>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginTop: '3.5rem',
        }}
      >
        {FEATURES.map((f) => (
          <div key={f.title} className="panel">
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>{f.title}</h2>
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.95rem' }}>
              {f.body}
            </p>
          </div>
        ))}
      </section>

      <section style={{ marginTop: '3rem' }}>
        <p style={{ color: 'var(--muted)' }}>
          Are you a tipster with a real record?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)' }}>
            Get verified and start earning →
          </Link>
        </p>
      </section>
    </main>
  );
}
