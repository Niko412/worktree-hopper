// Search logic for the Worktrees list. Loaded by the webview (window.WorktreeFilter) and by the tests (require).
(function (root) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // null: no filter; undefined: invalid regular expression; otherwise a global, case-insensitive RegExp.
  function buildMatcher(text, regex) {
    const t = String(text || '').trim();
    if (!t) return null;
    try {
      return regex ? new RegExp(t, 'gi') : new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    } catch (e) {
      return undefined;
    }
  }

  function highlight(s, re) {
    if (!re) return esc(s);
    let out = '';
    let last = 0;
    re.lastIndex = 0;
    for (const m of String(s).matchAll(re)) {
      if (!m[0]) break;
      out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(String(s).slice(last));
  }

  function test(re, s) {
    re.lastIndex = 0;
    return re.test(s || '');
  }

  function filterItems(items, re) {
    if (!re) return items.slice();
    return items.filter((i) => test(re, i.name) || test(re, i.branch || i.head) || test(re, i.path));
  }

  const api = { esc, buildMatcher, highlight, filterItems };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorktreeFilter = api;
})(typeof window !== 'undefined' ? window : globalThis);
