const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'extension.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const declared = Object.keys(pkg.contributes.configuration.properties);

test('every setting the code reads is declared', () => {
  const used = [...source.matchAll(/\.get\('([A-Za-z]+)'\)/g)].map((m) => 'worktreeSwitch.' + m[1]);
  for (const s of new Set(used)) assert.ok(declared.includes(s), `${s} is read but not declared`);
});

test('every declared setting is documented in the README', () => {
  for (const s of declared) assert.ok(readme.includes('`' + s + '`'), `${s} is missing from README.md`);
});

test('every declared command is registered', () => {
  for (const { command } of pkg.contributes.commands) {
    assert.ok(source.includes(`registerCommand('${command}'`), `${command} is declared but not registered`);
  }
});

test('the view the code registers is declared in Source Control', () => {
  assert.ok(pkg.contributes.views.scm.some((v) => v.id === 'worktreeSwitch.view' && v.type === 'webview'));
  assert.ok(source.includes("registerWebviewViewProvider('worktreeSwitch.view'"));
});

test('the Marketplace fields are present', () => {
  for (const k of ['name', 'displayName', 'description', 'version', 'publisher', 'license', 'icon', 'repository']) {
    assert.ok(pkg[k], `package.json has no ${k}`);
  }
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.ok(fs.existsSync(path.join(root, pkg.icon)), 'icon file is missing');
  assert.ok(fs.existsSync(path.join(root, 'LICENSE')), 'LICENSE is missing');
});

test('the CHANGELOG has an entry for the current version', () => {
  const newest = changelog.match(/^## (\d+\.\d+\.\d+)/m);
  assert.ok(newest, 'CHANGELOG.md has no version entry');
  assert.equal(newest[1], pkg.version);
});

test('the webview loads the files the extension ships', () => {
  for (const f of ['view.js', 'filter.js', 'view.css']) {
    assert.ok(source.includes(`'media', '${f}'`), `extension.js does not load media/${f}`);
    assert.ok(fs.existsSync(path.join(root, 'media', f)), `media/${f} is missing`);
  }
});
