// Launches a real VS Code (VSCODE_VERSION, default stable) on a throwaway repository with worktrees,
// opened as a multi-root workspace, and runs suite.js inside it.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { runTests } = require('@vscode/test-electron');

function makeRepo() {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'wts-')));
  const main = path.join(dir, 'main');
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd });
  fs.mkdirSync(main);
  git(main, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(main, 'src'));
  fs.writeFileSync(path.join(main, 'src', 'app.txt'), 'main\n');
  git(main, 'add', '-A');
  git(main, 'commit', '-q', '-m', 'first');
  git(main, 'worktree', 'add', '-q', '-b', 'feature-one', path.join(dir, 'wt-one'));
  git(main, 'worktree', 'add', '-q', '-b', 'feature-two', path.join(dir, 'wt-two'));
  const workspace = path.join(dir, 'test.code-workspace');
  fs.writeFileSync(workspace, JSON.stringify({
    folders: [{ path: main }],
    settings: {
      'worktreeHopper.followInGit': false,
      'worktreeHopper.revealInGraph': false,
      'security.workspace.trust.enabled': false,
    },
  }));
  // A window whose first folder is not a repository (a plain folder), the repository second.
  const plain = path.join(dir, 'notes');
  fs.mkdirSync(plain);
  const mixed = path.join(dir, 'mixed.code-workspace');
  fs.writeFileSync(mixed, JSON.stringify({ folders: [{ path: plain }, { path: main }], settings: { 'security.workspace.trust.enabled': false } }));
  return { dir, workspace, mixed };
}

async function main() {
  const { dir, workspace, mixed } = makeRepo();
  const flags = ['--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes'];
  const run = (suite, target, extra = []) => runTests({
    version: process.env.VSCODE_VERSION || 'stable',
    extensionDevelopmentPath: path.join(__dirname, '..', '..'),
    extensionTestsPath: path.join(__dirname, suite),
    extensionTestsEnv: { WTS_ROOT: dir },
    launchArgs: [...(target ? [target] : []), ...flags, ...extra],
  });
  try {
    await run('suite.js', workspace);
    await run('startup.js', mixed);
    // No folder at all: a new empty window.
    await run('startup.js', null, ['--new-window']);
  } catch (e) {
    console.error('Integration tests failed:', e);
    process.exit(1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main();
