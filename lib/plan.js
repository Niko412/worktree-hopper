// What a switch to `target` does to the window's folders, decided without touching VS Code so it can be tested.
//
//   mode 'single'   (default) the window holds only the active worktree: replace every folder with the target.
//                   The first folder changes, so VS Code restarts the extensions; the window does not reload.
//   mode 'twoRoots' the first folder stays and the worktree is swapped in a second slot: no restart, but two roots.
//                   ('hot' is the 1.0.0 name of this mode.)
//   mode 'reload'   reopen the window on the target (handled by the caller as op 'open').
//
// folders: the workspace folders' paths, in order. slotIdx: the index of the swapped worktree in twoRoots mode, or -1.
// same(a, b): whether two paths are the same folder. hasWorkspaceFile: whether the window is a (saved or untitled)
// workspace rather than a single folder.
//
// Returns { op: 'none' } | { op: 'open' } |
//         { op: 'update', start, deleteCount, add, restarts, becomesWorkspace }
//   add is the path to insert at start (or null); restarts: VS Code restarts the extensions when it applies.
function planSwitch({ mode, folders, slotIdx, target, same, hasWorkspaceFile }) {
  if (mode === 'reload' || folders.length === 0) return { op: 'open' };
  const twoRoots = mode === 'twoRoots' || mode === 'hot';

  if (!twoRoots) {
    if (folders.length === 1 && same(folders[0], target)) return { op: 'none' };
    return { op: 'update', start: 0, deleteCount: folders.length, add: target, restarts: true, becomesWorkspace: !hasWorkspaceFile };
  }

  const active = slotIdx > 0 ? folders[slotIdx] : folders[0];
  if (same(active, target)) return { op: 'none' };
  if (same(folders[0], target)) {
    return slotIdx > 0 ? { op: 'update', start: slotIdx, deleteCount: 1, add: null, restarts: false, becomesWorkspace: false } : { op: 'none' };
  }
  if (slotIdx > 0) return { op: 'update', start: slotIdx, deleteCount: 1, add: target, restarts: false, becomesWorkspace: false };
  // Adding a second folder to a single-folder window turns it into a workspace, which restarts the extensions once.
  return { op: 'update', start: folders.length, deleteCount: 0, add: target, restarts: !hasWorkspaceFile, becomesWorkspace: !hasWorkspaceFile };
}

module.exports = { planSwitch };
