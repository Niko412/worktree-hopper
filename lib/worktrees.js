// Pure helpers, kept free of the vscode module so tests run under plain Node.

function parsePorcelain(text) {
  const items = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: line.slice(9), branch: '', head: '', detached: false, bare: false, prunable: false, locked: false };
      items.push(cur);
    } else if (!cur) {
      continue;
    } else if (line.startsWith('HEAD ')) cur.head = line.slice(5, 13);
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (line === 'detached') cur.detached = true;
    else if (line === 'bare') cur.bare = true;
    else if (line.startsWith('prunable')) cur.prunable = true;
    else if (line.startsWith('locked')) cur.locked = true;
  }
  return items;
}

// Why `git worktree remove` refused, from its error output: 'dirty' (needs --force), 'locked' (needs -f -f), or null.
function removeRefusal(stderr) {
  const t = String(stderr || '');
  if (/locked working tree/i.test(t)) return 'locked';
  if (/modified or untracked files|use --force/i.test(t)) return 'dirty';
  return null;
}

function removeArgs(worktreePath, refusal) {
  const force = refusal === 'locked' ? ['--force', '--force'] : refusal === 'dirty' ? ['--force'] : [];
  return ['worktree', 'remove', ...force, worktreePath];
}

// A path in one comparable form: resolved, and on Windows with backslashes and in lower case
// (git prints C:/x, VS Code reports c:\x, and the file system ignores case).
function normalizePath(p, platform) {
  const pathApi = platform === 'win32' ? require('path').win32 : require('path').posix;
  const r = pathApi.resolve(String(p));
  return platform === 'win32' ? r.toLowerCase() : r;
}

module.exports = { parsePorcelain, removeRefusal, removeArgs, normalizePath };
