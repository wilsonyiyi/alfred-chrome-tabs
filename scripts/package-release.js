#!/usr/bin/env node

import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

import {
  ALFRED_WORKFLOW_ASSET,
  CHROME_EXTENSION_ASSET,
  createZipArchive,
} from '../src/release-artifacts.js';
import {buildReleasePackage} from '../src/release-package.js';

const execFileAsync = promisify(execFile);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = path.join(sourceRoot, '.release');
const workflowDirectory = path.join(releaseRoot, 'package');
const bridgeDirectory = path.join(releaseRoot, 'chrome-extension');
const artifactsDirectory = path.join(releaseRoot, 'artifacts');

await fs.rm(artifactsDirectory, {recursive: true, force: true});
await fs.rm(bridgeDirectory, {recursive: true, force: true});
await buildReleasePackage({sourceRoot, destinationRoot: workflowDirectory});

await execFileAsync(
  'npm',
  ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
  {cwd: workflowDirectory},
);

await fs.mkdir(bridgeDirectory, {recursive: true});
await fs.cp(path.join(sourceRoot, 'extension'), path.join(bridgeDirectory, 'extension'), {recursive: true});
await fs.mkdir(path.join(bridgeDirectory, 'scripts'), {recursive: true});
await fs.cp(
  path.join(sourceRoot, 'scripts', 'install-native-host.js'),
  path.join(bridgeDirectory, 'scripts', 'install-native-host.js'),
);
await fs.cp(path.join(sourceRoot, 'src', 'bridge'), path.join(bridgeDirectory, 'src', 'bridge'), {recursive: true});
await fs.cp(
  path.join(sourceRoot, 'install-native-host.command'),
  path.join(bridgeDirectory, 'install-native-host.command'),
);
await fs.cp(
  path.join(sourceRoot, 'extension', 'README.md'),
  path.join(bridgeDirectory, 'README.md'),
);

const artifacts = await Promise.all([
  createZipArchive(workflowDirectory, path.join(artifactsDirectory, ALFRED_WORKFLOW_ASSET)),
  createZipArchive(bridgeDirectory, path.join(artifactsDirectory, CHROME_EXTENSION_ASSET)),
]);

for (const artifact of artifacts) {
  console.log(`Created ${artifact.destinationPath} (${artifact.bytes} bytes)`);
}
