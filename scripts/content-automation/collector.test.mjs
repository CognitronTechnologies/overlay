import test from 'node:test';
import assert from 'node:assert/strict';
import { collectEvidence, parseRss, selectCompetitions } from './collector.mjs';

const now = new Date('2026-10-30T10:00:00.000Z');
const fixture = {
  response: [{ fixture: { id: 1, date: '2026-10-30T20:00:00Z', status: { short: 'NS' } }, league: { id: 39, season: 2026, name: 'Premier League' }, teams: { home: { id: 10, name: 'Arsenal' }, away: { id: 20, name: 'Chelsea' } } }],
};
const sports = [{ key: 'soccer_epl', title: 'Premier League', active: true }];
const odds = [{ id: 'e1', home_team: 'Arsenal', away_team: 'Chelsea', commence_time: '2026-10-30T20:00:00Z', bookmakers: [{ key: 'b1', title: 'Book One', last_update: now.toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 2.1 }] }] }] }];

function mockFetch(url, options) {
  const parsed = new URL(url);
  assert.ok(!parsed.searchParams.has('apiKey') || parsed.hostname === 'api.the-odds-api.com');
  if (parsed.pathname.endsWith('/leagues')) return Promise.resolve(new Response(JSON.stringify({ response: [{ league: { id: 39, name: 'Premier League' } }] }), { status: 200 }));
  if (parsed.pathname.endsWith('/fixtures')) {
    assert.equal(parsed.searchParams.get('league'), '39');
    assert.equal(parsed.searchParams.get('season'), '2026');
    assert.equal(options.headers['x-apisports-key'], 'fixture-key');
    return Promise.resolve(new Response(JSON.stringify({ response: fixture.response }), { status: 200 }));
  }
  if (parsed.pathname.endsWith('/injuries')) return Promise.resolve(new Response(JSON.stringify({ response: [{ team: { id: 10 }, player: { name: 'Player One', type: 'Missing Fixture', reason: 'Injury' } }] }), { status: 200 }));
  if (parsed.pathname.endsWith('/sports')) return Promise.resolve(new Response(JSON.stringify(sports), { status: 200 }));
  if (parsed.pathname.endsWith('/odds')) return Promise.resolve(new Response(JSON.stringify(odds), { status: 200 }));
  throw new Error(`Unexpected URL: ${url}`);
}

test('collects bounded fixture and exact-book odds evidence without leaking provider keys', async () => {
  const bundle = await collectEvidence({ env: { CONTENT_NEWS_FEEDS_ENABLED: 'false', API_FOOTBALL_API_KEY: 'fixture-key', THE_ODDS_API_KEY: 'odds-key', API_FOOTBALL_LICENSE_APPROVED: 'true', THE_ODDS_API_LICENSE_APPROVED: 'true' }, fetchImpl: mockFetch, now, competitions: selectCompetitions('premier-league') });
  assert.equal(bundle.fixtures.length, 1);
  assert.equal(bundle.odds[0].bookmaker, 'Book One');
  assert.equal(bundle.sources.some((source) => source.url.includes('apiKey=')), false);
  assert.equal(bundle.news.length, 0);
  assert.equal(bundle.fixtures[0].teamNews.home.status, 'injury-data-only');
  assert.equal(bundle.injuryReports.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(bundle)) < 256 * 1024);
  const unapproved = await collectEvidence({ env: { CONTENT_NEWS_FEEDS_ENABLED: 'false', API_FOOTBALL_API_KEY: 'fixture-key', THE_ODDS_API_KEY: 'odds-key' }, fetchImpl: async () => { throw new Error('unapproved provider must not be called'); }, now, competitions: selectCompetitions('premier-league') });
  assert.equal(unapproved.sources.length, 0);
  assert.equal(unapproved.fixtures.length, 0);
});

