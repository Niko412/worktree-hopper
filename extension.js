// Worktree Hopper: a webview panel in the Source Control sidebar listing `git worktree list`.
const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const { parsePorcelain, removeRefusal, removeArgs, normalizePath } = require('./lib/worktrees');

// Real path first (symlinks, Windows short names like RUNNER~1), then one comparable form.
const realpath = (p) => { try { return fs.realpathSync.native(p); } catch (e) { return p; } };
const norm = (p) => normalizePath(realpath(p), process.platform);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstLine = (t) => String(t || '').trim().split('\n')[0];

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    cp.execFile('git', args, { cwd, maxBuffer: 4 * 1024 * 1024 }, (err, out, errOut) => {
      if (!err) return resolve(out);
      if (err.code === 'ENOENT') return reject(new Error('git was not found on the PATH of this machine'));
      return reject(new Error(errOut || err.message));
    });
  });
}


// Reopen each clean editor under oldRoot at the same relative path under newRoot; close the old tabs in one go.
async function moveEditors(oldRoot, newRoot) {
  if (!oldRoot) return;
  const prefix = norm(oldRoot) + path.sep;
  const prefixLength = path.resolve(oldRoot).length + 1;
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const moves = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (!(tab.input instanceof vscode.TabInputText) || tab.isDirty || tab.input.uri.scheme !== 'file') continue;
      const p = tab.input.uri.fsPath;
      if (!norm(p).startsWith(prefix)) continue;
      const moved = path.join(newRoot, path.resolve(p).slice(prefixLength));
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
  if (oldRoot && norm(oldRoot) !== norm(newRoot) && api.getRepository(vscode.Uri.file(oldRoot))) {
    await vscode.commands.executeCommand('git.close', vscode.Uri.file(oldRoot));
  }
}

// Scroll the Source Control Graph to the active repository's HEAD (the ◎ "Go to Current History Item" button).
// The Graph loads the new repository a moment after git opens it, so wait for git's HEAD, then reveal a few times.
const REVEAL = 'workbench.scm.action.graph.revealCurrentHistoryItem';
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

