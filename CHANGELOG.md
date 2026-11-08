# Changelog

## 0.6.0

- Renamed to **Worktree Hopper** (`NikolayChernuha.worktree-hopper`): "Worktree Switch" was taken on the Marketplace.
  Settings and commands are now `worktreeHopper.*`; the repository is `Niko412/worktree-hopper`.

## 0.5.1

- Published under the Marketplace publisher `NikolayChernuha` (the extension id is now
  `NikolayChernuha.worktree-switch`).

## 0.5.0

- Delete a worktree from its row (🗑, or the Delete key) after a Yes/Cancel question. A worktree with uncommitted
  changes, or a locked one, asks a second time before it is forced. The branch is kept.
- Switching again right after a switch no longer gets lost: VS Code refuses a folder change while confirming the last
  one, so the switch retries and waits for it.
- Folders reached through a symlink or a Windows short name (`RUNNER~1`) are recognised as the same worktree.
- Works on Windows paths (git's `C:/x` and VS Code's `c:\x` are the same folder).
- Tested in CI: unit tests, and integration tests in a real VS Code (1.85.0 and stable, on Linux, Windows and macOS).
- Release tags are guarded: package.json, the CHANGELOG and the built .vsix must all carry the tag's version.

## 0.4.0

First public release.

- Worktrees panel inside Source Control, with text or regex search (Alt+R).
- Hot switch: the active worktree swaps as a second workspace folder, so the window does not reload.
- Open editors move to the same files in the new worktree; unsaved ones stay.
- Source Control and its Graph follow the active worktree, and the Graph scrolls to its current commit.
- Open in a new window with Alt+click or the window button; full-reload switching is a setting.
