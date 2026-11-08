# Worktree Switch

A **Worktrees** panel inside VS Code's Source Control view. Find a git worktree by typing part of its name, branch or
path, and switch to it in place, without reloading the window.

If you keep many worktrees side by side (one per task or pull request), opening the right one usually means a trip
through *File → Open Folder* or a new window. This panel lists them all under Changes and the Graph, so switching is
one click.

## Features

- **Lists every worktree** of the current repository, from `git worktree list`: folder name, branch (or detached
  commit), and tags for `main`, `open`, `gone` (folder deleted) and `locked`. The active one is marked with ●.
- **Search** by folder name, branch or path. Matches are highlighted. Toggle regular expressions with the `.*`
  button or **Alt+R**; an invalid expression turns the box red.
- **Keyboard first**: **Ctrl+Alt+W** (**Cmd+Alt+W** on macOS) jumps to the search box, ↑/↓ move, **Enter** switches,
  **Alt+Enter** opens in a new window, **Esc** clears.
- **Hot switch, no reload.** The active worktree is swapped in as a second workspace folder, so extensions,
  terminals and chat panels keep running.
- **Your editors come along.** Each open file reopens at the same path in the new worktree. Files with unsaved
  changes stay where they are.
- **Source Control follows.** The previous worktree's repository is closed in Source Control, so Changes and the
  Graph show only the active worktree, and the Graph scrolls to its current commit.
- **New window when you want one**: Alt+click a row, or use its ⧉ button. ⎘ copies the path.
- **Stays current**: the list refreshes when worktrees are added or removed.

## How the hot switch works

VS Code restarts every extension when the *first* folder of a window changes, but not when a later folder does.
So the window keeps the folder you opened as a fixed first folder and swaps the active worktree in a second slot:

- The **first** switch turns the window into a multi-root workspace. Extensions restart once (the window does not
  reload).
- **Every switch after that is instant.**
- Switching back to the first folder removes the slot.

Prefer a plain single-folder window? Set `worktreeSwitch.switchMode` to `reload` and each switch reopens the window
on the worktree instead.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `worktreeSwitch.switchMode` | `hot` | `hot` swaps the worktree in place; `reload` reopens the window on it. |
| `worktreeSwitch.openIn` | `sameWindow` | Where a plain click opens. Alt+click does the other. |
| `worktreeSwitch.moveEditors` | `true` | On a hot switch, reopen open editors in the new worktree. |
| `worktreeSwitch.followInGit` | `true` | On a hot switch, show only the active worktree in Source Control. |
| `worktreeSwitch.revealInGraph` | `true` | After a hot switch, scroll the Graph to the worktree's current commit. |
| `worktreeSwitch.hidePrunable` | `false` | Hide worktrees whose folder is gone. |

## Tips

- The panel appears at the bottom of Source Control. Drag its header to put it between Changes and the Graph;
  VS Code remembers the spot.
- VS Code asks whether you trust each worktree folder the first time it is added. Add their parent folder under
  **Workspaces: Manage Workspace Trust** to skip the prompt.
- Terminals already open stay in their folder; new ones start in the active worktree.
- When you close a hot-switched window, VS Code offers to save it as a workspace. Saving keeps the setup.
- Worktrees marked `gone` can be cleaned up with `git worktree prune`.

## Requirements

- VS Code 1.85 or newer (or a compatible editor such as Cursor or VSCodium).
- `git` on the `PATH` of the machine where the workspace lives. It works in Remote SSH, WSL and containers, where
  it runs next to the repository.

## License

[MIT](LICENSE)
