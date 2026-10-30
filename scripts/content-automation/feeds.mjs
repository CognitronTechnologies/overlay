import { FEED_MIN_INTERVAL_MS, FEED_USER_AGENT, selectedFeeds } from './sources.mjs';

function plainText(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, (entity) => {
      const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
      const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/<script\b[^>]*>[\s\S]*?<\/script(?:\s[^>]*)?>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style(?:\s[^>]*)?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseRss(xml, publisher, feedUrl, retrievedAt) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('RSS DTD/entity declarations are not allowed');
  const root = xml.replace(/^\uFEFF/, '').replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g, '').trim();
  if (!/^<(?:rss(?=[\s>])|feed(?=[\s>])|rdf:RDF(?=[\s>]))/i.test(root)) throw new Error('Not a published RSS/Atom document');
  const atom = /^<feed(?=[\s>])/i.test(root);
  const tag = (text, name) => {
    const match = text.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return match ? plainText(match[1]) : '';
  };
  const entries = atom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  return [...root.matchAll(entries)].slice(0, 30).flatMap(([, item]) => {
    const title = tag(item, 'title').slice(0, 300);
    let link = tag(item, 'link');
    if (atom) {
      const links = [...item.matchAll(/<link\b([^>]*?)\/?\s*>/gi)];
      const attrs = (text, name) => plainText(text.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? '');
      link = links.map(([, text]) => ({ href: attrs(text, 'href'), rel: attrs(text, 'rel') })).find((entry) => !entry.rel || entry.rel === 'alternate')?.href ?? '';
    }
    let url;
    try { url = new URL(link, feedUrl); } catch { return []; }
    const published = Date.parse(tag(item, atom ? 'published' : 'pubDate') || (atom ? tag(item, 'updated') : tag(item, 'dc:date')));
    if (!title || !link || !Number.isFinite(published) || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
    // Ignore content:encoded / Atom content even when the feed includes a complete article.
    const summary = tag(item, atom ? 'summary' : 'description').split(/\s+/).slice(0, 60).join(' ').slice(0, 400);
    const publishedAt = new Date(published).toISOString();
    return [{ title, url: url.href, summary, publishedAt, source: { url: url.href, title, publisher, retrievedAt, kind: 'news', tier: 'B', publicFeedEvidence: true, publishedAt } }];
  });
}

export function robotsAllows(text, feedUrl) {
  const groups = [];
  let group = { agents: [], rules: [] };
  let hasDirectives = false;
  for (const line of text.split(/\r?\n/)) {
    const match = line.replace(/#.*$/, '').trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, field, raw] = match;
    const name = field.toLowerCase();
    const value = raw.trim();
    if (name === 'user-agent') {
      if (hasDirectives) { groups.push(group); group = { agents: [], rules: [] }; hasDirectives = false; }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length) {
      hasDirectives = true;
      if (['allow', 'disallow'].includes(name) && value) group.rules.push({ allow: name === 'allow', path: value });
    }
  }
  groups.push(group);
  const specificity = (entry) => Math.max(-1, ...entry.agents.map((agent) => agent === '*' ? 0 : 'overlaypicks'.includes(agent) ? agent.length : -1));
  const best = Math.max(-1, ...groups.map(specificity));
  if (best < 0) return true;
  const url = new URL(feedUrl);
  const target = url.pathname + url.search;
  const rules = groups.filter((entry) => specificity(entry) === best).flatMap((entry) => entry.rules).filter((rule) => {
    const anchored = rule.path.endsWith('$');
    const path = anchored ? rule.path.slice(0, -1) : rule.path;
    const pattern = path.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(target);
  }).sort((a, b) => b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length || Number(b.allow) - Number(a.allow));
  return !rules.length || rules[0].allow;
}

async function boundedText(response, maximum) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) { await reader.cancel(); throw new Error('Feed/robots response exceeds safety limit'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

const competitionPatterns = {
  'premier-league': /\b(?:premier league|epl)\b/i,
  championship: /\b(?:efl |english |sky bet )?championship\b/i,
  'league-one': /\bleague (?:one|1)\b/i,
  'league-two': /\bleague (?:two|2)\b/i,
  'fa-cup': /\bfa cup\b/i,
  'efl-cup': /\b(?:efl|carabao|league) cup\b/i,
};

export async function collectPublicFeeds({ env, fetchImpl, retrievedAt, competitions, feedState = {} }) {
  const news = [];
  const skipped = [];
  const robots = new Map();
  for (const feed of selectedFeeds(env)) {
    try {
      const previous = feedState[feed.id] ?? {};
      const elapsed = Date.parse(retrievedAt) - Date.parse(previous.lastAttemptAt ?? '');
      if (Number.isFinite(elapsed) && elapsed < FEED_MIN_INTERVAL_MS) { skipped.push({ feed: feed.id, reason: 'minimum six-hour interval' }); continue; }
      feedState[feed.id] = { ...previous, lastAttemptAt: retrievedAt };
      const origin = new URL(feed.url).origin;
      if (!robots.has(origin)) {
        const response = await fetchImpl(`${origin}/robots.txt`, { headers: { 'User-Agent': FEED_USER_AGENT }, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
        if (response.status === 404) robots.set(origin, '');
        else if (!response.ok || response.status !== 200 || /text\/html/i.test(response.headers.get('content-type') ?? '')) throw new Error(`robots unavailable (${response.status})`);
        else {
          const text = await boundedText(response, 128 * 1024);
          if (/^\s*</.test(text)) throw new Error('robots response is not plain text');
          robots.set(origin, text);
        }
      }
      if (!robotsAllows(robots.get(origin), feed.url)) { skipped.push({ feed: feed.id, reason: 'robots.txt disallows feed URL' }); continue; }
      const headers = { 'User-Agent': FEED_USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' };
      if (previous.etag) headers['If-None-Match'] = previous.etag;
      if (previous.lastModified) headers['If-Modified-Since'] = previous.lastModified;
      const response = await fetchImpl(feed.url, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
      if (response.status === 304) { skipped.push({ feed: feed.id, reason: 'not modified (304); no stored article content' }); continue; }
      if (response.status !== 200) throw new Error(`public feed unavailable (${response.status}); no redirect/auth bypass`);
      if (!/^(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('feed response is not RSS/Atom XML');
      const items = parseRss(await boundedText(response, 512 * 1024), feed.publisher, feed.url, retrievedAt);
      feedState[feed.id] = { lastAttemptAt: retrievedAt, etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') };
      for (const item of items) {
        const text = `${item.title} ${item.summary}`;
        if (/\b(?:women|wsl|under[- ]?\d+|u-?\d{2}|youth|world cup|international|scottish|welsh|northern irish|irish|south african|indian|ghanaian|nigerian|kenyan|bangladesh|isthmian|southern league|northern premier)\b/i.test(text)) continue;
        const matching = competitions.filter((comp) => competitionPatterns[comp.key]?.test(text)).map((comp) => comp.key);
        const age = Date.parse(retrievedAt) - Date.parse(item.publishedAt);
        if (!matching.length || age < -60_000 || age > 24 * 60 * 60_000) continue;
        news.push({ ...item, competitions: matching, source: { ...item.source, feedId: feed.id, termsNote: feed.termsNote } });
      }
    } catch (error) {
      skipped.push({ feed: feed.id, reason: String(error.message).slice(0, 200) });
    }
  }
  return { news: [...new Map(news.map((item) => [item.url, item])).values()].slice(0, 40), skipped };
}
