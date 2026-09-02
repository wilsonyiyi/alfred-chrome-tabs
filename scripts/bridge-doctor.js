#!/usr/bin/env node

import fs from 'node:fs/promises';

import {requestBridge} from '../src/bridge/client.js';
import {EXTENSION_ID} from '../src/bridge/constants.js';
import {nativeHostManifestPath} from '../src/bridge/paths.js';

const manifestPath = nativeHostManifestPath();
let manifestInstalled = false;

try {
  await fs.access(manifestPath);
  manifestInstalled = true;
} catch {}

console.log(`Extension ID: ${EXTENSION_ID}`);
console.log(`Native host manifest: ${manifestInstalled ? manifestPath : 'not installed'}`);

try {
  const result = await requestBridge('ping');
  console.log(`Bridge: ${result.ready ? 'ready' : 'not ready'}`);
} catch (error) {
  console.log(`Bridge: unavailable (${error.message})`);
  process.exitCode = 1;
}
