import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAuthorArticles, canManageArticle } from './authoring.ts';

const admin = { userId: 'admin-1', role: 'admin' as const };
const tipster = { userId: 't-1', role: 'tipster' as const };
const user = { userId: 'u-1', role: 'user' as const };

test('admins can always author', () => {
  assert.equal(canAuthorArticles(admin), true);
  assert.equal(canAuthorArticles(admin, null), true);
});

test('approved (active) tipsters can author', () => {
  assert.equal(canAuthorArticles(tipster, { status: 'active' }), true);
});

test('suspended or unknown tipsters cannot author', () => {
  assert.equal(canAuthorArticles(tipster, { status: 'suspended' }), false);
  assert.equal(canAuthorArticles(tipster, null), false);
  assert.equal(canAuthorArticles(tipster, undefined), false);
});

test('plain users can never author', () => {
  assert.equal(canAuthorArticles(user, { status: 'active' }), false);
});

test('admins can manage any article', () => {
  assert.equal(canManageArticle(admin, { authorId: 'someone-else' }), true);
});

test('tipsters can manage only their own articles', () => {
  assert.equal(canManageArticle(tipster, { authorId: 't-1' }), true);
  assert.equal(canManageArticle(tipster, { authorId: 't-2' }), false);
});

test('plain users cannot manage articles', () => {
  assert.equal(canManageArticle(user, { authorId: 'u-1' }), false);
});
