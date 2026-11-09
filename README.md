# Worktree Hopper

[![Build](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml/badge.svg)](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/NikolayChernuha.worktree-hopper?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=NikolayChernuha.worktree-hopper)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/NikolayChernuha.worktree-hopper)](https://marketplace.visualstudio.com/items?itemName=NikolayChernuha.worktree-hopper)
[![Open VSX](https://img.shields.io/open-vsx/v/NikolayChernuha/worktree-hopper?label=Open%20VSX)](https://open-vsx.org/extension/NikolayChernuha/worktree-hopper)
[![GitHub release](https://img.shields.io/github/v/release/Niko412/worktree-hopper)](https://github.com/Niko412/worktree-hopper/releases)
[![Tested on VS Code](https://img.shields.io/badge/tested%20on%20VS%20Code-1.85%20%7C%20stable-007ACC)](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml)
[![Tested on](https://img.shields.io/badge/tested%20on-Linux%20%7C%20Windows%20%7C%20macOS-555)](https://github.com/Niko412/worktree-hopper/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A VS Code extension: a **Worktrees** panel in the Source Control view. Search git worktrees by text or regex and
switch to one in place, without reloading the window: the window then holds that worktree like a normal repository,
and open files follow.

![The Worktrees panel in Source Control](images/screenshot.png)

The Marketplace listing, with every feature, key and setting, is [MARKETPLACE.md](MARKETPLACE.md).

## Install

- **VS Code:** search *Worktree Hopper* in the Extensions view, or
  [install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=NikolayChernuha.worktree-hopper).
- **Cursor, VSCodium, Windsurf:** install from [Open VSX](https://open-vsx.org/extension/NikolayChernuha/worktree-hopper).
- **By hand:** download the `.vsix` from [Releases](https://github.com/Niko412/worktree-hopper/releases), then
  `code --install-extension worktree-hopper-X.Y.Z.vsix`.

## What is tested

Every push and pull request runs, on GitHub's hosted runners:

| Suite | Where | What |
|---|---|---|
| Unit | Node 22 | Parsing `git worktree list`, search and regex, why git refused a delete, Windows paths, the manifest against the code and the README, the release guard |
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

1. In an ordinary commit, bump the version (`npm version X.Y.Z --no-git-tag-version` sets `package.json` and
   `package-lock.json`) and add a `## X.Y.Z` entry at the top of `CHANGELOG.md`.
2. Run `scripts/release.sh`. It tags `origin/main` at the version `package.json` writes, and pushes the tag.
3. CI's release guard ([scripts/release-guard.sh](scripts/release-guard.sh)) refuses the tag unless it is
   `vX.Y.Z`, `package.json`, `package-lock.json` and the newest `CHANGELOG.md` entry carry that version, its commit is on `main`, it is
   higher than every earlier release, and it was not released before. After the tests pass, CI builds the `.vsix`,
   checks the version inside it too, and attaches it to a GitHub release.
4. CI then publishes that same `.vsix` to Open VSX, and to the Visual Studio Marketplace once that is set up
   (below); until then upload it on the [Marketplace](https://marketplace.visualstudio.com/manage) (Update).

### Publishing from CI

- **Open VSX:** trusted publishing, no token or secret. At open-vsx.org → Settings → Trusted publishers the
  namespace `NikolayChernuha` trusts GitHub `Niko412/worktree-hopper`, workflow `build.yml`, environment `openvsx`
  (which only `v*` tags may use). The job exchanges GitHub's OIDC token for a short-lived Open VSX one.
- **Visual Studio Marketplace**, without a stored secret (Entra ID with GitHub's OIDC token; Azure DevOps personal
  access tokens for all organisations stop working on 1 December 2026):
  1. In the Azure portal, **Microsoft Entra ID → App registrations → New registration** (free, no subscription).
  2. In it, **Certificates & secrets → Federated credentials → Add**: *GitHub Actions deploying Azure resources*,
     organisation `Niko412`, repository `worktree-hopper`, entity *Environment*, name `marketplace`. That
     environment exists in this repository and only `v*` tags may run in it.
  3. Add the app as a member of the publisher on the
     [Marketplace management page](https://marketplace.visualstudio.com/manage) (Members → Add, role
     *Contributor*), by the user id Azure DevOps gives the app.
  4. Add the repository **variables** `AZURE_CLIENT_ID` (the app's client id) and `AZURE_TENANT_ID`.

Tags `v*` cannot be moved or deleted, and `main` cannot be force-pushed or deleted (repository rulesets).

## Contributing

This repository takes issues, but only its owner can push or open pull requests. Bug reports and ideas are welcome
in [Issues](https://github.com/Niko412/worktree-hopper/issues).

## License

[MIT](LICENSE)
