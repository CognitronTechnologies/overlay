// Real-service integration tests: only the cache is in-memory; all reads,
// optimistic writes, transactions and audit records use PostgreSQL.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { PrismaClient, Article, FreeTip } from '@prisma/client';
import ts from 'typescript';
import type { AutomationService } from './automation.service.ts';
import type { EditorialService } from './editorial.service.ts';
import type { ArticlesService } from '../articles/articles.service.ts';
import type { FreeTipsService } from '../free-tips/free-tips.service.ts';
import type { PrismaService } from '../../prisma.service.ts';
import type { ArticleDraftDto, FreeTipDraftDto } from './automation.dto.ts';

// Nest decorators and parameter properties cannot run under strip-only Node.
// Transpile the real services in memory, restoring the loader before any test.
function loadServices() {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.ts'];
  require.extensions['.ts'] = (module, filename) => {
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        esModuleInterop: true,
      },
    });
    (module as NodeJS.Module & { _compile(source: string, filename: string): void })._compile(outputText, filename);
  };
  try {
    return {
      Automation: require('./automation.service.ts').AutomationService as typeof AutomationService,
      Editorial: require('./editorial.service.ts').EditorialService as typeof EditorialService,
      Articles: require('../articles/articles.service.ts').ArticlesService as typeof ArticlesService,
      FreeTips: require('../free-tips/free-tips.service.ts').FreeTipsService as typeof FreeTipsService,
      CreateTipDto: require('../free-tips/dto/create-free-tip.dto.ts').CreateFreeTipDto,
      EntityCache: require('../../common/cache/entity-cache.ts').EntityCache,
    };
  } finally {
    if (previous) require.extensions['.ts'] = previous;
    else delete require.extensions['.ts'];
  }
}

