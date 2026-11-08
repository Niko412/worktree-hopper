# Worktree Switch

[![Build](https://github.com/Niko412/worktree-switch/actions/workflows/build.yml/badge.svg)](https://github.com/Niko412/worktree-switch/actions/workflows/build.yml)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/niko412.worktree-switch?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=niko412.worktree-switch)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/niko412.worktree-switch)](https://marketplace.visualstudio.com/items?itemName=niko412.worktree-switch)
[![Open VSX](https://img.shields.io/open-vsx/v/niko412/worktree-switch?label=Open%20VSX)](https://open-vsx.org/extension/niko412/worktree-switch)
[![GitHub release](https://img.shields.io/github/v/release/Niko412/worktree-switch)](https://github.com/Niko412/worktree-switch/releases)
[![Tested on VS Code](https://img.shields.io/badge/tested%20on%20VS%20Code-1.85%20%7C%20stable-007ACC)](https://github.com/Niko412/worktree-switch/actions/workflows/build.yml)
[![Tested on](https://img.shields.io/badge/tested%20on-Linux%20%7C%20Windows%20%7C%20macOS-555)](https://github.com/Niko412/worktree-switch/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A VS Code extension: a **Worktrees** panel in the Source Control view. Search git worktrees by text or regex and
switch to one in place, without reloading the window. Open files, Changes and the Graph follow the switch.

![The Worktrees panel in Source Control](images/screenshot.png)

The Marketplace listing, with every feature, key and setting, is [MARKETPLACE.md](MARKETPLACE.md).

## Install

- **VS Code:** search *Worktree Switch* in the Extensions view, or
  [install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=niko412.worktree-switch).
- **Cursor, VSCodium, Windsurf:** install from [Open VSX](https://open-vsx.org/extension/niko412/worktree-switch).
- **By hand:** download the `.vsix` from [Releases](https://github.com/Niko412/worktree-switch/releases), then
  `code --install-extension worktree-switch-X.Y.Z.vsix`.

## What is tested

Every push and pull request runs, on GitHub's hosted runners:

| Suite | Where | What |
|---|---|---|
| Unit | Node 20 | Parsing `git worktree list`, search and regex, why git refused a delete, Windows paths, the manifest against the code and the README, the release guard |
| Integration | VS Code **1.85.0** (the minimum) and **stable**, on **Linux, Windows and macOS** | A real VS Code on a throwaway repository with worktrees: switch in place, editors moving, switching back, unsaved editors staying, delete refused, cancelled, asked twice for changes, and done |

The `.vsix` is built only after every test passes.

## Development

```sh
npm ci
npm test                    # unit tests
npm run test:integration    # downloads VS Code and runs the integration tests (needs a display; xvfb-run on Linux)
npx vsce package --readme-path MARKETPLACE.md
```

The code: [extension.js](extension.js) (the extension host side), [media/](media/) (the panel's webview),
[lib/worktrees.js](lib/worktrees.js) (pure helpers), [test/](test/).

## Releasing

A release is a `vX.Y.Z` tag on `main`; nothing else publishes.

1. In an ordinary commit, bump `version` in `package.json` and add a `## X.Y.Z` entry at the top of `CHANGELOG.md`.
2. Run `scripts/release.sh`. It tags `origin/main` at the version `package.json` writes, and pushes the tag.
3. CI's release guard ([scripts/release-guard.sh](scripts/release-guard.sh)) refuses the tag unless it is
   `vX.Y.Z`, `package.json` and the newest `CHANGELOG.md` entry carry that version, its commit is on `main`, it is
   higher than every earlier release, and it was not released before. After the tests pass, CI builds the `.vsix`,
   checks the version inside it too, and attaches it to a GitHub release.
4. Upload that `.vsix` to the [Marketplace](https://marketplace.visualstudio.com/manage) (New extension → Visual
   Studio Code, or Update) and to Open VSX (`npx ovsx publish worktree-switch-X.Y.Z.vsix -p <token>`).

Tags `v*` cannot be moved or deleted, and `main` cannot be force-pushed or deleted (repository rulesets).

## Contributing

This repository takes issues, but only its owner can push or open pull requests. Bug reports and ideas are welcome
in [Issues](https://github.com/Niko412/worktree-switch/issues).

## License

[MIT](LICENSE)
