import { Suspense } from 'react';
import WelcomeClient from './WelcomeClient';

// useSearchParams (in WelcomeClient) requires a Suspense boundary for the
// static prerender/CSR-bailout.
export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeClient />
    </Suspense>
  );
}
