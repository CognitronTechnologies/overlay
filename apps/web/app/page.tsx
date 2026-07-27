import Link from 'next/link';
import type { Metadata } from 'next';
import Flag from './Flag';
import Avatar from './Avatar';
import SportsDiscovery from './sports/SportsDiscovery';
import { API_URL } from '../lib/api';

export const metadata: Metadata = {
  title: 'Overlay Picks — Verified tipsters, ranked by real edge',
  description:
    'Hunt real edge. Every pick is hashed and locked before kickoff, then settled automatically from the results — ranked by verified yield and closing line value. No edits, no fake records.',
};

export const revalidate = 60;

interface LeaderboardRow {
  tipsterId: string;
  yield: number;
  clvAvg: number;
  winRate: number;
  sampleSize: number;
  country: string | null;
  name: string | null;
  avatarUrl: string | null;
}

async function getLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const res = await fetch(`${API_URL}/api/leaderboard`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as LeaderboardRow[];
  } catch {
    return [];
  }
}

const STEPS: { n: string; title: string; body: string }[] = [
  { n: '01', title: 'Post', body: 'A tipster submits a pick with the odds they took.' },
  { n: '02', title: 'Locked', body: 'It’s hashed and timestamped before kickoff. No edits, ever.' },
  { n: '03', title: 'Settled', body: 'Graded automatically from the official result.' },
  { n: '04', title: 'Ranked', body: 'Verified yield and closing line value move them up the board.' },
];

export default async function Home() {
  const top = (await getLeaderboard()).slice(0, 5);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '3.5rem 1.5rem' }}>
      {/* Hero + clickable leaderboard preview */}
      <section
        style={{
          display: 'flex',
          gap: '2.5rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <h1 style={{ fontSize: '2.3rem', lineHeight: 1.15, margin: '0 0 1.1rem', fontWeight: 600 }}>
            Hunt real edge. Not screenshots.
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.65, margin: '0 0 1.5rem' }}>
            Every pick is hashed and locked <strong style={{ color: 'var(--fg)' }}>before kickoff</strong>,
            then settled automatically from the result. What you see is the real
            record — closing line value, drawdowns and all. No edits. No fake wins.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Link href="/tipsters" className="btn btn--primary btn--lg">
              Browse tipsters
            </Link>
            <Link href="/tips" className="btn btn--secondary btn--lg">
              Today’s free picks
            </Link>
          </div>
        </div>

        {top.length > 0 ? (
          <Link
            href="/tipsters"
            aria-label="View the full leaderboard of verified tipsters"
            style={{
              flex: '1 1 300px',
              minWidth: 0,
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.1rem 1.2rem',
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Top verified tipsters</h2>
              <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>View all →</span>
            </div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {top.map((r, i) => (
                <li
                  key={r.tipsterId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.7rem',
                    padding: '0.55rem 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      textAlign: 'right',
                      color: 'var(--muted)',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    {i + 1}
                  </span>
                  <Avatar src={r.avatarUrl} seed={r.name ?? r.tipsterId} size={30} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.name ?? r.tipsterId}
                      {r.country ? (
                        <Flag code={r.country} style={{ marginLeft: '0.4rem', verticalAlign: 'middle' }} />
                      ) : null}
                    </span>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>
                      {(r.clvAvg * 100).toFixed(1)}% CLV · {r.sampleSize} picks
                    </span>
                  </span>
                  <span
                    style={{
                      color: r.yield >= 0 ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 700,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {r.yield >= 0 ? '+' : ''}
                    {r.yield.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ol>
          </Link>
        ) : null}
      </section>

      {/* How it works */}
      <section style={{ marginTop: '3.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', margin: '0 0 1.25rem' }}>How it works</h2>
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {STEPS.map((s) => (
            <li key={s.n}>
              <div style={{ color: 'var(--accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {s.n}
              </div>
              <div style={{ fontWeight: 600, margin: '0.2rem 0 0.3rem' }}>{s.title}</div>
              <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: '3.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Browse events &amp; odds</h2>
            <p style={{ color: 'var(--muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              Pick a sport, compare bookmaker prices and see live scores — then find the tipsters on them.
            </p>
          </div>
        </div>
        <SportsDiscovery showTitle={false} />
      </section>

      <section style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Run your own picks?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)' }}>
            Get verified and start earning →
          </Link>
        </p>
      </section>
    </main>
  );
}
