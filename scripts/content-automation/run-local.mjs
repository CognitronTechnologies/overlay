import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main as pipeline } from './cli.mjs';
import { requireCopilotAuth, resolveCopilot } from './copilot.mjs';
import { MAX_EVIDENCE_BYTES, enforceSize, selectCompetitions } from './policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function localOptions(args) {
  const opts = { kind: 'article', submit: false, max: 5, competitions: '', copyedit: true };
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === '--submit') { opts.submit = true; continue; }
    if (flag === '--no-copyedit') { opts.copyedit = false; continue; }
    if (!['--kind', '--max', '--competitions'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    opts[flag.slice(2)] = flag === '--max' ? Number(value) : value;
  }
  if (!['article', 'tip'].includes(opts.kind)) throw new Error('--kind must be article or tip');
  if (!Number.isInteger(opts.max) || opts.max < 0 || opts.max > 5) throw new Error('--max must be an integer from 0 to 5');
  selectCompetitions(opts.competitions);
  return opts;
}

export async function checkPrerequisites(opts, { env = process.env, findCopilot = resolveCopilot, fetchImpl = fetch } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required.');
  if (opts.max > 0) {
    await findCopilot({ env });
    requireCopilotAuth(env);
  }
  if (!opts.submit) return;
  if (!env.AUTOMATION_INGEST_TOKEN?.trim() || !env.OVERLAY_API_URL?.trim()) throw new Error('--submit requires AUTOMATION_INGEST_TOKEN and OVERLAY_API_URL in this shell (same token as the API).');
  let base;
  try { base = new URL(env.OVERLAY_API_URL); } catch { throw new Error('OVERLAY_API_URL must be an HTTP(S) API origin, e.g. http://localhost:4000'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('OVERLAY_API_URL must be an HTTP(S) API origin without credentials or /api.');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('content:local only submits to a loopback API (localhost, 127.0.0.1, or [::1]).');
  try {
    const response = await fetchImpl(`${base.origin}/api/health/ready`, { signal: AbortSignal.timeout(5_000), redirect: 'error' });
    if (!response.ok || (await response.json()).status !== 'ok') throw new Error('not ready');
  } catch { throw new Error('Local API is unreachable or not ready. Start @overlay/api and check /api/health/ready (Postgres and Redis must be running).'); }
}

// Keep the reader's six-hour polling limit without throwing away the evidence
// from the preceding dry run. Never refresh the original source timestamps.
export function reuseFeedNews(bundle, previous = []) {
  const reusable = new Set((bundle.policyGates?.skippedFeeds ?? []).filter(({ reason }) => reason === 'minimum six-hour interval' || reason.startsWith('not modified (304)')).map(({ feed }) => feed));
  const selected = new Set(bundle.scope.competitions.map(({ key }) => key));
  const now = Date.parse(bundle.retrievedAt);
  const cached = previous.filter((item) => reusable.has(item.source?.feedId) && item.competitions?.some((key) => selected.has(key)) && now - Date.parse(item.publishedAt) >= 0 && now - Date.parse(item.publishedAt) <= 24 * 60 * 60_000 && now - Date.parse(item.source.retrievedAt) >= 0 && now - Date.parse(item.source.retrievedAt) <= 24 * 60 * 60_000);
  bundle.news = [...new Map([...bundle.news, ...cached].map((item) => [item.url, item])).values()].slice(0, 40);
  bundle.sources = [...new Map([...bundle.sources, ...bundle.news.map((item) => item.source)].map((item) => [item.url, item])).values()];
  return cached.length;
}

export async function runLocal(args = process.argv.slice(2), { env = process.env, preflight = checkPrerequisites, run = pipeline, log = console.log, workDirectory = resolve(root, '.content-local') } = {}) {
  const opts = localOptions(args);
  selectCompetitions(opts.competitions || env.CONTENT_COMPETITIONS || '');
  await preflight(opts, { env });
  const work = workDirectory;
  const out = resolve(work, `${new Date().toISOString().replace(/[:.]/g, '-')}-${opts.kind}-${process.pid}`);
  await mkdir(out, { recursive: true });
  const evidence = resolve(out, 'evidence.json');
  const drafts = resolve(out, 'drafts.json');
  const validated = resolve(out, 'validated.json');
  const edited = resolve(out, 'edited.json');
  const finalValidated = resolve(out, 'final-validated.json');
  const newsCache = resolve(work, 'feed-news.json');
  const save = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
  log(`Content local: ${opts.kind}; ${opts.submit ? 'SUBMIT pending drafts to local API' : 'DRY RUN - nothing submitted'}. Outputs: ${out}`);
  try {
    await run(['collect', '--out', evidence, '--competitions', opts.competitions || env.CONTENT_COMPETITIONS || '', '--feed-cache', resolve(work, 'feed-cache.json')]);
    const bundle = await read(evidence);
    const previous = await read(newsCache).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
    const reused = reuseFeedNews(bundle, previous);
    enforceSize(bundle, MAX_EVIDENCE_BYTES, 'Evidence bundle');
    await save(evidence, bundle);
    await save(newsCache, bundle.news);
    log(`Evidence: ${bundle.fixtures.length} fixtures, ${bundle.odds.length} odds lines, ${bundle.news.length} news snippets (${reused} cached; original timestamps retained).`);
    for (const skipped of bundle.policyGates?.skippedFeeds ?? []) log(`Feed ${skipped.feed}: ${skipped.reason}`);
    await run(['draft', '--kind', opts.kind, '--evidence', evidence, '--out', drafts, '--max', String(opts.max)]);
    await run(['validate', '--kind', opts.kind, '--evidence', evidence, '--input', drafts, '--out', validated, '--max', String(opts.max)]);
    let finalPath = validated;
    if (opts.kind === 'article' && opts.copyedit) {
      await run(['copyedit', '--evidence', evidence, '--input', validated, '--out', edited]);
      await run(['validate', '--kind', 'article', '--evidence', evidence, '--input', edited, '--out', finalValidated, '--max', String(opts.max), '--prior-rejected', validated, '--prior-validated', validated]);
      finalPath = finalValidated;
    }
    const result = await read(finalPath);
    if (opts.submit) await run(['submit', '--kind', opts.kind, '--input', finalPath]);
    const summary = { kind: opts.kind, submitted: opts.submit, accepted: result.drafts.length, rejected: result.rejected.length, news: bundle.news.length, outputDirectory: out };
    await save(resolve(out, 'summary.json'), summary);
    log(`Complete: ${summary.accepted} validated, ${summary.rejected} rejected. ${opts.submit ? 'Submission complete; review pending drafts at http://localhost:3000/admin/editorial' : 'Dry run: no API writes. Add --submit to submit for human review.'}`);
    if (!summary.accepted) log('Zero drafts is a valid safe outcome; nothing will appear in the editorial queue. Tips need licensed fixture, performance, team-news and fresh odds evidence.');
    log(`Outputs: ${out}`);
    return summary;
  } catch (error) {
    log(`Stopped; no later stages will run. Inspect outputs: ${out}`);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLocal().catch((error) => { console.error(`content:local: ${error.message}`); process.exitCode = 1; });
}
