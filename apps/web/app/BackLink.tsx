import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from './Icon';

/**
 * Consistent "back" link: a chevron-left icon + label, in the accent colour.
 * Replaces the previous "← Label" text arrows with a crisp SVG that renders
 * identically on every platform. Works in server and client components.
 */
export default function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        color: 'var(--accent)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}
    >
      <Icon name="chevron-left" size={14} />
      {children}
    </Link>
  );
}
