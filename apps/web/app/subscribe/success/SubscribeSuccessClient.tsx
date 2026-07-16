'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authFetch } from '../../../lib/auth';

/**
 * Post-checkout return screen. With a real payment provider the subscription is
 * activated asynchronously by the provider's *verified* webhook — the browser
 * never grants its own entitlement. For local/staging with the mock provider
 * (no real processor to call back), we self-confirm via an authenticated,
 * self-scoped dev endpoint that is hard-disabled in production.
 *
 * Preferred param: t=<tipsterId>. Legacy fallback: ref=mock_sub_<userId>_<tipsterId>.
 */
export default function SubscribeSuccessClient() {
  const params = useSearchParams();
  const [state, setState] = useState<'working' | 'done' | 'pending'>('working');

  useEffect(() => {
    let tipsterId = params.get('t');

    // Legacy ref fallback: mock_sub_<userId>_<tipsterId>.
    if (!tipsterId) {
      const ref = params.get('ref');
      const parts = ref?.split('_') ?? [];
      if (parts[0] === 'mock' && parts[1] === 'sub') {
        tipsterId = parts[3] ?? null;
      }
    }

    // No tipster context (e.g. a real provider redirect) → the signed webhook
    // activates the subscription; just show a pending confirmation.
    if (!tipsterId) {
      setState('pending');
      return;
    }

    // Dev-only self-confirmation. The user id comes from the auth token, never
    // the URL; production returns 403 and we fall back to the pending message.
    authFetch('/api/subscriptions/dev-confirm', {
      method: 'POST',
      body: JSON.stringify({ tipsterId }),
    })
      .then((r) => setState(r.ok ? 'done' : 'pending'))
      .catch(() => setState('pending'));
  }, [params]);

  return (
    <>
      <h1>{state === 'done' ? 'You’re subscribed 🎉' : 'Finishing up…'}</h1>
      <p style={{ color: 'var(--muted)' }}>
        {state === 'done'
          ? 'Your subscription is active. You now get this tipster’s live picks the moment they’re locked.'
          : state === 'pending'
            ? 'Your subscription is being activated. It will appear on your account shortly.'
            : 'Confirming your subscription…'}
      </p>
      <p>
        <Link href="/account" style={{ color: 'var(--accent)' }}>
          → Go to your account
        </Link>
      </p>
    </>
  );
}
