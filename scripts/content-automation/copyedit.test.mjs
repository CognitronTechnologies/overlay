import test from 'node:test';
import assert from 'node:assert/strict';
import { copyLintArticle, factPreservationErrors, prepareCopyEditedDrafts } from './copyedit.mjs';

const urls = ['https://news.example/everton-3-1', 'https://sports.example/report'];
const sources = urls.map((url, index) => ({ url, title: `Report ${index + 1}`, publisher: `Publisher ${index + 1}`, retrievedAt: '2026-10-30T09:00:00.000Z', kind: 'news' }));
const longBody = `${Array(40).fill('Everton reached the quarter-finals after a measured performance and a closely contested cup match.').join(' ')} Publisher 1 reported the result [Publisher 1](${urls[0]}). Publisher 2 described the team response [Publisher 2](${urls[1]}).`;
const article = {
  dedupeKey: 'everton-cup-win-20261030', title: 'Everton advance after a disciplined cup win over Newcastle',
  excerpt: 'Everton moved into the next round after a composed display, while the result leaves the club preparing for another cup fixture. The available reports confirm the score and identify the next opponent, but do not detail the player decision.',
  body: longBody, category: 'news', tags: ['Everton', 'EFL Cup'], sources, reviewerWarnings: [],
};
const evidence = { news: [{ title: 'Everton cup report', summary: 'Everton beat Newcastle 3-1.' }], sources };

test('copy lint checks links, meta language, headings, lengths, and prohibited betting terms', () => {
  assert.deepEqual(copyLintArticle(article), []);
  const bad = { ...article, title: 'Short', excerpt: 'Too brief.', body: `## Confirmed\nThis section is our own reading. The evidence supplied to us guarantees a sure win. https://other.example/raw\n${longBody.replaceAll(`[Publisher 1](${urls[0]})`, urls[0]).replaceAll(`[Publisher 2](${urls[1]})`, '')}` };
  const warnings = copyLintArticle(bad).join('\n');
  for (const phrase of ['headline must be', 'excerpt must be', 'banned audit heading', 'banned meta language', 'raw URLs', 'every source URL', 'prohibited betting language']) assert.ok(warnings.includes(phrase), phrase);
});

test('fact preservation accepts prose edits only when facts and identity remain stable', () => {
  const edited = { ...article, title: 'Everton progress after a controlled win against Newcastle', body: `${longBody.replace('a measured performance', 'a composed performance')}\nWhat's next remains unclear.` };
  assert.deepEqual(factPreservationErrors(article, edited, evidence), []);
});

for (const opener of ['Beyond', 'Several', 'However', 'After']) {
  for (const prefix of [' ', '\n## ', '\n- ', '\n1. ', '\n> ']) {
    test(`fact preservation accepts ordinary opener ${opener} after ${JSON.stringify(prefix)}`, () => {
      const edited = { ...article, body: `${longBody}${prefix}${opener} the cup match, reports described the team response.` };
      assert.deepEqual(factPreservationErrors(article, edited, evidence), []);
    });
  }
}

test('fact preservation matches names against source words in any case, including possessives and acronyms', () => {
  const original = { ...article, body: `${longBody} Reports mentioned valencia and mbappé’s response to uefa.` };
  const sourceEvidence = { news: [{ summary: 'newcastle met o’brien in carabao cup coverage.' }] };
  const edited = { ...original, body: `${original.body} Valencia and Mbappé responded to UEFA. Newcastle met O’Brien in the Carabao Cup.` };
  assert.deepEqual(factPreservationErrors(original, edited, sourceEvidence), []);
});

test('fact preservation recognises lower-case words in original source metadata', () => {
  const original = { ...article, sources: sources.map((source) => ({ ...source, title: 'valencia report' })) };
  const edited = { ...original, body: `${longBody} Valencia responded.` };
  assert.deepEqual(factPreservationErrors(original, edited, evidence), []);
});

