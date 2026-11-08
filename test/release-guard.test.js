// Runs scripts/release-guard.sh against throwaway git repositories, with a fake `gh` on the PATH.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const GUARD = path.join(__dirname, '..', 'scripts', 'release-guard.sh');

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// A repo with an origin, package.json at `version`, a CHANGELOG entry, and the given earlier tags.
function makeRepo({ version = '1.2.0', changelog = version, lock = version, tags = [], released = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
  const origin = path.join(dir, 'origin.git');
  const work = path.join(dir, 'work');
  const bin = path.join(dir, 'bin');
  sh(dir, 'git', ['init', '-q', '--bare', '-b', 'main', origin]);
  sh(dir, 'git', ['init', '-q', '-b', 'main', work]);
  const git = (...a) => sh(work, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a]);
  git('remote', 'add', 'origin', origin);
  const commit = (v, c, l = v) => {
    fs.writeFileSync(path.join(work, 'package.json'), JSON.stringify({ name: 'x', version: v }));
    fs.writeFileSync(path.join(work, 'package-lock.json'), JSON.stringify({ name: 'x', version: l, packages: { '': { version: l } } }));
    fs.writeFileSync(path.join(work, 'CHANGELOG.md'), `# Changelog\n\n## ${c}\n\n- change\n\n## 0.0.1\n`);
    git('add', '-A');
    git('commit', '-q', '-m', v);
  };
  for (const t of tags) { commit(t.slice(1), t.slice(1)); git('tag', t); }
  commit(version, changelog, lock);
  git('push', '-q', 'origin', 'main', '--tags');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nexit ${released ? 0 : 1}\n`, { mode: 0o755 });
  return { work, git, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } };
}

function guard(repo, ...args) {
  const r = spawnSync('bash', [GUARD, ...args], { cwd: repo.work, env: repo.env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

function tagAndPush(repo, tag) {
  repo.git('tag', tag);
  repo.git('push', '-q', 'origin', tag);
}

test('a new, higher tag on main that every version field agrees with passes', () => {
  const repo = makeRepo({ version: '1.2.0', tags: ['v1.0.0', 'v1.1.0'] });
  tagAndPush(repo, 'v1.2.0');
  const r = guard(repo, 'tag', 'v1.2.0');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /passes/);
});

test('a tag that is not vX.Y.Z is refused', () => {
  const repo = makeRepo();
  for (const t of ['1.2.0', 'v1.2', 'v1.2.0-beta', 'v01.2.0', 'release']) {
    const r = guard(repo, 'tag', t);
    assert.notEqual(r.code, 0, t);
    assert.match(r.out, /not vX\.Y\.Z/);
  }
});

test('package.json disagreeing with the tag is refused', () => {
  const repo = makeRepo({ version: '1.2.0' });
  tagAndPush(repo, 'v1.3.0');
  const r = guard(repo, 'tag', 'v1.3.0');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /package\.json says 1\.2\.0/);
});

test('a package-lock.json disagreeing with the tag is refused', () => {
  const repo = makeRepo({ version: '1.2.0', lock: '1.1.0' });
  tagAndPush(repo, 'v1.2.0');
  const r = guard(repo, 'tag', 'v1.2.0');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /package-lock\.json says '1\.1\.0 1\.1\.0'/);
});

test('a CHANGELOG without an entry for the version is refused', () => {
  const repo = makeRepo({ version: '1.2.0', changelog: '1.1.0' });
  tagAndPush(repo, 'v1.2.0');
  const r = guard(repo, 'tag', 'v1.2.0');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /CHANGELOG\.md's newest entry is '1\.1\.0'/);
});

test('a tag on a commit that is not on main is refused', () => {
  const repo = makeRepo({ version: '1.2.0' });
  repo.git('switch', '-q', '-c', 'side');
  repo.git('commit', '-q', '--allow-empty', '-m', 'side');
  tagAndPush(repo, 'v1.2.0');
  const r = guard(repo, 'tag', 'v1.2.0');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /is not on origin\/main/);
});

test('a tag lower than the latest release is refused', () => {
  const repo = makeRepo({ version: '1.1.5', tags: ['v1.0.0', 'v1.2.0'] });
  tagAndPush(repo, 'v1.1.5');
  const r = guard(repo, 'tag', 'v1.1.5');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /not higher than the latest release v1\.2\.0/);
});

test('versions compare as numbers, not text', () => {
  const repo = makeRepo({ version: '1.10.0', tags: ['v1.9.0'] });
  tagAndPush(repo, 'v1.10.0');
  assert.equal(guard(repo, 'tag', 'v1.10.0').code, 0);
});

test('a version already released is refused', () => {
  const repo = makeRepo({ version: '1.2.0', released: true });
  tagAndPush(repo, 'v1.2.0');
  const r = guard(repo, 'tag', 'v1.2.0');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /already released/);
});

function makeVsix(dir, pkgVersion, manifestVersion) {
  const file = path.join(dir, 'x.vsix');
  const manifest = `<PackageManifest><Metadata><Identity Language="en-US" Id="x" Version="${manifestVersion}" Publisher="p"/></Metadata></PackageManifest>`;
  execFileSync('python3', ['-c', [
    'import sys, zipfile',
    'z = zipfile.ZipFile(sys.argv[1], "w")',
    'z.writestr("extension/package.json", sys.argv[2])',
    'z.writestr("extension.vsixmanifest", sys.argv[3])',
    'z.close()',
  ].join('\n'), file, JSON.stringify({ version: pkgVersion }), manifest]);
  return file;
}

test('a .vsix built at the tag version passes', () => {
  const repo = makeRepo();
  const r = guard(repo, 'vsix', 'v1.2.0', makeVsix(repo.work, '1.2.0', '1.2.0'));
  assert.equal(r.code, 0, r.out);
});

test('a .vsix whose package.json or manifest disagrees with the tag is refused', () => {
  const repo = makeRepo();
  let r = guard(repo, 'vsix', 'v1.2.0', makeVsix(repo.work, '1.1.0', '1.2.0'));
  assert.notEqual(r.code, 0);
  assert.match(r.out, /\.vsix package\.json says 1\.1\.0/);
  r = guard(repo, 'vsix', 'v1.2.0', makeVsix(repo.work, '1.2.0', '1.1.0'));
  assert.notEqual(r.code, 0);
  assert.match(r.out, /\.vsix manifest says 1\.1\.0/);
});
