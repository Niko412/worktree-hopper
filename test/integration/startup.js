// Start-up cases, inside VS Code: a window whose first folder is not a repository, and a window with no folder.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vscode = require('vscode');

const same = (p) => {
  let r = path.resolve(p);
  try { r = fs.realpathSync.native(r); } catch (e) { /* compare as given */ }
  return process.platform === 'win32' ? r.toLowerCase() : r;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const ext = vscode.extensions.all.find((e) => e.packageJSON.name === 'worktree-hopper');
  assert.ok(ext, 'extension not found');
  const { provider } = await ext.activate();
  await provider.refresh();
  const folders = vscode.workspace.workspaceFolders || [];

  if (folders.length === 0) {
    assert.equal(provider.lastState.type, 'error');
    assert.match(provider.lastState.text, /Open a folder inside a git repository/);
    console.log('ok - an empty window asks for a folder');
  } else {
    const main = same(path.join(process.env.WTS_ROOT, 'main'));
    assert.equal(provider.lastState.type, 'list', JSON.stringify(provider.lastState));
    assert.equal(provider.paths.size, 2); // main and wt-one: the first suite deleted wt-two
    assert.ok(provider.paths.has(main));
    console.log('ok - the repository is found when the first folder is not one');
  }

  // The panel shows what the extension last posted, whenever its page loads (no empty list).
  await vscode.commands.executeCommand('worktreeHopper.focus');
  await sleep(1500);
  assert.equal(provider.pageReady, true, 'the panel page never said ready');
  console.log('ok - the panel page loads and is answered');
}

module.exports = { run };
