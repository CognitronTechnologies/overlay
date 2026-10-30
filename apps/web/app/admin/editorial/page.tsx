'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { roleHasPermission } from '@overlay/shared/rbac';
import { authFetch, getProfile } from '../../../lib/auth';
import BackLink from '../../BackLink';

type EditorialType = 'article' | 'free-tip';
type Status = 'draft' | 'pending' | 'published' | 'rejected' | 'expired' | 'archived';
interface EditorialRecord {
  id: string;
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string | null;
  category?: 'content' | 'news';
  tags?: string[];
  sport?: string;
  league?: string | null;
  match?: string;
  market?: string;
  selection?: string;
  odds?: number | null;
  analysis?: string | null;
  kickoffAt?: string | null;
  expiresAt?: string | null;
  reviewerWarnings?: string[];
  sources?: { publisher?: string; title?: string; url?: string; retrievedAt?: string }[];
  createdAt: string;
  status: Status;
  automationRun?: { id: string; workflowName: string; externalRunUrl?: string | null } | null;
}
interface ListItem { type: EditorialType; item: EditorialRecord }
interface ListResponse { items: ListItem[]; total: number; page: number; pageSize: number; totalPages: number }

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--fg)', padding: '0.55rem 0.7rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box',
};

export default function EditorialQueuePage() {
  const t = useTranslations('editorial');
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [type, setType] = useState<'' | EditorialType>('');
  const [status, setStatus] = useState<'' | Status>('pending');
  const [origin, setOrigin] = useState<'' | 'manual' | 'automation'>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setResult(null);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (type) qs.set('type', type);
    if (status) qs.set('status', status);
    if (origin) qs.set('origin', origin);
    try {
      const res = await authFetch(`/api/admin/editorial?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
        throw new Error(Array.isArray(body?.message) ? body.message.join(', ') : body?.message || t('loadFailed'));
      }
      setResult(await res.json() as ListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'));
    }
  }, [origin, page, status, t, type]);

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile) { router.replace('/login'); return; }
      if (profile.role !== 'admin' || !roleHasPermission(profile.role, 'content:moderate')) { router.replace('/account'); return; }
      setAuthorized(true);
    })();
  }, [router]);
  useEffect(() => { if (authorized) void load(); }, [authorized, load]);

  function updateFilter<T>(setValue: (value: T) => void, value: T) {
    setPage(1);
    setValue(value);
  }

  if (!authorized) return null;
  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p><BackLink href="/admin">{t('backAdmin')}</BackLink></p>
      <h1>{t('title')}</h1>
      <p style={{ color: 'var(--muted)' }}>{t('description')}</p>

      <section aria-label={t('filters')} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', margin: '1.25rem 0' }}>
        <label style={{ minWidth: 150 }}>{t('type')}
          <select aria-label={t('type')} value={type} onChange={(e) => updateFilter(setType, e.target.value as '' | EditorialType)} style={inputStyle}>
            <option value="">{t('allTypes')}</option><option value="article">{t('articles')}</option><option value="free-tip">{t('freeTips')}</option>
          </select>
        </label>
        <label style={{ minWidth: 150 }}>{t('status')}
          <select aria-label={t('status')} value={status} onChange={(e) => updateFilter(setStatus, e.target.value as '' | Status)} style={inputStyle}>
            <option value="pending">{t('pending')}</option><option value="draft">{t('draft')}</option><option value="published">{t('published')}</option><option value="rejected">{t('rejected')}</option><option value="expired">{t('expired')}</option><option value="archived">{t('archived')}</option><option value="">{t('allStatuses')}</option>
          </select>
        </label>
        <label style={{ minWidth: 150 }}>{t('origin')}
          <select aria-label={t('origin')} value={origin} onChange={(e) => updateFilter(setOrigin, e.target.value as '' | 'manual' | 'automation')} style={inputStyle}>
            <option value="">{t('allOrigins')}</option><option value="manual">{t('manual')}</option><option value="automation">{t('automation')}</option>
          </select>
        </label>
      </section>

      {error ? <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      {!result && !error ? <p aria-live="polite">{t('loading')}</p> : null}
      {result && result.items.length === 0 ? <p>{t('empty')}</p> : null}
      {result && result.items.length > 0 ? (
        <>
          <p aria-live="polite">{t('resultCount', { count: result.total })}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {result.items.map(({ type: itemType, item }) => {
              const displayTitle = itemType === 'article' ? item.title : `${item.match || t('untitled')} - ${item.selection || ''}`;
              const countdownDate = item.kickoffAt || item.expiresAt;
              const remaining = countdownDate ? new Date(countdownDate).getTime() - Date.now() : null;
              const countdown = remaining == null ? t('notAvailable') : remaining <= 0 ? t('timePassed') : `${Math.floor(remaining / 3_600_000)}h ${Math.floor((remaining % 3_600_000) / 60_000)}m`;
              return (
                <li key={`${itemType}-${item.id}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.7rem' }}>
                    <div>
                      <Link href={`/admin/editorial/${itemType}/${encodeURIComponent(item.id)}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>{displayTitle}</Link>
                      <div style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: '0.35rem' }}>
                        {itemType === 'article' ? t('article') : t('freeTip')} - {item.league || item.sport || t('competitionUnknown')} - {t('createdAt', { date: new Date(item.createdAt).toLocaleString() })}
                      </div>
                    </div>
                    <span aria-label={t('statusValue', { status: t(item.status) })} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.25rem 0.65rem', fontWeight: 600 }}>{t(item.status)}</span>
                  </div>
                  {itemType === 'free-tip' ? <p style={{ margin: '0.55rem 0 0' }}>{t('countdown', { label: item.kickoffAt ? t('kickoff') : t('expiry'), time: countdown })}</p> : null}
                  <div style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: '0.5rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
                    <span>{t('warningsCount', { count: item.reviewerWarnings?.length ?? 0 })}</span>
                    <span>{t('sourcesCount', { count: item.sources?.length ?? 0 })}</span>
                    {item.automationRun ? item.automationRun.externalRunUrl && /^https?:\/\//i.test(item.automationRun.externalRunUrl) ? <a href={item.automationRun.externalRunUrl} target="_blank" rel="noopener noreferrer nofollow">{t('runLink', { name: item.automationRun.workflowName })}</a> : <span>{t('runLink', { name: item.automationRun.workflowName })}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <nav aria-label={t('pagination')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button type="button" className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('previous')}</button>
            <span>{t('pageOf', { page: result.page, total: result.totalPages })}</span>
            <button type="button" className="btn btn--secondary btn--sm" disabled={page >= result.totalPages} onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}>{t('next')}</button>
          </nav>
        </>
      ) : null}
    </main>
  );
}
