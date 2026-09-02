import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import test from 'node:test';

import {requestBridge} from '../src/bridge/client.js';
import {EXTENSION_ORIGIN} from '../src/bridge/constants.js';
import {encodeNativeMessage, NativeMessageDecoder} from '../src/bridge/native-protocol.js';
import {bridgeSocketPath} from '../src/bridge/paths.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function waitForSocket(socketPath) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fs.access(socketPath);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Native host did not create ${socketPath}`);
}

test('native host forwards a Unix socket request through Chrome native messaging', async t => {
  const temporaryHome = await fs.mkdtemp('/tmp/alfred-ct-');
  const socketPath = bridgeSocketPath(temporaryHome);
  const host = spawn(
    process.execPath,
    [path.join(projectRoot, 'src', 'bridge', 'native-host.js'), EXTENSION_ORIGIN],
    {
      env: {...process.env, ALFRED_CHROME_TABS_HOME: temporaryHome},
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let stderr = '';
  host.stderr.setEncoding('utf8');
  host.stderr.on('data', chunk => {
    stderr += chunk;
  });

  t.after(async () => {
    if (host.exitCode === null) {
      host.kill('SIGTERM');
      await once(host, 'exit');
    }
    await fs.rm(temporaryHome, {recursive: true, force: true});
  });

  const decoder = new NativeMessageDecoder();
  let hostReady = false;
  host.stdout.on('data', chunk => {
    for (const request of decoder.push(chunk)) {
      if (request.type === 'hostReady') {
        hostReady = true;
        continue;
      }
      host.stdin.write(encodeNativeMessage({
        id: request.id,
        result: {ready: true, echoedMethod: request.method},
      }));
    }
  });

  await waitForSocket(socketPath);
  host.stdin.write(encodeNativeMessage({type: 'ready'}));

  const result = await requestBridge('ping', {}, {socketPath, timeoutMs: 1000});

  assert.equal(hostReady, true);
  assert.deepEqual(result, {ready: true, echoedMethod: 'ping'});
  assert.equal(stderr, '');
});
