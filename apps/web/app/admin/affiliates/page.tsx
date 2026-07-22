'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roleHasPermission, type Role } from '@overlay/shared/rbac';
import { authFetch, getProfile } from '../../../lib/auth';
import { formStyles } from '../../formStyles';

// ---- Types ----

interface DashboardSummary {
  totalClicks: number;
  clicksToday: number;
  activeBookmakers: number;
  activeOffers: number;
}

interface TopBookmaker {
  id: string;
  name: string;
  slug: string;
  _count: { clicks: number };
}

interface TopOffer {
  id: string;
  title: string;
  bookmaker: { id: string; name: string };
  _count: { clicks: number };
}

interface DashboardData {
  summary: DashboardSummary;
  topBookmakers: TopBookmaker[];
  topOffers: TopOffer[];
}

interface BookmakerCounts {
  offers: number;
  clicks: number;
}

interface Bookmaker {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string;
  destinationUrl: string | null;
  trackingParams: string | null;
  promoCode: string | null;
  promoCodeDescription: string | null;
  description: string | null;
  welcomeOffer: string | null;
  termsSummary: string | null;
  rating: number | null;
  isFeatured: boolean;
  isActive: boolean;
  supportedCountries: string[];
  displayOrder: number;
  _count: BookmakerCounts;
}

interface Offer {
  id: string;
  bookmakerId: string;
  title: string;
  description: string | null;
  cta: string | null;
  destinationUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  bookmaker?: { id: string; name: string; slug: string };
  _count?: { clicks: number };
}

interface ClickRecord {
  id: string;
  bookmaker: { id: string; name: string; slug: string };
  offer: { id: string; title: string } | null;
  userId: string | null;
  source: string;
  page: string;
  country: string | null;
  clickedAt: string;
}

// ---- Constants ----

const MUTED = { color: 'var(--muted)' } as const;

const EMPTY_BOOKMAKER = {
  name: '',
  slug: '',
  logo: '',
  website: '',
  destinationUrl: '',
  trackingParams: '',
  promoCode: '',
  promoCodeDescription: '',
  description: '',
  welcomeOffer: '',
  termsSummary: '',
  rating: 0,
  isFeatured: false,
  isActive: true,
  supportedCountries: 'KE',
  displayOrder: 0,
};

const EMPTY_OFFER = {
  title: '',
  description: '',
  cta: '',
  destinationUrl: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

// ---- Helpers ----

function formatClicks(n: number): string {
  return n.toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---- Metric Card ----

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '1.25rem 1.4rem',
      }}
    >
      <div
        style={{
          color: 'var(--muted)',
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, marginTop: '0.35rem' }}>
        {value}
      </div>
    </div>
  );
}

