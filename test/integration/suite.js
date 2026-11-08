// Runs inside VS Code's extension host. Exports run(), as @vscode/test-electron expects.
const assert = require('node:assert/strict');
const path = require('node:path');
const vscode = require('vscode');

const same = (p) => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
const fs = require('node:fs');
const root = process.env.WTS_ROOT;
const MAIN = path.join(root, 'main');
const ONE = path.join(root, 'wt-one');
const TWO = path.join(root, 'wt-two');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, check, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error('timed out waiting for ' + what);
}
const folders = () => (vscode.workspace.workspaceFolders || []).map((f) => same(f.uri.fsPath));
const activeFile = () => vscode.window.activeTextEditor && same(vscode.window.activeTextEditor.document.uri.fsPath);

async function run() {
  const results = [];
  const step = async (name, fn) => {
    try { await fn(); results.push(`ok - ${name}`); } catch (e) { results.push(`not ok - ${name}: ${e.message}`); }
  };

  const ext = vscode.extensions.all.find((e) => e.packageJSON.name === 'worktree-switch');
  assert.ok(ext, 'extension not found');
  const { provider } = await ext.activate();
  await provider.refresh();

  await step('commands are registered', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const c of ['worktreeSwitch.refresh', 'worktreeSwitch.focus']) assert.ok(all.includes(c), c);
  });

  await step('the Worktrees view opens and focuses its search', async () => {
    await vscode.commands.executeCommand('worktreeSwitch.focus');
  });

  await step('lists the three worktrees', async () => {
    assert.equal(provider.paths.size, 3);
    for (const p of [MAIN, ONE, TWO]) assert.ok(provider.paths.has(same(p)), p);
  });

  await step('a hot switch adds the worktree as the second folder, moving the open editor', async () => {
    await vscode.window.showTextDocument(vscode.Uri.file(path.join(MAIN, 'src', 'app.txt')));
    await provider.hotSwitch(ONE);
    await until('wt-one to be the second folder', () => folders()[1] === same(ONE));
    assert.deepEqual(folders(), [same(MAIN), same(ONE)]);
    await until('the editor to move', () => activeFile() === same(path.join(ONE, 'src', 'app.txt')));
  });

  await step('switching again replaces the second folder', async () => {
    await provider.hotSwitch(TWO);
    await until('wt-two to replace wt-one', () => folders()[1] === same(TWO));
    assert.deepEqual(folders(), [same(MAIN), same(TWO)]);
    await until('the editor to move', () => activeFile() === same(path.join(TWO, 'src', 'app.txt')));
  });

  await step('switching back to the first folder removes the slot', async () => {
    await provider.hotSwitch(MAIN);
    await until('the slot to go', () => folders().length === 1);
    assert.deepEqual(folders(), [same(MAIN)]);
    await until('the editor to move back', () => activeFile() === same(path.join(MAIN, 'src', 'app.txt')));
  });

  await step('an unsaved editor stays where it is', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(MAIN, 'src', 'app.txt')));
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(0, 0), 'unsaved '));
    await provider.hotSwitch(ONE);
    await until('wt-one to be the second folder', () => folders()[1] === same(ONE));
    await sleep(500);
    const open = vscode.window.tabGroups.all.flatMap((g) => g.tabs).map((t) => t.input && t.input.uri && same(t.input.uri.fsPath));
    assert.ok(open.includes(same(path.join(MAIN, 'src', 'app.txt'))), 'the unsaved editor was closed');
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });

  // Delete: the confirmation is answered by replacing provider.ask; `answers` lists the replies in order.
  const answering = (answers) => {
    const asked = [];
    provider.ask = async (message) => { asked.push(message); return answers.shift() === 'yes'; };
    return asked;
  };

  await step('delete is refused for the main worktree and for a folder open in the window', async () => {
    const asked = answering(['yes']);
    assert.equal(await provider.deleteWorktree(MAIN), false);
    assert.equal(await provider.deleteWorktree(ONE), false); // wt-one is the open slot
    assert.equal(asked.length, 0);
    assert.ok(fs.existsSync(ONE));
  });

  await step('Cancel keeps the worktree', async () => {
    const asked = answering(['cancel']);
    assert.equal(await provider.deleteWorktree(TWO), false);
    assert.equal(asked.length, 1);
    assert.match(asked[0], /Delete worktree wt-two\?/);
    assert.ok(fs.existsSync(TWO));
    assert.ok(provider.paths.has(same(TWO)));
  });

  await step('a worktree with changes asks a second time, and Cancel there keeps it', async () => {
    fs.writeFileSync(path.join(TWO, 'new.txt'), 'untracked\n');
    const asked = answering(['yes', 'cancel']);
    assert.equal(await provider.deleteWorktree(TWO), false);
    assert.equal(asked.length, 2);
    assert.match(asked[1], /uncommitted or untracked changes/);
    assert.ok(fs.existsSync(path.join(TWO, 'new.txt')));
  });

  await step('Yes twice deletes a worktree with changes, and the branch stays', async () => {
    answering(['yes', 'yes']);
    assert.equal(await provider.deleteWorktree(TWO), true);
    assert.ok(!fs.existsSync(TWO));
    assert.ok(!provider.paths.has(same(TWO)));
    const branches = require('node:child_process').execFileSync('git', ['branch', '--list', 'feature-two'], { cwd: MAIN, encoding: 'utf8' });
    assert.match(branches, /feature-two/);
  });

  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('not ok'));
  if (failed.length) throw new Error(`${failed.length} integration test(s) failed`);
}

module.exports = { run };
