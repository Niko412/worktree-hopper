#!/usr/bin/env bash
# Refuses a release tag unless every version field agrees with it and it is a new, higher release on main.
#   scripts/release-guard.sh tag <tag>          before building: tag form, package.json, package-lock.json,
#                                               CHANGELOG, main, order
#   scripts/release-guard.sh vsix <tag> <file>  after building: the version inside the .vsix
set -euo pipefail

fail() { echo "release guard: $*" >&2; exit 1; }

stage="${1:-}"
tag="${2:-}"
[[ -n "$stage" && -n "$tag" ]] || fail "usage: $0 tag <tag> | vsix <tag> <file>"
[[ "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail "tag '$tag' is not vX.Y.Z"
version="${tag#v}"

case "$stage" in
  tag)
    pkg="$(node -p "require('./package.json').version")" || fail "cannot read package.json"
    [[ "$pkg" == "$version" ]] || fail "package.json says $pkg, tag says $version"

    if [[ -f package-lock.json ]]; then
      lock="$(node -p "const l=require('./package-lock.json'); l.version + ' ' + ((l.packages || {})[''] || {}).version")"
      [[ "$lock" == "$version $version" ]] || fail "package-lock.json says '$lock', tag says $version"
    fi

    changelog="$(grep -m1 -oE '^## [0-9]+\.[0-9]+\.[0-9]+' CHANGELOG.md | cut -c4-)" || true
    [[ "$changelog" == "$version" ]] || fail "CHANGELOG.md's newest entry is '${changelog:-none}', tag says $version"

    git fetch --quiet --tags --force origin main
    commit="$(git rev-list -n1 "$tag")" || fail "tag $tag not found"
    git merge-base --is-ancestor "$commit" origin/main || fail "$tag ($commit) is not on origin/main"

    if gh release view "$tag" >/dev/null 2>&1; then fail "$tag is already released"; fi

    highest="$(git tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | grep -vx "$tag" | sort -V | tail -n1 || true)"
    if [[ -n "$highest" ]]; then
      top="$(printf '%s\n%s\n' "$highest" "$tag" | sort -V | tail -n1)"
      [[ "$top" == "$tag" ]] || fail "$tag is not higher than the latest release $highest"
    fi
    echo "release guard: $tag passes (package.json, package-lock.json, CHANGELOG.md, on main, after ${highest:-nothing})"
    ;;
  vsix)
    file="${3:-}"
    [[ -f "$file" ]] || fail "no .vsix at '$file'"
    inside="$(unzip -p "$file" extension/package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
    manifest="$(unzip -p "$file" extension.vsixmanifest | grep -oE 'Identity [^>]*' | grep -oE 'Version="[^"]+"' | head -n1 | cut -d'"' -f2)"
    [[ "$inside" == "$version" ]] || fail ".vsix package.json says $inside, tag says $version"
    [[ "$manifest" == "$version" ]] || fail ".vsix manifest says $manifest, tag says $version"
    echo "release guard: $file is $version"
    ;;
  *) fail "unknown stage '$stage'" ;;
esac
