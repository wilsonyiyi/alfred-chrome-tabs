import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {bumpReleaseVersion, resolveReleaseVersion} from '../src/release-version.js';

test('resolveReleaseVersion supports semantic release types and exact versions', () => {
  assert.equal(resolveReleaseVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(resolveReleaseVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(resolveReleaseVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(resolveReleaseVersion('1.2.3', '4.5.6'), '4.5.6');
  assert.throws(() => resolveReleaseVersion('1.2.3', 'next'), /X\.Y\.Z/u);
});

test('bumpReleaseVersion synchronizes every release version source', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-tabs-version-'));
  t.after(() => fs.rm(root, {force: true, recursive: true}));
  await fs.mkdir(path.join(root, 'extension'));
  await Promise.all([
    fs.writeFile(path.join(root, 'package.json'), '{"name":"example","version":"1.2.3"}\n'),
    fs.writeFile(path.join(root, 'package-lock.json'), '{"name":"example","version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n'),
    fs.writeFile(path.join(root, 'info.plist'), '<key>version</key><string>1.2.3</string>\n'),
    fs.writeFile(path.join(root, 'extension', 'manifest.json'), '{"manifest_version":3,"version":"1.2.3"}\n'),
  ]);

  const result = await bumpReleaseVersion({release: '1.3.0', root});
  const [packageJson, packageLock, plist, manifest] = await Promise.all([
    fs.readFile(path.join(root, 'package.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(root, 'package-lock.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(root, 'info.plist'), 'utf8'),
    fs.readFile(path.join(root, 'extension', 'manifest.json'), 'utf8').then(JSON.parse),
  ]);

  assert.deepEqual(result, {changed: true, previousVersion: '1.2.3', version: '1.3.0'});
  assert.equal(packageJson.version, '1.3.0');
  assert.equal(packageLock.version, '1.3.0');
  assert.equal(packageLock.packages[''].version, '1.3.0');
  assert.match(plist, /<string>1\.3\.0<\/string>/u);
  assert.equal(manifest.version, '1.3.0');
});

test('bumpReleaseVersion rejects drift before changing files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-tabs-version-drift-'));
  t.after(() => fs.rm(root, {force: true, recursive: true}));
  await fs.mkdir(path.join(root, 'extension'));
  await Promise.all([
    fs.writeFile(path.join(root, 'package.json'), '{"version":"1.2.3"}\n'),
    fs.writeFile(path.join(root, 'package-lock.json'), '{"version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n'),
    fs.writeFile(path.join(root, 'info.plist'), '<key>version</key><string>1.2.3</string>\n'),
    fs.writeFile(path.join(root, 'extension', 'manifest.json'), '{"version":"1.2.2"}\n'),
  ]);

  await assert.rejects(
    bumpReleaseVersion({release: 'patch', root}),
    /extension manifest version 1\.2\.2 does not match package version 1\.2\.3/u,
  );
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version, '1.2.3');
});