test('fails closed for missing keys, provider outages, disabled competitions, and feed injection', async () => {
  await assert.rejects(collectEvidence({ env: { CONTENT_NEWS_FEEDS_ENABLED: 'false', API_FOOTBALL_LICENSE_APPROVED: 'true', THE_ODDS_API_LICENSE_APPROVED: 'true' }, now }), /API_FOOTBALL_API_KEY is required/);
  await assert.rejects(collectEvidence({ env: { CONTENT_NEWS_FEEDS_ENABLED: 'false', API_FOOTBALL_API_KEY: 'a', THE_ODDS_API_KEY: 'b', API_FOOTBALL_LICENSE_APPROVED: 'true', THE_ODDS_API_LICENSE_APPROVED: 'true' }, fetchImpl: async () => new Response('', { status: 503 }), now }), /503/);
  assert.throws(() => selectCompetitions('la-liga'), /not enabled/);
  assert.throws(() => parseRss('<!DOCTYPE rss [<!ENTITY x "y">]><rss/>', 'Publisher', 'https://feed.example/rss', now.toISOString()), /DTD\/entity/);
});


const rss = (description = 'Premier League clubs announce the next round schedule.') => `<rss version="2.0"><channel><item><title>Premier League schedule update</title><link>https://news.example/football/update</link><description><![CDATA[${description}]]></description><pubDate>${now.toUTCString()}</pubDate><content:encoded>FULL ARTICLE MUST NEVER APPEAR IN EVIDENCE</content:encoded></item></channel></rss>`;

