const test = require('node:test');
const assert = require('node:assert/strict');
const { esc, buildMatcher, highlight, filterItems } = require('../media/filter');

const ITEMS = [
  { name: 'repo', branch: 'main', head: '8a4695f5', path: '/home/me/repo' },
  { name: 'ls-2815', branch: '2815-face-gate', head: '27c91c25', path: '/home/me/ls-2815' },
  { name: 'ls-sa', branch: '2761-connect-security', head: 'aaaa1111', path: '/home/me/ls-sa' },
  { name: 'ls-e', branch: '', head: 'f258ddf6', path: '/srv/other/ls-e' },
];
const names = (items) => items.map((i) => i.name);

test('an empty search shows everything', () => {
  assert.equal(buildMatcher('   ', false), null);
  assert.deepEqual(names(filterItems(ITEMS, null)), names(ITEMS));
});

test('plain text matches name, branch or path, ignoring case', () => {
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('SECURITY', false))), ['ls-sa']);
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('2815', false))), ['ls-2815']);
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('/srv/', false))), ['ls-e']);
});

test('plain text treats regex characters literally', () => {
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('ls-.', false))), []);
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('ls-s', false))), ['ls-sa']);
});

test('regex mode uses the expression', () => {
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('^ls-\\d+$', true))), ['ls-2815']);
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('face|connect', true))), ['ls-2815', 'ls-sa']);
});

test('a detached worktree matches on its head', () => {
  assert.deepEqual(names(filterItems(ITEMS, buildMatcher('f258', false))), ['ls-e']);
});

test('an invalid regex is reported, not thrown', () => {
  assert.equal(buildMatcher('(unclosed', true), undefined);
  assert.ok(buildMatcher('(unclosed', false) instanceof RegExp);
});

test('repeated filtering gives the same answer (global regex state is reset)', () => {
  const re = buildMatcher('ls', false);
  assert.deepEqual(names(filterItems(ITEMS, re)), names(filterItems(ITEMS, re)));
});

test('highlight marks every match and escapes HTML', () => {
  assert.equal(highlight('a-b-a', buildMatcher('a', false)), '<mark>a</mark>-b-<mark>a</mark>');
  assert.equal(highlight('<x>', null), '&lt;x&gt;');
  assert.equal(highlight('<b>"', buildMatcher('b', false)), '&lt;<mark>b</mark>&gt;&quot;');
  assert.equal(esc('&'), '&amp;');
});

test('highlight stops on an empty match instead of looping', () => {
  assert.equal(highlight('abc', buildMatcher('x*', true)), 'abc');
});
