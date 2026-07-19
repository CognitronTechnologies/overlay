'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { authFetch, getProfile } from '../../../lib/auth';
import { formStyles } from '../../formStyles';

type ArticleAuthorStatus = 'pending' | 'approved' | 'suspended';

interface Author {
  userId: string;
  displayName: string | null;
  email: string;
  articleAuthorStatus: ArticleAuthorStatus;
  status: string;
}

const MUTED = 'var(--muted)';

export default function BlogAuthorshipPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [authors, setAuthors] = useState<Author[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/articles/admin/authors');
      console.log(res);

      if (!res.ok) {
        throw new Error('Failed to load authors');
      }

      setAuthors(await res.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load authors',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const profile = await getProfile();

      if (!profile) {
        router.replace('/login');
        return;
      }

      if (profile.role !== 'admin') {
        router.replace('/account');
        return;
      }

      setAuthorized(true);

      await load();
    })();
  }, [router, load]);

  async function updateStatus(
    userId: string,
    articleAuthorStatus: ArticleAuthorStatus,
  ) {
    setSaving(userId);
    setError(null);
    setNotice(null);

    try {
      const res = await authFetch(
        `/api/articles/admin/authors/${userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            articleAuthorStatus,
          }),
        },
      );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error('PATCH failed', res.status, body);
      const msg = Array.isArray(body?.message) ? body?.message[0] : body?.message;
      throw new Error(msg || `Failed to update author (${res.status})`);
    }

      setNotice('Author updated.');

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Update failed',
      );
    } finally {
      setSaving(null);
    }
  }

  if (!authorized) {
    return (
      <main
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '3rem 1.5rem',
        }}
      >
        <p style={{ color: MUTED }}>Loading…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '3rem 1.5rem',
      }}
    >
      <p>
        <Link
          href="/blog"
          style={{ color: 'var(--accent)' }}
        >
          ← Blog
        </Link>
      </p>

      <h1>Article authorship</h1>

      <p style={{ color: MUTED }}>
        Manage which tipsters are allowed to write
        articles. Marketplace approval and article
        authorship are independent.
      </p>

      {error && (
        <p style={formStyles.error}>{error}</p>
      )}

      {notice && (
        <p style={{ color: '#4ade80' }}>
          {notice}
        </p>
      )}

      {loading ? (
        <p style={{ color: MUTED }}>
          Loading authors...
        </p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '2rem',
          }}
        >
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Email</th>
              <th align="left">Tipster</th>
              <th align="left">
                Article author
              </th>
            </tr>
          </thead>

          <tbody>
            {authors.map((author) => (
              <tr key={author.userId}>
                <td>
                  {author.displayName ??
                    'Unnamed'}
                </td>

                <td>{author.email}</td>

                <td>{author.status}</td>

                <td>
                  <select
                    value={
                      author.articleAuthorStatus
                    }
                    disabled={
                      saving === author.userId
                    }
                    onChange={(e) =>
                      updateStatus(
                        author.userId,
                        e.target
                          .value as ArticleAuthorStatus,
                      )
                    }
                  >
                    <option value="pending">
                      Pending
                    </option>

                    <option value="approved">
                      Approved
                    </option>

                    <option value="suspended">
                      Suspended
                    </option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}