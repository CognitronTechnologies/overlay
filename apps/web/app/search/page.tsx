import { Suspense } from 'react';
import type { Metadata } from 'next';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
  title: 'Search — Overlay Picks',
  description: 'Search verified tipsters, guides and news across Overlay Picks.',
};

// useSearchParams (in SearchClient) needs a Suspense boundary for prerender.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchClient />
    </Suspense>
  );
}
