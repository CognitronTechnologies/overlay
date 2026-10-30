import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { localOptions, checkPrerequisites, reuseFeedNews, runLocal } from './run-local.mjs';

const auth = { COPILOT_USE_LOGGED_IN: '1' };
const findCopilot = async () => 'fake-copilot';

test('local flags default to dry-run and enforce bounded scope', () => {
  assert.deepEqual(localOptions([]), { kind: 'article', submit: false, max: 5, competitions: '', copyedit: true });
  assert.deepEqual(localOptions(['--kind', 'tip', '--submit', '--max', '2', '--competitions', 'premier-league']), { kind: 'tip', submit: true, max: 2, competitions: 'premier-league', copyedit: true });
  assert.equal(localOptions(['--no-copyedit']).copyedit, false);
  for (const args of [['--kind'], ['--kind', 'other'], ['--max', '6'], ['--max', '1.5'], ['--max', '-1'], ['--competitions', 'la-liga'], ['--unknown']]) assert.throws(() => localOptions(args));
});

test('preflight reports missing CLI/auth before any collection', async () => {
  const opts = localOptions([]);
  await assert.rejects(checkPrerequisites(opts, { env: {}, findCopilot: async () => { throw new Error('npm install -g @github/copilot'); } }), /npm install/);
  await assert.rejects(checkPrerequisites(opts, { env: {}, findCopilot }), /Copilot auth required/);
  await checkPrerequisites(opts, { env: auth, findCopilot, fetchImpl: () => { throw new Error('Dry runs must not contact API'); } });
  await checkPrerequisites(localOptions(['--max', '0']), { env: {}, findCopilot: () => { throw new Error('Must skip CLI'); } });
});

test('submit preflight requires token/origin and a healthy loopback API without sending token', async () => {
  const opts = localOptions(['--submit']);
  await assert.rejects(checkPrerequisites(opts, { env: auth, findCopilot }), /AUTOMATION_INGEST_TOKEN and OVERLAY_API_URL/);
  for (const url of ['not-url', 'https://remote.example', 'http://localhost:4000/api', 'http://user:pass@localhost:4000']) {
    await assert.rejects(checkPrerequisites(opts, { env: { ...auth, AUTOMATION_INGEST_TOKEN: 'unit-test', OVERLAY_API_URL: url }, findCopilot }));
  }
  const env = { ...auth, AUTOMATION_INGEST_TOKEN: 'unit-test', OVERLAY_API_URL: 'http://localhost:4000' };
  for (const fetchImpl of [async () => { throw new Error('ECONNREFUSED'); }, async () => new Response('{}', { status: 503 }), async () => new Response('{}')]) {
    await assert.rejects(checkPrerequisites(opts, { env, findCopilot, fetchImpl }), /unreachable or not ready/);
  }
  await checkPrerequisites(opts, { env, findCopilot, fetchImpl: async (url, options) => {
    assert.equal(url, 'http://localhost:4000/api/health/ready');
    assert.equal(options.headers, undefined);
    return new Response('{"status":"ok"}');
  } });
});

test('cached feed evidence respects scope, polling skips, age and original timestamps', () => {
  const bundle = { retrievedAt: '2026-10-30T08:00:00Z', scope: { competitions: [{ key: 'premier-league' }] }, news: [], sources: [], policyGates: { skippedFeeds: [{ feed: 'bbc', reason: 'minimum six-hour interval' }] } };
  const item = { url: 'https://example.org/news', publishedAt: '2026-10-30T06:00:00Z', competitions: ['premier-league'], source: { feedId: 'bbc', url: 'https://example.org/news', retrievedAt: '2026-10-30T07:00:00Z' } };
  assert.equal(reuseFeedNews(bundle, [item, { ...item, url: 'old', publishedAt: '2026-10-28T00:00:00Z' }, { ...item, competitions: ['championship'] }, { ...item, source: { ...item.source, feedId: 'disabled' } }]), 1);
  assert.equal(bundle.news[0].source.retrievedAt, '2026-10-30T07:00:00Z');
  assert.equal(bundle.sources.length, 1);
});

test('runner dry-run executes only ordered collect/draft/validate; failures stop downstream stages', async (t) => {
  const calls = [];
  const finalValidationArgs = [];
  const logs = [];
  let out;
  const run = async ([stage, ...args]) => {
    calls.push(stage);
    if (stage === 'validate' && args.includes('--prior-validated')) finalValidationArgs.push(args);
    const path = args[args.indexOf('--out') + 1];
    out = dirname(path);
    const bundle = { retrievedAt: new Date().toISOString(), scope: { competitions: [] }, news: [], sources: [], fixtures: [], odds: [], policyGates: { skippedFeeds: [] } };
    await writeFile(path, JSON.stringify(stage === 'collect' ? bundle : { drafts: [], rejected: [] }));
  };
  const workDirectory = resolve('.content-local', `runner-tests-${process.pid}`);
  t.after(() => rm(workDirectory, { recursive: true, force: true }));
  const summary = await runLocal([], { workDirectory, preflight: async () => {}, run, log: (line) => logs.push(line) });
  assert.deepEqual(calls, ['collect', 'draft', 'validate', 'copyedit', 'validate']);
  assert.ok(finalValidationArgs[0]?.includes('--prior-validated'));
  assert.equal(finalValidationArgs[0]?.[finalValidationArgs[0].indexOf('--prior-validated') + 1], finalValidationArgs[0]?.[finalValidationArgs[0].indexOf('--input') + 1].replace('edited.json', 'validated.json'));
  assert.equal(summary.submitted, false);
  assert.equal(JSON.parse(await readFile(resolve(out, 'summary.json'), 'utf8')).accepted, 0);
  assert.ok(logs.some((line) => line.includes('Zero drafts')));
  await rm(out, { recursive: true, force: true });
  calls.length = 0;
  await runLocal(['--no-copyedit'], { workDirectory, preflight: async () => {}, run, log: () => {} });
  assert.deepEqual(calls, ['collect', 'draft', 'validate']);
  await rm(out, { recursive: true, force: true });
  calls.length = 0;
  await runLocal(['--kind', 'tip'], { workDirectory, preflight: async () => {}, run, log: () => {} });
  assert.deepEqual(calls, ['collect', 'draft', 'validate']);
  await rm(out, { recursive: true, force: true });
  calls.length = 0;
  await runLocal(['--submit'], { workDirectory, preflight: async () => {}, run: async (args) => { if (args[0] === 'submit') { calls.push('submit'); return; } await run(args); }, log: () => {} });
  assert.deepEqual(calls, ['collect', 'draft', 'validate', 'copyedit', 'validate', 'submit']);
  await rm(out, { recursive: true, force: true });
  calls.length = 0;
  await assert.rejects(runLocal([], { workDirectory, preflight: async () => {}, run: async (args) => { if (args[0] === 'draft') { calls.push('draft'); throw new Error('fake draft failed'); } await run(args); }, log: () => {} }), /fake draft failed/);
  assert.deepEqual(calls, ['collect', 'draft']);
});
