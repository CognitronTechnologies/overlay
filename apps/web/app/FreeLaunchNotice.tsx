import { useTranslations } from 'next-intl';

export default function FreeLaunchNotice() {
  const t = useTranslations('launch');
  return (
    <aside
      role="status"
      style={{
        margin: '1rem 0',
        padding: '0.85rem 1rem',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface)',
      }}
    >
      <strong>{t('title')}</strong>
      <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0' }}>
        {t('description')}
      </p>
    </aside>
  );
}
