import { collectPublicFeeds, parseRss } from './feeds.mjs';
import {
  ENABLED_COMPETITIONS, MAX_EVIDENCE_BYTES, MAX_PROVIDER_RESPONSE_BYTES,
  enforceSize, normalizeName, selectCompetitions,
} from './policy.mjs';
import { parseSportsConfig } from '../../apps/api/src/integrations/sports/sports-config.ts';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const ODDS_SPORTS_URL = 'https://api.the-odds-api.com/v4/sports';
async function jsonRequest(url, headers, fetchImpl) {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${new URL(url).origin}${new URL(url).pathname}`);
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_PROVIDER_RESPONSE_BYTES) throw new Error('Provider response exceeds 1 MiB safety limit');
  try { return JSON.parse(text); } catch { throw new Error('Provider returned malformed JSON'); }
}

function findCompetition(value, selected) {
  const normalized = normalizeName(value);
  return selected.find((item) => normalizeName(item.name) === normalized || normalizeName(item.key) === normalized);
}

function source(url, title, publisher, retrievedAt, kind, extra = {}) {
  return { url, title, publisher, retrievedAt, kind, ...extra };
}

function oddsItems(raw, competition, sourceUrl, retrievedAt) {
  const results = [];
  for (const event of (Array.isArray(raw) ? raw : []).slice(0, 100)) {
    if (!event || !event.id || !event.home_team || !event.away_team) continue;
    for (const bookmaker of (event.bookmakers ?? []).slice(0, 20)) {
      for (const market of (bookmaker.markets ?? []).slice(0, 10)) {
        const name = market.key === 'h2h' ? '1X2' : market.key === 'totals' ? 'totals' : null;
        if (!name) continue;
        for (const outcome of (market.outcomes ?? []).slice(0, 10)) {
          if (!Number.isFinite(outcome.price) || outcome.price <= 1 || outcome.price > 1000) continue;
          const update = market.last_update ?? bookmaker.last_update ?? null;
          results.push({
            competition: competition.key, eventId: event.id,
            home: event.home_team, away: event.away_team,
            kickoffAt: event.commence_time, market: name,
            selection: name === '1X2' ? outcome.name : `${outcome.name} ${outcome.point}`,
            odds: outcome.price, bookmaker: bookmaker.title ?? bookmaker.key,
            oddsUpdatedAt: update, oddsRetrievedAt: retrievedAt,
            sourceUrl, provider: 'The Odds API',
          });
        }
      }
    }
  }
  return results;
}

export async function collectEvidence({ env = process.env, fetchImpl = fetch, now = new Date(), competitions, feedState = {} } = {}) {
  const selected = competitions ?? selectCompetitions(env.CONTENT_COMPETITIONS ?? '');
  if (!selected.length) throw new Error('No enabled competitions selected');
  const footballKey = env.API_FOOTBALL_API_KEY ?? env.SPORTS_API_KEY;
  const oddsKey = env.THE_ODDS_API_KEY ?? env.SPORTS_API_KEY;
  const footballApproved = env.API_FOOTBALL_LICENSE_APPROVED === 'true';
  const oddsApproved = env.THE_ODDS_API_LICENSE_APPROVED === 'true';
  if (footballApproved && !footballKey) throw new Error('API_FOOTBALL_API_KEY is required when API-Football automated use is approved');
  if (oddsApproved && !oddsKey) throw new Error('THE_ODDS_API_KEY is required when The Odds API automated use is approved');
  const retrievedAt = now.toISOString();
  let fixtures = [];
  const fixtureSources = [];
  if (footballApproved) {
    const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    for (const competition of selected) {
      const discoveryUrl = `${API_FOOTBALL_BASE}/leagues?name=${encodeURIComponent(competition.name)}&season=${season}`;
      const catalog = await jsonRequest(discoveryUrl, { 'x-apisports-key': footballKey }, fetchImpl);
      if (!Array.isArray(catalog.response)) throw new Error('API-Football league response is missing response[]');
      const league = catalog.response.find((item) => normalizeName(item.league?.name) === normalizeName(competition.name) && Number.isInteger(item.league?.id));
      if (!league) continue;
      const fixtureUrl = `${API_FOOTBALL_BASE}/fixtures?league=${league.league.id}&season=${season}&next=50`;
      const payload = await jsonRequest(fixtureUrl, { 'x-apisports-key': footballKey }, fetchImpl);
      if (!Array.isArray(payload.response)) throw new Error('API-Football fixture response is missing response[]');
      fixtureSources.push(source(fixtureUrl, `${competition.name} upcoming fixtures`, 'API-Football', retrievedAt, 'match', { provider: 'api-football', tier: 'unverified', performanceData: false, permittedAutomatedUse: true }));
      fixtures.push(...payload.response.slice(0, 100).flatMap((item) => {
        const fixtureCompetition = findCompetition(item.league?.name, selected);
        const kickoff = item.fixture?.date;
        if (fixtureCompetition?.key !== competition.key || item.league?.id !== league.league.id || item.league?.season !== season
          || !kickoff || !Number.isFinite(Date.parse(kickoff)) || !item.teams?.home?.name || !item.teams?.away?.name) return [];
        return [{
          eventId: String(item.fixture.id), competition: competition.key,
          competitionName: competition.name, home: item.teams.home.name, away: item.teams.away.name,
          providerTeamIds: { home: item.teams.home.id ?? null, away: item.teams.away.id ?? null },
          providerLeagueId: item.league.id, providerSeason: item.league.season,
          kickoffAt: new Date(kickoff).toISOString(), status: item.fixture.status?.short ?? 'unknown',
          sourceUrl: fixtureUrl, competitionRound: item.league.round ?? null,
          venue: { name: item.fixture.venue?.name ?? null, city: item.fixture.venue?.city ?? null },
          verifiedVenue: Boolean(item.fixture.venue?.name), seniorMensVerified: false, faCupTipEligible: false,
          teamNews: { home: { status: 'unavailable', sourceUrls: [] }, away: { status: 'unavailable', sourceUrls: [] }, injuries: { home: [], away: [] } },
          suspensionCheck: { status: 'unavailable', sourceUrls: [] },
          squadChecks: { home: { latestTenComplete: false, regularStarterStarts: null, criticalPlayersIdentified: false, criticalPlayerAvailability: 'unknown', uncertainRegularStarters: null }, away: { latestTenComplete: false, regularStarterStarts: null, criticalPlayersIdentified: false, criticalPlayerAvailability: 'unknown', uncertainRegularStarters: null } },
          cupRotationChecked: false, coveredLeagueDivisionsVerified: false, lineupsConfirmed: false,
          formSamples: { home: null, away: null },
        }];
      }));
    }
  }
  const injurySources = [];
  const injuryReports = [];
  if (footballApproved) {
    const leagues = new Map(fixtures.filter((fixture) => Number.isInteger(fixture.providerLeagueId) && Number.isInteger(fixture.providerSeason))
      .map((fixture) => [`${fixture.providerLeagueId}:${fixture.providerSeason}`, fixture]));
    for (const [key, fixture] of leagues) {
      const [leagueId, season] = key.split(':');
      const injuryUrl = `https://v3.football.api-sports.io/injuries?league=${leagueId}&season=${season}`;
      const payload = await jsonRequest(injuryUrl, { 'x-apisports-key': footballKey }, fetchImpl);
      if (!Array.isArray(payload.response)) throw new Error('API-Football injury response is missing response[]');
      injurySources.push(source(injuryUrl, `${fixture.competitionName} injury report`, 'API-Football', retrievedAt, 'other', { provider: 'api-football', tier: 'unverified', performanceData: false, permittedAutomatedUse: true }));
      for (const item of payload.response.slice(0, 1000)) {
        const teamId = item.team?.id;
        const player = item.player ?? {};
        if (!Number.isInteger(teamId) || !player.name) continue;
        for (const event of fixtures.filter((candidate) => candidate.providerLeagueId === fixture.providerLeagueId && candidate.providerSeason === fixture.providerSeason)) {
          const side = event.providerTeamIds.home === teamId ? 'home' : event.providerTeamIds.away === teamId ? 'away' : null;
          if (!side || event.teamNews.injuries[side].length >= 5) continue;
          const record = { team: side === 'home' ? event.home : event.away, player: String(player.name).slice(0, 120), type: String(player.type ?? '').slice(0, 80), reason: String(player.reason ?? '').slice(0, 200), sourceUrl: injuryUrl };
          event.teamNews.injuries[side].push(record);
          event.teamNews[side].status = 'injury-data-only';
          event.teamNews[side].retrievedAt = retrievedAt;
          event.teamNews[side].sourceUrls = [injuryUrl];
          injuryReports.push({ competition: event.competition, eventId: event.eventId, ...record, retrievedAt });
        }
      }
    }
  }
  let sports = [];
  const odds = [];
  const oddsSources = [];
  if (oddsApproved) {
    const sportPayload = await jsonRequest(`${ODDS_SPORTS_URL}?apiKey=${encodeURIComponent(oddsKey)}`, {}, fetchImpl);
    if (!Array.isArray(sportPayload)) throw new Error('The Odds API response is not a sport catalog');
    const selectedByName = new Map(selected.map((item) => [normalizeName(item.name), item]));
    const region = parseSportsConfig(env).regions.split(',')[0];
    sports = sportPayload.filter((sport) => sport.active && selectedByName.has(normalizeName(sport.title))).slice(0, selected.length);
    for (const sport of sports) {
      const competition = selectedByName.get(normalizeName(sport.title));
      const eventsUrl = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport.key)}/odds`;
      oddsSources.push(source(eventsUrl, `${competition.name} market odds`, 'The Odds API', retrievedAt, 'odds', { provider: 'the-odds-api', tier: 'unverified', performanceData: false, permittedAutomatedUse: true }));
      const url = `${eventsUrl}?apiKey=${encodeURIComponent(oddsKey)}&regions=${region}&markets=h2h,totals&oddsFormat=decimal`;
      const raw = await jsonRequest(url, {}, fetchImpl);
      odds.push(...oddsItems(raw, competition, eventsUrl, retrievedAt));
    }
  }
  const { news, skipped: skippedFeeds } = await collectPublicFeeds({ env, fetchImpl, retrievedAt, competitions: selected, feedState });
  const sources = [
    ...fixtureSources,
    ...(oddsApproved ? [source('https://api.the-odds-api.com/v4/sports', 'Sports catalog', 'The Odds API', retrievedAt, 'other', { provider: 'the-odds-api', tier: 'unverified', performanceData: false, permittedAutomatedUse: true })] : []),
    ...oddsSources,
    ...injurySources,
    ...news.map((item) => item.source),
  ];
  const bundle = {
    version: 1, retrievedAt,
    scope: { competitions: selected.map(({ key, name }) => ({ key, name })), maxItems: 100 },
    sources: [...new Map(sources.map((item) => [item.url, item])).values()],
    fixtures: fixtures.slice(0, 100), odds: odds.slice(0, 100),
    injuryReports: injuryReports.slice(0, 100), news: news.slice(0, 40),
    policyGates: {
      publicFeedReaderOnly: true,
      skippedFeeds,
      providersEnabled: { apiFootball: footballApproved, theOddsApi: oddsApproved },
      tipPrerequisites: ['two independent licensed origins', 'licensed performance data', 'current team news for both teams', '10 recent competitive matches per team', 'five current-season matches per team', 'verified venue and competition round', 'exact bookmaker price updated within five minutes', 'all claims source-supported'],
      articlePrerequisites: ['two independent Tier A/B news publishers', 'independent corroboration for consequential claims', 'original synthesis', 'publisher attribution and source links', 'no 25-word verbatim evidence overlap'],
    },
  };
  enforceSize(bundle, MAX_EVIDENCE_BYTES, 'Evidence bundle');
  return bundle;
}

export { parseRss, selectCompetitions, ENABLED_COMPETITIONS };
