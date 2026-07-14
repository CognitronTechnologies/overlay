'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authFetch, getProfile } from '../../lib/auth';
import { API_URL } from '../../lib/api';
import type { OnboardingStatus, PerformanceDashboard } from '../../lib/api';
import { formStyles } from '../formStyles';
import PerformanceDashboardView from '../PerformanceDashboard';

interface EventRow {
  id: string;
  sport: string;
  league: string | null;
  home: string;
  away: string;
  startTime: string;
}

interface Pick {
  id: string;
  market: string;
  selection: string;
  oddsAtPick: number;
  status: string;
  clv: number | null;
}

/** Market + best prices per selection, for the odds-driven pick form. */
interface MarketOdds {
  market: string;
  prices: Record<string, number>;
}

const MARKETS = [
  '1X2',
  'moneyline',
  'dnb',
  'double_chance',
  'btts',
  'spreads',
  'totals',
  'team_totals',
  'odd_even',
  'correct_score',
];

// Per-market guidance for the selection field so picks match the grader's
// expected format (see packages/shared/src/grading.ts).
const SELECTION_HINTS: Record<string, string> = {
  '1X2': 'home, draw or away',
  moneyline: 'home or away',
  dnb: 'home or away (draw no bet)',
  double_chance: '1X, 12 or X2',
  btts: 'yes or no (both teams to score)',
  spreads: 'e.g. home -1.5, away +0.25 (Asian OK)',
  totals: 'e.g. over 2.5 or under 3',
  team_totals: 'e.g. home over 1.5',
  odd_even: 'odd or even',
  correct_score: 'e.g. 2-1',
};

