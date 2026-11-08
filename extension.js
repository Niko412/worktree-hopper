// Worktree Switch: a webview panel in the Source Control sidebar listing `git worktree list`.
const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    cp.execFile('git', args, { cwd, maxBuffer: 4 * 1024 * 1024 }, (err, out, errOut) =>
      err ? reject(new Error(errOut || err.message)) : resolve(out));
  });
}

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

// Reopen each clean editor under oldRoot at the same relative path under newRoot; close the old tabs in one go.
async function moveEditors(oldRoot, newRoot) {
  if (!oldRoot) return;
  const prefix = path.resolve(oldRoot) + path.sep;
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const moves = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (!(tab.input instanceof vscode.TabInputText) || tab.isDirty || tab.input.uri.scheme !== 'file') continue;
      const p = tab.input.uri.fsPath;
      if (!p.startsWith(prefix)) continue;
      const moved = path.join(newRoot, p.slice(prefix.length));
      if (fs.existsSync(moved)) moves.push({ tab, uri: vscode.Uri.file(moved), col: group.viewColumn });
    }
  }
  if (!moves.length) return;
  await Promise.all(moves.map((m) => vscode.window.showTextDocument(m.uri, { viewColumn: m.col, preview: false, preserveFocus: true })));
  await vscode.window.tabGroups.close(moves.map((m) => m.tab), true);
  const focus = moves.find((m) => m.tab === activeTab) || moves[0];
  await vscode.window.showTextDocument(focus.uri, { viewColumn: focus.col });
}

// Make git (and so the Graph and Changes) follow the active worktree: close the old repo, open the new one.
async function followInGit(oldRoot, newRoot) {
  const ext = vscode.extensions.getExtension('vscode.git');
  if (!ext) return;
  const api = (ext.isActive ? ext.exports : await ext.activate()).getAPI(1);
  const target = vscode.Uri.file(newRoot);
  if (!api.getRepository(target)) await api.openRepository(target);
  if (oldRoot && path.resolve(oldRoot) !== path.resolve(newRoot) && api.getRepository(vscode.Uri.file(oldRoot))) {
    await vscode.commands.executeCommand('git.close', vscode.Uri.file(oldRoot));
  }
}

// Scroll the Source Control Graph to the active repository's HEAD (the ◎ "Go to Current History Item" button).
// The Graph loads the new repository a moment after git opens it, so wait for git's HEAD, then reveal a few times.
const REVEAL = 'workbench.scm.action.graph.revealCurrentHistoryItem';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let revealRun = 0;
async function revealGraphHead(root, log) {
  const run = ++revealRun;
  const ext = vscode.extensions.getExtension('vscode.git');
  if (ext && root) {
    const api = (ext.isActive ? ext.exports : await ext.activate()).getAPI(1);
    for (let t = 0; t < 50; t++) {
      const repo = api.getRepository(vscode.Uri.file(root));
      if (repo && repo.state.HEAD && repo.state.HEAD.commit) { log(`git ready after ${t * 100} ms`); break; }
      await sleep(100);
    }
  }
  for (const wait of [300, 700, 1200, 2000]) {
    await sleep(wait);
    if (run !== revealRun) return; // a newer switch took over
    try { await vscode.commands.executeCommand(REVEAL); } catch (e) { log('reveal failed: ' + e.message); }
  }
  log('revealed ' + root);
}

class WorktreeView {
  constructor(context) {
    this.context = context;
    this.view = undefined;
    this.watchers = [];
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
    view.onDidChangeVisibility(() => view.visible && this.refresh());
    this.refresh().then(() => {
      const r = this.roots();
      if (r.slotIdx > 0 && vscode.workspace.getConfiguration('worktreeSwitch').get('followInGit')) {
        followInGit(r.anchor.uri.fsPath, r.active)
          .then(() => vscode.workspace.getConfiguration('worktreeSwitch').get('revealInGraph') && revealGraphHead(r.active, (m) => this.log(m)))
          .catch((e) => this.log('git: ' + e.message));
      }
    });
  }

  // Hot mode keeps folder 0 (the anchor) fixed and swaps one extra folder (the slot):
  // changing a window's first folder restarts every extension, changing a later one does not.
  roots() {
    const folders = vscode.workspace.workspaceFolders || [];
    const anchor = folders[0];
    const known = this.paths || new Set();
    const slotIdx = folders.findIndex((f, i) => i > 0 && known.has(path.resolve(f.uri.fsPath)));
    return { folders, anchor, slotIdx, active: slotIdx > 0 ? folders[slotIdx].uri.fsPath : anchor && anchor.uri.fsPath };
  }

