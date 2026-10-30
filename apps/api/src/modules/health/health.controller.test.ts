import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { evaluateReadiness } from './health.checks.ts';

test('first concurrent readiness probes await the shared Redis connection', async () => {
  let connections = 0;
  let pings = 0;
  let connect!: () => void;
  const connected = new Promise<void>((resolve) => { connect = resolve; });
  class Redis {
    ready = false;
    on() {}
    async connect() {
      connections++;
      await connected;
      this.ready = true;
    }
    async ping() {
      assert.equal(this.ready, true, 'offline queue is disabled; connect must finish first');
      pings++;
      return 'PONG';
    }
    async quit() {}
  }
  const require = createRequire(import.meta.url);
  const filename = new URL('./health.controller.ts', import.meta.url);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} as { HealthController: new (prisma: unknown) => any } };
  const localRequire = (name: string) => {
    if (name === 'ioredis') return Redis;
    if (name === './health.checks') return { evaluateReadiness };
    if (name === '../../prisma.service') return { PrismaService: class {} };
    return require(name);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  const controller = new module.exports.HealthController({ $queryRaw: async () => [1] });
  const statuses: number[] = [];
  const response = { status: (status: number) => statuses.push(status) };
  try {
    const first = controller.ready(response);
    const second = controller.ready(response);
    assert.equal(connections, 1);
    assert.equal(pings, 0);
    connect();
    const results = await Promise.all([first, second]);
    assert.deepEqual(statuses, [200, 200]);
    assert.ok(results.every((result) => result.status === 'ok'));
    await controller.ready(response);
    assert.equal(connections, 1);
    assert.equal(pings, 3);
  } finally {
    connect();
    await controller.onModuleDestroy();
  }
});