export default function DashboardPage() {
  const router = useRouter();
  const [tipsterId, setTipsterId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [performance, setPerformance] = useState<PerformanceDashboard | null>(
    null,
  );
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    eventId: '',
    market: '1X2',
    selection: '',
    oddsAtPick: '2.00',
    stakeUnits: '1',
    note: '',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pick-form discovery: filters + odds-driven selection.
  const [filters, setFilters] = useState<{
    sports: string[];
    leagues: Record<string, string[]>;
  }>({ sports: [], leagues: {} });
  const [fSport, setFSport] = useState('');
  const [fLeague, setFLeague] = useState('');
  const [fQuery, setFQuery] = useState('');
  const [eventOdds, setEventOdds] = useState<MarketOdds[] | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);

  const loadPicks = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/api/picks/tipster/${id}`);
    if (res.ok) setPicks((await res.json()) as Pick[]);
  }, []);

  const loadPerformance = useCallback(async () => {
    try {
      const res = await authFetch('/api/picks/me/performance');
      if (res.ok) setPerformance((await res.json()) as PerformanceDashboard);
    } catch {
      setPerformance(null);
    }
  }, []);

  const loadOnboarding = useCallback(async () => {
    try {
      const res = await authFetch('/api/tipsters/me/onboarding');
      if (res.ok) setOnboarding((await res.json()) as OnboardingStatus);
    } catch {
      setOnboarding(null);
    }
  }, []);

  const loadSubscribers = useCallback(async () => {
    try {
      const res = await authFetch('/api/tipsters/me/subscribers');
      if (res.ok) {
        const { count } = (await res.json()) as { count: number };
        setSubscriberCount(count);
      }
    } catch {
      setSubscriberCount(null);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/events/filters`);
      if (res.ok) {
        setFilters(
          (await res.json()) as {
            sports: string[];
            leagues: Record<string, string[]>;
          },
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadEvents = useCallback(
    async (sport: string, league: string, q: string) => {
      const qs = new URLSearchParams();
      if (sport) qs.set('sport', sport);
      if (league) qs.set('league', league);
      if (q.trim()) qs.set('q', q.trim());
      try {
        const res = await fetch(`${API_URL}/api/events/upcoming?${qs.toString()}`);
        setEvents(res.ok ? ((await res.json()) as EventRow[]) : []);
      } catch {
        setEvents([]);
      }
    },
    [],
  );

  /** Load an event's live markets/odds and default the form to the first line. */
  const loadEventOdds = useCallback(async (eventId: string) => {
    if (!eventId) {
      setEventOdds(null);
      return;
    }
    setOddsLoading(true);
    try {
      const res = await authFetch(`/api/events/${eventId}/odds`);
      const odds = res.ok ? ((await res.json()) as MarketOdds[]) : [];
      setEventOdds(odds);
      if (odds.length > 0) {
        const first = odds[0];
        const [sel, price] = Object.entries(first.prices)[0] ?? ['', 0];
        setForm((f) => ({
          ...f,
          market: first.market,
          selection: sel,
          oddsAtPick: price ? String(price) : f.oddsAtPick,
        }));
      }
    } catch {
      setEventOdds([]);
    } finally {
      setOddsLoading(false);
    }
  }, []);

  function selectEvent(eventId: string) {
    setForm((f) => ({ ...f, eventId, selection: '' }));
    loadEventOdds(eventId);
  }

  function selectMarket(market: string) {
    const prices = eventOdds?.find((m) => m.market === market)?.prices;
    if (prices) {
      const [sel, price] = Object.entries(prices)[0] ?? ['', 0];
      setForm((f) => ({
        ...f,
        market,
        selection: sel,
        oddsAtPick: price ? String(price) : f.oddsAtPick,
      }));
    } else {
      setForm((f) => ({ ...f, market, selection: '' }));
    }
  }

  function selectSelection(sel: string) {
    const price = eventOdds?.find((m) => m.market === form.market)?.prices[sel];
    setForm((f) => ({
      ...f,
      selection: sel,
      oddsAtPick: price ? String(price) : f.oddsAtPick,
    }));
  }

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile) {
        router.replace('/login');
        return;
      }
      if (profile.role !== 'tipster' || !profile.tipsterId) {
        router.replace('/account');
        return;
      }
      setTipsterId(profile.tipsterId);
      loadFilters();
      loadEvents('', '', '');
      loadPicks(profile.tipsterId);
      loadPerformance();
      loadOnboarding();
      loadSubscribers();
    })();
  }, [
    router,
    loadPicks,
    loadPerformance,
    loadOnboarding,
    loadSubscribers,
    loadFilters,
    loadEvents,
  ]);

  // Refetch the event list whenever the sport/league/search filter changes.
  useEffect(() => {
    if (tipsterId) loadEvents(fSport, fLeague, fQuery);
  }, [tipsterId, fSport, fLeague, fQuery, loadEvents]);

  async function submitPick(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!form.eventId) {
      setMsg('Pick an event first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch('/api/picks', {
        method: 'POST',
        body: JSON.stringify({
          eventId: form.eventId,
          market: form.market,
          selection: form.selection,
          oddsAtPick: Number(form.oddsAtPick),
          stakeUnits: Number(form.stakeUnits),
          note: form.note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? `Failed (${res.status})`);
      }
      setMsg('Pick locked ✓');
      setForm((f) => ({ ...f, selection: '', note: '' }));
      if (tipsterId) await loadPicks(tipsterId);
      await loadPerformance();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1>Tipster dashboard</h1>
      <p style={{ color: 'var(--muted)' }}>
        Picks are hash-locked and timestamped the moment you submit — before
        kickoff. That’s what makes your record verifiable.
      </p>

      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: '0.15rem',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '0.9rem 1.4rem',
          background: 'var(--surface)',
          margin: '0.5rem 0 1rem',
        }}
      >
        <span style={{ fontSize: '1.9rem', fontWeight: 700, lineHeight: 1 }}>
          {subscriberCount ?? '—'}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Active subscriber{subscriberCount === 1 ? '' : 's'}
        </span>
      </div>

      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/earnings" style={{ color: 'var(--accent)' }}>
          → Earnings &amp; payouts
        </Link>
      </p>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard/profile" style={{ color: 'var(--accent)' }}>
          → Edit public profile
        </Link>
      </p>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/admin/blog" style={{ color: 'var(--accent)' }}>
          → Write an article
        </Link>
      </p>

      <h2 style={{ marginTop: '2rem' }}>Submit a pick</h2>
      {onboarding && !onboarding.canPublish ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '1rem 1.2rem',
            background: 'var(--surface)',
          }}
        >
          <p style={{ margin: '0 0 0.5rem' }}>
            Finish onboarding ({onboarding.completedSteps}/
            {onboarding.totalSteps} steps) to unlock pick publishing.
          </p>
          <Link href="/onboarding" style={{ color: 'var(--accent)' }}>
            → Complete onboarding
          </Link>
        </div>
      ) : (
        <form
          onSubmit={submitPick}
          style={{ ...formStyles.form, maxWidth: 520 }}
        >
        {/* Narrow down: sport → league → search by team. */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            aria-label="Filter by sport"
            style={{ ...formStyles.input, flex: '1 1 140px' }}
            value={fSport}
            onChange={(e) => {
              setFSport(e.target.value);
              setFLeague('');
            }}
          >
            <option value="">All sports</option>
            {filters.sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by league"
            style={{ ...formStyles.input, flex: '1 1 140px' }}
            value={fLeague}
            onChange={(e) => setFLeague(e.target.value)}
            disabled={!fSport || !(filters.leagues[fSport]?.length)}
          >
            <option value="">All leagues</option>
            {(filters.leagues[fSport] ?? []).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <input
          style={formStyles.input}
          placeholder="Search teams…"
          value={fQuery}
          onChange={(e) => setFQuery(e.target.value)}
        />

        <label style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Event
          <select
            style={{ ...formStyles.input, marginTop: '0.35rem' }}
            value={form.eventId}
            onChange={(e) => selectEvent(e.target.value)}
          >
            <option value="">
              {events.length
                ? 'Select an event…'
                : 'No matching events'}
            </option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.home} vs {ev.away} — {new Date(ev.startTime).toLocaleString()}
              </option>
            ))}
          </select>
        </label>

        <label style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Market
          <select
            style={{ ...formStyles.input, marginTop: '0.35rem' }}
            value={form.market}
            onChange={(e) => selectMarket(e.target.value)}
          >
            {(eventOdds && eventOdds.length > 0
              ? eventOdds.map((m) => m.market)
              : MARKETS
            ).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {(() => {
          const prices = eventOdds?.find((m) => m.market === form.market)?.prices;
          const hasLiveOdds = !!prices && Object.keys(prices).length > 0;
          return (
            <label style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Selection
              {oddsLoading ? (
                <span style={{ marginLeft: '0.5rem' }}>· loading odds…</span>
              ) : null}
              {hasLiveOdds ? (
                <select
                  style={{ ...formStyles.input, marginTop: '0.35rem' }}
                  value={form.selection}
                  onChange={(e) => selectSelection(e.target.value)}
                  required
                >
                  <option value="">Choose a line…</option>
                  {Object.entries(prices!).map(([sel, price]) => (
                    <option key={sel} value={sel}>
                      {sel} @ {price.toFixed(2)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={{ ...formStyles.input, marginTop: '0.35rem' }}
                  placeholder={SELECTION_HINTS[form.market] ?? 'Selection'}
                  value={form.selection}
                  onChange={(e) =>
                    setForm({ ...form, selection: e.target.value })
                  }
                  required
                />
              )}
            </label>
          );
        })()}

        <label style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Odds{' '}
          {eventOdds && eventOdds.length > 0 ? (
            <span style={{ fontSize: '0.8rem' }}>
              (auto-filled from the live line — editable)
            </span>
          ) : null}
          <input
            style={{ ...formStyles.input, marginTop: '0.35rem' }}
            type="number"
            step="0.01"
            min="1.01"
            placeholder="Odds"
            value={form.oddsAtPick}
            onChange={(e) => setForm({ ...form, oddsAtPick: e.target.value })}
            required
          />
        </label>
        <input
          style={formStyles.input}
          type="number"
          step="0.1"
          min="0.1"
          placeholder="Stake (units)"
          value={form.stakeUnits}
          onChange={(e) => setForm({ ...form, stakeUnits: e.target.value })}
          required
        />
        <textarea
          style={{ ...formStyles.input, minHeight: 72, resize: 'vertical' }}
          placeholder="Optional context / reasoning (shown to subscribers)"
          value={form.note}
          maxLength={280}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        {msg ? <p style={{ color: 'var(--accent)', margin: 0 }}>{msg}</p> : null}
        <button style={formStyles.button} disabled={submitting}>
          {submitting ? 'Locking…' : 'Lock pick'}
        </button>
      </form>
      )}

      <PerformanceDashboardView data={performance} />

      <h2 style={{ marginTop: '2.5rem' }}>Your track record</h2>
      {picks.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No settled picks yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
              <th style={{ padding: '0.5rem 0' }}>Selection</th>
              <th>Market</th>
              <th>Odds</th>
              <th>CLV</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0' }}>{p.selection}</td>
                <td>{p.market}</td>
                <td>{p.oddsAtPick.toFixed(2)}</td>
                <td>{p.clv != null ? `${(p.clv * 100).toFixed(1)}%` : '—'}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
