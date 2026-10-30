import test from 'node:test';
import assert from 'node:assert/strict';
import { TIP_DISCLAIMER, hasArticleUncertainty, validateDrafts } from './validator.mjs';

const now = new Date('2026-10-30T10:00:00.000Z');
const retrievedAt = now.toISOString();
const sources = [
  { url: 'https://stats.example/matches', title: 'Performance match data', publisher: 'Stats Provider', retrievedAt, kind: 'match' },
  { url: 'https://club.example/team-news', title: 'Club update', publisher: 'Club News', retrievedAt, kind: 'official' },
];
const bundle = {
  retrievedAt,
  sources: [
    { ...sources[0], tier: 'B', performanceData: true, permittedAutomatedUse: true },
    { ...sources[1], tier: 'A', performanceData: false, permittedAutomatedUse: true },
  ],
  fixtures: [{ competition: 'premier-league', home: 'Arsenal', away: 'Chelsea', kickoffAt: '2026-10-30T14:00:00.000Z', status: 'NS', competitionRound: 'Regular Season - 10', seniorMensVerified: true, verifiedVenue: true, teamNews: { home: { status: 'verified', retrievedAt, sourceUrls: [sources[1].url] }, away: { status: 'verified', retrievedAt, sourceUrls: [sources[1].url] } }, suspensionCheck: { status: 'verified', retrievedAt, sourceUrls: [sources[1].url] }, squadChecks: { home: { latestTenComplete: true, regularStarterStarts: 7, criticalPlayersIdentified: true, criticalPlayerAvailability: 'confirmed', uncertainRegularStarters: 1 }, away: { latestTenComplete: true, regularStarterStarts: 6, criticalPlayersIdentified: true, criticalPlayerAvailability: 'confirmed', uncertainRegularStarters: 2 } }, cupRotationChecked: true, lineupsConfirmed: true, formSamples: { home: { completedMatches: 12, currentSeasonMatches: 6, withinDays: 140, retrievedAt }, away: { completedMatches: 11, currentSeasonMatches: 5, withinDays: 160, retrievedAt } } }],
  odds: [{ competition: 'premier-league', home: 'Arsenal', away: 'Chelsea', kickoffAt: '2026-10-30T14:00:00.000Z', market: '1X2', selection: 'Arsenal', odds: 2.1, bookmaker: 'Bookmaker A', oddsUpdatedAt: new Date(now.getTime() - 2 * 60_000).toISOString(), oddsRetrievedAt: retrievedAt, provider: 'The Odds API' }],
};
const cited = sources.map((source) => source.url).join(' ');
const analysis = `${Array(30).fill('Form and venue can change.').join(' ')} Bookmaker A ${cited} ${TIP_DISCLAIMER}`;
const validTip = {
  dedupeKey: 'epl-arsenal-chelsea-test', tipDate: '2026-10-30', sport: 'soccer', league: 'Premier League',
  match: 'Arsenal vs Chelsea', market: '1X2', selection: 'Arsenal', odds: 2.1, analysis,
  kickoffAt: '2026-10-30T14:00:00.000Z', expiresAt: new Date(now.getTime() + 20 * 60_000).toISOString(),
  oddsProvider: 'The Odds API', oddsRetrievedAt: retrievedAt, sources, reviewerWarnings: [],
  rationale: { rationale: `A reviewable explanation supported by both listed sources. ${cited}`, counterarguments: ['A concrete opposing consideration is that relevant lineups remain unknown.', 'A second risk is that team performance can vary despite the available sample.'] },
};

test('accepts a source-grounded tip with a future expiry inside the approval window', () => {
  const result = validateDrafts({ kind: 'tip', response: { drafts: [validTip] }, bundle, now });
  assert.equal(result.accepted.length, 1);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.fatalErrors, []);
});

test('rejects expiries after the kickoff approval cutoff and applies a configured margin', () => {
  const afterDefaultCutoff = { ...validTip, expiresAt: '2026-10-30T13:00:00.001Z' };
  const defaultResult = validateDrafts({ kind: 'tip', response: { drafts: [afterDefaultCutoff] }, bundle, now });
  assert.ok(defaultResult.rejected[0].reasons.some((reason) => reason.includes('kickoff minus the 60-minute approval margin')));

  const shorterCutoff = { ...validTip, expiresAt: '2026-10-30T12:30:00.001Z' };
  const configuredResult = validateDrafts({ kind: 'tip', response: { drafts: [shorterCutoff] }, bundle, now, env: { AUTOMATION_MIN_KICKOFF_LEAD_MINUTES: '90' } });
  assert.ok(configuredResult.rejected[0].reasons.some((reason) => reason.includes('kickoff minus the 90-minute approval margin')));
});

