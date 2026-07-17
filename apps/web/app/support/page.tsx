'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  submitFeedback,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from '../../lib/auth';

type FaqItem = { q: string; a: React.ReactNode };

const GENERAL_FAQ: FaqItem[] = [
  {
    q: 'What is Overlay Bets?',
    a: (
      <>
        A verified tipster marketplace. Tipsters post picks that are locked and
        timestamped before kickoff and settled automatically from the result, so
        their track records can’t be faked. Bettors follow the ones with real,
        provable edge. See{' '}
        <Link href="/about" style={{ color: 'var(--accent)' }}>
          About &amp; how it works
        </Link>{' '}
        for the full picture.
      </>
    ),
  },
  {
    q: 'Is my personal data safe?',
    a: (
      <>
        Yes. We only collect what we need to run your account, and you can export
        or delete your data at any time from your account settings. See our{' '}
        <Link href="/legal/privacy" style={{ color: 'var(--accent)' }}>
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: 'How do I get in touch?',
    a: 'Use the “Contact us” form at the bottom of this page — pick a topic, add your message, and (optionally) your email so we can reply.',
  },
];

const USER_FAQ: FaqItem[] = [
  {
    q: 'Is there a fee for bettors?',
    a: 'No — browsing tipsters, viewing the leaderboard and reading the free daily tips are all free. You only pay when you subscribe to a tipster to see their live picks.',
  },
  {
    q: 'How do subscriptions and billing work?',
    a: (
      <>
        You subscribe to a tipster to see their live picks. Manage or cancel any
        subscription from{' '}
        <Link href="/account/subscriptions" style={{ color: 'var(--accent)' }}>
          My subscriptions
        </Link>{' '}
        via the secure billing portal. If a subscription is close to expiring,
        you’ll see a notice there.
      </>
    ),
  },
  {
    q: 'How do I raise a complaint or leave feedback about a tipster?',
    a: (
      <>
        Open{' '}
        <Link href="/account/subscriptions" style={{ color: 'var(--accent)' }}>
          My subscriptions
        </Link>{' '}
        and use <strong>Give feedback</strong> on the tipster in question — you
        can leave praise or report an issue. This is available for tipsters you
        subscribe to, and our team reviews every complaint.
      </>
    ),
  },
  {
    q: 'How do I know a tipster’s track record is real?',
    a: 'Every pick is hashed and timestamped the moment it’s posted — before kickoff — then settled automatically from the official result. Records can’t be edited, deleted or backdated, so the yield and closing line value you see are real.',
  },
];

const TIPSTER_FAQ: FaqItem[] = [
  {
    q: 'How do I become a tipster?',
    a: (
      <>
        <Link href="/signup" style={{ color: 'var(--accent)' }}>
          Create an account
        </Link>{' '}
        as a tipster and complete onboarding (profile, sports, pricing and
        payout details). Once set up you can post picks and get paid by
        subscribers.
      </>
    ),
  },
  {
    q: 'What fees does Overlay Bets charge?',
    a: 'Overlay Bets takes a platform fee on tipster subscription revenue (currently 25%). You keep the rest of what your subscribers pay.',
  },
  {
    q: 'When and how do I get paid?',
    a: 'Payouts are processed weekly, every Tuesday. You can also request an off-schedule (on-demand) payout of your available balance from your dashboard — those are released once an admin approves them.',
  },
  {
    q: 'How are my picks verified?',
    a: 'When you post a pick it’s hashed and locked before kickoff, then graded automatically from the official result. That’s what makes your record provable — and impossible to fake.',
  },
];

const CATEGORIES = Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[];

export default function SupportPage() {
  const [category, setCategory] = useState<FeedbackCategory>('question');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const inputStyle: React.CSSProperties = {
    padding: '0.6rem 0.7rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--fg)',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box',
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await submitFeedback(category, message, email.trim() || undefined);
      setOk(true);
      setMsg('Thanks — your message has reached our team.');
      setMessage('');
    } catch (err) {
      setOk(false);
      setMsg(err instanceof Error ? err.message : 'Could not send your message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '3.5rem 1.5rem' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Support Center</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Answers to common questions — plus a direct line to our team.
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>General</h2>
        <div style={{ marginTop: '0.75rem' }}>
          {GENERAL_FAQ.map((item) => (
            <details
              key={item.q}
              style={{
                borderTop: '1px solid var(--border)',
                padding: '0.9rem 0',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {item.q}
              </summary>
              <div style={{ color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '2.25rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>For users</h2>
        <div style={{ marginTop: '0.75rem' }}>
          {USER_FAQ.map((item) => (
            <details
              key={item.q}
              style={{
                borderTop: '1px solid var(--border)',
                padding: '0.9rem 0',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {item.q}
              </summary>
              <div style={{ color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '2.25rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>For tipsters</h2>
        <div style={{ marginTop: '0.75rem' }}>
          {TIPSTER_FAQ.map((item) => (
            <details
              key={item.q}
              style={{
                borderTop: '1px solid var(--border)',
                padding: '0.9rem 0',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {item.q}
              </summary>
              <div style={{ color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Contact us / product feedback</h2>
        <p style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
          Have a question, a suggestion, or found a bug? Send it straight to the
          team.
        </p>
        <p style={{ margin: '0.5rem 0 1rem' }}>
          <a
            href="https://wa.me/447576532267"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary btn--sm"
            style={{ gap: '0.45rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 01-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.42 9.42 0 01-1.44-5.02c0-5.2 4.24-9.43 9.46-9.43 2.53 0 4.9.99 6.69 2.78a9.36 9.36 0 012.77 6.67c0 5.2-4.24 9.44-9.46 9.44zm8.05-17.5A11.32 11.32 0 0012.04.5C5.77.5.68 5.58.68 11.84c0 2 .52 3.95 1.52 5.67L.6 23.5l6.14-1.61a11.34 11.34 0 005.3 1.35h.01c6.27 0 11.36-5.09 11.36-11.35 0-3.03-1.18-5.88-3.32-8.02z" />
            </svg>
            Chat on WhatsApp
          </a>
        </p>
        <form
          onSubmit={send}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', maxWidth: 520 }}
        >
          <label style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Topic
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              style={{ ...inputStyle, marginTop: '0.3rem' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {FEEDBACK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <textarea
            placeholder="How can we help?"
            value={message}
            maxLength={4000}
            required
            onChange={(e) => setMessage(e.target.value)}
            style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
          />
          <input
            type="email"
            placeholder="Your email (optional, so we can reply)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <div>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send message'}
            </button>
          </div>
          {msg ? (
            <p style={{ color: ok ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
              {msg}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
