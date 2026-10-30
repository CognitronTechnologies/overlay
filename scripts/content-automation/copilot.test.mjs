import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm, chmod, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { copilotEnv, copilotLaunch, requireCopilotAuth, resolveCopilot } from './copilot.mjs';
import { main } from './cli.mjs';

const work = resolve('.content-local', `launcher-tests-${process.pid}`);

test('Windows resolves exe before cmd and honors COPILOT_CLI with spaces', async () => {
  const existing = new Set(['C:\\npm\\copilot.cmd', 'D:\\tools\\copilot.exe', 'C:\\custom tools\\my-copilot.cmd']);
  const canExecute = async (path) => existing.has(path);
  assert.equal(await resolveCopilot({ platform: 'win32', env: { Path: 'C:\\npm;D:\\tools' }, canExecute }), 'D:\\tools\\copilot.exe');
  assert.equal(await resolveCopilot({ platform: 'win32', env: { PATH: 'C:\\npm' }, canExecute }), 'C:\\npm\\copilot.cmd');
  assert.equal(await resolveCopilot({ platform: 'win32', env: { COPILOT_CLI: 'C:\\custom tools\\my-copilot.cmd' }, canExecute }), 'C:\\custom tools\\my-copilot.cmd');
  assert.equal(await resolveCopilot({ platform: 'win32', env: { PATH: 'C:\\npm', COPILOT_CLI: 'copilot' }, canExecute }), 'C:\\npm\\copilot.cmd');
  await assert.rejects(resolveCopilot({ env: {}, canExecute: async () => false }), /npm install -g @github\/copilot/);
});

test('cmd fallback quotes spaces, bounds command length, and rejects expansion/injection', () => {
  const launch = copilotLaunch('C:\\Program Files\\copilot.cmd', ['-p', 'Read instructions.md and evidence.json.'], { platform: 'win32', env: { SystemRoot: 'C:\\Windows' } });
  assert.equal(launch.file, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(launch.args, ['/d', '/s', '/c', '""C:\\Program Files\\copilot.cmd" "-p" "Read instructions.md and evidence.json.""']);
  assert.equal(launch.options.windowsVerbatimArguments, true);
  assert.equal(launch.options.shell, false);
  for (const unsafe of ['a"b', '%TOKEN%', '!TOKEN!', 'a&whoami', 'a|b', 'a\nb', 'a^b', 'a>b']) {
    assert.throws(() => copilotLaunch('copilot.cmd', ['-p', unsafe], { platform: 'win32' }), /Unsafe Windows/);
  }
  assert.throws(() => copilotLaunch('copilot.cmd', ['x'.repeat(8000)], { platform: 'win32' }), /too long/);
  assert.throws(() => copilotLaunch('copilot.exe', ['x'.repeat(31_000)], { platform: 'win32' }), /too long/);
  assert.equal(copilotLaunch('copilot.exe', ['-p', 'safe'], { platform: 'win32' }).file, 'copilot.exe');
  assert.equal(copilotLaunch('copilot', ['-p', 'safe'], { platform: 'linux' }).file, 'copilot');
});

test('explicit local login or CI token is required; sandbox env excludes unrelated credentials', () => {
  assert.throws(() => requireCopilotAuth({}), /Copilot auth required/);
  assert.throws(() => requireCopilotAuth({ COPILOT_USE_LOGGED_IN: 'true' }), /Copilot auth required/);
  requireCopilotAuth({ COPILOT_USE_LOGGED_IN: '1' });
  requireCopilotAuth({ COPILOT_GITHUB_TOKEN: 'unit-test-token' });
  const env = copilotEnv({ Path: 'bin', USERPROFILE: 'profile', APPDATA: 'roaming', LOCALAPPDATA: 'local', SystemRoot: 'windows', COPILOT_GITHUB_TOKEN: 'unit-test-token', API_FOOTBALL_API_KEY: 'test-provider', THE_ODDS_API_KEY: 'test-provider', AUTOMATION_INGEST_TOKEN: 'test-ingest', DATABASE_URL: 'test-db', NODE_OPTIONS: '--bad' });
  assert.equal(env.APPDATA, 'roaming');
  assert.equal(env.LOCALAPPDATA, 'local');
  assert.equal(env.SystemRoot, 'windows');
  assert.equal(env.COPILOT_GITHUB_TOKEN, 'unit-test-token');
  for (const key of ['API_FOOTBALL_API_KEY', 'THE_ODDS_API_KEY', 'AUTOMATION_INGEST_TOKEN', 'DATABASE_URL', 'NODE_OPTIONS']) assert.equal(env[key], undefined);
});

test('real fake-shim launch keeps large evidence and instructions out of argv and finds templates', async (t) => {
  await mkdir(resolve(work, 'fake tools'), { recursive: true });
  t.after(() => rm(work, { recursive: true, force: true }));
  const script = resolve(work, 'fake tools', 'fake-cli.mjs');
  await writeFile(script, `#!/usr/bin/env node\nimport { readFile, writeFile } from 'node:fs/promises';\nimport assert from 'node:assert/strict';\nassert.ok(process.argv.join(' ').length < 2000);\nassert.ok((await readFile('evidence.json', 'utf8')).length > 90000);\nassert.match(await readFile('instructions.md', 'utf8'), /draft-only Overlay article/);\nassert.equal(process.env.AUTOMATION_INGEST_TOKEN, undefined);\nassert.equal(process.env.THE_ODDS_API_KEY, undefined);\nawait writeFile('draft-output.json', JSON.stringify({ drafts: [] }));\n`);
  let executable = script;
  if (process.platform === 'win32') {
    executable = resolve(work, 'fake tools', 'copilot.cmd');
    await writeFile(executable, `@echo off\r\n"${process.execPath}" "%~dp0fake-cli.mjs" %*\r\n`);
  } else await chmod(script, 0o755);
  const changes = { COPILOT_CLI: executable, COPILOT_USE_LOGGED_IN: '1', AUTOMATION_INGEST_TOKEN: 'unit-test-ingest', THE_ODDS_API_KEY: 'unit-test-provider' };
  const old = Object.fromEntries(Object.keys(changes).map((key) => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, changes);
  const evidence = resolve(work, 'evidence.json');
  const output = resolve(work, 'drafts.json');
  await writeFile(evidence, JSON.stringify({ testEvidence: 'x'.repeat(100_000) }));
  await main(['draft', '--kind', 'article', '--evidence', evidence, '--out', output]);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), { drafts: [] });
  await assert.rejects(readFile(resolve(work, '.copilot-read-write', 'evidence.json')), /ENOENT/);
});
const copyeditWork = resolve('.content-local', `copyedit-cli-tests-${process.pid}`);

