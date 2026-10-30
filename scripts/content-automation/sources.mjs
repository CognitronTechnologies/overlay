// Only publisher-offered feed endpoints belong here; article URLs are never fetched.
export const NEWS_FEEDS = Object.freeze({
  bbc: { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', publisher: 'BBC Sport', enabled: true,
    termsNote: 'BBC restricts business RSS and AI grounding without permission; owner accepted residual ToS risk.' },
  sky: { url: 'https://www.skysports.com/rss/11095', publisher: 'Sky Sports', enabled: true,
    termsNote: 'All rights reserved; applicable commercial/AI feed terms remain unverified; owner accepted residual ToS risk.' },
  guardian: { url: 'https://www.theguardian.com/football/rss', publisher: 'The Guardian', enabled: true,
    termsNote: 'Guardian requires written approval for automated extraction and AI generation; owner accepted residual ToS risk.' },
});

export const FEED_USER_AGENT = 'OverlayPicks/1.0 (public RSS/Atom reader; draft-only editorial research)';
export const FEED_MIN_INTERVAL_MS = 6 * 60 * 60_000;

export function selectedFeeds(env = {}) {
  if (/^(false|0|off)$/i.test(String(env.CONTENT_NEWS_FEEDS_ENABLED ?? 'true').trim())) return [];
  const names = env.CONTENT_NEWS_FEEDS === undefined || env.CONTENT_NEWS_FEEDS.trim() === ''
    ? Object.keys(NEWS_FEEDS) : env.CONTENT_NEWS_FEEDS.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  const denied = new Set((env.CONTENT_NEWS_FEEDS_DENY ?? '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean));
  for (const name of [...names, ...denied]) if (!Object.hasOwn(NEWS_FEEDS, name)) throw new Error(`Unknown public news feed: ${name}`);
  return [...new Set(names)].filter((name) => NEWS_FEEDS[name].enabled && !denied.has(name)).map((id) => ({ id, ...NEWS_FEEDS[id] }));
}
