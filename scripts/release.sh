#!/usr/bin/env bash
# Tags origin/main at the version package.json writes and pushes the tag; CI guards, builds and releases it.
# Bump the version (package.json and a CHANGELOG.md entry) in an ordinary commit first.
set -euo pipefail

git fetch --quiet --tags origin main
version="$(git show origin/main:package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
tag="v$version"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "$tag already exists: bump package.json and CHANGELOG.md first" >&2
  exit 1
fi
git tag -a "$tag" -m "$tag" origin/main
git push origin "$tag"
echo "pushed $tag; watch it with: gh run watch"