test('copyedit runs a fake Copilot in a read/write-only file sandbox', async (t) => {
  try { await readFile(resolve('.github', 'skills', 'overlay-copy-edit', 'SKILL.md'), 'utf8'); }
  catch { t.skip('runtime copy-edit skill is not available yet'); return; }
  await mkdir(resolve(copyeditWork, 'fake tools'), { recursive: true });
  t.after(() => rm(work, { recursive: true, force: true }));
  const script = resolve(copyeditWork, 'fake tools', 'fake-cli.mjs');
  await writeFile(script, `#!/usr/bin/env node\nimport { readFile, writeFile } from 'node:fs/promises';\nimport assert from 'node:assert/strict';\nassert.ok(process.argv.includes('--allow-tool=read'));\nassert.ok(process.argv.includes('--allow-tool=write'));\nassert.ok(process.argv.includes('--deny-tool=shell'));\nassert.ok(process.argv.includes('--deny-tool=web_search'));\nassert.ok(process.argv.includes('--deny-tool=web_fetch'));\nassert.match(await readFile('instructions.md', 'utf8'), /UK English/);\nassert.match(await readFile('evidence.json', 'utf8'), /Arsenal/);\nconst input = JSON.parse(await readFile('validated.json', 'utf8'));\nassert.equal(process.env.AUTOMATION_INGEST_TOKEN, undefined);\nassert.equal(process.env.API_FOOTBALL_API_KEY, undefined);\nawait writeFile('edited.json', JSON.stringify(input));\n`);
  let executable = script;
  if (process.platform === 'win32') {
    executable = resolve(copyeditWork, 'fake tools', 'copilot.cmd');
    await writeFile(executable, `@echo off\r\n"${process.execPath}" "%~dp0fake-cli.mjs" %*\r\n`);
  } else await chmod(script, 0o755);
  const changes = { COPILOT_CLI: executable, COPILOT_USE_LOGGED_IN: '1', AUTOMATION_INGEST_TOKEN: 'unit-test-ingest', API_FOOTBALL_API_KEY: 'unit-test-provider' };
  const old = Object.fromEntries(Object.keys(changes).map((key) => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, changes);
  const source = { url: 'https://news.example/arsenal', title: 'Arsenal update', publisher: 'News Desk', retrievedAt: '2026-10-30T09:00:00.000Z', kind: 'news' };
  const body = `${Array(30).fill('Arsenal prepare for the next fixture after a positive result.').join(' ')} News Desk reported the update [News Desk](${source.url}).`;
  const input = resolve(copyeditWork, 'validated.json');
  const evidence = resolve(copyeditWork, 'evidence.json');
  const output = resolve(copyeditWork, 'edited.json');
  await writeFile(input, JSON.stringify({ drafts: [{ dedupeKey: 'arsenal-test-20261030', title: 'Arsenal prepare for an important Premier League fixture', body, excerpt: 'Arsenal prepare for the next fixture after a positive result. The update provides readers with a clear account of the latest development and the next scheduled event.', category: 'news', tags: ['Arsenal'], sources: [source], reviewerWarnings: [] }] }));
  await writeFile(evidence, JSON.stringify({ sources: [source], fixtures: [], news: [{ title: 'Arsenal update' }] }));
  await main(['copyedit', '--evidence', evidence, '--input', input, '--out', output]);
  const result = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(result.drafts.length, 1);
  assert.ok(result.drafts[0].reviewerWarnings.some((warning) => warning.startsWith('Copy edit:')));
  await assert.rejects(readFile(resolve(copyeditWork, '.copilot-copyedit-read-write', 'evidence.json')), /ENOENT/);
});