for (const added of ['Valencia responded.', 'Reports mentioned Valencia.', 'Mbappé responded.', 'PSG responded.', '## Valencia response', '- Valencia responded.']) {
  test(`fact preservation rejects an unsupported name: ${added}`, () => {
    const errors = factPreservationErrors(article, { ...article, body: `${longBody}\n${added}` }, evidence);
    assert.ok(errors.some((error) => error.includes('proper-noun token')), errors.join('\n'));
  });
}

for (const opener of ['Questions', 'Reaction', 'Ultimately']) {
  for (const prefix of [' ', '\n## ', '\n- ', '\n1. ']) {
    test(`ordinary prose opener ${opener} is positional, not a blanket name exemption: ${JSON.stringify(prefix)}`, () => {
      const edited = { ...article, body: `${longBody}${prefix}${opener} remain about the cup match.` };
      assert.deepEqual(factPreservationErrors(article, edited, evidence), []);
      const unsupported = { ...edited, body: `${edited.body} Reports mentioned ${opener}.` };
      assert.ok(factPreservationErrors(article, unsupported, evidence).some((error) => error.includes(`(${opener.toLowerCase()})`)));
    });
  }
}

test('sentence-opening prose exemptions do not hide capitalized mid-sentence names', () => {
  const errors = factPreservationErrors(article, { ...article, body: `${longBody} Open play continued. Reports mentioned Open.` }, evidence);
  assert.ok(errors.some((error) => error.includes('(open)')));
});

test('fact preservation accepts existing quotations but rejects new or altered quotes', () => {
  const original = { ...article, body: `${longBody} The response was “a measured performance”.` };
  const sourceEvidence = { news: [{ summary: 'The report said "a closely contested cup match".' }] };
  const edited = { ...original, body: `${original.body} The report said “a closely contested cup match”.` };
  assert.deepEqual(factPreservationErrors(original, edited, sourceEvidence), []);
  for (const quote of ['"a composed performance"', '“a composed performance”', '‘a composed performance’', "'a composed performance'"]) {
    const errors = factPreservationErrors(original, { ...original, body: `${original.body} The response was ${quote}.` }, sourceEvidence);
    assert.ok(errors.some((error) => error.includes('introduced or changed a quote')), quote);
  }
});

test('fact preservation rejects changed metadata, URLs, numbers, dates, and unsupported proper nouns', () => {
  const edited = { ...article, dedupeKey: 'changed-key', category: 'content', tags: ['Everton'], sources: [sources[0]], title: 'Everton win 4-1 against Newcastle on 31 October', body: `${longBody.replace(`[Publisher 2](${urls[1]})`, '')} Valencia manager spoke.` };
  const errors = factPreservationErrors(article, edited, evidence).join('\n');
  for (const phrase of ['changed dedupeKey', 'changed category', 'changed tags', 'changed sources', 'set of URLs', 'new number', 'proper-noun token']) assert.ok(errors.includes(phrase), phrase);
  const addedDate = factPreservationErrors(article, { ...article, body: `${article.body} The year 2026 was notable.` }, evidence);
  assert.ok(addedDate.some((error) => error.includes('new number, score, or date (2026)')));
});

test('copy-edit rejection falls back to original and adds a reviewer warning; lint issues remain warnings', () => {
  const changed = { ...article, body: `${article.body} Lionel Messi responded.` };
  const rejected = prepareCopyEditedDrafts([article], [changed], evidence);
  assert.equal(rejected.drafts[0].body, article.body);
  assert.ok(rejected.drafts[0].reviewerWarnings[0].startsWith('Copy edit rejected:'));
  const linted = prepareCopyEditedDrafts([article], [{ ...article, body: article.body.replace(`[Publisher 1](${urls[0]})`, urls[0]) }], evidence);
  assert.equal(linted.drafts.length, 1);
  assert.ok(linted.drafts[0].reviewerWarnings.some((warning) => warning.startsWith('Copy lint:')));
  const missing = prepareCopyEditedDrafts([article], [], evidence);
  assert.equal(missing.drafts[0].body, article.body);
  assert.ok(missing.drafts[0].reviewerWarnings[0].startsWith('Copy edit rejected:'));
});
