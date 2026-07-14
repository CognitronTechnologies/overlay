import Link from 'next/link';

/**
 * Global site footer (OB-140). Carries the prominent "information only / we take
 * no bets" disclaimer and links to the legal pages.
 */
export default function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid #1c2430',
        marginTop: '3rem',
        padding: '2rem 1.5rem',
        color: '#9aa4b2',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 1rem',
            color: '#c7cdd6',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: '#f0b072' }}>Information only.</strong>{' '}
          Overlay Bets is a sports-information and analytics service. We take no
          bets, hold no stakes and are not a bookmaker. Picks and stats are for
          informational purposes only and are not a guarantee of any outcome.
          18+. Please gamble responsibly.
        </p>
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.9rem',
          }}
        >
          <Link href="/legal/terms" style={{ color: '#9aa4b2' }}>
            Terms of Service
          </Link>
          <Link href="/legal/privacy" style={{ color: '#9aa4b2' }}>
            Privacy Policy
          </Link>
          <Link href="/blog" style={{ color: '#9aa4b2' }}>
            Blog
          </Link>
        </nav>
        <p style={{ margin: '1rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
          © {new Date().getFullYear()} Overlay Bets. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
