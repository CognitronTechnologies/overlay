'use client';

import { useState } from 'react';
import { signInWithOAuth } from '../lib/auth';

/**
 * "Continue with Google" button. Kicks off the Supabase OAuth redirect flow;
 * the browser returns to /auth/callback, which establishes the session and
 * routes the user by role. Shared by the login and signup pages.
 */
export default function GoogleSignInButton({
  label = 'Continue with Google',
  role,
}: {
  label?: string;
  role?: 'user' | 'tipster';
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      // On success the browser is redirected away, so this promise resolves
      // only once the redirect is initiated.
      await signInWithOAuth('google', role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          background: 'var(--surface)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.7rem 1.4rem',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          width: '100%',
        }}
      >
        <GoogleGlyph />
        {loading ? 'Redirecting…' : label}
      </button>
      {error ? (
        <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
      ) : null}
    </>
  );
}

/** Official multi-colour Google "G" mark. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Small "or" divider used between the OAuth button and the email form. */
export function OrDivider() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--muted)',
        fontSize: '0.85rem',
        margin: '0.25rem 0',
      }}
    >
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      or
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
