import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Our Team | Overlay Bets',
  description:
    'Meet the software engineers building Overlay Bets, the transparent marketplace for verified sports tipsters.',
  keywords: [
    'Overlay Bets team',
    'sports betting software',
    'software engineers',
    'verified tipsters',
    'sports analytics',
  ],
  alternates: {
    canonical: '/team',
  },
  openGraph: {
    title: 'Meet the Team | Overlay Bets',
    description:
      'Meet the engineers building transparent software for verified sports betting analytics.',
    url: '/team',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meet the Team | Overlay Bets',
    description:
      'The engineers building Overlay Bets and its transparent sports analytics platform.',
  },
};

const team = [
  {
    name: 'Dickson Mwendia',
    role: 'Lead Software Engineer',
    github: 'https://github.com/Dickson-Mwendia',
    description:
      'Dickson leads the technical direction of Overlay Bets, designing the platform architecture, backend infrastructure, data models, and long-term engineering strategy while ensuring the system remains scalable and reliable.',
  },
  {
    name: 'John Walter Munene',
    role: 'Software Engineer',
    github: 'https://github.com/john-walter-munene',
    description:
      'John develops full-stack product features across the frontend and backend, contributing to authentication, verification workflows, APIs, user experience, and the overall product functionality of Overlay Bets.',
  },
];

export default function TeamPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '3.5rem 1.5rem',
      }}
    >
      <section style={{ marginBottom: '4rem' }}>
        <p style={{ marginBottom: '.75rem' }}>
          <Link
            href="/"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            ← Overlay Bets
          </Link>
        </p>

        <h1
          style={{
            fontSize: '2.5rem',
            marginBottom: '1rem',
          }}
        >
          Meet the team
        </h1>

        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.75,
            maxWidth: 720,
          }}
        >
          Overlay Bets is built by software engineers passionate about bringing
          transparency to sports betting. Instead of screenshots, unverifiable
          claims, and marketing hype, we're creating a platform where every pick
          is verified, every performance metric is measurable, and trust is
          earned through real data.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '2rem',
        }}
      >
        {team.map((member) => (
          <article
            key={member.name}
            style={{
              padding: '2rem',
              border: '1px solid var(--border)',
              borderRadius: 16,
              background: 'var(--surface)',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: '.4rem',
                fontSize: '1.5rem',
              }}
            >
              {member.name}
            </h2>

            <p
              style={{
                color: 'var(--accent)',
                fontWeight: 600,
                marginTop: 0,
                marginBottom: '1rem',
              }}
            >
              {member.role}
            </p>

            <p
              style={{
                color: 'var(--muted)',
                lineHeight: 1.75,
                marginBottom: '1.5rem',
              }}
            >
              {member.description}
            </p>

            <a
              href={member.github}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View GitHub →
            </a>
          </article>
        ))}
      </section>

      <section
        style={{
          marginTop: '5rem',
          paddingTop: '3rem',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '1.75rem',
            marginBottom: '1rem',
          }}
        >
          Building trustworthy sports analytics
        </h2>

        <p
          style={{
            color: 'var(--muted)',
            maxWidth: 700,
            margin: '0 auto 2rem',
            lineHeight: 1.75,
          }}
        >
          Every feature we build supports one goal: making sports betting
          analysis transparent, reproducible, and verifiable. From
          cryptographically locked picks to public ROI, Yield, and Closing Line
          Value tracking, Overlay Bets is designed to reward genuine long-term
          skill—not marketing.
        </p>

        <Link
          href="/tipsters"
          className="btn btn--primary btn--lg"
        >
          Explore verified tipsters
        </Link>
      </section>
    </main>
  );
}