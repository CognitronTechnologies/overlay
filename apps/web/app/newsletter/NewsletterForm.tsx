'use client';

import { useState } from 'react';

type FormState = {
  email: string;
};

export default function NewsletterForm() {
  const [form, setForm] = useState<FormState>({
    email: '',
  });

  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setStatus('loading');

    try {
      /*
        Future API integration:

        await fetch('/api/newsletter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        });
      */

      console.log(form);

      setStatus('success');

      setForm({
        email: '',
      });
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gap: '1.25rem',
        }}
      >
        <label
          style={{
            display: 'grid',
            gap: '.4rem',
            fontWeight: 500,
          }}
        >
          Email address

          <input
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          className="btn btn--primary btn--lg"
          disabled={status === 'loading'}
        >
          {status === 'loading'
            ? 'Subscribing...'
            : 'Subscribe'}
        </button>
      </form>

      {status === 'success' && (
        <p
          style={{
            marginTop: '1.5rem',
            color: 'var(--accent)',
          }}
        >
          Thanks for subscribing! We'll keep you updated.
        </p>
      )}

      {status === 'error' && (
        <p
          style={{
            marginTop: '1.5rem',
            color: 'var(--danger)',
          }}
        >
          Something went wrong. Please try again.
        </p>
      )}

      <section
        style={{
          marginTop: '3rem',
          borderTop: '1px solid var(--border)',
          paddingTop: '2rem',
        }}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            marginBottom: '.75rem',
          }}
        >
          What you'll receive
        </h2>

        <ul
          style={{
            paddingLeft: '1.2rem',
            lineHeight: 1.8,
            color: 'var(--muted)',
          }}
        >
          <li>Verified tipster marketplace updates</li>
          <li>Platform feature announcements</li>
          <li>Closing Line Value (CLV) education</li>
          <li>Sports betting analytics articles</li>
          <li>Responsible gambling resources</li>
        </ul>
      </section>
    </>
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: '.5rem',
  padding: '.8rem 1rem',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '1rem',
  boxSizing: 'border-box' as const,
};