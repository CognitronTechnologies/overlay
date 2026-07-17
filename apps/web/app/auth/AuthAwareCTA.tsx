'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProfile } from '../../lib/auth';

export default function AuthAwareCTA() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const profile = await getProfile();

      if (!mounted) return;

      setSignedIn(profile !== null);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return null;
  }

  if (signedIn) {
    return (
      <Link
        href="/tipsters"
        className="btn btn--primary btn--lg"
      >
        Browse verified tipsters
      </Link>
    );
  }

  return (
    <Link
      href="/signup"
      className="btn btn--primary btn--lg"
    >
      Create your free account
    </Link>
  );
}