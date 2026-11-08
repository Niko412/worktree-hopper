(function () {
  const vscode = acquireVsCodeApi();
  const state = Object.assign({ q: '', regex: false }, vscode.getState() || {});
  const q = document.getElementById('q');
  const rx = document.getElementById('rx');
  const list = document.getElementById('list');
  const count = document.getElementById('count');
  let items = [];
  let shown = [];
  let sel = 0;
  let openIn = 'sameWindow';

  q.value = state.q;
  rx.setAttribute('aria-pressed', String(state.regex));

  const { esc, buildMatcher, highlight, filterItems } = window.WorktreeFilter;

  function matcher() {
    const re = buildMatcher(q.value, state.regex);
    q.classList.toggle('bad', re === undefined);
    return re;
  }

  function render() {
    const re = matcher();
    if (re === undefined) { count.textContent = 'Invalid regular expression'; return; }
    shown = filterItems(items, re);
    if (sel >= shown.length) sel = Math.max(0, shown.length - 1);
    count.textContent = re ? `${shown.length} of ${items.length}` : `${items.length} worktrees`;
    list.innerHTML = shown.map((i, n) => {
      const label = i.branch || (i.detached ? `detached ${i.head}` : i.head);
      const tags = [i.main && 'main', i.open && 'open', i.prunable && 'gone', i.locked && 'locked'].filter(Boolean)
        .map((t) => `<span class="tag">${t}</span>`).join('');
      return `<li role="option" data-n="${n}" class="${n === sel ? 'sel' : ''} ${i.current ? 'cur' : ''} ${i.prunable ? 'gone' : ''}" title="${esc(i.path)}">
        <span class="dot">${i.current ? '●' : ''}</span>
        <span class="name">${highlight(i.name, re)}</span>
        <span class="branch">${highlight(label, re)}</span>${tags}
        <button class="act" data-act="here" title="Switch in this window">↪</button>
        <button class="act" data-act="new" title="Open in new window">⧉</button>
        <button class="act" data-act="copy" title="Copy path">⎘</button>
        ${i.main || i.current || i.open ? '' : '<button class="act del" data-act="delete" title="Delete worktree…">🗑</button>'}
      </li>`;
    }).join('');
  }

  function open(n, other, forced) {
    const i = shown[n];
    if (!i || i.current) return;
    const newWindow = forced !== undefined ? forced : (openIn === 'newWindow') !== !!other;
    vscode.postMessage({ type: 'open', path: i.path, newWindow });
  }

  function save() { state.q = q.value; vscode.setState(state); }

  q.addEventListener('input', () => { sel = 0; save(); render(); });
  rx.addEventListener('click', () => {
    state.regex = !state.regex; rx.setAttribute('aria-pressed', String(state.regex)); save(); render(); q.focus();
  });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { open(sel, e.altKey); }
    else if (e.key === 'Delete' && shown[sel] && !shown[sel].main && !shown[sel].current && !shown[sel].open) {
      vscode.postMessage({ type: 'delete', path: shown[sel].path }); e.preventDefault();
    }
    else if (e.key === 'Escape') { q.value = ''; save(); render(); }
    else if (e.altKey && (e.key === 'r' || e.key === 'R')) { rx.click(); e.preventDefault(); }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    const n = Number(li.dataset.n);
    const act = e.target.dataset && e.target.dataset.act;
    if (act === 'copy') return vscode.postMessage({ type: 'copy', path: shown[n].path });
    if (act === 'delete') return vscode.postMessage({ type: 'delete', path: shown[n].path });
    if (act === 'here') return open(n, false, false);
    if (act === 'new') return open(n, false, true);
    open(n, e.altKey);
  });

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'list') { items = m.items; openIn = m.openIn; render(); }
    else if (m.type === 'error') { items = []; list.innerHTML = `<li class="err">${esc(m.text)}</li>`; count.textContent = ''; }
    else if (m.type === 'focus') { q.focus(); q.select(); }
  });

  vscode.postMessage({ type: 'ready' });
})();
