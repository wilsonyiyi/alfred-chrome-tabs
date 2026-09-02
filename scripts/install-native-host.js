#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {EXTENSION_ORIGIN, NATIVE_HOST_NAME} from '../src/bridge/constants.js';
import {
  nativeHostDirectory,
  nativeHostManifestPath,
} from '../src/bridge/paths.js';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRuntimeDirectory = path.join(projectRoot, 'src', 'bridge');
const hostDirectory = nativeHostDirectory();
const runtimeDirectory = path.join(hostDirectory, 'runtime');
const hostScript = path.join(runtimeDirectory, 'native-host.js');
const wrapperPath = path.join(hostDirectory, 'native-host.sh');
const manifestPath = nativeHostManifestPath();
const wrapper = `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(hostScript)} "$@"\n`;
const manifest = {
  name: NATIVE_HOST_NAME,
  description: 'Chrome Tabs Alfred workflow native messaging bridge',
  path: wrapperPath,
  type: 'stdio',
  allowed_origins: [EXTENSION_ORIGIN],
};

await fs.mkdir(hostDirectory, {recursive: true, mode: 0o700});
await fs.rm(runtimeDirectory, {recursive: true, force: true});
await fs.cp(sourceRuntimeDirectory, runtimeDirectory, {recursive: true});
await fs.writeFile(
  path.join(runtimeDirectory, 'package.json'),
  `${JSON.stringify({private: true, type: 'module'}, null, 2)}\n`,
);
await fs.writeFile(wrapperPath, wrapper, {mode: 0o755});
await fs.chmod(wrapperPath, 0o755);
await fs.mkdir(path.dirname(manifestPath), {recursive: true});
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Native host installed at ${manifestPath}`);
console.log(`Native host runtime copied to ${runtimeDirectory}`);
console.log(`Load unpacked extension from ${path.join(projectRoot, 'extension')}`);
