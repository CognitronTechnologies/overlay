import type { Metadata } from 'next';
import SportsDiscovery from './SportsDiscovery';

export const metadata: Metadata = {
  title: 'Sports & Odds — Overlay Picks',
  description:
    'Browse live and upcoming sports events, compare bookmaker odds across markets, and follow scores in real time.',
  alternates: { canonical: '/sports' },
};

export default function SportsPage() {
  return (
    <main style={{ padding: '3rem 1.5rem 4rem' }}>
      <SportsDiscovery />
    </main>
  );
}