// updateWorkspaceFolders refuses (returns false) while VS Code is still confirming the previous change.
// Retry until it is accepted, then wait for the change to land.
async function updateFolders(start, deleteCount, ...add) {
  for (let t = 0; t < 50; t++) {
    let sub;
    const landed = new Promise((resolve) => {
      sub = vscode.workspace.onDidChangeWorkspaceFolders(() => resolve(true));
      setTimeout(() => resolve(false), 5000);
    });
    if (vscode.workspace.updateWorkspaceFolders(start, deleteCount, ...add)) {
      const ok = await landed;
      sub.dispose();
      return ok;
    }
    sub.dispose();
    await sleep(100);
  }
  return false;
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
    // Listen before the page loads: its 'ready' can come at once, and a message lost here leaves an empty list.
    view.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
    view.webview.html = this.html(view.webview);
    view.onDidChangeVisibility(() => view.visible && this.refresh());
    this.refresh().then(() => {
      const r = this.roots();
      if (r.slotIdx > 0 && vscode.workspace.getConfiguration('worktreeHopper').get('followInGit')) {
        followInGit(r.anchor.uri.fsPath, r.active)
          .then(() => vscode.workspace.getConfiguration('worktreeHopper').get('revealInGraph') && revealGraphHead(r.active, (m) => this.log(m)))
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
    const slotIdx = folders.findIndex((f, i) => i > 0 && known.has(norm(f.uri.fsPath)));
    return { folders, anchor, slotIdx, active: slotIdx > 0 ? folders[slotIdx].uri.fsPath : anchor && anchor.uri.fsPath };
  }

  // The repository to list: the active worktree first, then every workspace folder in order,
  // so a window whose first folder is not a repository (or a parent of several) still works.
  async findRepo() {
    const { folders, active } = this.roots();
    const candidates = [...new Set([active, ...folders.map((f) => f.uri.fsPath)].filter(Boolean))];
    const failures = [];
    for (const cwd of candidates) {
      try {
        const top = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
        const commonDir = path.resolve(top, (await git(cwd, ['rev-parse', '--git-common-dir'])).trim());
        return { top, commonDir };
      } catch (e) {
        failures.push(`${cwd}: ${firstLine(e.message)}`);
      }
    }
    return { failures, empty: candidates.length === 0 };
  }

  async refresh() {
    const repo = await this.findRepo();
    if (!repo.top) {
      if (repo.empty) return this.post({ type: 'error', text: 'Open a folder inside a git repository.' });
      for (const f of repo.failures) this.log('no repository: ' + f);
      return this.post({ type: 'error', text: 'No git repository here. ' + repo.failures[0] });
    }
    const { top, commonDir } = repo;
    try {
      let items = parsePorcelain(await git(top, ['worktree', 'list', '--porcelain']));
      this.paths = new Set(items.map((i) => norm(i.path)));
      const r = this.roots();
      if (vscode.workspace.getConfiguration('worktreeHopper').get('hidePrunable')) items = items.filter((i) => !i.prunable);
      const main = items[0] && items[0].path;
      const open = new Set(r.folders.map((f) => norm(f.uri.fsPath)));
      const activeRoot = r.slotIdx > 0 ? r.active : top;
      for (const i of items) {
        i.current = norm(i.path) === norm(activeRoot);
        i.open = !i.current && open.has(norm(i.path));
        i.main = i.path === main;
        i.name = path.basename(i.path);
      }
      this.items = items;
      this.repoTop = top;
      this.watch(commonDir);
      this.post({ type: 'list', items, openIn: vscode.workspace.getConfiguration('worktreeHopper').get('openIn') });
    } catch (e) {
      this.log('git worktree list failed: ' + e.message.trim());
      this.post({ type: 'error', text: 'git worktree list failed: ' + firstLine(e.message) });
    }
  }

  async hotSwitch(target) {
    const { folders, anchor, slotIdx, active } = this.roots();
    if (!anchor) return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(target), { forceReuseWindow: true });
    if (active && norm(active) === norm(target)) return;
    const name = path.basename(target);
    const cfg = vscode.workspace.getConfiguration('worktreeHopper');
    const toAnchor = norm(target) === norm(anchor.uri.fsPath);
    if (!toAnchor && slotIdx < 0 && !vscode.workspace.workspaceFile) {
      // First switch: the window turns multi-root and this extension restarts, so move editors before that.
      if (cfg.get('moveEditors')) await moveEditors(active, target);
      vscode.window.setStatusBarMessage('Worktree Hopper: window becomes multi-root once; later switches are instant', 5000);
      vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(target), name });
      return;
    }
    let ok;
    if (toAnchor) ok = await updateFolders(slotIdx, 1);
    else if (slotIdx > 0) ok = await updateFolders(slotIdx, 1, { uri: vscode.Uri.file(target), name });
    else ok = await updateFolders(folders.length, 0, { uri: vscode.Uri.file(target), name });
    if (!ok) {
      this.log(`switch to ${name} was not accepted by VS Code`);
      vscode.window.showWarningMessage(`Could not switch to ${name}. Try again.`);
      return;
    }
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
    if (msg.type === 'ready') {
      this.pageReady = true;
      if (this.lastState) this.view.webview.postMessage(this.lastState);
      return this.refresh();
    }
    if (msg.type === 'refresh') return this.refresh();
    if (msg.type === 'open') {
      if (!fs.existsSync(msg.path)) {
        vscode.window.showWarningMessage(`Worktree folder is gone: ${msg.path}. Run "git worktree prune".`);
        return;
      }
      if (msg.newWindow) return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(msg.path), { forceNewWindow: true });
      if (vscode.workspace.getConfiguration('worktreeHopper').get('switchMode') === 'hot') return this.hotSwitch(msg.path);
      return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(msg.path), { forceReuseWindow: true });
    }
    if (msg.type === 'delete') return this.deleteWorktree(msg.path);
    if (msg.type === 'copy') {
      await vscode.env.clipboard.writeText(msg.path);
      vscode.window.setStatusBarMessage('Copied ' + msg.path, 2000);
    }
  }

  // A modal Yes/Cancel question; returns true on Yes. Replaced in the integration tests.
  async ask(message, detail) {
    return (await vscode.window.showWarningMessage(message, { modal: true, detail }, 'Yes')) === 'Yes';
  }

  // Deletes a worktree after a Yes. The main worktree and any folder open in this window are refused.
  async deleteWorktree(target) {
    const item = (this.items || []).find((i) => norm(i.path) === norm(target));
    if (!item) return false;
    const open = (vscode.workspace.workspaceFolders || []).some((f) => norm(f.uri.fsPath) === norm(target));
    if (item.main || open) {
      vscode.window.showWarningMessage(item.main ? 'The main worktree cannot be deleted.' : `Switch away from ${item.name} before deleting it.`);
      return false;
    }
    const branch = item.branch ? `The branch ${item.branch} is kept.` : 'Its commit stays in the repository.';
    const where = item.prunable ? 'Its folder is already gone; git forgets it.' : `This deletes the folder ${item.path}.`;
    if (!(await this.ask(`Delete worktree ${item.name}?`, `${where} ${branch}`))) return false;
    const cwd = this.repoTop;
    try {
      await this.removeWorktree(cwd, item, null);
    } catch (e) {
      const refusal = removeRefusal(e.message);
      if (!refusal) { vscode.window.showErrorMessage(`Could not delete ${item.name}: ${e.message.trim()}`); return false; }
      const why = refusal === 'locked'
        ? `${item.name} is locked.`
        : `${item.name} has uncommitted or untracked changes. They will be lost.`;
      if (!(await this.ask(`${why} Delete it anyway?`, `This deletes the folder ${item.path}. ${branch}`))) return false;
      try {
        await this.removeWorktree(cwd, item, refusal);
      } catch (e2) {
        vscode.window.showErrorMessage(`Could not delete ${item.name}: ${e2.message.trim()}`);
        return false;
      }
    }
    vscode.window.setStatusBarMessage(`Deleted worktree ${item.name}`, 3000);
    await this.refresh();
    return true;
  }

  // git worktree remove, retried: on Windows a file watcher can hold the folder for a moment.
  // A refusal that needs the user's answer (changes, lock) is thrown at once. If git has already
  // let go of the worktree but its folder is still there, the folder is removed here.
  async removeWorktree(cwd, item, refusal) {
    let last;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await git(cwd, removeArgs(item.path, refusal));
        return;
      } catch (e) {
        last = e;
        this.log(`remove ${item.name} (attempt ${attempt + 1}): ${e.message.trim()}`);
        if (!refusal && removeRefusal(e.message)) throw e;
        const listed = parsePorcelain(await git(cwd, ['worktree', 'list', '--porcelain']))
          .some((i) => norm(i.path) === norm(item.path));
        if (!listed) {
          fs.rmSync(item.path, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
          return;
        }
        await sleep(400);
      }
    }
    throw last;
  }

  log(m) {
    if (!this.out) this.out = vscode.window.createOutputChannel('Worktree Hopper');
    this.out.appendLine(new Date().toISOString().slice(11, 19) + ' ' + m);
  }

  focusSearch() { this.post({ type: 'focus' }); }

  // Keeps the last list or error, so a page that loads later (or reloads) gets it on 'ready'.
  post(m) {
    if (m.type === 'list' || m.type === 'error') this.lastState = m;
    if (this.view) this.view.webview.postMessage(m);
  }

  html(webview) {
    const nonce = Math.random().toString(36).slice(2);
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.css'));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.js'));
    const filterJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'filter.js'));
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}"></head><body>
<div class="search">
  <input id="q" type="text" placeholder="Search worktrees (Enter opens first)" spellcheck="false" aria-label="Search worktrees">
  <button id="rx" class="toggle" title="Use Regular Expression (Alt+R)" aria-pressed="false">.*</button>
