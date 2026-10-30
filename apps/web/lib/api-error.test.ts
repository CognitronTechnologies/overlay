import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiError } from './api-error.ts';

test('readApiError reads nested API codes and messages', async () => {
  const response = new Response(JSON.stringify({ message: { code: 'TIP_KICKOFF_TOO_SOON', message: 'Too soon' } }), { status: 400 });
  assert.deepEqual(await readApiError(response, 'Fallback'), { code: 'TIP_KICKOFF_TOO_SOON', message: 'Too soon' });
});

test('readApiError formats validation message arrays', async () => {
  const response = new Response(JSON.stringify({ message: ['sport should not be empty', 'match should not be empty'] }), { status: 400 });
  assert.deepEqual(await readApiError(response, 'Fallback'), { message: 'sport should not be empty, match should not be empty' });
});

test('readApiError uses a fallback for unreadable responses', async () => {
  const response = new Response('not json', { status: 500 });
  assert.deepEqual(await readApiError(response, 'Fallback'), { message: 'Fallback' });
});
