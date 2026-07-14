import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableStatus, retryDelayMs } from './http.ts';

test('isRetryableStatus: 429 and 5xx retryable; 4xx and 2xx not', () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(200), false);
});

test('retryDelayMs: exponential backoff capped at 8s', () => {
  assert.equal(retryDelayMs(0), 500);
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(2), 2000);
  assert.equal(retryDelayMs(3), 4000);
  assert.equal(retryDelayMs(10), 8000); // capped
});

test('retryDelayMs: honours numeric Retry-After (seconds), capped at 30s', () => {
  assert.equal(retryDelayMs(0, '2'), 2000);
  assert.equal(retryDelayMs(0, '120'), 30_000); // capped
  assert.equal(retryDelayMs(5, '0'), 0);
});

test('retryDelayMs: ignores a non-numeric Retry-After', () => {
  assert.equal(retryDelayMs(1, 'Wed, 21 Oct 2026 07:28:00 GMT'), 1000);
  assert.equal(retryDelayMs(0, null), 500);
});