// ---- Page Component ----

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Bookmakers
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [bmSearch, setBmSearch] = useState('');
  const [bmQuery, setBmQuery] = useState('');
  const [bmFilterActive, setBmFilterActive] = useState<string>('');
  const [bmFilterFeatured, setBmFilterFeatured] = useState<string>('');
  const [editingBm, setEditingBm] = useState<Record<string, string> | null>(null);
  const [bmForm, setBmForm] = useState({ ...EMPTY_BOOKMAKER });

  // Offers
  const [expandedBm, setExpandedBm] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [editingOffer, setEditingOffer] = useState<Record<string, string> | null>(null);
  const [offerForm, setOfferForm] = useState({ ...EMPTY_OFFER });

  // Clicks
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [clickFilterBm, setClickFilterBm] = useState('');
  const [clickFilterSource, setClickFilterSource] = useState('');
  const [clickFilterCountry, setClickFilterCountry] = useState('');
  const [clickFilterFrom, setClickFilterFrom] = useState('');
  const [clickFilterTo, setClickFilterTo] = useState('');
  const [showClicks, setShowClicks] = useState(false);

  // ---- Auth ----

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile) {
        router.replace('/login');
        return;
      }
      if (!roleHasPermission(profile.role, 'content:moderate')) {
        router.replace('/account');
        return;
      }
      setRole(profile.role);
      setAuthorized(true);
    })();
  }, [router]);

  // ---- Data loading ----

  const loadDashboard = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/affiliates/dashboard');
      if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`);
      setDashboard((await res.json()) as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }, []);

  const loadBookmakers = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (bmQuery) qs.set('search', bmQuery);
      if (bmFilterActive) qs.set('active', bmFilterActive);
      if (bmFilterFeatured) qs.set('featured', bmFilterFeatured);
      const res = await authFetch(`/api/admin/affiliates/bookmakers?${qs.toString()}`);
      if (!res.ok) throw new Error(`Failed to load bookmakers (${res.status})`);
      setBookmakers((await res.json()) as Bookmaker[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmakers');
    }
  }, [bmQuery, bmFilterActive, bmFilterFeatured]);

  const loadOffers = useCallback(async (bookmakerId: string) => {
    try {
      const res = await authFetch(`/api/admin/affiliates/bookmakers/${bookmakerId}/offers`);
      if (!res.ok) throw new Error(`Failed to load offers (${res.status})`);
      setOffers((await res.json()) as Offer[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    }
  }, []);

  const loadClicks = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (clickFilterBm) qs.set('bookmaker', clickFilterBm);
      if (clickFilterSource) qs.set('source', clickFilterSource);
      if (clickFilterCountry) qs.set('country', clickFilterCountry);
      if (clickFilterFrom) qs.set('from', clickFilterFrom);
      if (clickFilterTo) qs.set('to', clickFilterTo);
      const res = await authFetch(`/api/admin/affiliates/clicks?${qs.toString()}`);
      if (!res.ok) throw new Error(`Failed to load clicks (${res.status})`);
      setClicks((await res.json()) as ClickRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clicks');
    }
  }, [clickFilterBm, clickFilterSource, clickFilterCountry, clickFilterFrom, clickFilterTo]);

  useEffect(() => {
    if (!authorized) return;
    loadDashboard();
    loadBookmakers();
  }, [authorized, loadDashboard, loadBookmakers]);

  // ---- Bookmaker CRUD ----

  function resetBmForm(bm?: Bookmaker) {
    if (bm) {
      setBmForm({
        name: bm.name,
        slug: bm.slug,
        logo: bm.logo ?? '',
        website: bm.website,
        destinationUrl: bm.destinationUrl ?? '',
        trackingParams: bm.trackingParams ?? '',
        promoCode: bm.promoCode ?? '',
        promoCodeDescription: bm.promoCodeDescription ?? '',
        description: bm.description ?? '',
        welcomeOffer: bm.welcomeOffer ?? '',
        termsSummary: bm.termsSummary ?? '',
        rating: bm.rating ?? 0,
        isFeatured: bm.isFeatured,
        isActive: bm.isActive,
        supportedCountries: bm.supportedCountries.join(', '),
        displayOrder: bm.displayOrder,
      });
    } else {
      setBmForm({ ...EMPTY_BOOKMAKER });
    }
  }

  function startCreateBm() {
    resetBmForm();
    setEditingBm({ mode: 'create' });
    setError(null);
    setNotice(null);
  }

  function startEditBm(bm: Bookmaker) {
    resetBmForm(bm);
    setEditingBm({ mode: 'edit', id: bm.id });
    setError(null);
    setNotice(null);
  }

  function cancelBmForm() {
    setEditingBm(null);
    setError(null);
  }

  async function saveBookmaker(e: React.FormEvent) {
    e.preventDefault();
    if (!bmForm.name.trim() || !bmForm.slug.trim() || !bmForm.website.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: bmForm.name.trim(),
        slug: bmForm.slug.trim(),
        logo: bmForm.logo.trim() || undefined,
        website: bmForm.website.trim(),
        destinationUrl: bmForm.destinationUrl.trim() || undefined,
        trackingParams: bmForm.trackingParams.trim() || undefined,
        promoCode: bmForm.promoCode.trim() || undefined,
        promoCodeDescription: bmForm.promoCodeDescription.trim() || undefined,
        description: bmForm.description.trim() || undefined,
        welcomeOffer: bmForm.welcomeOffer.trim() || undefined,
        termsSummary: bmForm.termsSummary.trim() || undefined,
        rating: bmForm.rating || undefined,
        isFeatured: bmForm.isFeatured,
        isActive: bmForm.isActive,
        supportedCountries: bmForm.supportedCountries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
        displayOrder: bmForm.displayOrder || 0,
      };

      if (editingBm?.mode === 'edit' && editingBm.id) {
        const res = await authFetch(`/api/admin/affiliates/bookmakers/${editingBm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `Update failed (${res.status})`);
        }
        setNotice('Bookmaker updated.');
      } else {
        const res = await authFetch('/api/admin/affiliates/bookmakers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `Create failed (${res.status})`);
        }
        setNotice('Bookmaker created.');
      }
      setEditingBm(null);
      await loadBookmakers();
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBookmaker(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will soft-deactivate the bookmaker.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/api/admin/affiliates/bookmakers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setNotice(`"${name}" deactivated.`);
      await loadBookmakers();
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  function submitBmSearch(e: React.FormEvent) {
    e.preventDefault();
    setBmQuery(bmSearch.trim());
  }

  // ---- Offer CRUD ----

  function resetOfferForm(offer?: Offer) {
    if (offer) {
      setOfferForm({
        title: offer.title,
        description: offer.description ?? '',
        cta: offer.cta ?? '',
        destinationUrl: offer.destinationUrl,
        startsAt: offer.startsAt ? offer.startsAt.slice(0, 16) : '',
        endsAt: offer.endsAt ? offer.endsAt.slice(0, 16) : '',
        isActive: offer.isActive,
      });
    } else {
      setOfferForm({ ...EMPTY_OFFER });
    }
  }

  function startCreateOffer() {
    resetOfferForm();
    setEditingOffer({ mode: 'create' });
    setError(null);
    setNotice(null);
  }

  function startEditOffer(offer: Offer) {
    resetOfferForm(offer);
    setEditingOffer({ mode: 'edit', id: offer.id });
    setError(null);
    setNotice(null);
  }

  function cancelOfferForm() {
    setEditingOffer(null);
    setError(null);
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!offerForm.title.trim() || !offerForm.destinationUrl.trim() || !expandedBm) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = {
        title: offerForm.title.trim(),
        description: offerForm.description.trim() || undefined,
        cta: offerForm.cta.trim() || undefined,
        destinationUrl: offerForm.destinationUrl.trim(),
        startsAt: offerForm.startsAt ? new Date(offerForm.startsAt).toISOString() : undefined,
        endsAt: offerForm.endsAt ? new Date(offerForm.endsAt).toISOString() : undefined,
        isActive: offerForm.isActive,
      };

      if (editingOffer?.mode === 'edit' && editingOffer.id) {
        const res = await authFetch(`/api/admin/affiliates/offers/${editingOffer.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `Update failed (${res.status})`);
        }
        setNotice('Offer updated.');
      } else {
        const res = await authFetch(`/api/admin/affiliates/bookmakers/${expandedBm}/offers`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `Create failed (${res.status})`);
        }
        setNotice('Offer created.');
      }
      setEditingOffer(null);
      await loadOffers(expandedBm);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteOffer(offerId: string) {
    if (!confirm('Delete this offer? This will soft-deactivate it.')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/api/admin/affiliates/offers/${offerId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setNotice('Offer deactivated.');
      if (expandedBm) await loadOffers(expandedBm);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  function toggleExpandBm(bmId: string) {
    if (expandedBm === bmId) {
      setExpandedBm(null);
      setOffers([]);
      setEditingOffer(null);
    } else {
      setExpandedBm(bmId);
      setEditingOffer(null);
      loadOffers(bmId);
    }
  }

  // ---- Clicks ----

  function handleLoadClicks(e: React.FormEvent) {
    e.preventDefault();
    loadClicks();
  }

  // ---- Render ----

  if (!authorized) {
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <p style={MUTED}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1>Affiliates</h1>
      <p style={MUTED}>
        Manage bookmaker partnerships, affiliate offers, and track click
        performance. Every action is recorded in the audit log.
      </p>

      {error ? <p style={formStyles.error}>{error}</p> : null}
      {notice ? <p style={{ color: 'var(--accent)', margin: 0 }}>{notice}</p> : null}

      {/* ---- Dashboard Summary ---- */}
      {dashboard ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
          }}
        >
          <MetricCard label="Total clicks" value={formatClicks(dashboard.summary.totalClicks)} />
          <MetricCard label="Clicks today" value={formatClicks(dashboard.summary.clicksToday)} />
          <MetricCard label="Active bookmakers" value={String(dashboard.summary.activeBookmakers)} />
          <MetricCard label="Active offers" value={String(dashboard.summary.activeOffers)} />
        </div>
      ) : (
        <p style={{ ...MUTED, marginTop: '1.5rem' }}>Loading dashboard…</p>
      )}

      {/* ---- Top Performers ---- */}
      {dashboard && (dashboard.topBookmakers.length > 0 || dashboard.topOffers.length > 0) ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem',
          }}
        >
          {dashboard.topBookmakers.length > 0 ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Top bookmakers</h3>
              {dashboard.topBookmakers.map((bm) => (
                <div
                  key={bm.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span>{bm.name}</span>
                  <span style={MUTED}>{formatClicks(bm._count.clicks)} clicks</span>
                </div>
              ))}
            </div>
          ) : null}
          {dashboard.topOffers.length > 0 ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Top offers</h3>
              {dashboard.topOffers.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span>
                    {o.title}{' '}
                    <span style={MUTED}>({o.bookmaker.name})</span>
                  </span>
                  <span style={MUTED}>{formatClicks(o._count.clicks)} clicks</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Bookmaker Management ---- */}
      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.2rem' }}>Bookmakers</h2>

        <form
          onSubmit={submitBmSearch}
          style={{ display: 'flex', gap: '0.6rem', margin: '1rem 0', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <input
            style={{ ...formStyles.input, maxWidth: 240 }}
            placeholder="Search name or slug…"
            value={bmSearch}
            onChange={(e) => setBmSearch(e.target.value)}
          />
          <button style={formStyles.button} type="submit">
            Search
          </button>
          {bmQuery ? (
            <button
              type="button"
              onClick={() => {
                setBmSearch('');
                setBmQuery('');
              }}
              style={{
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.6rem 1.2rem',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          ) : null}
          <select
            style={{ ...formStyles.input, width: 'auto', padding: '0.6rem 0.8rem' }}
            value={bmFilterActive}
            onChange={(e) => setBmFilterActive(e.target.value)}
          >
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select
            style={{ ...formStyles.input, width: 'auto', padding: '0.6rem 0.8rem' }}
            value={bmFilterFeatured}
            onChange={(e) => setBmFilterFeatured(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Featured</option>
            <option value="false">Not featured</option>
          </select>
          <button
            type="button"
            style={{ ...formStyles.button, marginLeft: 'auto' }}
            onClick={startCreateBm}
          >
            + New bookmaker
          </button>
        </form>

        {/* Bookmaker form */}
        {editingBm ? (
          <form
            onSubmit={saveBookmaker}
            style={{
              ...formStyles.form,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <h3 style={{ margin: 0 }}>
              {editingBm.mode === 'create' ? 'New bookmaker' : 'Edit bookmaker'}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <label>
                Name *
                <input
                  style={formStyles.input}
                  value={bmForm.name}
                  onChange={(e) => setBmForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label>
                Slug *
                <input
                  style={formStyles.input}
                  value={bmForm.slug}
                  onChange={(e) => setBmForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </label>
              <label>
                Website *
                <input
                  style={formStyles.input}
                  value={bmForm.website}
                  onChange={(e) => setBmForm((f) => ({ ...f, website: e.target.value }))}
                />
              </label>
              <label>
                Logo URL
                <input
                  style={formStyles.input}
                  value={bmForm.logo}
                  onChange={(e) => setBmForm((f) => ({ ...f, logo: e.target.value }))}
                />
              </label>
              <label>
                Destination URL
                <input
                  style={formStyles.input}
                  value={bmForm.destinationUrl}
                  onChange={(e) => setBmForm((f) => ({ ...f, destinationUrl: e.target.value }))}
                />
              </label>
              <label>
                Tracking params
                <input
                  style={formStyles.input}
                  value={bmForm.trackingParams}
                  placeholder="?ref=overlay&campaign=…"
                  onChange={(e) => setBmForm((f) => ({ ...f, trackingParams: e.target.value }))}
                />
              </label>
              <label>
                Promo code
                <input
                  style={formStyles.input}
                  value={bmForm.promoCode}
                  onChange={(e) => setBmForm((f) => ({ ...f, promoCode: e.target.value }))}
                />
              </label>
              <label>
                Promo code description
                <input
                  style={formStyles.input}
                  value={bmForm.promoCodeDescription}
                  onChange={(e) => setBmForm((f) => ({ ...f, promoCodeDescription: e.target.value }))}
                />
              </label>
              <label>
                Display order
                <input
                  type="number"
                  style={formStyles.input}
                  value={bmForm.displayOrder}
                  onChange={(e) => setBmForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                />
              </label>
              <label>
                Rating (0–5)
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  style={formStyles.input}
                  value={bmForm.rating}
                  onChange={(e) => setBmForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                />
              </label>
              <label>
                Supported countries (comma-separated)
                <input
                  style={formStyles.input}
                  value={bmForm.supportedCountries}
                  placeholder="KE, GB, UG, ZA"
                  onChange={(e) => setBmForm((f) => ({ ...f, supportedCountries: e.target.value }))}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                <input
                  type="checkbox"
                  checked={bmForm.isFeatured}
                  onChange={(e) => setBmForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                />
                Featured
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                <input
                  type="checkbox"
                  checked={bmForm.isActive}
                  onChange={(e) => setBmForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <label>
              Description
              <textarea
                style={{ ...formStyles.input, minHeight: 80 }}
                value={bmForm.description}
                onChange={(e) => setBmForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              Welcome offer
              <textarea
                style={{ ...formStyles.input, minHeight: 60 }}
                value={bmForm.welcomeOffer}
                onChange={(e) => setBmForm((f) => ({ ...f, welcomeOffer: e.target.value }))}
              />
            </label>
            <label>
              Terms summary
              <textarea
                style={{ ...formStyles.input, minHeight: 60 }}
                value={bmForm.termsSummary}
                onChange={(e) => setBmForm((f) => ({ ...f, termsSummary: e.target.value }))}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                style={formStyles.button}
                disabled={busy || !bmForm.name.trim() || !bmForm.slug.trim() || !bmForm.website.trim()}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                style={{
                  ...formStyles.button,
                  background: 'var(--border)',
                  color: 'var(--fg)',
                }}
                onClick={cancelBmForm}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {/* Bookmaker list */}
        {bookmakers.length === 0 ? (
          <p style={MUTED}>No bookmakers found.</p>
        ) : (
          <div>
            {bookmakers.map((bm) => (
              <div
                key={bm.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  marginBottom: '0.75rem',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    background: expandedBm === bm.id ? 'var(--surface)' : undefined,
                  }}
                  onClick={() => toggleExpandBm(bm.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    {bm.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bm.logo}
                        alt={bm.name}
                        style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain' }}
                      />
                    ) : null}
                    <div>
                      <strong>{bm.name}</strong>
                      <div style={{ ...MUTED, fontSize: '0.85rem' }}>
                        /{bm.slug} · {bm._count.offers} offers · {formatClicks(bm._count.clicks)} clicks
                        {bm.isFeatured ? ' · ⭐ Featured' : ''}
                        {!bm.isActive ? (
                          <span style={{ color: 'var(--danger)' }}> · Inactive</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        color: 'var(--accent)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.35rem 0.8rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                      onClick={() => startEditBm(bm)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        color: 'var(--danger)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.35rem 0.8rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                      onClick={() => deleteBookmaker(bm.id, bm.name)}
                    >
                      Delete
                    </button>
                    <span style={{ ...MUTED, fontSize: '0.85rem' }}>
                      {expandedBm === bm.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded offers section */}
                {expandedBm === bm.id ? (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      padding: '1rem 1rem 1rem 2.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Offers</h4>
                      <button
                        type="button"
                        style={{
                          ...formStyles.button,
                          padding: '0.4rem 0.9rem',
                          fontSize: '0.85rem',
                        }}
                        onClick={startCreateOffer}
                      >
                        + New offer
                      </button>
                    </div>

                    {/* Offer form */}
                    {editingOffer ? (
                      <form
                        onSubmit={saveOffer}
                        style={{
                          ...formStyles.form,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '1rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <h5 style={{ margin: 0 }}>
                          {editingOffer.mode === 'create' ? 'New offer' : 'Edit offer'}
                        </h5>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '0.75rem',
                          }}
                        >
                          <label>
                            Title *
                            <input
                              style={formStyles.input}
                              value={offerForm.title}
                              onChange={(e) => setOfferForm((f) => ({ ...f, title: e.target.value }))}
                            />
                          </label>
                          <label>
                            CTA
                            <input
                              style={formStyles.input}
                              value={offerForm.cta}
                              placeholder="Bet now"
                              onChange={(e) => setOfferForm((f) => ({ ...f, cta: e.target.value }))}
                            />
                          </label>
                          <label>
                            Destination URL *
                            <input
                              style={formStyles.input}
                              value={offerForm.destinationUrl}
                              onChange={(e) => setOfferForm((f) => ({ ...f, destinationUrl: e.target.value }))}
                            />
                          </label>
                          <label>
                            Starts at
                            <input
                              type="datetime-local"
                              style={formStyles.input}
                              value={offerForm.startsAt}
                              onChange={(e) => setOfferForm((f) => ({ ...f, startsAt: e.target.value }))}
                            />
                          </label>
                          <label>
                            Ends at
                            <input
                              type="datetime-local"
                              style={formStyles.input}
                              value={offerForm.endsAt}
                              onChange={(e) => setOfferForm((f) => ({ ...f, endsAt: e.target.value }))}
                            />
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                            <input
                              type="checkbox"
                              checked={offerForm.isActive}
                              onChange={(e) => setOfferForm((f) => ({ ...f, isActive: e.target.checked }))}
                            />
                            Active
                          </label>
                        </div>
                        <label>
                          Description
                          <textarea
                            style={{ ...formStyles.input, minHeight: 60 }}
                            value={offerForm.description}
                            onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button
                            type="submit"
                            style={formStyles.button}
                            disabled={busy || !offerForm.title.trim() || !offerForm.destinationUrl.trim()}
                          >
                            {busy ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            style={{
                              ...formStyles.button,
                              background: 'var(--border)',
                              color: 'var(--fg)',
                            }}
                            onClick={cancelOfferForm}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {/* Offer list */}
                    {offers.length === 0 ? (
                      <p style={MUTED}>No offers yet.</p>
                    ) : (
                      <div>
                        {offers.map((o) => (
                          <div
                            key={o.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem',
                              padding: '0.6rem 0',
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong>{o.title}</strong>
                              <div style={{ ...MUTED, fontSize: '0.85rem' }}>
                                {o.cta ? `${o.cta} · ` : ''}
                                {formatDate(o.startsAt)} – {formatDate(o.endsAt)}
                                {o._count ? ` · ${formatClicks(o._count.clicks)} clicks` : ''}
                                {!o.isActive ? (
                                  <span style={{ color: 'var(--danger)' }}> · Inactive</span>
                                ) : null}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                              <button
                                type="button"
                                style={{
                                  background: 'transparent',
                                  color: 'var(--accent)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 8,
                                  padding: '0.3rem 0.7rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                }}
                                onClick={() => startEditOffer(o)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{
                                  background: 'transparent',
                                  color: 'var(--danger)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 8,
                                  padding: '0.3rem 0.7rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                }}
                                onClick={() => deleteOffer(o.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Click Analytics ---- */}
      <section style={{ marginTop: '2.5rem' }}>
        <h2
          style={{ fontSize: '1.2rem', cursor: 'pointer' }}
          onClick={() => setShowClicks((s) => !s)}
        >
          Click analytics {showClicks ? '▲' : '▼'}
        </h2>

        {showClicks ? (
          <>
            <form
              onSubmit={handleLoadClicks}
              style={{
                display: 'flex',
                gap: '0.6rem',
                margin: '1rem 0',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Bookmaker
                <select
                  style={{ ...formStyles.input, width: 'auto', padding: '0.5rem 0.7rem', marginTop: '0.25rem' }}
                  value={clickFilterBm}
                  onChange={(e) => setClickFilterBm(e.target.value)}
                >
                  <option value="">All</option>
                  {bookmakers.map((bm) => (
                    <option key={bm.id} value={bm.id}>
                      {bm.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Source
                <input
                  style={{ ...formStyles.input, width: 'auto', padding: '0.5rem 0.7rem', marginTop: '0.25rem' }}
                  value={clickFilterSource}
                  placeholder="FREE_BETS, HOME…"
                  onChange={(e) => setClickFilterSource(e.target.value)}
                />
              </label>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Country
                <input
                  style={{ ...formStyles.input, width: 'auto', padding: '0.5rem 0.7rem', marginTop: '0.25rem' }}
                  value={clickFilterCountry}
                  placeholder="KE, GB…"
                  onChange={(e) => setClickFilterCountry(e.target.value)}
                />
              </label>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                From
                <input
                  type="date"
                  style={{ ...formStyles.input, width: 'auto', padding: '0.5rem 0.7rem', marginTop: '0.25rem' }}
                  value={clickFilterFrom}
                  onChange={(e) => setClickFilterFrom(e.target.value)}
                />
              </label>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                To
                <input
                  type="date"
                  style={{ ...formStyles.input, width: 'auto', padding: '0.5rem 0.7rem', marginTop: '0.25rem' }}
                  value={clickFilterTo}
                  onChange={(e) => setClickFilterTo(e.target.value)}
                />
              </label>
              <button style={formStyles.button} type="submit">
                Load clicks
              </button>
            </form>

            {clicks.length === 0 ? (
              <p style={MUTED}>No clicks found. Apply filters and load.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', ...MUTED, fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.5rem 0.5rem' }}>Date</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>Bookmaker</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>Offer</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>Source</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>Country</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clicks.map((c) => (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {formatDateTime(c.clickedAt)}
                        </td>
                        <td style={{ padding: '0.5rem' }}>{c.bookmaker.name}</td>
                        <td style={{ padding: '0.5rem', ...MUTED, fontSize: '0.85rem' }}>
                          {c.offer?.title ?? '—'}
                        </td>
                        <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{c.source}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                          {c.country ?? '—'}
                        </td>
                        <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.page}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}