</div>
<div id="count" class="count"></div>
<ul id="list" role="listbox"></ul>
<script nonce="${nonce}" src="${filterJs}"></script>
<script nonce="${nonce}" src="${js}"></script>
</body></html>`;
  }
}

// The pre-1.0 builds were "Worktree Switch" (another id); both installed means two Worktrees panels.
async function warnAboutOldExtension() {
  const old = ['NikolayChernuha.worktree-switch', 'niko412.worktree-switch', 'centralad.worktree-switch']
    .find((id) => vscode.extensions.getExtension(id));
  if (!old) return;
  const choice = await vscode.window.showWarningMessage(
    `Worktree Hopper replaces ${old} (Worktree Switch). With both installed there are two Worktrees panels.`,
    'Uninstall the old one',
  );
  if (choice) await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', old);
}

function activate(context) {
  const provider = new WorktreeView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('worktreeHopper.view', provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('worktreeHopper.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('worktreeHopper.focus', async () => {
      await vscode.commands.executeCommand('worktreeHopper.view.focus');
      provider.focusSearch();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('worktreeHopper') && provider.refresh()),
    { dispose: () => provider.watchers.forEach((w) => w.dispose()) },
  );
  provider.refresh();
  warnAboutOldExtension();
  return { provider }; // used by the integration tests
}

module.exports = { activate, deactivate() {} };
