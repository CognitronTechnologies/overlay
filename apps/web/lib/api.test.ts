import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PRERENDERED_TIPSTERS,
  tipsterStaticParams,
  listArticleSlugs,
  listFreeTipDates,
  listTipsterIds,
} from './api.ts';

test('tipsterStaticParams maps sitemap entries to route params', () => {
  const params = tipsterStaticParams([
    { tipsterId: 'a' },
    { tipsterId: 'b' },
  ]);
  assert.deepEqual(params, [{ id: 'a' }, { id: 'b' }]);
});

test('tipsterStaticParams drops blank and duplicate ids', () => {
  const params = tipsterStaticParams([
    { tipsterId: 'a' },
    { tipsterId: '  ' },
    { tipsterId: 'a' },
    { tipsterId: ' b ' },
  ]);
  assert.deepEqual(params, [{ id: 'a' }, { id: 'b' }]);
});

test('tipsterStaticParams caps the number pre-rendered at build', () => {
  const entries = Array.from({ length: MAX_PRERENDERED_TIPSTERS + 25 }, (_, i) => ({
    tipsterId: `t${i}`,
  }));
  const params = tipsterStaticParams(entries);
  assert.equal(params.length, MAX_PRERENDERED_TIPSTERS);
  assert.deepEqual(params[0], { id: 't0' });

  // An explicit lower limit is honoured too.
  assert.equal(tipsterStaticParams(entries, 5).length, 5);
});

test('tipsterStaticParams returns an empty list for no entries', () => {
  assert.deepEqual(tipsterStaticParams([]), []);
});

test('sitemap API reads use a ten-second deadline and preserve successful data', async (t) => {
  const deadlines: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    deadlines.push(milliseconds);
    return new AbortController().signal;
  });
  const results = [
    [{ slug: 'article', updatedAt: '2026-10-27', publishedAt: null }],
    ['2026-10-27'],
    [{ tipsterId: 'tipster', updatedAt: '2026-10-27' }],
  ];
  let index = 0;
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(results[index++]);
  });
  assert.deepEqual(
    await Promise.all([listArticleSlugs(), listFreeTipDates(), listTipsterIds()]),
    results,
  );
  assert.deepEqual(deadlines, [10_000, 10_000, 10_000]);
});

test('sitemap API reads abort stalled requests and log their empty-list fallback', async (t) => {
  t.mock.method(AbortSignal, 'timeout', () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('Request timed out')), 20);
    return controller.signal;
  });
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => {
    const signal = options.signal;
    assert.ok(signal);
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const warnings = t.mock.method(console, 'warn', () => {});
  assert.deepEqual(
    await Promise.all([listArticleSlugs(), listFreeTipDates(), listTipsterIds()]),
    [[], [], []],
  );
  assert.equal(warnings.mock.callCount(), 3);
});
