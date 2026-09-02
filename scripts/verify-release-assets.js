#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  ALFRED_WORKFLOW_ASSET,
  CHROME_EXTENSION_ASSET,
} from '../src/release-artifacts.js';
import {
  DEVELOPMENT_BUNDLE_ID,
  PRODUCTION_BUNDLE_ID,
} from '../src/release-package.js';

const artifactsDirectory = path.resolve('.release', 'artifacts');
const expectedAssets = [ALFRED_WORKFLOW_ASSET, CHROME_EXTENSION_ASSET].sort();
const actualAssets = fs.readdirSync(artifactsDirectory).sort();

if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
  throw new Error(`Expected release assets ${expectedAssets.join(', ')}, found ${actualAssets.join(', ')}`);
}

function entries(assetName) {
  return execFileSync(
    'unzip',
    ['-Z1', path.join(artifactsDirectory, assetName)],
    {encoding: 'utf8'},
  ).trim().split('\n');
}

function requireEntries(assetName, requiredEntries) {
  const archiveEntries = new Set(entries(assetName));
  for (const entry of requiredEntries) {
    if (!archiveEntries.has(entry)) {
      throw new Error(`${assetName} is missing ${entry}`);
    }
  }
}

requireEntries(ALFRED_WORKFLOW_ASSET, [
  'icon.png',
  'info.plist',
  'index.js',
  'node_modules/alfy/index.js',
  'src/group-items.js',
]);
requireEntries(CHROME_EXTENSION_ASSET, [
  'README.md',
  'extension/manifest.json',
  'extension/icons/icon-128.png',
  'extension/popup.html',
  'install-native-host.command',
  'scripts/install-native-host.js',
  'src/bridge/native-host.js',
]);

const workflowPlist = execFileSync(
  'unzip',
  ['-p', path.join(artifactsDirectory, ALFRED_WORKFLOW_ASSET), 'info.plist'],
  {encoding: 'utf8'},
);
if (!workflowPlist.includes(PRODUCTION_BUNDLE_ID) || workflowPlist.includes(DEVELOPMENT_BUNDLE_ID)) {
  throw new Error('Alfred release asset does not contain the production bundle ID');
}

console.log(`Verified ${ALFRED_WORKFLOW_ASSET} and ${CHROME_EXTENSION_ASSET}.`);
