const test = require('node:test');
const assert = require('node:assert/strict');
const { planSwitch } = require('../lib/plan');

const same = (a, b) => a === b;
const plan = (o) => planSwitch({ same, slotIdx: -1, hasWorkspaceFile: false, ...o });

test('single: a one-folder window replaces its folder with the target, restarting extensions', () => {
  assert.deepEqual(plan({ mode: 'single', folders: ['/main'], target: '/wt' }),
    { op: 'update', start: 0, deleteCount: 1, add: '/wt', restarts: true, becomesWorkspace: true });
});

test('single: once a workspace, later switches still replace the one folder', () => {
  assert.deepEqual(plan({ mode: 'single', folders: ['/wt'], target: '/other', hasWorkspaceFile: true }),
    { op: 'update', start: 0, deleteCount: 1, add: '/other', restarts: true, becomesWorkspace: false });
});

test('single: a two-root window left by twoRoots mode collapses to the target alone', () => {
  assert.deepEqual(plan({ mode: 'single', folders: ['/main', '/wt'], target: '/other', hasWorkspaceFile: true }),
    { op: 'update', start: 0, deleteCount: 2, add: '/other', restarts: true, becomesWorkspace: false });
});

test('single: switching to the folder already open does nothing', () => {
  assert.deepEqual(plan({ mode: 'single', folders: ['/wt'], target: '/wt' }), { op: 'none' });
});

test('single is the default for an unknown or missing mode', () => {
  assert.equal(plan({ mode: undefined, folders: ['/main'], target: '/wt' }).deleteCount, 1);
  assert.equal(plan({ mode: 'bogus', folders: ['/main'], target: '/wt' }).start, 0);
});

test('an empty window and reload mode open the folder', () => {
  assert.deepEqual(plan({ mode: 'single', folders: [], target: '/wt' }), { op: 'open' });
  assert.deepEqual(plan({ mode: 'reload', folders: ['/main'], target: '/wt' }), { op: 'open' });
});

test('twoRoots: the first switch adds a second folder (restart only if the window was a single folder)', () => {
  assert.deepEqual(plan({ mode: 'twoRoots', folders: ['/main'], target: '/wt' }),
    { op: 'update', start: 1, deleteCount: 0, add: '/wt', restarts: true, becomesWorkspace: true });
  assert.equal(plan({ mode: 'twoRoots', folders: ['/main'], target: '/wt', hasWorkspaceFile: true }).restarts, false);
});

test('twoRoots: later switches replace the slot, and the first folder removes it, without a restart', () => {
  assert.deepEqual(plan({ mode: 'twoRoots', folders: ['/main', '/a'], slotIdx: 1, target: '/b', hasWorkspaceFile: true }),
    { op: 'update', start: 1, deleteCount: 1, add: '/b', restarts: false, becomesWorkspace: false });
  assert.deepEqual(plan({ mode: 'twoRoots', folders: ['/main', '/a'], slotIdx: 1, target: '/main', hasWorkspaceFile: true }),
    { op: 'update', start: 1, deleteCount: 1, add: null, restarts: false, becomesWorkspace: false });
  assert.deepEqual(plan({ mode: 'twoRoots', folders: ['/main', '/a'], slotIdx: 1, target: '/a' }), { op: 'none' });
});

test("'hot' (the 1.0.0 name) still means twoRoots", () => {
  assert.equal(plan({ mode: 'hot', folders: ['/main', '/a'], slotIdx: 1, target: '/b', hasWorkspaceFile: true }).start, 1);
});
