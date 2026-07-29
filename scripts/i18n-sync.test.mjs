import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flatten,
  getPath,
  missingPaths,
  stalePaths,
  rebuildFromSource,
} from './i18n-sync.mjs';

const source = {
  nav: { home: 'Home', about: 'About' },
  home: { title: 'Hello', cta: 'Go {name}' },
};

test('flatten produces dotted leaf paths', () => {
  assert.deepEqual(flatten(source), {
    'nav.home': 'Home',
    'nav.about': 'About',
    'home.title': 'Hello',
    'home.cta': 'Go {name}',
  });
});

test('getPath reads nested values and returns undefined for absent paths', () => {
  assert.equal(getPath(source, 'nav.about'), 'About');
  assert.equal(getPath(source, 'nav.missing'), undefined);
  assert.equal(getPath(source, 'a.b.c'), undefined);
});

test('missingPaths lists source leaves absent from the target', () => {
  const target = { nav: { home: 'Accueil' }, home: { title: 'Bonjour' } };
  assert.deepEqual(missingPaths(source, target), ['nav.about', 'home.cta']);
});

test('stalePaths lists target leaves no longer in the source', () => {
  const target = {
    nav: { home: 'Accueil', about: 'A', legacy: 'old' },
    home: { title: 'B', cta: 'C' },
  };
  assert.deepEqual(stalePaths(source, target), ['nav.legacy']);
});

test('rebuildFromSource keeps existing, fills missing, drops stale, mirrors structure', async () => {
  const target = {
    nav: { home: 'Accueil', legacy: 'old' },
    home: { title: 'Bonjour' },
  };
  const calls = [];
  const translate = async (text, path) => {
    calls.push(path);
    return `[fr]${text}`;
  };
  const { result, filled } = await rebuildFromSource(source, target, translate);

  // Existing translations preserved.
  assert.equal(result.nav.home, 'Accueil');
  assert.equal(result.home.title, 'Bonjour');
  // Missing keys filled via translate().
  assert.equal(result.nav.about, '[fr]About');
  assert.equal(result.home.cta, '[fr]Go {name}');
  // Stale key dropped; structure mirrors source exactly.
  assert.deepEqual(Object.keys(result.nav), ['home', 'about']);
  assert.deepEqual(missingPaths(source, result), []);
  assert.deepEqual(stalePaths(source, result), []);
  // Only missing paths were translated.
  assert.deepEqual(filled.sort(), ['home.cta', 'nav.about']);
  assert.deepEqual(calls.sort(), ['home.cta', 'nav.about']);
});
