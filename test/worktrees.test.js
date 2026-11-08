const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePorcelain } = require('../lib/worktrees');

const SAMPLE = [
  'worktree /repo',
  'HEAD 8a4695f5aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'branch refs/heads/main',
  '',
  'worktree /wt/feature',
  'HEAD c89972c2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'branch refs/heads/feature/one',
  'locked',
  '',
  'worktree /wt/gone',
  'HEAD f258ddf6cccccccccccccccccccccccccccccccc',
  'detached',
  'prunable gitdir file points to non-existent location',
  '',
  'worktree /repo.git',
  'bare',
  '',
].join('\n');

test('parses every worktree in order', () => {
  const items = parsePorcelain(SAMPLE);
  assert.deepEqual(items.map((i) => i.path), ['/repo', '/wt/feature', '/wt/gone', '/repo.git']);
});

test('keeps the branch without refs/heads/ and the short head', () => {
  const [main, feature] = parsePorcelain(SAMPLE);
  assert.equal(main.branch, 'main');
  assert.equal(main.head, '8a4695f5');
  assert.equal(feature.branch, 'feature/one');
});

test('reads the locked, detached, prunable and bare flags', () => {
  const [main, feature, gone, bare] = parsePorcelain(SAMPLE);
  assert.equal(main.locked || main.detached || main.prunable || main.bare, false);
  assert.equal(feature.locked, true);
  assert.equal(gone.detached, true);
  assert.equal(gone.prunable, true);
  assert.equal(gone.branch, '');
  assert.equal(bare.bare, true);
});

test('handles CRLF-free empty input and stray lines before the first worktree', () => {
  assert.deepEqual(parsePorcelain(''), []);
  assert.deepEqual(parsePorcelain('HEAD abc\nbranch refs/heads/x\n'), []);
});

test('keeps spaces in paths', () => {
  const [item] = parsePorcelain('worktree /home/me/my repo\nHEAD 1234567890\nbranch refs/heads/x\n');
  assert.equal(item.path, '/home/me/my repo');
});

const { removeRefusal, removeArgs, normalizePath } = require('../lib/worktrees');

test('reads why git refused to remove a worktree', () => {
  assert.equal(removeRefusal("fatal: '../x' contains modified or untracked files, use --force to delete it"), 'dirty');
  assert.equal(removeRefusal("fatal: cannot remove a locked working tree;\nuse 'remove -f -f' to override or unlock first"), 'locked');
  assert.equal(removeRefusal('fatal: not a git repository'), null);
  assert.equal(removeRefusal(undefined), null);
});

test('forces only as much as the refusal needs', () => {
  assert.deepEqual(removeArgs('/w', null), ['worktree', 'remove', '/w']);
  assert.deepEqual(removeArgs('/w', 'dirty'), ['worktree', 'remove', '--force', '/w']);
  assert.deepEqual(removeArgs('/w', 'locked'), ['worktree', 'remove', '--force', '--force', '/w']);
});

test('normalizes paths so git and VS Code agree on Windows', () => {
  assert.equal(normalizePath('C:/Users/Me/repo', 'win32'), normalizePath('c:\\users\\me\\repo\\', 'win32'));
  assert.equal(normalizePath('/home/me/repo/', 'linux'), '/home/me/repo');
  assert.notEqual(normalizePath('/home/Me', 'linux'), normalizePath('/home/me', 'linux'));
});
