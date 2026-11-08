# Changelog

## 1.0.1

- **A switch now looks like a normal repository** (new default `worktreeHopper.switchMode: single`): the window
  holds only the active worktree, with one root in Explorer and Source Control. The window does not reload; the
  extensions restart for a moment. The instant two-folder switch is `twoRoots` (1.0.0's `hot`, which still works).
- Fixed: the panel sometimes showed only its search box and no worktrees. It now listens before its page loads
  and sends its last list again whenever the page is ready.
- The repository is found in any folder of the window, not only the first, so a window that starts with a plain
  folder (or a parent of several repositories) works.
- When git fails, the panel says why (git not on the PATH, an unsafe repository, ...) and the log has every
  folder tried (Output → Worktree Hopper).
- With the pre-1.0 *Worktree Switch* still installed there were two Worktrees panels; Worktree Hopper now offers to
  uninstall it.

## 1.0.0

First release on the Visual Studio Marketplace and Open VSX, as **Worktree Hopper**
(`NikolayChernuha.worktree-hopper`).

- **Worktrees panel in Source Control**, under Changes and the Graph: every worktree with its branch (or detached
  commit) and tags for `main`, `open`, `gone` and `locked`; ● marks the active one.
- **Search** by folder name, branch or path, with matches highlighted; **Alt+R** or `.*` toggles regular expressions.
- **Hot switch, no reload:** the active worktree is swapped in as a second workspace folder, so extensions,
  terminals and chat panels keep running. The first switch turns the window multi-root once.
- **Open editors move** to the same files in the new worktree; unsaved ones stay.
- **Source Control and the Graph follow** the active worktree, and the Graph scrolls to its current commit.
- **Delete a worktree** (🗑 or the Delete key) after a Yes/Cancel question; uncommitted changes or a lock ask a
  second time before it is forced. The branch is kept.
- **New window** with Alt+click or ⧉; full-reload switching is the `worktreeHopper.switchMode` setting.
- **Keyboard:** Ctrl+Alt+W (Cmd+Alt+W) jumps to the search; ↑/↓, Enter, Alt+Enter, Delete, Esc.
- Works locally and over Remote SSH, WSL and Dev Containers; paths reached through a symlink or a Windows short
  name are recognised as the same worktree.
- Tested in CI on VS Code 1.85.0 and stable, on Linux, Windows and macOS.

## Before 1.0.0

Pre-releases 0.4.0 to 0.5.1 were published on GitHub only, under the name *Worktree Switch*, which was already taken
on the Marketplace.
