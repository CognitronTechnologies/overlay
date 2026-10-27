'use client';

import { useTranslations } from 'next-intl';
import { useFollow } from './FollowProvider';
import Icon from './Icon';

/**
 * Watchlist toggle for a tipster. Reads shared state from
 * {@link FollowProvider} so many buttons cost one request. Free action —
 * the watchlist tracks public performance without unlocking gated picks.
 */
export default function FollowButton({
  tipsterId,
  size = 'md',
  block = false,
  iconOnly = false,
}: {
  tipsterId: string;
  size?: 'sm' | 'md';
  block?: boolean;
  iconOnly?: boolean;
}) {
  const t = useTranslations('watchlist');
  const { ready, isFollowing, toggle } = useFollow();
  const following = isFollowing(tipsterId);

  const title = following ? t('tooltipAdded') : t('tooltipAdd');
  const ariaLabel = following ? t('removeAria') : t('addAria');

  if (iconOnly) {
    return (
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        aria-pressed={following}
        aria-label={ariaLabel}
        disabled={!ready}
        onClick={() => toggle(tipsterId)}
        title={title}
        style={{
          width: 34,
          height: 34,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          lineHeight: 1,
          color: following ? 'var(--accent)' : 'var(--fg)',
        }}
      >
        <Icon name={following ? 'check' : 'plus'} size={17} />
      </button>
    );
  }

  const className = [
    'btn',
    following ? 'btn--secondary' : 'btn--primary',
    size === 'sm' ? 'btn--sm' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      aria-pressed={following}
      aria-label={ariaLabel}
      disabled={!ready}
      onClick={() => toggle(tipsterId)}
      style={block ? { width: '100%' } : undefined}
      title={title}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <Icon name={following ? 'check' : 'plus'} size={16} />
        {following ? t('added') : t('add')}
      </span>
    </button>
  );
}
