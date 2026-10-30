import test from 'node:test';
import assert from 'node:assert/strict';
import { robotsAllows } from './feeds.mjs';
import { hasVerbatimOverlap } from './validator.mjs';

test('robots uses product-specific groups, longest rule, allow tie, wildcard and query anchors', () => {
  const url = 'https://feed.example/football/rss?edition=uk';
  assert.equal(robotsAllows('User-agent: *\nDisallow: /football', url), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: OverlayPicks\nAllow: /football', url), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /*rss*\nAllow: /football/rss?edition=uk$', url), true);
  assert.equal(robotsAllows('User-agent: *\nAllow: /football\nDisallow: /football', url), true);
  assert.equal(robotsAllows('User-agent: GPTBot\nDisallow: /', url), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow:', url), true);
  assert.equal(robotsAllows('User-agent: OverlayPicks\nDisallow: /\nUser-agent: OverlayPicks\nAllow: /football', url), true);
});

test('verbatim guard checks all evidence with case/punctuation normalization and exact 25-word threshold', () => {
  const snippet = Array.from({ length: 30 }, (_, index) => `fact${index}`).join(' ');
  const bundle = { news: [{ summary: snippet }] };
  assert.equal(hasVerbatimOverlap(snippet.split(' ').slice(0, 24).join(' '), bundle), false);
  assert.equal(hasVerbatimOverlap(snippet.split(' ').slice(0, 25).join(', ').toUpperCase(), bundle), true);
  assert.equal(hasVerbatimOverlap('An independently worded account of the event.', bundle), false);
});