test('parses RSS snippets and Atom alternate links, never full content or markup', () => {
  const [item] = parseRss(rss('&lt;b&gt;Premier League&lt;/b&gt; &amp; '+Array(100).fill('facts').join(' ')), 'Publisher', 'https://feed.example/rss', now.toISOString());
  assert.ok(item.summary.length <= 400);
  assert.ok(item.summary.split(/\s+/).length <= 60);
  assert.ok(!item.summary.includes('<'));
  assert.ok(!JSON.stringify(item).includes('FULL ARTICLE'));
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>FA Cup update</title><link rel="self" href="https://feed.example/entry"/><link href="https://news.example/cup" rel="alternate"/><published>${now.toISOString()}</published><summary>A short update.</summary><content>FULL ATOM BODY</content></entry></feed>`;
  const [entry] = parseRss(atom, 'Publisher', 'https://feed.example/rss', now.toISOString());
  assert.equal(entry.url, 'https://news.example/cup');
  assert.equal(entry.summary, 'A short update.');
  assert.ok(!JSON.stringify(entry).includes('FULL ATOM'));
  assert.throws(() => parseRss('<html><body>Login</body></html>', 'P', 'https://feed.example/rss', now.toISOString()), /Not a published/);
});

test('enabled public feeds send honest UA, respect robots and never fetch article pages', async () => {
  const calls = [];
  const bundle = await collectEvidence({ env: {}, now, fetchImpl: async (url, options) => {
    calls.push(url);
    assert.match(options.headers['User-Agent'], /OverlayPicks/);
    assert.equal(options.redirect, 'manual');
    if (new URL(url).pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /rss\nDisallow: /football/rss', { headers: { 'content-type': 'text/plain' } });
    assert.equal(url, 'https://feeds.bbci.co.uk/sport/football/rss.xml');
    return new Response(rss(), { headers: { 'content-type': 'application/rss+xml' } });
  } });
  assert.equal(bundle.news.length, 1);
  assert.equal(bundle.policyGates.skippedFeeds.length, 2);
  assert.ok(bundle.policyGates.skippedFeeds.every((item) => /robots.txt disallows/.test(item.reason)));
  assert.ok(bundle.news[0].source.termsNote);
  assert.equal(bundle.news[0].source.permittedAutomatedUse, undefined);
  assert.ok(!calls.includes('https://news.example/football/update'));
});

test('feed kill switch, allow/deny lists, conditional GET and frequency bounds', async () => {
  const disabled = await collectEvidence({ env: { CONTENT_NEWS_FEEDS_ENABLED: 'false' }, now, fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.equal(disabled.news.length, 0);
  const denied = await collectEvidence({ env: { CONTENT_NEWS_FEEDS: 'bbc', CONTENT_NEWS_FEEDS_DENY: 'bbc' }, now, fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.equal(denied.news.length, 0);
  await assert.rejects(collectEvidence({ env: { CONTENT_NEWS_FEEDS: 'https://unreviewed.example/feed' }, now }), /Unknown public news feed/);
  const state = {};
  const env = { CONTENT_NEWS_FEEDS: 'bbc' };
  const first = await collectEvidence({ env, now, feedState: state, fetchImpl: async (url) => new URL(url).pathname === '/robots.txt'
    ? new Response('', { status: 404 }) : new Response(rss(), { headers: { 'content-type': 'application/rss+xml', etag: '"v1"', 'last-modified': now.toUTCString() } }) });
  assert.equal(first.news.length, 1);
  assert.ok(!JSON.stringify(state).includes('Premier League'));
  const soon = await collectEvidence({ env, now, feedState: state, fetchImpl: async () => { throw new Error('minimum interval must prevent fetch'); } });
  assert.match(soon.policyGates.skippedFeeds[0].reason, /six-hour/);
  const later = await collectEvidence({ env, now: new Date(now.getTime() + 10 * 60 * 60_000), feedState: state, fetchImpl: async (url, options) => {
    if (new URL(url).pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /');
    assert.equal(options.headers['If-None-Match'], '"v1"');
    assert.equal(options.headers['If-Modified-Since'], now.toUTCString());
    return new Response(null, { status: 304 });
  } });
  assert.match(later.policyGates.skippedFeeds[0].reason, /304/);
});

test('feed redirects, auth failures, HTML, and unavailable robots are skipped without bypass', async () => {
  for (const [status, type, body] of [[302, 'text/html', 'redirect'], [401, 'text/html', 'login'], [403, 'text/html', 'forbidden'], [200, 'text/html', '<html>Paywall</html>'], [200, 'application/rss+xml', '<html>Login</html>']]) {
    const bundle = await collectEvidence({ env: { CONTENT_NEWS_FEEDS: 'bbc' }, now, fetchImpl: async (url) => new URL(url).pathname === '/robots.txt' ? new Response('User-agent: *\nAllow: /') : new Response(body, { status, headers: { 'content-type': type } }) });
    assert.equal(bundle.news.length, 0);
    assert.equal(bundle.policyGates.skippedFeeds.length, 1);
  }
  let calls = 0;
  const bundle = await collectEvidence({ env: { CONTENT_NEWS_FEEDS: 'bbc' }, now, fetchImpl: async () => { calls += 1; return new Response('', { status: 503 }); } });
  assert.equal(calls, 1);
  assert.match(bundle.policyGates.skippedFeeds[0].reason, /robots unavailable/);
});

test('news scope requires a selected English competition and excludes youth/women/internationals', async () => {
  for (const headline of ['La Liga news', 'Women Premier League update', 'Under-21 Premier League update', 'World Cup news', 'Scottish Premier League update']) {
    const bundle = await collectEvidence({ env: { CONTENT_NEWS_FEEDS: 'bbc' }, now, fetchImpl: async (url) => new URL(url).pathname === '/robots.txt' ? new Response('User-agent: *\nAllow: /') : new Response(rss(headline).replace('Premier League schedule update', headline), { headers: { 'content-type': 'application/rss+xml' } }) });
    assert.equal(bundle.news.length, 0, headline);
  }
});


test('oversized feeds are canceled, stale items are omitted and competition overrides constrain news', async () => {
  const collect = (xml, extra = {}) => collectEvidence({ env: { CONTENT_NEWS_FEEDS: 'bbc' }, now, ...extra, fetchImpl: async (url) => new URL(url).pathname === '/robots.txt' ? new Response('User-agent: *\nAllow: /') : new Response(xml, { headers: { 'content-type': 'application/rss+xml' } }) });
  const oversized = await collect(rss('x'.repeat(513 * 1024)));
  assert.equal(oversized.news.length, 0);
  assert.match(oversized.policyGates.skippedFeeds[0].reason, /safety limit/);
  const stale = await collect(rss().replace(now.toUTCString(), 'Wed, 28 Oct 2026 10:00:00 GMT'));
  assert.equal(stale.news.length, 0);
  const notSelected = await collect(rss(), { competitions: selectCompetitions('fa-cup') });
  assert.equal(notSelected.news.length, 0);
});
