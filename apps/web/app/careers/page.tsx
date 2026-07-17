import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers at Overlay Bets',
  description:
    'Learn about future opportunities at Overlay Bets and join a team building a trusted marketplace for sports analytics and verified tipsters.',
  alternates: {
    canonical: '/careers',
  },
};


export default function CareersPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '3.5rem 1.5rem',
      }}
    >

      <section>
        <h1
          style={{
            fontSize: '2rem',
            lineHeight: 1.2,
            marginBottom: '1rem',
            fontWeight: 600,
          }}
        >
          Careers at Overlay Bets
        </h1>


        <p
          style={{
            fontSize: '1.05rem',
            lineHeight: 1.7,
            marginBottom: '1rem',
          }}
        >
          We are building a trusted marketplace where sports knowledge,
          technology, and transparent performance come together.
        </p>


        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          Our mission is to create better connections between bettors and
          genuine analysts while giving talented tipsters the tools to build
          sustainable businesses.
        </p>

      </section>


      <section
        style={{
          marginTop: '2.5rem',
          borderTop: '1px solid var(--border)',
          paddingTop: '2rem',
        }}
      >

        <h2
          style={{
            fontSize: '1.3rem',
            marginBottom: '1rem',
          }}
        >
          Current openings
        </h2>


        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          We do not currently have any open positions.
        </p>

      </section>


      <section
        style={{
          marginTop: '2.5rem',
        }}
      >

        <h2
          style={{
            fontSize: '1.3rem',
            marginBottom: '1rem',
          }}
        >
          Want to work with us in the future?
        </h2>


        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '1.5rem',
          }}
        >
          We are always interested in meeting talented engineers, designers,
          analysts, and sports data enthusiasts.
        </p>


        <Link
          href="/contact"
          className="btn btn--primary"
        >
          Get in touch
        </Link>

      </section>

    </main>
  );
}