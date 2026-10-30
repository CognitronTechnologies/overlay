'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { marked } from 'marked';
import { sanitizeHtml } from '@overlay/shared/markdown';
import { roleHasPermission } from '@overlay/shared/rbac';
import { authFetch, getAccessToken, getProfile } from '../../../../../lib/auth';
import { readApiError } from '../../../../../lib/api-error';
import BackLink from '../../../../BackLink';

type EditorialType = 'article' | 'free-tip';
type Status = 'draft' | 'pending' | 'published' | 'rejected' | 'expired' | 'archived';
interface Source { publisher?: string; title?: string; url?: string; retrievedAt?: string; kind?: string }
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
  oddsProvider?: string | null;
  oddsRetrievedAt?: string | null;
  rationale?: Record<string, unknown> | null;
  reviewerWarnings?: string[];
  sources?: Source[];
  createdAt: string;
  updatedAt: string;
  status: Status;
  origin?: string;
  automationRun?: { id: string; workflowName: string; externalRunId?: string | null; externalRunUrl?: string | null; startedAt?: string; finishedAt?: string | null; status?: string; createdCount?: number; rejectedCount?: number; errorSummary?: string | null } | null;
  event?: { id: string; startTime?: string } | null;
}
interface EditorialResponse { type: EditorialType; item: EditorialRecord }
const inputStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', padding: '0.55rem 0.7rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' };
const panelStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.15rem', marginTop: '1rem' };

function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}