test('rejects an expired tip and invalid configured margin falls back to 60 minutes', () => {
  const expired = { ...validTip, expiresAt: '2026-10-30T09:59:59.999Z' };
  const result = validateDrafts({ kind: 'tip', response: { drafts: [expired] }, bundle, now, env: { AUTOMATION_MIN_KICKOFF_LEAD_MINUTES: '0' } });
  assert.ok(result.rejected[0].reasons.some((reason) => reason.includes('Tip expiry must be in the future')));
  const fallback = validateDrafts({ kind: 'tip', response: { drafts: [{ ...validTip, expiresAt: '2026-10-30T13:00:00.001Z' }] }, bundle, now, env: { AUTOMATION_MIN_KICKOFF_LEAD_MINUTES: 'invalid' } });
  assert.ok(fallback.rejected[0].reasons.some((reason) => reason.includes('60-minute approval margin')));
});

test('drops weak candidates successfully, but treats hallucinated sources and schema deviations as fatal', () => {
  const weakBundle = { ...bundle, fixtures: [{ ...bundle.fixtures[0], teamNews: { home: 'unavailable', away: 'unavailable' } }] };
  const weak = validateDrafts({ kind: 'tip', response: { drafts: [validTip] }, bundle: weakBundle, now });
  assert.equal(weak.accepted.length, 0);
  assert.ok(weak.rejected[0].reasons.some((reason) => reason.includes('team news')));
  const hallucinated = { ...validTip, sources: [...sources, { url: 'https://fake.example/invented', title: 'Invented', publisher: 'Fabricated', retrievedAt, kind: 'news' }] };
  const fatal = validateDrafts({ kind: 'tip', response: { drafts: [hallucinated] }, bundle, now });
  assert.ok(fatal.fatalErrors.some((error) => error.includes('not present in the evidence bundle')));
  const schema = validateDrafts({ kind: 'tip', response: { drafts: [{ ...validTip, publish: true }] }, bundle, now });
  assert.ok(schema.fatalErrors.some((error) => error.includes('unsupported field')));
});

test('requires strict JSON wrapper and rejects malformed non-UTC dates', () => {
  assert.throws(() => validateDrafts({ kind: 'tip', response: '```json{}', bundle, now }));
  const invalid = validateDrafts({ kind: 'tip', response: { drafts: [{ ...validTip, tipDate: '2026-02-31' }] }, bundle, now });
  assert.ok(invalid.fatalErrors.some((error) => error.includes('real UTC calendar date')));
});


test('enforces article source rights, citation URLs, factual sections, and freshness', () => {
  const articleSource = { url: 'https://news.example/report', title: 'Current report', publisher: 'News Publisher', retrievedAt, kind: 'news' };
  const secondSource = { ...articleSource, url: 'https://second.example/report', publisher: 'Second Publisher' };
  const articleBundle = { retrievedAt, sources: [articleSource, secondSource].map((source) => ({ ...source, tier: 'B', publicFeedEvidence: true, termsNote: 'Owner accepted residual ToS risk.', publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString() })) };
  const body = `${now.toISOString().slice(0, 10)} Confirmed facts. Reported details. Commentary and Analysis. Key details remain unclear. The next update is scheduled. ${Array(50).fill('Evidence remains limited and claims are explicitly sourced.').join(' ')} ${articleSource.publisher} ${articleSource.url} ${secondSource.publisher} ${secondSource.url}`;
  const excerpt = 'This report outlines a verified development, explains its relevance, distinguishes confirmed facts from reported detail, notes that key details remain unclear, and identifies the next update readers should monitor. It links sources and avoids assumptions about likely outcomes.';
  const article = { dedupeKey: 'news-current-story-20261030', title: 'A verified football update for readers today now', body, excerpt, tags: ['Premier League', 'Arsenal'], sources: [articleSource, secondSource] };
  const accepted = validateDrafts({ kind: 'article', response: { drafts: [article] }, bundle: articleBundle, now });
  assert.equal(accepted.accepted.length, 1);
  assert.ok(accepted.accepted[0].reviewerWarnings.includes('Researched 2026-10-30 UTC from public feed summaries'));
  assert.ok(accepted.accepted[0].reviewerWarnings.some((warning) => warning.includes('seven days')));
  assert.ok(accepted.accepted[0].reviewerWarnings.some((warning) => warning.includes('ToS risk')));
  const styleOnly = validateDrafts({ kind: 'article', response: { drafts: [{ ...article, title: 'Short headline', excerpt: 'Tiny excerpt.', body: `The next update is upcoming, but key details remain unknown. News Publisher reported it at ${articleSource.url}; Second Publisher also reported the update at ${secondSource.url}.` }] }, bundle: articleBundle, now });
  assert.equal(styleOnly.accepted.length, 1, 'style-length failures are handled by copy lint, not fact validation');
  const noLink = validateDrafts({ kind: 'article', response: { drafts: [{ ...article, body: body.replace(articleSource.url, '') }] }, bundle: articleBundle, now });
  assert.ok(noLink.fatalErrors.some((error) => error.includes('does not cite source URL')));
  const noAttribution = validateDrafts({ kind: 'article', response: { drafts: [{ ...article, body: body.replace(articleSource.publisher, '') }] }, bundle: articleBundle, now });
  assert.ok(noAttribution.fatalErrors.some((error) => error.includes('lacks publisher attribution')));
  const copied = Array.from({ length: 25 }, (_, index) => `word${index}`).join(' ');
  const copying = validateDrafts({ kind: 'article', response: { drafts: [{ ...article, body: `${body} ${copied.toUpperCase()}` }] }, bundle: { ...articleBundle, news: [{ summary: copied }] }, now });
  assert.ok(copying.fatalErrors.some((error) => error.includes('25 words')));
  const singleSource = validateDrafts({ kind: 'article', response: { drafts: [{ ...article, sources: [articleSource] }] }, bundle: articleBundle, now });
  assert.ok(singleSource.fatalErrors.some((error) => /requires 2.*20 sources/.test(error)));
  const staleBundle = { ...articleBundle, sources: [{ ...articleBundle.sources[0], publishedAt: new Date(now.getTime() - 25 * 60 * 60_000).toISOString() }] };
  const stale = validateDrafts({ kind: 'article', response: { drafts: [article] }, bundle: staleBundle, now });
  assert.ok(stale.fatalErrors.some((error) => error.includes('older than 24 hours')));
});


