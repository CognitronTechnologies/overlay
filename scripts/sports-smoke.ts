/**
 * Live smoke test for the sports-data integration (OB-045). DB-free: it hits
 * The Odds API directly and runs the real responses through our production
 * mappers, so you can validate fixtures → odds (h2h/spreads/totals) → results →
 * grading against a live key without spinning up Postgres.
 *
 * Usage (key read from .env — never pass it on the command line):
 *   node --experimental-strip-types --env-file=.env scripts/sports-smoke.ts
 *
 * Optional: SPORTS_SMOKE_SPORT (default soccer_epl).
 */
import {
  mapEvents,
  mapOdds,
  gradeFromScores,
  type OddsApiEvent,
  type OddsApiEventOdds,
  type OddsApiScoreEvent,
} from '../apps/api/src/integrations/sports/the-odds-api.mapper.ts';

const KEY = process.env.SPORTS_API_KEY;
const SPORT = process.env.SPORTS_SMOKE_SPORT ?? 'soccer_epl';
const BASE = 'https://api.the-odds-api.com/v4';

if (!KEY) {
  console.error(
    'SPORTS_API_KEY is not set. Add it to .env, then run:\n' +
      '  node --experimental-strip-types --env-file=.env scripts/sports-smoke.ts',
  );
  process.exit(1);
}

async function getJson<T>(url: string): Promise<{ data: T; res: Response }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return { data: (await res.json()) as T, res };
}

function creditInfo(res: Response): string {
  const remaining = res.headers.get('x-requests-remaining');
  const used = res.headers.get('x-requests-used');
  return remaining ? ` [credits remaining=${remaining} used=${used}]` : '';
}

console.log(`\n=== The Odds API smoke test · sport="${SPORT}" ===\n`);

// 1) Upcoming fixtures.
const evReq = await getJson<OddsApiEvent[]>(
  `${BASE}/sports/${SPORT}/events?apiKey=${KEY}`,
);
const events = mapEvents(evReq.data);
console.log(`Fixtures: ${events.length}${creditInfo(evReq.res)}`);
const sample = events[0];
if (sample) {
  console.log(
    `  e.g. ${sample.home} vs ${sample.away} @ ${sample.startTime.toISOString()} (${sample.vendorEventId})`,
  );
}

// 2) Odds for the first fixture (h2h + spreads + totals).
if (evReq.data[0]) {
  const oddsReq = await getJson<OddsApiEventOdds[]>(
    `${BASE}/sports/${SPORT}/odds?apiKey=${KEY}&regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal`,
  );
  const target =
    oddsReq.data.find((o) => o.id === evReq.data[0].id) ?? oddsReq.data[0];
  console.log(`\nOdds (mapped)${creditInfo(oddsReq.res)}:`);
  if (target) {
    for (const m of mapOdds(target)) {
      const sample3 = Object.entries(m.prices)
        .slice(0, 4)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.log(
        `  ${m.market}: ${Object.keys(m.prices).length} selection(s) — ${sample3}`,
      );
    }
  } else {
    console.log('  (no odds returned for this fixture yet)');
  }
}

// 3) Recent results + a sample grade.
const scoreReq = await getJson<OddsApiScoreEvent[]>(
  `${BASE}/sports/${SPORT}/scores?apiKey=${KEY}&daysFrom=3`,
);
const completed = scoreReq.data.filter((s) => s.completed && s.scores);
console.log(`\nCompleted (last 3d): ${completed.length}${creditInfo(scoreReq.res)}`);
const done = completed[0];
if (done) {
  const [h, a] = [done.scores![0], done.scores![1]];
  console.log(`  ${done.home_team} ${h?.score}–${a?.score} ${done.away_team}`);
  console.log(
    `  grade 1X2 home=${gradeFromScores(done, '1X2', 'home')}, ` +
      `moneyline away=${gradeFromScores(done, 'moneyline', 'away')}`,
  );
}

console.log('\n=== done ===\n');