  async refresh() {
    if (!this.view) return;
    const { folders, active, anchor } = this.roots();
    const cwd = active || (anchor && anchor.uri.fsPath);
    if (!cwd) return this.post({ type: 'error', text: 'Open a folder inside a git repository.' });
    try {
      const top = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
      const commonDir = path.resolve(top, (await git(cwd, ['rev-parse', '--git-common-dir'])).trim());
      let items = parsePorcelain(await git(top, ['worktree', 'list', '--porcelain']));
      this.paths = new Set(items.map((i) => path.resolve(i.path)));
      const r = this.roots();
      if (vscode.workspace.getConfiguration('worktreeSwitch').get('hidePrunable')) items = items.filter((i) => !i.prunable);
      const main = items[0] && items[0].path;
      const open = new Set(folders.map((f) => path.resolve(f.uri.fsPath)));
      for (const i of items) {
        i.current = path.resolve(i.path) === path.resolve(r.active || top);
        i.open = !i.current && open.has(path.resolve(i.path));
        i.main = i.path === main;
        i.name = path.basename(i.path);
      }
      this.watch(commonDir);
      this.post({ type: 'list', items, openIn: vscode.workspace.getConfiguration('worktreeSwitch').get('openIn') });
    } catch (e) {
      this.post({ type: 'error', text: 'Not a git repository: ' + cwd });
    }
  }

  async hotSwitch(target) {
    const { folders, anchor, slotIdx, active } = this.roots();
    if (!anchor) return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(target), { forceReuseWindow: true });
    if (active && path.resolve(active) === path.resolve(target)) return;
    const name = path.basename(target);
    const cfg = vscode.workspace.getConfiguration('worktreeSwitch');
    const toAnchor = path.resolve(target) === path.resolve(anchor.uri.fsPath);
    if (!toAnchor && slotIdx < 0 && !vscode.workspace.workspaceFile) {
      // First switch: the window turns multi-root and this extension restarts, so move editors before that.
      if (cfg.get('moveEditors')) await moveEditors(active, target);
      vscode.window.setStatusBarMessage('Worktree Switch: window becomes multi-root once; later switches are instant', 5000);
      vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(target), name });
      return;
    }
    if (toAnchor) vscode.workspace.updateWorkspaceFolders(slotIdx, 1);
    else if (slotIdx > 0) vscode.workspace.updateWorkspaceFolders(slotIdx, 1, { uri: vscode.Uri.file(target), name });
    else vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(target), name });
    await Promise.all([
      cfg.get('moveEditors') ? moveEditors(active, target) : null,
      cfg.get('followInGit') ? followInGit(active, target).catch((e) => this.log('git: ' + e.message)) : null,
    ]);
    if (cfg.get('revealInGraph')) revealGraphHead(target, (m) => this.log(m));
    vscode.window.setStatusBarMessage('Switched to ' + name, 2000);
  }

  watch(commonDir) {
    if (this.watchedDir === commonDir) return;
    this.watchers.forEach((w) => w.dispose());
    this.watchedDir = commonDir;
    const debounced = () => { clearTimeout(this.t); this.t = setTimeout(() => this.refresh(), 300); };
    for (const pattern of ['worktrees/*/HEAD', 'worktrees/*', 'HEAD']) {
      const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(commonDir), pattern));
      w.onDidCreate(debounced); w.onDidDelete(debounced); w.onDidChange(debounced);
      this.watchers.push(w);
    }
  }

  async onMessage(msg) {
    if (msg.type === 'ready') return this.refresh();
    if (msg.type === 'refresh') return this.refresh();
    if (msg.type === 'open') {
      if (!fs.existsSync(msg.path)) {
        vscode.window.showWarningMessage(`Worktree folder is gone: ${msg.path}. Run "git worktree prune".`);
        return;
      }
      if (msg.newWindow) return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(msg.path), { forceNewWindow: true });
      if (vscode.workspace.getConfiguration('worktreeSwitch').get('switchMode') === 'hot') return this.hotSwitch(msg.path);
      return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(msg.path), { forceReuseWindow: true });
    }
    if (msg.type === 'copy') {
      await vscode.env.clipboard.writeText(msg.path);
      vscode.window.setStatusBarMessage('Copied ' + msg.path, 2000);
    }
  }

  log(m) {
    if (!this.out) this.out = vscode.window.createOutputChannel('Worktree Switch');
    this.out.appendLine(new Date().toISOString().slice(11, 19) + ' ' + m);
  }

  focusSearch() { this.post({ type: 'focus' }); }

  post(m) { if (this.view) this.view.webview.postMessage(m); }

  html(webview) {
    const nonce = Math.random().toString(36).slice(2);
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.css'));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.js'));
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}"></head><body>
<div class="search">
  <input id="q" type="text" placeholder="Search worktrees (Enter opens first)" spellcheck="false" aria-label="Search worktrees">
  <button id="rx" class="toggle" title="Use Regular Expression (Alt+R)" aria-pressed="false">.*</button>
</div>
<div id="count" class="count"></div>
<ul id="list" role="listbox"></ul>
<script nonce="${nonce}" src="${js}"></script>
</body></html>`;
  }
}

function activate(context) {
  const provider = new WorktreeView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('worktreeSwitch.view', provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('worktreeSwitch.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('worktreeSwitch.focus', async () => {
      await vscode.commands.executeCommand('worktreeSwitch.view.focus');
      provider.focusSearch();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('worktreeSwitch') && provider.refresh()),
    { dispose: () => provider.watchers.forEach((w) => w.dispose()) },
  );
}

module.exports = { activate, deactivate() {} };
