# Worktree Hopper

[![Build](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml/badge.svg)](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/NikolayChernuha.worktree-hopper?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=NikolayChernuha.worktree-hopper)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/NikolayChernuha.worktree-hopper)](https://marketplace.visualstudio.com/items?itemName=NikolayChernuha.worktree-hopper)
[![Open VSX](https://img.shields.io/open-vsx/v/NikolayChernuha/worktree-hopper?label=Open%20VSX)](https://open-vsx.org/extension/NikolayChernuha/worktree-hopper)
[![Tested on VS Code](https://img.shields.io/badge/tested%20on%20VS%20Code-1.85%20%7C%20stable-007ACC)](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml)
[![Tested on](https://img.shields.io/badge/tested%20on-Linux%20%7C%20Windows%20%7C%20macOS-555)](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/Niko412/worktree-hopper/blob/main/LICENSE)

**Switch git worktrees from the Source Control view, in place, without reloading the window.**

A **Worktrees** panel sits under Changes and the Graph. Type a few letters of a folder, branch or path, press Enter,
and the window is on that worktree, with your open files, the Graph and Changes following along.

![The Worktrees panel in Source Control](https://raw.githubusercontent.com/Niko412/worktree-hopper/main/images/screenshot.png)

## Why

If you keep a worktree per task or pull request, getting to the right one means *File → Open Folder*, a full
reload, and losing your terminals and chat. With Worktree Hopper it is one click, and nothing restarts.

## Features

- **Every worktree, in Source Control.** Folder, branch (or detached commit), and tags for `main`, `open`, `gone`
  and `locked`. ● marks the active one.
- **Search by text or regex.** Name, branch or path, with matches highlighted. **Alt+R** or `.*` toggles regular
  expressions.
- **Switch in place, no reload.** The window holds just the active worktree, like a normal repository; editors and
  terminals stay open. (Prefer instant switches with nothing restarting? See *How switching works*.)
- **Your editors come along.** Open files reopen at the same path in the new worktree; unsaved ones stay put.
- **Source Control follows.** Changes and the Graph show the active worktree.
- **Delete with a confirmation.** 🗑 (or the Delete key) asks Yes/Cancel. Uncommitted changes or a lock ask a
  second time. The branch is kept.
- **New window when you want one.** Alt+click, or ⧉ on the row.

## Keyboard

| Key | Action |
|---|---|
| **Ctrl+Alt+W** (**Cmd+Alt+W**) | Jump to the search box |
| ↑ / ↓ | Move through the list |
| **Enter** | Switch in this window |
| **Alt+Enter** | Open in a new window |
| **Delete** | Delete the selected worktree (asks first) |
| **Alt+R** | Toggle regular expressions |
| **Esc** | Clear the search |

## How switching works

`worktreeHopper.switchMode` chooses how a click switches this window:

- **`single`** (default): the window holds only the active worktree, so Explorer and Source Control look exactly
  like a normal repository. The window does not reload, and editors and terminals stay; VS Code restarts the
  extensions for a moment, because a window's first folder changed.
- **`twoRoots`**: the folder you opened stays first and the worktree is swapped in as a second folder. Switching is
  instant and nothing restarts, but Explorer and Source Control show two roots. The first switch turns a
  single-folder window into a workspace.
- **`reload`**: reopen the window on the worktree.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `worktreeHopper.switchMode` | `single` | `single`: only the active worktree in the window; `twoRoots`: instant, as a second folder; `reload`: reopen the window. |
| `worktreeHopper.openIn` | `sameWindow` | Where a plain click opens. Alt+click does the other. |
| `worktreeHopper.moveEditors` | `true` | On a switch in this window, reopen open editors in the new worktree. |
| `worktreeHopper.followInGit` | `true` | In `twoRoots` mode, show only the active worktree in Source Control. |
| `worktreeHopper.revealInGraph` | `true` | In `twoRoots` mode, scroll the Graph to the worktree's current commit. |
| `worktreeHopper.hidePrunable` | `false` | Hide worktrees whose folder is gone. |

## Tips

- Drag the **Worktrees** header between Changes and the Graph; VS Code remembers where you put it.
- VS Code asks whether to trust each new worktree folder. Trust their parent folder once (**Workspaces: Manage
  Workspace Trust**) to skip that.
- Terminals already open stay where they were; new ones start in the active worktree.

## Requirements

- VS Code 1.85 or newer, or a compatible editor (Cursor, VSCodium, Windsurf).
- `git` on the machine where the workspace lives. Works locally and over Remote SSH, WSL and Dev Containers.

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/Niko412/worktree-hopper/issues).
