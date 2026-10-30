import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const startup = readFileSync(new URL('apps/api/start-api.sh', root), 'utf8');
const shell = process.platform === 'win32'
  ? join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe')
  : '/bin/sh';

function runStartup(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'overlay-startup-'));
  try {
    writeFileSync(join(dir, 'start-api.sh'), startup);
    writeFileSync(join(dir, 'node'), `#!/bin/sh
printf '%s\\n' "$*" >> calls.log
case "$1" in
  node_modules/prisma/build/index.js) exit "\${MIGRATION_EXIT:-0}" ;;
  prisma/seed.mjs) exit "\${SEED_EXIT:-0}" ;;
  apps/api/dist/main.js) exit "\${API_EXIT:-0}" ;;
  *) exit 99 ;;
esac
`, { mode: 0o755 });
    const result = spawnSync(shell, ['start-api.sh'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: dir, SEED_ON_START: 'false', ...env },
    });
    assert.ifError(result.error);
    return {
      ...result,
      calls: readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const migration = 'node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma';
const api = 'apps/api/dist/main.js';

test('startup runs migrations then API with only Node on PATH (no npm/npx)', () => {
  const result = runStartup();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [migration, api]);
  assert.ok(!startup.includes('\r'), 'Linux entrypoint must use LF line endings');
});

test('migration failure stops startup before seed or API', () => {
  const result = runStartup({ MIGRATION_EXIT: '17', SEED_ON_START: 'true' });
  assert.equal(result.status, 17, result.stderr);
  assert.deepEqual(result.calls, [migration]);
});

test('optional seed runs after migrations and before API', () => {
  const result = runStartup({ SEED_ON_START: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [migration, 'prisma/seed.mjs', api]);
});

test('seed failure emits a warning and still starts API', () => {
  const result = runStartup({ SEED_ON_START: 'true', SEED_EXIT: '18' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [migration, 'prisma/seed.mjs', api]);
  assert.match(result.stdout, /WARNING: db:seed failed/);
});

test('API exit status is propagated', () => {
  const result = runStartup({ API_EXIT: '19' });
  assert.equal(result.status, 19, result.stderr);
  assert.deepEqual(result.calls, [migration, api]);
});

test('Prisma CLI is retained as a locked production dependency', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
  assert.ok(pkg.dependencies.prisma);
  assert.equal(pkg.devDependencies.prisma, undefined);
  assert.equal(lock.packages[''].dependencies.prisma, pkg.dependencies.prisma);
  assert.notEqual(lock.packages['node_modules/prisma'].dev, true);
  assert.notEqual(lock.packages['node_modules/@prisma/engines'].dev, true);
  const dockerfile = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(dockerfile, /COPY --from=builder \/app\/apps\/api\/start-api\.sh/);
  const blueprint = readFileSync(new URL('render.yaml', root), 'utf8');
  assert.match(blueprint, /dockerCommand: sh apps\/api\/start-api\.sh/);
});
