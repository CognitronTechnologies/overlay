import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, appendFile, readdir, chmod, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEvidence } from './collector.mjs';
import { copilotEnv, copilotLaunch, requireCopilotAuth, resolveCopilot } from './copilot.mjs';
import { MAX_DRAFT_OUTPUT_BYTES, MAX_EVIDENCE_BYTES, enforceSize, kickoffApprovalMarginMinutes, selectCompetitions } from './policy.mjs';
import { validateDrafts } from './validator.mjs';
import { prepareCopyEditedDrafts } from './copyedit.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const prompts = resolve(root, 'scripts', 'content-automation', 'prompts');

function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) throw new Error(`Unexpected argument: ${args[i]}`);
    result[args[i].slice(2)] = args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[++i];
  }
  return result;
}

async function json(path) { return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')); }
async function saveJson(path, value) { await mkdir(dirname(resolve(path)), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' }); }

async function fixtureFetch(fixturePath) {
  const data = await json(fixturePath);
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/robots.txt') return new Response(data.robots ?? 'User-agent: *\nAllow: /', { headers: { 'content-type': 'text/plain' } });
    if (data.feeds && parsed.hostname in data.feeds) return new Response(data.feeds[parsed.hostname].replaceAll('__PUBLISHED_AT__', new Date().toUTCString()), { headers: { 'content-type': 'application/rss+xml' } });
    const route = parsed.pathname.endsWith('/leagues') ? 'leagues'
      : parsed.pathname.endsWith('/injuries') ? 'injuries'
        : parsed.pathname.endsWith('/fixtures') ? 'fixtures'
        : parsed.pathname.endsWith('/sports') ? 'sports'
        : parsed.pathname.endsWith('/odds') ? parsed.pathname.split('/').slice(-2, -1)[0] : null;
    if (!route || !(route in data)) throw new Error(`No fixture response configured for ${parsed.pathname}`);
    return new Response(JSON.stringify(data[route]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

async function collect(args) {
  const opts = options(args);
  if (!opts.out) throw new Error('collect requires --out');
  const selected = selectCompetitions(String(opts.competitions ?? process.env.CONTENT_COMPETITIONS ?? ''));
  const fetchImpl = opts.fixture ? await fixtureFetch(String(opts.fixture)) : fetch;
  const feedState = opts['feed-cache'] ? await json(String(opts['feed-cache'])).catch((error) => { if (error.code === 'ENOENT') return {}; throw error; }) : {};
  const bundle = await collectEvidence({ env: process.env, fetchImpl, competitions: selected, feedState });
  if (opts['feed-cache']) await saveJson(String(opts['feed-cache']), feedState);
  await saveJson(String(opts.out), bundle);
  console.log(`Collected ${bundle.fixtures.length} fixtures, ${bundle.odds.length} odds lines, ${bundle.news.length} public-feed news snippets.`);
}

async function draft(args) {
  const opts = options(args);
  const kind = String(opts.kind ?? '');
  if (!['article', 'tip'].includes(kind) || !opts.evidence || !opts.out) throw new Error('draft requires --kind article|tip --evidence PATH --out PATH');
  const maxDrafts = Number(opts.max ?? 5);
  if (!Number.isInteger(maxDrafts) || maxDrafts < 0 || maxDrafts > 5) throw new Error('max must be an integer from 0 to 5');
  if (maxDrafts === 0) { await saveJson(String(opts.out), { drafts: [] }); console.log('Maximum drafts is zero; skipped Copilot.'); return; }
  requireCopilotAuth();
  const executable = await resolveCopilot();
  const bundle = await json(String(opts.evidence));
  enforceSize(bundle, MAX_EVIDENCE_BYTES, 'Evidence bundle');
  const promptTemplate = await readFile(resolve(prompts, `${kind === 'tip' ? 'tips' : 'news'}.md`), 'utf8');
  const basePrompt = promptTemplate.replaceAll('[[APPROVAL_MARGIN_MINUTES]]', String(kickoffApprovalMarginMinutes(process.env)));
  const prompt = 'Read instructions.md and evidence.json in this directory. Follow instructions.md and write the JSON result to draft-output.json.';
  const safeEnv = copilotEnv();
  const launch = copilotLaunch(executable, ['-p', prompt, '--allow-tool=read', '--allow-tool=write', '--deny-tool=shell', '--deny-tool=web_search', '--deny-tool=web_fetch', '--no-ask-user'], { env: safeEnv });
  const sandbox = resolve(dirname(String(opts.out)), '.copilot-read-write');
  const evidenceFile = resolve(sandbox, 'evidence.json');
  const outputFile = resolve(sandbox, 'draft-output.json');
  const instructionsFile = resolve(sandbox, 'instructions.md');
  await rm(sandbox, { recursive: true, force: true });
  await mkdir(sandbox, { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(bundle)}\n`, { flag: 'wx' });
  await writeFile(outputFile, '', { flag: 'wx' });
  const instructions = `${basePrompt}\nReturn no more than ${maxDrafts} draft(s). Read only instructions.md and evidence.json. Write exactly one JSON object with a drafts array to draft-output.json; do not create or modify any other file.\n`;
  await writeFile(instructionsFile, instructions, { flag: 'wx' });
  await chmod(instructionsFile, 0o444);
  await chmod(evidenceFile, 0o444);
  await chmod(outputFile, 0o666);
  await chmod(sandbox, 0o555);
  console.log(`Copilot inputs: ${Buffer.byteLength(prompt)} prompt bytes; ${Buffer.byteLength(instructions)} instruction bytes; ${Buffer.byteLength(JSON.stringify(bundle))} evidence bytes (files, not argv).`);
  let content;
  try {
    await exec(launch.file, launch.args, { ...launch.options, cwd: sandbox, env: safeEnv, timeout: 240_000, maxBuffer: MAX_DRAFT_OUTPUT_BYTES + 32 * 1024, windowsHide: true });
    await chmod(sandbox, 0o755);
    const files = (await readdir(sandbox)).sort();
    if (files.length !== 3 || files[0] !== 'draft-output.json' || files[1] !== 'evidence.json' || files[2] !== 'instructions.md') throw new Error('Copilot created an unexpected file in its restricted workspace');
    content = (await readFile(outputFile, 'utf8')).trim();
  } catch (error) {
    await chmod(sandbox, 0o755).catch(() => {});
    const detail = String(error.stderr ?? error.message).slice(0, 1000);
    throw new Error(`Copilot CLI failed (auth, quota, or execution): ${detail}`);
  } finally {
    await chmod(sandbox, 0o755).catch(() => {});
    await rm(sandbox, { recursive: true, force: true }).catch(() => {});
  }
  if (!content || Buffer.byteLength(content) > MAX_DRAFT_OUTPUT_BYTES) throw new Error('Copilot returned empty or oversized output');
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new Error('Copilot output was not strict JSON'); }
  await saveJson(String(opts.out), parsed);
  console.log('Copilot returned bounded JSON output.');
}

async function copyedit(args) {
  const opts = options(args);
  if (!opts.evidence || !opts.input || !opts.out) throw new Error('copyedit requires --evidence PATH --input PATH --out PATH');
  const input = await json(String(opts.input));
  if (!input || !Array.isArray(input.drafts)) throw new Error('copyedit input must contain validated drafts');
  const original = input.drafts;
  const evidence = await json(String(opts.evidence));
  enforceSize(evidence, MAX_EVIDENCE_BYTES, 'Evidence bundle');
  const finish = async (candidate) => {
    const result = prepareCopyEditedDrafts(original, candidate, evidence);
    for (const item of result.rejected) console.warn(`Copy edit fallback draft ${item.index ?? ''}: ${item.reason ?? item}`);
    for (const item of result.lintWarnings) console.warn(`Draft ${item.index}: ${item.warning}`);
    await saveJson(String(opts.out), { drafts: result.drafts });
    console.log(`Copy edit complete: ${result.drafts.length} article(s), ${result.rejected.length} reverted, ${result.lintWarnings.length} lint warning(s).`);
  };
  if (!original.length) { await finish([]); return; }

  const sandbox = resolve(dirname(String(opts.out)), '.copilot-copyedit-read-write');
  const evidenceFile = resolve(sandbox, 'evidence.json');
  const validatedFile = resolve(sandbox, 'validated.json');
  const outputFile = resolve(sandbox, 'edited.json');
  const instructionsFile = resolve(sandbox, 'instructions.md');
  await rm(sandbox, { recursive: true, force: true });
  await mkdir(sandbox, { recursive: true });
  try {
    const skillPath = resolve(root, '.github', 'skills', 'overlay-copy-edit', 'SKILL.md');
    const skill = (await readFile(skillPath, 'utf8')).replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '').trim();
    if (!skill) throw new Error('Overlay copy-edit skill is missing or empty');
    const wrapper = `\n\n## Pipeline wrapper\nEdit only article prose for publication readiness. Preserve every factual detail and return exactly the same article objects and number of drafts. The fields dedupeKey, sources (including the full array), category, and tags must remain identical. Do not add or remove any URLs, numbers, scores, dates, or proper nouns. Do not add fields. Return exactly JSON {"drafts":[...]} in edited.json. Read only instructions.md, evidence.json, and validated.json; write only edited.json.\n`;
    await writeFile(evidenceFile, `${JSON.stringify(evidence)}\n`, { flag: 'wx' });
    await writeFile(validatedFile, `${JSON.stringify({ drafts: original })}\n`, { flag: 'wx' });
    await writeFile(outputFile, '', { flag: 'wx' });
    await writeFile(instructionsFile, `${skill}${wrapper}`, { flag: 'wx' });
    await chmod(instructionsFile, 0o444);
    await chmod(evidenceFile, 0o444);
    await chmod(validatedFile, 0o444);
    await chmod(outputFile, 0o666);
    await chmod(sandbox, 0o555);
    requireCopilotAuth();
    const executable = await resolveCopilot();
    const safeEnv = copilotEnv();
    const prompt = 'Read instructions.md, evidence.json, and validated.json. Follow instructions.md and write the edited JSON to edited.json.';
    const launch = copilotLaunch(executable, ['-p', prompt, '--allow-tool=read', '--allow-tool=write', '--deny-tool=shell', '--deny-tool=web_search', '--deny-tool=web_fetch', '--no-ask-user'], { env: safeEnv });
    console.log(`Copilot copy-edit inputs: ${Buffer.byteLength(skill)} style bytes; ${Buffer.byteLength(JSON.stringify(evidence))} evidence bytes; ${Buffer.byteLength(JSON.stringify(original))} validated draft bytes.`);
    await exec(launch.file, launch.args, { ...launch.options, cwd: sandbox, env: safeEnv, timeout: 240_000, maxBuffer: MAX_DRAFT_OUTPUT_BYTES + 32 * 1024, windowsHide: true });
    await chmod(sandbox, 0o755);
    const files = (await readdir(sandbox)).sort();
    if (files.length !== 4 || files[0] !== 'edited.json' || files[1] !== 'evidence.json' || files[2] !== 'instructions.md' || files[3] !== 'validated.json') throw new Error('Copilot created an unexpected file in its restricted workspace');
    const content = (await readFile(outputFile, 'utf8')).trim();
    if (!content || Buffer.byteLength(content) > MAX_DRAFT_OUTPUT_BYTES) throw new Error('Copilot returned empty or oversized copy-edit output');
    const edited = JSON.parse(content);
    if (!edited || typeof edited !== 'object' || Array.isArray(edited) || Object.keys(edited).some((key) => key !== 'drafts') || !Array.isArray(edited.drafts)) throw new Error('Copy-edit output must be a JSON object with a drafts array only');
    await finish(edited.drafts);
  } catch (error) {
    const detail = String(error.stderr ?? error.message).slice(0, 240);
    console.warn(`Copy edit unavailable; retaining validated article(s): ${detail}`);
    const fallback = prepareCopyEditedDrafts(original, [], evidence).drafts.map((draft) => ({ ...draft, reviewerWarnings: [...new Set([...(draft.reviewerWarnings ?? []), `Copy edit rejected: ${detail}`])].slice(0, 20) }));
    await saveJson(String(opts.out), { drafts: fallback });
  } finally {
    await chmod(sandbox, 0o755).catch(() => {});
    await rm(sandbox, { recursive: true, force: true }).catch(() => {});
  }
}

async function validate(args) {
  const opts = options(args);
  const kind = String(opts.kind ?? '');
  if (!['article', 'tip'].includes(kind) || !opts.evidence || !opts.input || !opts.out) throw new Error('validate requires --kind article|tip --evidence PATH --input PATH --out PATH');
  const priorValidated = opts['prior-validated'] ? await json(String(opts['prior-validated'])) : null;
  if (priorValidated && !Array.isArray(priorValidated.drafts)) throw new Error('--prior-validated file must contain a drafts array');
  const result = validateDrafts({ kind, response: await json(String(opts.input)), bundle: await json(String(opts.evidence)), maxDrafts: Number(opts.max ?? 5), priorValidatedDrafts: priorValidated?.drafts ?? [] });
  const priorOutput = opts['prior-rejected'] ? await json(String(opts['prior-rejected'])) : null;
  if (priorOutput && !Array.isArray(priorOutput.rejected)) throw new Error('--prior-rejected file must contain a rejected array');
  const rejected = [...(priorOutput?.rejected ?? []), ...result.rejected];
  for (const item of result.rejected) console.error(`Dropped draft ${item.index}: ${item.reasons.join('; ')}`);
  if (result.fatalErrors.length) {
    await saveJson(String(opts.out), { drafts: [], rejected, fatalErrors: result.fatalErrors });
    throw new Error(`Validation failed closed; no drafts can be submitted. ${result.fatalErrors.join('; ')}`);
  }
  await saveJson(String(opts.out), { drafts: result.accepted, rejected });
  console.log(`Validated ${result.accepted.length} strong candidate(s); dropped ${rejected.length} draft(s).`);
}

async function apiRequest(url, token, body) {
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 400) }; }
  if (response.status === 409 && /duplicate/i.test(JSON.stringify(data))) return { ...data, duplicate: true };
  if (!response.ok) throw new Error(`Overlay API request failed (${response.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function submit(args) {
  const opts = options(args);
  const kind = String(opts.kind ?? '');
  if (!['article', 'tip'].includes(kind) || !opts.input) throw new Error('submit requires --kind article|tip --input PATH');
  const token = process.env.AUTOMATION_INGEST_TOKEN;
  const base = (process.env.OVERLAY_API_URL ?? '').replace(/\/+$/, '');
  if (!token || !base) throw new Error('AUTOMATION_INGEST_TOKEN and OVERLAY_API_URL are required for submission');
  const file = await json(String(opts.input));
  if (!Array.isArray(file.drafts) || file.fatalErrors?.length) throw new Error('Refusing to submit unvalidated draft output');
  const api = `${base}/api/automation`;
  const externalRunId = `${process.env.GITHUB_RUN_ID ?? 'local'}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`;
  const started = await apiRequest(`${api}/runs`, token, {
    workflowName: kind === 'tip' ? 'content-tip-drafts' : 'content-news-drafts',
    externalRunId,
    externalRunUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
  });
  const runId = started.run?.id;
  if (!runId) throw new Error('Overlay API start-run response omitted run.id');
  let created = 0;
  let duplicates = 0;
  let error = null;
  for (const item of file.drafts) {
    try {
      const payload = { ...item, automationRunId: runId };
      const result = await apiRequest(`${api}/drafts/${kind === 'tip' ? 'free-tips' : 'articles'}`, token, payload);
      if (result.duplicate) duplicates += 1;
      else created += 1;
    } catch (err) { error = err; break; }
  }
  try {
    await apiRequest(`${api}/runs/${encodeURIComponent(runId)}/finish`, token, {
      status: error ? (created ? 'partial' : 'failed') : 'succeeded',
      createdCount: created, rejectedCount: file.rejected?.length ?? 0,
      ...(error ? { errorSummary: String(error.message).slice(0, 1900) } : {}),
    });
  } catch (finishError) { if (!error) error = finishError; else console.error(`Could not finish run audit: ${finishError.message}`); }
  if (error) throw error;
  console.log(`Submitted ${created} draft(s) (${duplicates} duplicate idempotent result(s)); run ${runId}.`);
}

async function summary(args) {
  const opts = options(args);
  const kind = opts.kind === 'tip' ? 'Free-tip' : 'News article';
  let file = null;
  try { file = await json(String(opts.input)); } catch {}
  const draftCount = file?.drafts?.length ?? 0;
  const rejected = file?.rejected ?? [];
  const status = opts.dry_run === 'true' ? 'Dry run — nothing submitted.' : (file ? 'Submission step completed or was skipped due to an earlier failure.' : 'No validated output was produced; submit step was skipped.');
  let text = `## Content automation — ${kind}\n\n- Result: ${status}\n- Validated drafts: ${draftCount}\n- Rejected drafts: ${rejected.length}\n`;
  for (const item of rejected.slice(0, 10)) text += `- Dropped draft ${item.index}: ${(item.reasons ?? []).join('; ')}\n`;
  if (opts.dry_run === 'true' && draftCount) text += `\n### Dry-run payloads\n\n\`\`\`json\n${JSON.stringify(file.drafts, null, 2).slice(0, 9000)}\n\`\`\`\n`;
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
  else process.stdout.write(text);
}

export async function main([command, ...args] = process.argv.slice(2)) {
  if (command === 'collect') await collect(args);
  else if (command === 'draft') await draft(args);
  else if (command === 'validate') await validate(args);
  else if (command === 'copyedit') await copyedit(args);
  else if (command === 'submit') await submit(args);
  else if (command === 'summary') await summary(args);
  else throw new Error('Command must be collect, draft, validate, copyedit, submit, or summary');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`content-automation: ${error.message}`);
    process.exitCode = 1;
  });
}
