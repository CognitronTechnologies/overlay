'use client';

import { marked } from 'marked';
import { sanitizeHtml } from '@overlay/shared/markdown';
import { formStyles } from '../../formStyles';
import {
  ManagedArticle,
  STATUS_LABELS,
} from './foundation';

const MUTED = 'var(--muted)';

// Preview
interface PreviewProps { body: string; }

export function Preview({ body }: PreviewProps) {
  // Render sanitized markdown preview
  const html = sanitizeHtml(
    marked.parse(body ?? '', { async: false }) as string,
  );

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Preview</h3>

      <article
        style={{
          background: '#0f1420',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '1.25rem',
          lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// Article Card

interface ArticleCardProps {
  article: ManagedArticle;
  onEdit(article: ManagedArticle): void;
  onDelete(id: string): void;
}

export function ArticleCard({ article, onEdit, onDelete, }: ArticleCardProps) {
  return (
    <li
      style={{
        borderTop: '1px solid var(--border)',
        padding: '1rem 0',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        alignItems: 'center',
      }}
    >
      <div>
        <strong>{article.title}</strong>

        <div
          style={{
            color: MUTED,
            fontSize: '0.85rem',
          }}
        >
          {article.category === 'news' ? 'News' : 'Content'} ·{' '}
          {STATUS_LABELS[article.status]} · /{article.slug}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        <button
          style={{
            ...formStyles.button,
            background: 'var(--border)',
            color: 'var(--fg)',
          }}
          onClick={() => onEdit(article)}
        >
          Edit
        </button>

        <button
          style={{
            ...formStyles.button,
            background: '#3a1420',
            color: '#ff9db0',
          }}
          onClick={() => onDelete(article.id)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

// Article List

interface ArticleListProps {
  loading: boolean;
  articles: ManagedArticle[];
  onEdit(article: ManagedArticle): void;
  onDelete(id: string): void;
}

export function ArticleList({ loading, articles, onEdit, onDelete, }: ArticleListProps) {
  // Show loading state
  if (loading) {
    return <p style={{ color: MUTED }}>Loading…</p>;
  }

  // Show empty state
  if (articles.length === 0) {
    return <p style={{ color: MUTED }}>No articles yet.</p>;
  }

  // Render article list
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        marginTop: '1.5rem',
      }}
    >
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}