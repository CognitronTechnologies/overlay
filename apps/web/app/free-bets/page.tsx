'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { API_URL } from '../../lib/api';

/* ──────────────────────────────────────────────────────────────────────────
   Types (derived from Prisma schema's Bookmaker + AffiliateOffer)
   ──────────────────────────────────────────────────────────────────────── */

interface AffiliateOffer {
  id: string;
  bookmakerId: string;
  title: string;
  description: string | null;
  cta: string | null;
  destinationUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Bookmaker {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string;
  destinationUrl: string | null;
  trackingParams: string | null;
  promoCode: string | null;
  promoCodeDescription: string | null;
  description: string | null;
  welcomeOffer: string | null;
  termsSummary: string | null;
  rating: number | null;
  isFeatured: boolean;
  isActive: boolean;
  supportedCountries: string[];
  displayOrder: number;
  offers: AffiliateOffer[];
  createdAt: string;
  updatedAt: string;
}

interface FreeBetsPageData {
  featured: Bookmaker[];
  bookmakers: Bookmaker[];
  disclosure: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Styles (inline, consistent with PrivacyPage)
   ──────────────────────────────────────────────────────────────────────── */

const container: React.CSSProperties = {
  maxWidth: 1000,
  margin: '0 auto',
  padding: '3rem 1.5rem',
};

const section: React.CSSProperties = {
  marginTop: '4rem',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '1.7rem',
  marginBottom: '1rem',
  color: 'var(--fg)',
};

const cardGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '1.25rem',
};

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
};

const pill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '0.2rem 0.55rem',
  borderRadius: 6,
  background: 'var(--accent)',
  color: 'var(--on-accent)',
};

const ctaButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.6rem 1.4rem',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.9rem',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  textDecoration: 'none',
  transition: 'background 0.15s',
  border: 'none',
  cursor: 'pointer',
};

const errorBox: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--danger)',
  borderRadius: 10,
  padding: '2rem',
  textAlign: 'center',
  color: 'var(--danger)',
};

const faqItem: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  padding: '1rem 0',
};

const faqQuestion: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '1rem',
  marginBottom: '0.35rem',
  color: 'var(--fg)',
  cursor: 'pointer',
};

const badge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.2rem 0.5rem',
  borderRadius: 6,
  background: 'var(--success)',
  color: '#fff',
};

const compareTable: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.88rem',
};

const compareTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  borderBottom: '2px solid var(--border)',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const compareTd: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  color: 'var(--fg)',
  verticalAlign: 'middle',
};


