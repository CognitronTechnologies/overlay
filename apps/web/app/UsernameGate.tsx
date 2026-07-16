'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getFullProfile } from '../lib/auth';

// Pages that must remain reachable without a username (auth + the setup step).
const EXEMPT = [
  '/welcome',
  '/login',
  '/signup',
  '/auth',
  '/forgot-password',
  '/reset-password',
];

/**
 * Enforces the mandatory username. Any authenticated account without a username
 * is redirected to /welcome to choose one before using the rest of the app.
 * Unauthenticated visitors are untouched. Renders nothing.
 */
export default function UsernameGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    if (EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }
    let active = true;
    getFullProfile().then((p) => {
      if (active && p && !p.username) {
        router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
      }
    });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return null;
}
