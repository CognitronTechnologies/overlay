import type { SVGProps } from 'react';

/**
 * Monochrome line icons for sports, replacing the previous emoji set. Keyed by
 * the same normalised sport keys, with prefix-matching and a trophy fallback,
 * so callers keep the same lookup semantics — just crisper, on-brand glyphs.
 */
type SportKey =
  | 'soccer'
  | 'americanfootball'
  | 'basketball'
  | 'baseball'
  | 'icehockey'
  | 'tennis'
  | 'rugby'
  | 'cricket'
  | 'golf'
  | 'boxing'
  | 'motorsport'
  | 'darts'
  | 'snooker'
  | 'volleyball'
  | 'handball'
  | 'cycling'
  | 'default';

const SPORT_PATHS: Record<SportKey, React.ReactNode> = {
  soccer: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12 8 15 10.2 13.8 13.8 10.2 13.8 9 10.2" />
      <path d="M12 3v2M4.5 9l1.8 1.3M19.5 9l-1.8 1.3M7 19.5l1.2-1.8M17 19.5l-1.2-1.8" />
    </>
  ),
  americanfootball: (
    <>
      <path d="M4 12c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7-8-3-8-7z" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="10.5" y1="10.5" x2="10.5" y2="13.5" />
      <line x1="12" y1="10.5" x2="12" y2="13.5" />
      <line x1="13.5" y1="10.5" x2="13.5" y2="13.5" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M5 5c3.5 2.5 3.5 11.5 0 14M19 5c-3.5 2.5-3.5 11.5 0 14" />
    </>
  ),
  baseball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 5.5c1.8 1.6 1.8 11.4 0 13M17.5 5.5c-1.8 1.6-1.8 11.4 0 13" />
    </>
  ),
  icehockey: (
    <>
      <path d="M3 20l6-16h2l-3 16z" />
      <ellipse cx="17" cy="18" rx="4" ry="1.6" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M4 6c4 2 4 10 0 12M20 6c-4 2-4 10 0 12" />
    </>
  ),
  rugby: (
    <>
      <ellipse cx="12" cy="12" rx="6" ry="9" transform="rotate(45 12 12)" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="10.5" y1="10.5" x2="13.5" y2="13.5" />
      <line x1="13.5" y1="10.5" x2="10.5" y2="13.5" />
    </>
  ),
  cricket: (
    <>
      <line x1="4" y1="20" x2="14" y2="10" />
      <line x1="13" y1="9" x2="16" y2="12" />
      <circle cx="18" cy="6" r="2" />
    </>
  ),
  golf: (
    <>
      <line x1="9" y1="3" x2="9" y2="17" />
      <path d="M9 4l7 2.5-7 2.5" />
      <path d="M5 20c1.5-1 6.5-1 8 0" />
      <circle cx="15" cy="19" r="1" />
    </>
  ),
  boxing: (
    <>
      <path d="M7 8a3 3 0 0 1 3-3h4a4 4 0 0 1 4 4v3a3 3 0 0 1-3 3h-2" />
      <path d="M7 8H6a2 2 0 0 0-2 2v2a3 3 0 0 0 3 3h1" />
      <path d="M9 18v1a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-1" />
    </>
  ),
  motorsport: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </>
  ),
  darts: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  snooker: (
    <>
      <circle cx="9" cy="14" r="4" />
      <circle cx="16" cy="8" r="2.5" />
    </>
  ),
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c-3 4-3 10 0 18M3.5 8c4.5 1 9.5 4 12 11M20.5 8c-4.5 1-9.5 4-12 11" />
    </>
  ),
  handball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l3-4M12 12l-4 1M12 12l2 4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  cycling: (
    <>
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M5.5 17l4-8h5l-3 8M9.5 9h4l2 4" />
    </>
  ),
  default: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
};

/** Resolve a sport (or sport-group) name to an icon key, prefix-aware. */
function resolveKey(name: string): SportKey {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, SportKey> = {
    football: 'soccer',
    soccer: 'soccer',
    americanfootball: 'americanfootball',
    americanfootballnfl: 'americanfootball',
    basketball: 'basketball',
    baseball: 'baseball',
    icehockey: 'icehockey',
    hockey: 'icehockey',
    tennis: 'tennis',
    rugby: 'rugby',
    rugbyleague: 'rugby',
    rugbyunion: 'rugby',
    aussierules: 'rugby',
    cricket: 'cricket',
    golf: 'golf',
    boxing: 'boxing',
    mma: 'boxing',
    mixedmartialarts: 'boxing',
    motorsport: 'motorsport',
    formula1: 'motorsport',
    darts: 'darts',
    snooker: 'snooker',
    volleyball: 'volleyball',
    handball: 'handball',
    cycling: 'cycling',
  };
  if (aliases[key]) return aliases[key];
  for (const k of Object.keys(aliases)) {
    if (key.startsWith(k)) return aliases[k];
  }
  return 'default';
}

export interface SportIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** Sport or sport-group name (case/spacing-insensitive). */
  sport: string;
  size?: number;
}

export default function SportIcon({
  sport,
  size = 20,
  className,
  ...rest
}: SportIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {SPORT_PATHS[resolveKey(sport)]}
    </svg>
  );
}