test('accepts natural-language uncertainty without a dedicated heading', () => {
  const phrases = [
    'The club has not confirmed the details.',
    'The timing remains unclear.',
    'Further information is yet to be announced.',
    'No details are available about the decision.',
    'The report remains unconfirmed.',
    'A decision is expected next week.',
    'The club has not yet commented.',
  ];
  for (const phrase of phrases) assert.equal(hasArticleUncertainty(phrase), true, phrase);
  assert.equal(hasArticleUncertainty('The report confirmed the team update.'), false);
});

test('final copy-edited prose may rely on uncertainty from its validated predecessor, with a reviewer warning', () => {
  const articleSource = { url: 'https://news.example/report', title: 'Current report', publisher: 'News Publisher', retrievedAt, kind: 'news' };
  const secondSource = { ...articleSource, url: 'https://second.example/report', publisher: 'Second Publisher' };
  const articleBundle = { retrievedAt, sources: [articleSource, secondSource].map((source) => ({ ...source, tier: 'B', publicFeedEvidence: true, publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString() })) };
  const base = {
    dedupeKey: 'news-uncertainty-copyedit',
    title: 'A reported football change attracts attention across both clubs today',
    excerpt: 'Club officials have not confirmed the timing. Readers can expect an update as the clubs share more information and respond to questions about the decision.',
    body: `The club has not confirmed the timing. The next update is scheduled. ${Array(50).fill('The report describes a confirmed development and attributes each detail carefully.').join(' ')} News Publisher ${articleSource.url} Second Publisher ${secondSource.url}`,
    tags: ['football', 'clubs'], sources: [articleSource, secondSource],
  };
  const before = validateDrafts({ kind: 'article', response: { drafts: [base] }, bundle: articleBundle, now });
  assert.equal(before.accepted.length, 1);
  const copyEdited = {
    ...base,
    body: `Both clubs are preparing for the next update. It is scheduled to follow further discussions. ${Array(50).fill('The report describes a confirmed development and attributes each detail carefully.').join(' ')} News Publisher ${articleSource.url} Second Publisher ${secondSource.url}`,
  };
  const after = validateDrafts({ kind: 'article', response: { drafts: [copyEdited] }, bundle: articleBundle, now, priorValidatedDrafts: before.accepted });
  assert.equal(after.accepted.length, 1);
  assert.ok(after.accepted[0].reviewerWarnings.some((warning) => warning.includes('Copy edit removed uncertainty wording')));
});

test('remains fail-closed when neither the draft nor its validated predecessor handles uncertainty', () => {
  const articleSource = { url: 'https://news.example/report', title: 'Current report', publisher: 'News Publisher', retrievedAt, kind: 'news' };
  const secondSource = { ...articleSource, url: 'https://second.example/report', publisher: 'Second Publisher' };
  const articleBundle = { retrievedAt, sources: [articleSource, secondSource].map((source) => ({ ...source, tier: 'B', publicFeedEvidence: true, publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString() })) };
  const article = {
    dedupeKey: 'news-no-uncertainty', title: 'A reported football change attracts attention across both clubs today',
    excerpt: 'Officials described the development, shared the schedule and explained the next steps readers can follow as both clubs prepare to provide an update.',
    body: `Both clubs confirmed the update. The next announcement is scheduled. ${Array(50).fill('The report describes a confirmed development and attributes each detail carefully.').join(' ')} News Publisher ${articleSource.url} Second Publisher ${secondSource.url}`,
    tags: ['football', 'clubs'], sources: [articleSource, secondSource],
  };
  const result = validateDrafts({ kind: 'article', response: { drafts: [article] }, bundle: articleBundle, now });
  assert.ok(result.fatalErrors.some((error) => error.includes('handle uncertainty in reader-facing prose')));
});