export default function EditorialReviewPage() {
  const t = useTranslations('editorial');
  const router = useRouter();
  const params = useParams<{ type: string; id: string }>();
  const type = params.type as EditorialType;
  const id = params.id;
  const [authorized, setAuthorized] = useState(false);
  const [item, setItem] = useState<EditorialRecord | null>(null);
  const [draft, setDraft] = useState<EditorialRecord | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [manualRationale, setManualRationale] = useState('');
  const [manualRisks, setManualRisks] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oddsStale, setOddsStale] = useState(false);
  const editable = item?.status === 'draft' || item?.status === 'pending';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/editorial/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error((await readApiError(res, t('loadFailed'))).message);
      const data = await res.json() as EditorialResponse;
      setItem(data.item);
      setDraft(data.item);
      setRationaleText(JSON.stringify(data.item.rationale ?? {}, null, 2));
      const rationale = data.item.rationale ?? {};
      setManualRationale(typeof rationale.rationale === 'string' ? rationale.rationale : '');
      const manualRiskItems = Array.isArray(rationale.counterarguments)
        ? rationale.counterarguments
        : Array.isArray(rationale.risks) ? rationale.risks : [];
      setManualRisks(manualRiskItems.map(String).join('\n'));
      const retrieved = data.item.oddsRetrievedAt ? new Date(data.item.oddsRetrievedAt).getTime() : null;
      setOddsStale(retrieved != null && Number.isFinite(retrieved) && Date.now() - retrieved > 6 * 60 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t, type]);

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile) { router.replace('/login'); return; }
      if (profile.role !== 'admin' || !roleHasPermission(profile.role, 'content:moderate')) { router.replace('/account'); return; }
      setAuthorized(true);
    })();
  }, [router]);
  useEffect(() => { if (authorized) void load(); }, [authorized, load]);

  const riskItems = useMemo(() => {
    if (!item) return [];
    const counterarguments = Array.isArray(item.rationale?.counterarguments) ? item.rationale.counterarguments : [];
    const risks = Array.isArray(item.rationale?.risks) ? item.rationale.risks : [];
    return [...counterarguments, ...risks].map(String);
  }, [item]);

  const previewHtml = useMemo(() => {
    const raw = marked.parse(draft?.body ?? '', { async: false }) as string;
    return sanitizeHtml(raw);
  }, [draft?.body]);
  const changed = useMemo(() => {
    if (!item || !draft) return false;
    const fields = type === 'article'
      ? ['title', 'slug', 'body', 'excerpt', 'category', 'tags']
      : ['sport', 'league', 'match', 'market', 'selection', 'odds', 'analysis', 'kickoffAt', 'expiresAt'];
    const fieldsChanged = fields.some((field) => JSON.stringify(item[field as keyof EditorialRecord] ?? null) !== JSON.stringify(draft[field as keyof EditorialRecord] ?? null));
    const manualContentChanged = item.origin === 'manual' && (
      manualRationale !== String(item.rationale?.rationale ?? '') ||
      manualRisks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).join('\n') !==
        (Array.isArray(item.rationale?.counterarguments) ? item.rationale.counterarguments : Array.isArray(item.rationale?.risks) ? item.rationale.risks : []).map(String).join('\n')
    );
    return fieldsChanged || manualContentChanged || (item.origin !== 'manual' && rationaleText !== JSON.stringify(item.rationale ?? {}, null, 2));
  }, [draft, item, manualRationale, manualRisks, rationaleText, type]);

  function update(patch: Partial<EditorialRecord>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function save(): Promise<boolean> {
    if (!draft || !item || !editable) return false;
    let rationale: Record<string, unknown> | undefined;
    if (type === 'free-tip') {
      if (item.origin === 'manual') {
        const counterarguments = manualRisks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
        if (counterarguments.length && !manualRationale.trim()) {
          setError(t('manualRationaleRequired'));
          return false;
        }
        rationale = manualRationale.trim() ? { rationale: manualRationale.trim(), counterarguments } : undefined;
      } else {
        try {
          const parsed: unknown = JSON.parse(rationaleText || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(t('rationaleObjectError'));
          rationale = parsed as Record<string, unknown>;
        } catch (err) {
          setError(err instanceof Error ? err.message : t('rationaleObjectError'));
          return false;
        }
      }
    }
    const payload = type === 'article'
      ? { title: draft.title, slug: draft.slug, body: draft.body, excerpt: draft.excerpt ?? '', category: draft.category, tags: draft.tags ?? [] }
      : { sport: draft.sport, league: draft.league ?? '', match: draft.match, market: draft.market, selection: draft.selection, odds: draft.odds == null ? undefined : Number(draft.odds), analysis: draft.analysis ?? '', kickoffAt: draft.kickoffAt || undefined, expiresAt: draft.expiresAt || undefined, rationale };
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/api/admin/editorial/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await readApiError(res, t('saveFailed'))).message);
      let cacheUpdated = false;
      try {
        const token = await getAccessToken();
        if (token) {
          const cacheRes = await fetch('/api/revalidate', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ kind: type, slugs: [item.slug, draft.slug].filter((slug): slug is string => Boolean(slug)) }),
          });
          cacheUpdated = cacheRes.ok;
        }
      } catch { /* The editorial save succeeded; report the cache issue without undoing it. */ }
      setNotice(cacheUpdated ? t('saved') : t('savedCacheWarning'));
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!item || changed || busy || !editable) return;
    if (!window.confirm(t('approveConfirm'))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/api/admin/editorial/${encodeURIComponent(type)}/${encodeURIComponent(id)}/approve`, { method: 'POST' });
      if (!res.ok) {
        const detail = await readApiError(res, t('approveFailed'));
        if (detail.code === 'TIP_STALE') throw new Error(`${t('tipStaleError')} ${t('rejectInstead')}`);
        if (detail.code === 'TIP_EXPIRED') throw new Error(`${t('tipExpiredError')} ${t('rejectInstead')}`);
        throw new Error(detail.message);
      }
      let cacheUpdated = false;
      try {
        const token = await getAccessToken();
        if (token) {
          const cacheRes = await fetch('/api/revalidate', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ kind: type, slugs: item.slug ? [item.slug] : [] }),
          });
          cacheUpdated = cacheRes.ok;
        }
      } catch { /* The decision succeeded; report the cache issue without undoing it. */ }
      setNotice(cacheUpdated ? t('approved') : t('savedCacheWarning'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('approveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function reject(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim() || !editable || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/api/admin/editorial/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      if (!res.ok) throw new Error((await readApiError(res, t('rejectFailed'))).message);
      let cacheUpdated = false;
      try {
        const token = await getAccessToken();
        if (token) {
          const cacheRes = await fetch('/api/revalidate', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ kind: type, slugs: item.slug ? [item.slug] : [] }),
          });
          cacheUpdated = cacheRes.ok;
        }
      } catch { /* The decision succeeded; report the cache issue without undoing it. */ }
      setNotice(cacheUpdated ? t('rejectedNotice') : t('savedCacheWarning'));
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rejectFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!authorized) return null;
  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p><BackLink href="/admin/editorial">{t('backQueue')}</BackLink></p>
      {loading ? <p aria-live="polite">{t('loading')}</p> : null}
      {error ? <p role="alert" style={{ color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 8, padding: '0.75rem' }}>{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {item && draft ? <>
        <header style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div><h1>{type === 'article' ? item.title : `${item.match} - ${item.selection}`}</h1><p style={{ color: 'var(--muted)', marginTop: 0 }}>{type === 'article' ? t('article') : t('freeTip')} - {t(item.status)} - {item.origin === 'manual' ? t('manual') : item.origin || t('originUnknown')}</p></div>
          <span style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.35rem 0.75rem', fontWeight: 700 }}>{t(item.status)}</span>
        </header>

        {type === 'free-tip' && item.origin === 'manual' ? <p role="note" style={{ ...panelStyle, marginTop: '0.5rem' }}>{t('manualEntryByAdmin')}</p> : null}

        {item.reviewerWarnings?.length ? <section aria-labelledby="reviewer-warnings" style={{ ...panelStyle, borderColor: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 10%, var(--surface))' }}>
          <h2 id="reviewer-warnings" style={{ marginTop: 0 }}>{t('warnings')}</h2><ul>{item.reviewerWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
        </section> : null}

        <section style={panelStyle} aria-labelledby="draft-fields"><h2 id="draft-fields" style={{ marginTop: 0 }}>{t('draftContent')}</h2>
          {type === 'article' ? <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label>{t('titleField')}<input style={inputStyle} value={draft.title ?? ''} disabled={!editable || busy} onChange={(e) => update({ title: e.target.value })} /></label>
            <label>{t('slug')}<input style={inputStyle} value={draft.slug ?? ''} disabled={!editable || busy} onChange={(e) => update({ slug: e.target.value })} /></label>
            <label>{t('excerpt')}<textarea style={inputStyle} value={draft.excerpt ?? ''} disabled={!editable || busy} onChange={(e) => update({ excerpt: e.target.value })} rows={3} /></label>
            <label>{t('category')}<select style={inputStyle} value={draft.category ?? 'content'} disabled={!editable || busy} onChange={(e) => update({ category: e.target.value as 'content' | 'news' })}><option value="content">{t('contentCategory')}</option><option value="news">{t('newsCategory')}</option></select></label>
            <label>{t('tags')}<input style={inputStyle} value={(draft.tags ?? []).join(', ')} disabled={!editable || busy} onChange={(e) => update({ tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} /></label>
            <label>{t('bodyMarkdown')}<textarea style={{ ...inputStyle, minHeight: 300, fontFamily: 'monospace' }} value={draft.body ?? ''} disabled={!editable || busy} onChange={(e) => update({ body: e.target.value })} /></label>
            <h3>{t('safePreview')}</h3><article style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div> : <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label>{t('sport')}<input style={inputStyle} value={draft.sport ?? ''} disabled={!editable || busy} onChange={(e) => update({ sport: e.target.value })} /></label>
            <label>{t('competition')}<input style={inputStyle} value={draft.league ?? ''} disabled={!editable || busy} onChange={(e) => update({ league: e.target.value })} /></label>
            <label>{t('match')}<input style={inputStyle} value={draft.match ?? ''} disabled={!editable || busy} onChange={(e) => update({ match: e.target.value })} /></label>
            <label>{t('market')}<input style={inputStyle} value={draft.market ?? ''} disabled={!editable || busy} onChange={(e) => update({ market: e.target.value })} /></label>
            <label>{t('selection')}<input style={inputStyle} value={draft.selection ?? ''} disabled={!editable || busy} onChange={(e) => update({ selection: e.target.value })} /></label>
            <label>{t('odds')}<input type="number" step="any" style={inputStyle} value={draft.odds ?? ''} disabled={!editable || busy} onChange={(e) => update({ odds: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>{t('analysis')}<textarea style={inputStyle} rows={5} value={draft.analysis ?? ''} disabled={!editable || busy} onChange={(e) => update({ analysis: e.target.value })} /></label>
            {item.origin === 'manual' ? <>
              <label>{t('kickoff')}<input type="datetime-local" style={inputStyle} value={toLocalDateTime(draft.kickoffAt)} disabled={!editable || busy} onChange={(e) => update({ kickoffAt: localDateTimeToIso(e.target.value) })} /></label>
              <label>{t('rationale')}<textarea style={inputStyle} rows={4} value={manualRationale} disabled={!editable || busy} onChange={(e) => setManualRationale(e.target.value)} /></label>
              <label>{t('risks')}<textarea style={inputStyle} rows={4} value={manualRisks} placeholder={t('risksPlaceholder')} disabled={!editable || busy} onChange={(e) => setManualRisks(e.target.value)} /></label>
            </> : <>
              <label>{t('kickoffIso')}<input style={inputStyle} value={draft.kickoffAt ?? ''} disabled={!editable || busy} onChange={(e) => update({ kickoffAt: e.target.value || null })} /></label>
              <label>{t('expiryIso')}<input style={inputStyle} value={draft.expiresAt ?? ''} disabled={!editable || busy} onChange={(e) => update({ expiresAt: e.target.value || null })} /></label>
              <label>{t('rationaleJson')}<textarea style={{ ...inputStyle, minHeight: 160, fontFamily: 'monospace' }} value={rationaleText} disabled={!editable || busy} onChange={(e) => setRationaleText(e.target.value)} /></label>
            </>}
          </div>}
          {editable ? <div style={{ marginTop: '0.9rem' }}><button type="button" className="btn btn--secondary" disabled={busy || !changed} onClick={() => void save()}>{busy ? t('working') : t('saveChanges')}</button></div> : <p>{t('readOnly')}</p>}
        </section>

        {item.sources?.length || item.origin !== 'manual' ? <section style={panelStyle} aria-labelledby="sources-heading"><h2 id="sources-heading" style={{ marginTop: 0 }}>{t('sources')}</h2>
          {item.sources?.length ? <ul>{item.sources.map((source, index) => <li key={`${source.url}-${index}`} style={{ marginBottom: '0.65rem' }}><strong>{source.publisher || t('publisherUnknown')}</strong> - {source.title || t('untitled')} {source.url && /^https?:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer nofollow">{t('openSource')}</a> : null}<div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{source.kind ? `${source.kind} - ` : ''}{source.retrievedAt ? t('retrievedAt', { date: new Date(source.retrievedAt).toLocaleString() }) : t('retrievedUnknown')}</div></li>)}</ul> : <p>{t('noSources')}</p>}
        </section> : null}

        {type === 'free-tip' ? <section style={panelStyle} aria-labelledby="tip-evidence"><h2 id="tip-evidence" style={{ marginTop: 0 }}>{t('tipEvidence')}</h2>
          <p><strong>{t('odds')}:</strong> {item.odds ?? t('notAvailable')}{item.oddsProvider ? <> - <strong>{t('provider')}:</strong> {item.oddsProvider}</> : item.origin !== 'manual' ? <> - <strong>{t('provider')}:</strong> {t('notAvailable')}</> : null}{item.oddsRetrievedAt ? <> - <strong>{t('retrieved')}:</strong> {new Date(item.oddsRetrievedAt).toLocaleString()}</> : item.origin !== 'manual' ? <> - <strong>{t('retrieved')}:</strong> {t('notAvailable')}</> : null}</p>
          {item.oddsRetrievedAt ? <p role="status" aria-label={oddsStale ? t('oddsStale') : t('oddsFresh')}><strong>{oddsStale ? `STALE: ${t('oddsStale')}` : `RECENT: ${t('oddsFresh')}`}</strong> - {oddsStale ? t('oddsStaleDetail') : t('oddsFreshDetail')}</p> : item.origin !== 'manual' ? <p>{t('oddsTimestampMissing')}</p> : null}
          <div><h3>{t('rationale')}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{String(item.rationale?.rationale ?? t('notAvailable'))}</p></div>
          <div><h3>{t('risks')}</h3>{riskItems.length ? <ul>{riskItems.map((value, index) => <li key={index}>{value}</li>)}</ul> : item.origin === 'manual' ? null : <p>{t('notAvailable')}</p>}</div>
          <p>{t('kickoff')}: {item.kickoffAt ? new Date(item.kickoffAt).toLocaleString() : t('notAvailable')} - {t('expiry')}: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : t('notAvailable')}</p>
        </section> : null}

        {item.origin !== 'manual' ?         <section style={panelStyle} aria-labelledby="run-heading"><h2 id="run-heading" style={{ marginTop: 0 }}>{t('automationRun')}</h2>
          {item.automationRun ? <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.4rem 1rem' }}><dt>{t('workflow')}</dt><dd>{item.automationRun.workflowName}</dd><dt>{t('runId')}</dt><dd>{item.automationRun.externalRunId || item.automationRun.id}</dd><dt>{t('runStatus')}</dt><dd>{item.automationRun.status || t('notAvailable')}</dd><dt>{t('runStarted')}</dt><dd>{item.automationRun.startedAt ? new Date(item.automationRun.startedAt).toLocaleString() : t('notAvailable')}</dd><dt>{t('runFinished')}</dt><dd>{item.automationRun.finishedAt ? new Date(item.automationRun.finishedAt).toLocaleString() : t('notAvailable')}</dd><dt>{t('runCounts')}</dt><dd>{item.automationRun.createdCount ?? 0} / {item.automationRun.rejectedCount ?? 0}</dd>{item.automationRun.errorSummary ? <><dt>{t('runErrors')}</dt><dd>{item.automationRun.errorSummary}</dd></> : null}{item.automationRun.externalRunUrl && /^https?:\/\//i.test(item.automationRun.externalRunUrl) ? <><dt>{t('runLink')}</dt><dd><a href={item.automationRun.externalRunUrl} target="_blank" rel="noopener noreferrer nofollow">{t('openRun')}</a></dd></> : null}</dl> : <p>{t('noRun')}</p>}
        </section> : null}

        {editable ? <section style={{ ...panelStyle, borderColor: 'var(--border)' }} aria-labelledby="review-actions"><h2 id="review-actions" style={{ marginTop: 0 }}>{t('reviewActions')}</h2>
          {changed ? <p>{t('saveBeforeReview')}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}><button type="button" className="btn btn--primary" disabled={busy || changed} onClick={() => void approve()}>{busy ? t('working') : t('approvePublish')}</button></div>
          <form onSubmit={reject} style={{ display: 'grid', gap: '0.6rem', maxWidth: 600 }}><label htmlFor="rejection-reason">{t('rejectionReason')} <span aria-hidden="true">*</span></label><textarea id="rejection-reason" required minLength={1} maxLength={1000} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} style={inputStyle} rows={3} /><button type="submit" className="btn btn--secondary" disabled={busy || !reason.trim()}>{busy ? t('working') : t('reject')}</button></form>
        </section> : null}
      </> : null}
    </main>
  );
}