const prefix = `it_auto_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
const actor = { userId: `${prefix}_reviewer`, role: 'admin' as const };
const dbUrl = process.env.DATABASE_URL;
const envKeys = ['AUTOMATION_FREE_TIPS_DAILY_CAP', 'AUTOMATION_MIN_KICKOFF_LEAD_MINUTES'] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function httpError(status: number, code?: string) {
  return (error: unknown) => {
    const response = error as { getStatus(): number; getResponse(): { code?: string } };
    assert.equal(response.getStatus(), status);
    if (code) assert.equal(response.getResponse().code, code);
    return true;
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('content automation against PostgreSQL', { skip: !dbUrl && 'DATABASE_URL is unset', concurrency: false, timeout: 60_000 }, () => {
  let prisma: PrismaClient;
  let automation: AutomationService;
  let editorial: EditorialService;
  let articles: ArticlesService;
  let freeTips: FreeTipsService;
  let services: ReturnType<typeof loadServices>;
  let cache: ConstructorParameters<typeof EditorialService>[1];
  let runId: string;
  let dateCounter = 0;
  const initialDay = Math.floor(Math.random() * 20_000);

  before(async () => {
    const { PrismaClient } = await import('@prisma/client');
    services = loadServices();
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl! } } });
    await prisma.$connect();
    process.env.AUTOMATION_FREE_TIPS_DAILY_CAP = '5';
    process.env.AUTOMATION_MIN_KICKOFF_LEAD_MINUTES = '60';
    const values = new Map<string, string>();
    cache = new services.EntityCache({
      async get(key: string) { return values.get(key) ?? null; },
      async set(key: string, value: string) { values.set(key, value); },
      async incr(key: string) {
        const next = Number(values.get(key) ?? '0') + 1;
        values.set(key, String(next));
        return next;
      },
    }, prefix);
    automation = new services.Automation(prisma as PrismaService, cache);
    editorial = new services.Editorial(prisma as PrismaService, cache);
    articles = new services.Articles(prisma as PrismaService, cache);
    freeTips = new services.FreeTips(prisma as PrismaService);
    await prisma.user.create({ data: { id: actor.userId, email: `${prefix}@itest.local`, role: 'admin' } });
    const { run } = await automation.startRun({ workflowName: prefix, externalRunId: prefix });
    runId = run.id;
  });

  after(async () => {
    try {
      if (prisma) {
        await prisma.auditLog.deleteMany({ where: { actor: actor.userId } });
        await prisma.freeTip.deleteMany({ where: { OR: [{ dedupeKey: { startsWith: prefix } }, { match: { startsWith: prefix } }] } });
        await prisma.article.deleteMany({ where: { dedupeKey: { startsWith: prefix } } });
        await prisma.automationRun.deleteMany({ where: { workflowName: prefix } });
        await prisma.event.deleteMany({ where: { vendorEventId: { startsWith: prefix } } });
        await prisma.user.deleteMany({ where: { id: actor.userId } });
      }
    } finally {
      await prisma?.$disconnect();
      for (const key of envKeys) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
      }
    }
  });

  const key = () => `${prefix}_${randomUUID()}`;
  const sources = () => ['official', 'news'].map((kind) => ({
    url: `https://example.org/${prefix}/${kind}`,
    title: `Fixture evidence ${kind}`,
    publisher: 'Integration source',
    retrievedAt: new Date().toISOString(),
    kind: kind as 'official' | 'news',
  }));
  const articleDto = (): ArticleDraftDto => ({
    dedupeKey: key(), title: `${prefix} match report`, slug: key().slice(0, 80),
    body: 'Original evidence-based match report.', excerpt: 'A report for review.',
    tags: [prefix], sources: sources(), reviewerWarnings: ['Verify team news'], automationRunId: runId,
  });
  async function tipDto(overrides: Partial<FreeTipDraftDto> = {}): Promise<FreeTipDraftDto> {
    // Use an unused future UTC day: the cap is global, not scoped to this test.
    let kickoff: Date;
    do {
      kickoff = new Date(Date.UTC(2100, 0, 1 + initialDay + dateCounter++, 18));
    } while (await prisma.freeTip.count({ where: { tipDate: new Date(kickoff.toISOString().slice(0, 10)) } }));
    return {
      dedupeKey: key(), tipDate: kickoff.toISOString().slice(0, 10),
      sport: 'soccer', league: 'Premier League', match: `${prefix} Home vs Away`,
      market: '1X2', selection: 'home', odds: 1.95, analysis: 'Evidence for editorial review.',
      kickoffAt: kickoff.toISOString(), expiresAt: new Date(kickoff.getTime() - 3_600_000).toISOString(),
      oddsProvider: 'Test provider', oddsRetrievedAt: new Date().toISOString(), sources: sources(),
      reviewerWarnings: ['Confirm the lineup'],
      rationale: { rationale: 'Independent fixture evidence', counterarguments: ['Lineup uncertainty'] },
      automationRunId: runId, ...overrides,
    };
  }
  async function draft(type: 'article' | 'free-tip'): Promise<Article | FreeTip> {
    return type === 'article'
      ? (await automation.createArticleDraft(articleDto())).item
      : (await automation.createFreeTipDraft(await tipDto())).item;
  }

  const manualDto = (kickoffAt = new Date(Date.UTC(2200, 0, 1, 18)).toISOString()) => ({
    sport: 'soccer', match: `${prefix} Manual Home vs Away`, market: '1X2', selection: 'home', kickoffAt,
    rationale: { rationale: 'Human assessment', counterarguments: ['Lineup uncertainty'] },
  });

  test('manual DTO validates required kickoff, nested rationale and forbids publish/provenance fields', async () => {
    const { plainToInstance } = await import('class-transformer');
    const { validate } = await import('class-validator');
    const errors = async (value: object) => validate(plainToInstance(services.CreateTipDto, value), { whitelist: true, forbidNonWhitelisted: true });
    assert.equal((await errors(manualDto())).length, 0);
    for (const value of [
      { ...manualDto(), kickoffAt: undefined }, { ...manualDto(), kickoffAt: 'invalid' },
      { ...manualDto(), rationale: { rationale: 'Reason', counterarguments: 'not an array' } },
      { ...manualDto(), status: 'published' }, { ...manualDto(), origin: 'automation' },
      { ...manualDto(), reviewedBy: actor.userId }, { ...manualDto(), createdById: actor.userId },
      { ...manualDto(), expiresAt: '2200-01-01T18:00:00Z' },
    ]) assert.ok((await errors(value)).length > 0);
  });

  test('manual creation bypasses automation cap, evidence and dedupe but remains private pending review', async () => {
    const dto = manualDto();
    const oldCap = process.env.AUTOMATION_FREE_TIPS_DAILY_CAP;
    process.env.AUTOMATION_FREE_TIPS_DAILY_CAP = '0';
    let created;
    try { created = await freeTips.create(dto, actor); }
    finally { process.env.AUTOMATION_FREE_TIPS_DAILY_CAP = oldCap; }
    const row = await prisma.freeTip.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.status, 'pending');
    assert.equal(row.origin, 'manual');
    assert.deepEqual(row.sources, []);
    assert.deepEqual(row.rationale, dto.rationale);
    assert.equal(row.dedupeKey, null);
    assert.equal(row.odds, null);
    assert.equal(row.expiresAt!.getTime(), row.kickoffAt!.getTime() - 3_600_000);
    assert.equal(row.tipDate.toISOString().slice(0, 10), dto.kickoffAt.slice(0, 10));
    assert.equal((await freeTips.listByDate(created.date)).tips.some((tip) => tip.id === row.id), false);
    const queue = await editorial.list({ type: 'free-tip', status: 'pending', origin: 'manual', pageSize: '100' });
    assert.ok(queue.items.some((entry) => entry.item.id === row.id));
    const adminRow = (await freeTips.listAll()).find((tip) => tip.id === row.id)!;
    assert.equal(adminRow.status, 'pending');
    assert.equal(adminRow.origin, 'manual');
    assert.equal(adminRow.kickoffAt?.toISOString(), dto.kickoffAt);
    assert.equal(adminRow.expiresAt?.getTime(), row.expiresAt!.getTime());
    assert.notEqual((await freeTips.create(dto, actor)).id, row.id);
  });

  test('manual self-approval allows no sources or fresh quote and records creator plus approver', async () => {
    const created = await freeTips.create({ ...manualDto(), odds: 1.001 }, actor);
    await prisma.freeTip.update({ where: { id: created.id }, data: { oddsRetrievedAt: new Date('2000-01-01') } });
    const approved = await editorial.approve('free-tip', created.id, actor);
    assert.equal(approved.item.status, 'published');
    assert.equal(approved.item.reviewedBy, actor.userId);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id, action: 'editorial.approve' } });
    assert.deepEqual(audit.payload, { from: 'pending', to: 'published', createdById: actor.userId, approvedById: actor.userId });
    assert.ok((await freeTips.listByDate(created.date)).tips.some((tip) => tip.id === created.id));
    await freeTips.remove(created.id);
    assert.equal(await prisma.freeTip.findUnique({ where: { id: created.id } }), null);
  });

  test('manual creation rejects bad kickoff/date/odds and still enforces expiry at approval', async () => {
    const dto = manualDto();
    for (const kickoffAt of [new Date(Date.now() - 1).toISOString(), new Date(Date.now() + 30 * 60_000).toISOString()]) {
      await assert.rejects(freeTips.create({ ...dto, kickoffAt }, actor), httpError(400, 'TIP_KICKOFF_TOO_SOON'));
    }
    await assert.rejects(freeTips.create({ ...dto, kickoffAt: 'not a date' }, actor), httpError(400, 'INVALID_KICKOFF'));
    await assert.rejects(freeTips.create({ ...dto, date: '2199-12-31' }, actor), httpError(400, 'TIP_DATE_MISMATCH'));
    for (const odds of [1, 0, Infinity, NaN]) await assert.rejects(freeTips.create({ ...dto, odds }, actor), httpError(400, 'INVALID_ODDS'));
    const created = await freeTips.create(dto, actor);
    await prisma.freeTip.update({ where: { id: created.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await assert.rejects(editorial.approve('free-tip', created.id, actor), httpError(409, 'TIP_EXPIRED'));
    const stale = await freeTips.create(dto, actor);
    const kickoff = new Date(Date.now() + 30 * 60_000);
    await prisma.freeTip.update({ where: { id: stale.id }, data: { kickoffAt: kickoff, tipDate: new Date(kickoff.toISOString().slice(0, 10)), expiresAt: null } });
    await assert.rejects(editorial.approve('free-tip', stale.id, actor), httpError(409, 'TIP_STALE'));
  });

  test('legacy mutation routes reject all edits and automation deletes; editorial edits manual drafts', async () => {
    const automated = await draft('free-tip');
    await assert.rejects(freeTips.update(automated.id, { analysis: 'Wrong surface' }), httpError(409, 'USE_EDITORIAL_QUEUE'));
    await assert.rejects(freeTips.remove(automated.id), httpError(409, 'USE_EDITORIAL_QUEUE'));
    const created = await freeTips.create(manualDto(), actor);
    await assert.rejects(freeTips.update(created.id, { analysis: 'Wrong surface' }), httpError(409, 'USE_EDITORIAL_QUEUE'));
    const kickoffAt = '2200-01-02T18:00:00.000Z';
    const edited = await editorial.edit('free-tip', created.id, { kickoffAt, analysis: 'Reviewed explanation', rationale: { rationale: 'Updated human assessment', counterarguments: ['New risk'] } }, actor);
    assert.equal((edited.item as FreeTip).kickoffAt!.toISOString(), kickoffAt);
    assert.equal((edited.item as FreeTip).expiresAt!.toISOString(), '2200-01-02T17:00:00.000Z');
    assert.equal((edited.item as FreeTip).tipDate.toISOString().slice(0, 10), '2200-01-02');
    assert.equal(edited.item.status, 'pending');
    await editorial.approve('free-tip', created.id, actor);
    await assert.rejects(freeTips.update(created.id, { analysis: 'No bypass' }), httpError(409, 'USE_EDITORIAL_QUEUE'));
    await assert.rejects(editorial.edit('free-tip', created.id, { analysis: 'No bypass' }, actor), httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
  });

  test('manual editorial edits retain optimistic concurrency against approval', async () => {
    const created = await freeTips.create({ ...manualDto(), analysis: 'Original explanation' }, actor);
    const gate = gateReads('freeTip');
    const editing = gate.reviewer.edit('free-tip', created.id, { analysis: 'Stale edit' }, actor);
    const rejected = assert.rejects(editing, httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
    await gate.read;
    try { await editorial.approve('free-tip', created.id, actor); } finally { gate.resume(); }
    await rejected;
    const stored = await prisma.freeTip.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(stored.status, 'published');
    assert.equal(stored.analysis, 'Original explanation');
    assert.equal(await prisma.auditLog.count({ where: { entityId: created.id, action: 'editorial.edit' } }), 0);
  });

  test('both public routes hide published tips at kickoff, but not legacy null kickoffs or approval expiry', async () => {
    const created = await freeTips.create(manualDto((await tipDto()).kickoffAt), actor);
    await editorial.approve('free-tip', created.id, actor);
    const visible = async () => (await freeTips.listByDate(created.date)).tips.some((tip) => tip.id === created.id);
    await prisma.freeTip.update({ where: { id: created.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    assert.equal(await visible(), true);
    assert.ok((await freeTips.listDates()).includes(created.date));
    for (const kickoffAt of [new Date(), new Date(Date.now() - 60_000)]) {
      await prisma.freeTip.update({ where: { id: created.id }, data: { kickoffAt } });
      assert.equal(await visible(), false);
      assert.equal((await freeTips.listDates()).includes(created.date), false);
    }
    await prisma.freeTip.update({ where: { id: created.id }, data: { kickoffAt: null } });
    assert.equal(await visible(), true);
    assert.ok((await freeTips.listDates()).includes(created.date));
  });

  // Pause only the real initial read; transaction writes still use real Prisma.
  function gateReads(model: 'article' | 'freeTip', expectedReaders = 1) {
    const read = deferred();
    const resume = deferred();
    let readers = 0;
    const delegate = prisma[model];
    const wrapped = new Proxy(delegate, {
      get(target, property) {
        if (property === 'findUnique') return async (args: unknown) => {
          const row = await (target.findUnique as Function).call(target, args);
          if (++readers === expectedReaders) read.resolve();
          await resume.promise;
          return row;
        };
        return Reflect.get(target, property);
      },
    });
    const db = new Proxy(prisma, {
      get(target, property) {
        if (property === model) return wrapped;
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return { reviewer: new services.Editorial(db as PrismaService, cache), read: read.promise, resume: resume.resolve };
  }

  test('article ingestion is pending, preserves provenance, and dedupe replay is idempotent', async () => {
    const dto = articleDto();
    const first = await automation.createArticleDraft(dto);
    const replay = await automation.createArticleDraft({ ...dto, title: 'Must not overwrite original' });
    assert.equal(first.duplicate, false);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.item.id, first.item.id);
    const stored = await prisma.article.findUniqueOrThrow({ where: { id: first.item.id } });
    assert.equal(stored.status, 'pending');
    assert.equal(stored.origin, 'automation');
    assert.equal(stored.publishedAt, null);
    assert.equal(stored.reviewedBy, null);
    assert.equal(stored.automationRunId, runId);
    assert.deepEqual(stored.sources, dto.sources);
    assert.deepEqual(stored.reviewerWarnings, dto.reviewerWarnings);
    assert.equal(stored.title, dto.title);
    assert.equal(await prisma.article.count({ where: { dedupeKey: dto.dedupeKey } }), 1);
  });

  test('free-tip ingestion preserves provenance and dedupe replay does not consume quota', async () => {
    const dto = await tipDto();
    const first = await automation.createFreeTipDraft(dto);
    const replay = await automation.createFreeTipDraft({ ...dto, analysis: 'Do not replace evidence' });
    assert.equal(first.duplicate, false);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.item.id, first.item.id);
    const stored = await prisma.freeTip.findUniqueOrThrow({ where: { id: first.item.id } });
    assert.equal(stored.status, 'pending');
    assert.equal(stored.origin, 'automation');
    assert.equal(stored.reviewedBy, null);
    assert.equal(stored.automationRunId, runId);
    assert.deepEqual(stored.sources, dto.sources);
    assert.deepEqual(stored.reviewerWarnings, dto.reviewerWarnings);
    assert.deepEqual(stored.rationale, dto.rationale);
    assert.equal(stored.analysis, dto.analysis);
    assert.equal(stored.oddsProvider, dto.oddsProvider);
    assert.equal(stored.oddsRetrievedAt?.toISOString(), dto.oddsRetrievedAt);
    assert.equal(await prisma.freeTip.count({ where: { dedupeKey: dto.dedupeKey } }), 1);
  });

  test('the daily cap counts all five statuses including rejected and expired, but not manual tips', async () => {
    const dto = await tipDto();
    const manual = await automation.createFreeTipDraft(dto);
    await prisma.freeTip.update({ where: { id: manual.item.id }, data: { origin: 'manual', status: 'published' } });
    const statuses = ['draft', 'pending', 'published', 'rejected', 'expired'] as const;
    let lastId = '';
    let lastKey = '';
    for (const status of statuses) {
      lastKey = key();
      const { item } = await automation.createFreeTipDraft({ ...dto, dedupeKey: lastKey });
      lastId = item.id;
      await prisma.freeTip.update({ where: { id: item.id }, data: { status } });
    }
    const replay = await automation.createFreeTipDraft({ ...dto, dedupeKey: lastKey });
    assert.equal(replay.item.id, lastId);
    assert.equal(replay.duplicate, true);
    await assert.rejects(automation.createFreeTipDraft({ ...dto, dedupeKey: key() }), httpError(409, 'DAILY_CAP_REACHED'));
    assert.equal(await prisma.freeTip.count({ where: { tipDate: new Date(dto.tipDate), origin: 'automation' } }), 5);
  });

  test('expiry later than kickoff minus margin is rejected; the exact boundary is accepted', async () => {
    const dto = await tipDto();
    await assert.rejects(automation.createFreeTipDraft({ ...dto, expiresAt: new Date(new Date(dto.kickoffAt).getTime() - 3_600_000 + 1).toISOString() }), httpError(400, 'INVALID_EXPIRY'));
    assert.equal(await prisma.freeTip.count({ where: { dedupeKey: dto.dedupeKey } }), 0);
    const { item } = await automation.createFreeTipDraft(dto);
    assert.equal(item.expiresAt?.getTime(), new Date(dto.kickoffAt).getTime() - 3_600_000);
    await assert.rejects(editorial.edit('free-tip', item.id, { expiresAt: dto.kickoffAt }, actor), httpError(400, 'INVALID_EXPIRY'));
    await prisma.freeTip.update({ where: { id: item.id }, data: { expiresAt: new Date(dto.kickoffAt) } });
    await assert.rejects(editorial.approve('free-tip', item.id, actor), httpError(409, 'INVALID_EXPIRY'));
  });

  test('public list lazily expires overdue pending tips and returns only published tips/dates', async () => {
    const dto = await tipDto();
    const rows = [];
    for (let i = 0; i < 5; i++) rows.push((await automation.createFreeTipDraft({ ...dto, dedupeKey: key() })).item);
    await editorial.approve('free-tip', rows[0].id, actor);
    await editorial.reject('free-tip', rows[1].id, 'Unsupported evidence', actor);
    await prisma.freeTip.update({ where: { id: rows[2].id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await prisma.freeTip.update({ where: { id: rows[3].id }, data: { kickoffAt: new Date(Date.now() - 60_000) } });
    const listed = await freeTips.listByDate(dto.tipDate);
    assert.deepEqual(listed.tips.map((tip) => tip.id), [rows[0].id]);
    assert.equal('sources' in listed.tips[0], false);
    for (const row of [rows[2], rows[3]]) assert.equal((await prisma.freeTip.findUniqueOrThrow({ where: { id: row.id } })).status, 'expired');
    assert.equal((await prisma.freeTip.findUniqueOrThrow({ where: { id: rows[4].id } })).status, 'pending');
    assert.ok((await freeTips.listDates()).includes(dto.tipDate));
    const hiddenDate = await tipDto();
    await automation.createFreeTipDraft(hiddenDate);
    assert.ok(!(await freeTips.listDates()).includes(hiddenDate.tipDate));
  });

  test('editorial list lazily expires pending tips and approval rejects expired/stale evidence', async () => {
    const { item } = await automation.createFreeTipDraft(await tipDto());
    await prisma.freeTip.update({ where: { id: item.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await assert.rejects(editorial.approve('free-tip', item.id, actor), httpError(409, 'TIP_EXPIRED'));
    await editorial.list({ type: 'free-tip', status: 'expired' });
    assert.equal((await prisma.freeTip.findUniqueOrThrow({ where: { id: item.id } })).status, 'expired');
    const stale = await draft('free-tip');
    const kickoff = new Date(Date.now() + 30 * 60_000);
    await prisma.freeTip.update({ where: { id: stale.id }, data: { kickoffAt: kickoff, tipDate: new Date(kickoff.toISOString().slice(0, 10)), expiresAt: null } });
    await assert.rejects(editorial.approve('free-tip', stale.id, actor), httpError(409, 'TIP_STALE'));
  });

  for (const type of ['article', 'free-tip'] as const) {
    const model = type === 'article' ? 'article' : 'freeTip';
    const entity = type === 'article' ? 'Article' : 'FreeTip';

    test(`${type}: approval publishes with reviewer metadata and one audit record`, async () => {
      const item = await draft(type);
      const approved = await editorial.approve(type, item.id, actor);
      assert.equal(approved.item.status, 'published');
      assert.equal(approved.item.reviewedBy, actor.userId);
      assert.ok(approved.item.reviewedAt);
      if (type === 'article') assert.ok((approved.item as Article).publishedAt);
      assert.equal(await prisma.auditLog.count({ where: { entity, entityId: item.id, action: 'editorial.approve' } }), 1);
    });

    test(`${type}: a review arriving after the winner commits returns the documented conflict code`, async () => {
      const item = await draft(type);
      await editorial.approve(type, item.id, actor);
      await assert.rejects(editorial.reject(type, item.id, 'Late reviewer', actor), httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
      await assert.rejects(editorial.approve(type, item.id, actor), httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
      await assert.rejects(editorial.edit(type, item.id, type === 'article' ? { title: 'Late editor' } : { analysis: 'Late editor' }, actor), httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
      assert.equal(await prisma.auditLog.count({ where: { entity, entityId: item.id } }), 1);
    });

    test(`${type}: rejection requires a nonblank reason and records the reason`, async () => {
      const item = await draft(type);
      await assert.rejects(editorial.reject(type, item.id, ' <b> </b> ', actor), httpError(400));
      assert.equal(await prisma.auditLog.count({ where: { entityId: item.id } }), 0);
      const rejected = await editorial.reject(type, item.id, '  Insufficient independent evidence  ', actor);
      assert.equal(rejected.item.status, 'rejected');
      assert.equal(rejected.item.rejectionReason, 'Insufficient independent evidence');
      assert.equal(rejected.item.reviewedBy, actor.userId);
      assert.ok(rejected.item.reviewedAt);
    });

    test(`${type}: concurrent approve/reject has exactly one winner and one audit entry`, async () => {
      const item = await draft(type);
      const gate = gateReads(model, 2);
      const decisions = Promise.allSettled([
        gate.reviewer.approve(type, item.id, actor),
        gate.reviewer.reject(type, item.id, 'Evidence cannot be verified', actor),
      ]);
      await gate.read;
      gate.resume();
      const outcomes = await decisions;
      assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
      const loser = outcomes.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      httpError(409, 'EDITORIAL_STATUS_CONFLICT')(loser.reason);
      const audits = await prisma.auditLog.findMany({ where: { entity, entityId: item.id } });
      assert.equal(audits.length, 1);
      const stored = await prisma[model].findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(stored.status, audits[0].action === 'editorial.approve' ? 'published' : 'rejected');
    });

    test(`${type}: a stale updatedAt blocks an edit without an audit entry`, async () => {
      const item = await draft(type);
      const gate = gateReads(model);
      const editing = gate.reviewer.edit(type, item.id, type === 'article' ? { title: 'Stale editor title' } : { analysis: 'Stale analysis' }, actor);
      // Attach rejection handling before releasing the pending operation.
      const rejected = assert.rejects(editing, httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
      await gate.read;
      const data = type === 'article' ? { title: 'Newer title', updatedAt: new Date(item.updatedAt.getTime() + 1000) } : { analysis: 'Newer analysis', updatedAt: new Date(item.updatedAt.getTime() + 1000) };
      await prisma[model].update({ where: { id: item.id }, data });
      gate.resume();
      await rejected;
      const stored = await prisma[model].findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(type === 'article' ? (stored as Article).title : (stored as FreeTip).analysis, type === 'article' ? 'Newer title' : 'Newer analysis');
      assert.equal(await prisma.auditLog.count({ where: { entity, entityId: item.id } }), 0);
    });

    test(`${type}: edit-vs-approve race cannot change published content`, async () => {
      const item = await draft(type);
      const gate = gateReads(model);
      const editing = gate.reviewer.edit(type, item.id, type === 'article' ? { title: 'Must not overwrite approved title' } : { analysis: 'Must not overwrite approved analysis' }, actor);
      const rejected = assert.rejects(editing, httpError(409, 'EDITORIAL_STATUS_CONFLICT'));
      await gate.read;
      try { await editorial.approve(type, item.id, actor); } finally { gate.resume(); }
      await rejected;
      const stored = await prisma[model].findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(stored.status, 'published');
      assert.equal(type === 'article' ? (stored as Article).title : (stored as FreeTip).analysis, type === 'article' ? (item as Article).title : (item as FreeTip).analysis);
      assert.equal(await prisma.auditLog.count({ where: { entity, entityId: item.id } }), 1);
    });
  }

  test('a kickoff edit recomputes tipDate from its UTC date', async () => {
    const { item } = await automation.createFreeTipDraft(await tipDto());
    const nextKickoff = new Date(item.kickoffAt!.getTime() + 86_400_000);
    const edited = await editorial.edit('free-tip', item.id, { kickoffAt: nextKickoff.toISOString() }, actor);
    assert.equal((edited.item as FreeTip).tipDate.toISOString().slice(0, 10), nextKickoff.toISOString().slice(0, 10));
    const stored = await prisma.freeTip.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(stored.kickoffAt?.toISOString(), nextKickoff.toISOString());
    assert.equal(stored.tipDate.toISOString(), nextKickoff.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    assert.equal(await prisma.auditLog.count({ where: { entityId: item.id, action: 'editorial.edit' } }), 1);
  });

  test('unpublished articles are absent from public list, detail, tags and sitemap, including translations', async () => {
    const publicTag = `${prefix}_public`;
    const publicDraft = async () => (await automation.createArticleDraft({ ...articleDto(), tags: [publicTag] })).item;
    const pending = await publicDraft();
    const unpublished = [pending];
    const rejected = await publicDraft();
    unpublished.push(rejected);
    const published = await publicDraft();
    await editorial.reject('article', rejected.id, 'Unverified reporting', actor);
    // Prime the public cache before approval to verify publication invalidation.
    assert.deepEqual(await articles.listPublished({ tag: publicTag }), []);
    await editorial.approve('article', published.id, actor);
    for (const status of ['draft', 'archived'] as const) {
      const row = await publicDraft();
      await prisma.article.update({ where: { id: row.id }, data: { status } });
      unpublished.push(row);
    }
    const listed = await articles.listPublished({ tag: publicTag });
    assert.deepEqual(listed.map((row) => row.slug), [published.slug]);
    for (const row of unpublished) {
      await assert.rejects(articles.getPublishedBySlug(row.slug), httpError(404));
      await assert.rejects(articles.getPublishedBySlug(row.slug, 'fr'), httpError(404));
    }
    const hiddenTag = `${prefix}_hidden`;
    await prisma.article.create({ data: {
      slug: published.slug, locale: 'fr', title: 'Unpublished translation', body: 'Private draft',
      excerpt: 'Not public', status: 'pending', origin: 'automation', tags: [hiddenTag], dedupeKey: key(),
    } });
    assert.equal((await articles.getPublishedBySlug(published.slug, 'fr')).title, published.title);
    const publicArticle = await articles.getPublishedBySlug(published.slug);
    assert.equal(publicArticle.slug, published.slug);
    for (const field of ['sources', 'reviewerWarnings', 'automationRunId', 'dedupeKey', 'reviewedBy', 'rejectionReason']) assert.equal(field in publicArticle, false);
    const slugs = (await articles.listPublishedSlugs()).map((row) => row.slug);
    assert.ok(slugs.includes(published.slug));
    for (const row of unpublished) assert.ok(!slugs.includes(row.slug));
    const publicTags = await articles.listTags();
    assert.ok(publicTags.includes(publicTag));
    assert.ok(!publicTags.includes(hiddenTag));
  });
});
