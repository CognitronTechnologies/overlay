import type { Metadata } from 'next';
import SportsDiscovery from './SportsDiscovery';

export const metadata: Metadata = {
  title: 'Sports & Odds — Overlay Bets',
  description:
    'Browse live and upcoming sports events, compare bookmaker odds across markets, and follow scores in real time.',
  alternates: { canonical: '/sports' },
};

export default function SportsPage() {
  return <SportsDiscovery />;
}