//  Accordion state component
function Accordion({ title, children, defaultOpen = false, }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={faqItem}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...faqQuestion,
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 0,
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        {title}
        <span style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ color: 'var(--muted)', lineHeight: 1.7, marginTop: '0.4rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

//  Loading skeleton

function SkeletonBlock({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 10,
        background: 'var(--surface-2)',
        animation: 'freeBetsPulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

//  Page component

export default function FreeBetsPage() {
  const [data, setData] = useState<FreeBetsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/affiliates/free-bets`);

      if (!res.ok) {
        throw new Error(`Failed to load (${res.status})`);
      }

      const json: FreeBetsPageData = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Something went wrong',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

    const trackAffiliateClick = useCallback(
    async (
      slug: string,
      source: string,
      offerId?: string,
    ) => {
      try {
        const country =
          typeof navigator !== 'undefined'
            ? (() => {
                try {
                  return new Intl.Locale(navigator.language).region;
                } catch {
                  const parts = navigator.language?.split('-');
                  return parts?.[1];
                }
              })()
            : undefined;

        await fetch(`${API_URL}/api/affiliates/${slug}/click`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source,
            page: '/free-bets',
            offerId,
            country,
          }),
        });
      } catch {
        // Fire-and-forget.
        // Never prevent the user from navigating to the bookmaker.
      }
    },
    [],
  );

  /* ── ratings helpers ──────────────────────────────────────────────── */

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const stars: string[] = [];
    for (let i = 0; i < full; i++) stars.push('★');
    if (half) stars.push('½');
    while (stars.length < 5) stars.push('☆');
    return stars.join('');
  };

  /* ── derive categories ──────────────────────────────────────────────── */

  const categories = data
    ? [
        ...new Set(
          data.bookmakers
            .flatMap((b) => b.offers.map((o) => o.title))
            .filter(Boolean),
        ),
      ].slice(0, 6)
    : [];

  /* ── derived counts ──────────────────────────────────────────────── */

  const totalOffers = data
    ? data.bookmakers.reduce((sum, b) => sum + b.offers.length, 0)
    : 0;

  const avgRating = data
    ? data.bookmakers.reduce((sum, b) => sum + (b.rating ?? 0), 0) /
      data.bookmakers.filter((b) => b.rating != null).length || 0
    : 0;

  /* ── render ──────────────────────────────────────────────────────── */

  return (
    <main style={container}>
      {/* inject keyframes for skeleton pulse */}
      <style>{`
        @keyframes freeBetsPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* ──── Loading ──────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SkeletonBlock height={200} />
          <SkeletonBlock height={80} />
          <SkeletonBlock height={300} />
          <SkeletonBlock height={200} />
        </div>
      )}

      {/* ──── Error ────────────────────────────────────────────── */}
      {error && !loading && (
        <div style={errorBox}>
          <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Unable to load free bets
          </p>
          <p style={{ color: 'var(--muted)', margin: 0 }}>{error}</p>
          <button
            onClick={fetchData}
            style={{
              ...ctaButton,
              marginTop: '1rem',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ──── Content ──────────────────────────────────────────── */}
      {data && !loading && (
        <>
          {/* ════════════════════════════════════════════════════════
              Hero
              ════════════════════════════════════════════════════════ */}
          <section
            style={{
              textAlign: 'center',
              padding: '3rem 0 2rem',
            }}
          >
            <h1 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', color: 'var(--fg)' }}>
              Best Free Bets & Sign-Up Offers
            </h1>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '1.05rem',
                maxWidth: 640,
                margin: '0 auto 1.5rem',
                lineHeight: 1.6,
              }}
            >
              Compare the top bookmaker welcome bonuses, free bet offers, and
              promo codes — all in one place. Updated daily.
            </p>
            {data.featured.length > 0 && (
              <a
                href={
                  data.featured[0].destinationUrl || data.featured[0].website
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAffiliateClick(data.featured[0].slug, 'HERO_CTA')}
                style={{
                  ...ctaButton,
                  fontSize: '1rem',
                  padding: '0.75rem 2rem',
                }}
              >
                Claim Top Offer — {data.featured[0].name}
              </a>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════
              Trust Banner
              ════════════════════════════════════════════════════════ */}
          <section
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              marginTop: '1rem',
            }}
          >
            {[
              { label: `${data.bookmakers.length} bookmakers`, icon: '🏦' },
              { label: `${totalOffers} active offers`, icon: '🎁' },
              { label: `${Math.round(avgRating * 10) / 10} avg rating`, icon: '⭐' },
              { label: 'Updated daily', icon: '🔄' },
            ].map((item) => (
              <span
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                {item.label}
              </span>
            ))}
          </section>

          {/* ════════════════════════════════════════════════════════
              Overlay Bets Picks — Featured Cards
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <h2 style={sectionTitle}>🏆 Overlay Bets Picks</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.25rem' }}>
              Our editors hand-pick the best offers based on value, reputation,
              and terms.
            </p>

            {data.featured.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                No featured offers available right now. Check back soon.
              </p>
            ) : (
              <div style={cardGrid}>
                {data.featured.map((bm) => (
                  <div key={bm.id} style={{ ...card, borderColor: 'var(--accent)' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      {bm.logo && (
                        <img
                          src={bm.logo}
                          alt={`${bm.name} logo`}
                          style={{ height: 32, width: 'auto', objectFit: 'contain' }}
                        />
                      )}
                      <span style={pill}>Featured</span>
                    </div>

                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--fg)' }}>
                      {bm.name}
                    </h3>

                    {bm.welcomeOffer && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.88rem',
                          color: 'var(--success)',
                          fontWeight: 600,
                        }}
                      >
                        {bm.welcomeOffer}
                      </p>
                    )}

                    {bm.promoCode && (
                      <div
                        style={{
                          background: 'var(--surface-2)',
                          padding: '0.4rem 0.7rem',
                          borderRadius: 6,
                          fontSize: '0.82rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--muted)' }}>Promo code</span>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: 'var(--fg)',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {bm.promoCode}
                        </span>
                      </div>
                    )}

                    {bm.promoCodeDescription && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.78rem',
                          color: 'var(--muted)',
                        }}
                      >
                        {bm.promoCodeDescription}
                      </p>
                    )}

                    {bm.rating != null && (
                      <span style={{ color: 'var(--warning)', fontSize: '0.95rem' }}>
                        {renderStars(bm.rating)}
                      </span>
                    )}

                    <a
                      href={bm.destinationUrl || bm.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackAffiliateClick(bm.slug, 'FEATURED_CARD', bm.offers[0]?.id)}
                      style={{
                        ...ctaButton,
                        marginTop: 'auto',
                      }}
                    >
                      {bm.offers[0]?.cta || 'Claim Bonus'}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════
              Comparison Table
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <h2 style={sectionTitle}>📊 All Bookmaker Offers</h2>

            {data.bookmakers.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                No bookmakers available in your region at this time.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={compareTable}>
                  <thead>
                    <tr>
                      <th style={compareTh}>Bookmaker</th>
                      <th style={compareTh}>Welcome Offer</th>
                      <th style={compareTh}>Rating</th>
                      <th style={compareTh}>Promo Code</th>
                      <th style={compareTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookmakers.map((bm) => (
                      <tr key={bm.id}>
                        <td style={compareTd}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            {bm.logo && (
                              <img
                                src={bm.logo}
                                alt=""
                                style={{
                                  height: 24,
                                  width: 24,
                                  objectFit: 'contain',
                                  borderRadius: 4,
                                }}
                              />
                            )}
                            <span style={{ fontWeight: 600 }}>{bm.name}</span>
                            {bm.isFeatured && (
                              <span style={{ ...badge, background: 'var(--accent)', color: 'var(--on-accent)' }}>
                                Pick
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={compareTd}>
                          {bm.welcomeOffer ? (
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                              {bm.welcomeOffer}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...compareTd, whiteSpace: 'nowrap' }}>
                          {bm.rating != null ? (
                            <span style={{ color: 'var(--warning)' }}>
                              {renderStars(bm.rating)} {bm.rating.toFixed(1)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={compareTd}>
                          {bm.promoCode ? (
                            <code
                              style={{
                                background: 'var(--surface-2)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: 4,
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {bm.promoCode}
                            </code>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={compareTd}>
                          <a
                            href={bm.destinationUrl || bm.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackAffiliateClick(bm.slug, 'COMPARE_TABLE')}
                            style={{
                              ...ctaButton,
                              fontSize: '0.8rem',
                              padding: '0.4rem 1rem',
                            }}
                          >
                            {bm.offers[0]?.cta || 'Claim'}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════
              Offer Categories
              ════════════════════════════════════════════════════════ */}
          {categories.length > 0 && (
            <section style={section}>
              <h2 style={sectionTitle}>🎯 Offer Categories</h2>
              <div style={cardGrid}>
                {categories.slice(0, 6).map((cat, i) => {
                  const bmsForCat = data.bookmakers.filter((b) =>
                    b.offers.some((o) => o.title === cat),
                  );
                  return (
                    <div key={`${cat}-${i}`} style={card}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '0.95rem',
                          color: 'var(--fg)',
                        }}
                      >
                        {cat}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                        {bmsForCat.length} bookmaker{bmsForCat.length !== 1 ? 's' : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto' }}>
                        {bmsForCat.slice(0, 4).map((b) => (
                          <span
                            key={b.id}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: 4,
                              background: 'var(--surface-2)',
                              color: 'var(--muted)',
                            }}
                          >
                            {b.name}
                          </span>
                        ))}
                        {bmsForCat.length > 4 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                            +{bmsForCat.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════
              Recommendation Methodology
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <h2 style={sectionTitle}>📋 How We Rank Offers</h2>
            <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
              <p>
                Every offer on Overlay Bets is reviewed against the same criteria so you
                can compare with confidence. We update our rankings regularly based on:
              </p>
              <ul style={{ paddingLeft: '1.25rem' }}>
                <li>
                  <strong style={{ color: 'var(--fg)' }}>Bonus value</strong> — the
                  real-money equivalent of the free bet or deposit match.
                </li>
                <li>
                  <strong style={{ color: 'var(--fg)' }}>Wagering requirements</strong> —
                  how many times you need to play through before withdrawing.
                </li>
                <li>
                  <strong style={{ color: 'var(--fg)' }}>Minimum odds</strong> — whether
                  qualifying bets need long-odds picks or accept short-priced markets.
                </li>
                <li>
                  <strong style={{ color: 'var(--fg)' }}>Expiry and restrictions</strong>
                  — how long the offer lasts and which sports or markets are excluded.
                </li>
                <li>
                  <strong style={{ color: 'var(--fg)' }}>User experience</strong> — ease
                  of claiming, payment methods, and withdrawal speed.
                </li>
                <li>
                  <strong style={{ color: 'var(--fg)' }}>Reputation</strong> — licensing,
                  regulatory standing, and real-user feedback.
                </li>
              </ul>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              Educational Accordions
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <h2 style={sectionTitle}>💡 Free Bets Explained</h2>
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 12,
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
              }}
            >
              <Accordion title="What is a free bet?">
                A free bet is a promotional credit a bookmaker gives you — typically
                when you sign up or deposit. If your free bet wins, you keep the
                winnings (minus the stake). If it loses, you lose nothing.
              </Accordion>
              <Accordion title="How do matched betting and bonus hunting work?">
                Matched betting uses a back-lay strategy to turn free bets into
                guaranteed profit. Bonus hunting simply means signing up to multiple
                bookmakers to collect several welcome offers. Both are legal, but always
                read the terms first.
              </Accordion>
              <Accordion title="What are wagering requirements?">
                Wagering requirements (or playthrough) dictate how many times you must
                bet the bonus amount before you can withdraw. For example, a 10×
                requirement on a $10 bonus means you need $100 in total bets before
                cashing out.
              </Accordion>
              <Accordion title="Do free bets expire?">
                Yes — most offers have a validity period, usually 7–30 days from
                activation. Always check the expiry date so you don't miss out.
              </Accordion>
              <Accordion title="Can I withdraw a free bet immediately?">
                No — free bet credit is non-withdrawable. You must use it to place a
                qualifying bet first; only the resulting winnings (if any) can be
                withdrawn.
              </Accordion>
              <Accordion title="Are free bets available in my country?">
                Availability varies by jurisdiction. We show offers that match your
                region (detected automatically). If you don't see many offers,
                it may be because your country's regulations restrict certain
                promotions.
              </Accordion>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              Responsible Gambling
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <h2 style={sectionTitle}>🛡️ Responsible Gambling</h2>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '1.5rem',
                color: 'var(--muted)',
                lineHeight: 1.7,
              }}
            >
              <p>
                Free bets and bonuses are promotional tools — they should enhance your
                enjoyment of sports betting, not replace it. Betting carries financial
                risk and can be addictive. Please gamble responsibly.
              </p>
              <ul style={{ paddingLeft: '1.25rem' }}>
                <li>Set a budget and never chase losses.</li>
                <li>Use deposit limits and time-out tools offered by bookmakers.</li>
                <li>
                  If you need help, contact{' '}
                  <a
                    href="https://www.begambleaware.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)' }}
                  >
                    BeGambleAware
                  </a>{' '}
                  or{' '}
                  <a
                    href="https://www.gamcare.org.uk"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)' }}
                  >
                    GamCare
                  </a>
                  .
                </li>
              </ul>
              <p style={{ marginBottom: 0 }}>
                <Link
                  href="/legal/responsible-gambling"
                  style={{ color: 'var(--accent)' }}
                >
                  Read our full responsible gambling guide →
                </Link>
              </p>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              Affiliate Disclosure
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <div
              style={{
                fontSize: '0.82rem',
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1rem 1.25rem',
                background: 'var(--surface)',
                lineHeight: 1.6,
              }}
            >
              {data.disclosure}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              FAQ
              ════════════════════════════════════════════════════════ */}
          <section style={section}>
            <h2 style={sectionTitle}>❓ Frequently Asked Questions</h2>
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 12,
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
              }}
            >
              <Accordion title="How do I claim a free bet offer?">
                Click the &ldquo;Claim Bonus&rdquo; button on any card or table row.
                You'll be taken to the bookmaker's site where you can sign up
                (or log in) and opt into the promotion. Follow their on-screen
                instructions to complete the qualifying steps.
              </Accordion>
              <Accordion title="Are these offers legit?">
                Yes. We partner only with licensed, regulated bookmakers. Every offer
                listed is a genuine promotional deal vetted by our editorial team.
              </Accordion>
              <Accordion title="How often do you update the free bets page?">
                Daily. Our team monitors bookmaker promotions and updates offers,
                ratings, and rankings as soon as changes are published.
              </Accordion>
              <Accordion title="Can I stack multiple free bet offers?">
                Absolutely — many bettors claim offers from several bookmakers to
                maximise value. Just be sure to meet each offer's terms
                independently.
              </Accordion>
              <Accordion title="What if an offer doesn't work?">
                Promotions can be geo-restricted or time-limited. If an offer doesn't
                appear on the bookmaker's site, double-check the terms. Contact us
                and we'll verify and update the listing.
              </Accordion>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              Final CTA
              ════════════════════════════════════════════════════════ */}
          <section
            style={{
              ...section,
              textAlign: 'center',
              padding: '3rem 0',
            }}
          >
            <h2 style={{ fontSize: '1.6rem', color: 'var(--fg)', marginBottom: '0.75rem' }}>
              Ready to get started?
            </h2>
            <p
              style={{
                color: 'var(--muted)',
                maxWidth: 500,
                margin: '0 auto 1.5rem',
                lineHeight: 1.6,
              }}
            >
              Pick your favourite offer, sign up in minutes, and start betting with
              free credits — no risk required.
            </p>
            {data.featured.length > 0 && (
              <a
                href={
                  data.featured[0].destinationUrl || data.featured[0].website
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAffiliateClick(data.featured[0].slug, 'FINAL_CTA')}
                style={{
                  ...ctaButton,
                  fontSize: '1.05rem',
                  padding: '0.85rem 2.5rem',
                }}
              >
                Claim {data.featured[0].name} Bonus
              </a>
            )}
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {data.disclosure}
            </p>
          </section>
        </>
      )}
    </main>
  );
}