#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

import {EXTENSION_ORIGIN} from './constants.js';
import {bridgeDirectory, bridgeSocketPath} from './paths.js';
import {encodeNativeMessage, NativeMessageDecoder} from './native-protocol.js';

const callerOrigin = process.argv[2];
if (callerOrigin && callerOrigin !== EXTENSION_ORIGIN) {
  process.stderr.write(`Rejected native messaging caller: ${callerOrigin}\n`);
  process.exit(1);
}

const socketPath = bridgeSocketPath();
const pending = new Map();
const decoder = new NativeMessageDecoder();
let extensionReady = false;

function writeNative(message) {
  process.stdout.write(encodeNativeMessage(message));
}

function reply(socket, message) {
  socket.end(`${JSON.stringify(message)}\n`);
}

function handleExtensionMessage(message) {
  if (message.type === 'ready') {
    extensionReady = true;
    writeNative({type: 'hostReady'});
    return;
  }

  const request = pending.get(message.id);
  if (!request) {
    return;
  }

  clearTimeout(request.timeout);
  pending.delete(message.id);
  reply(request.socket, message);
}

process.stdin.on('data', chunk => {
  try {
    for (const message of decoder.push(chunk)) {
      handleExtensionMessage(message);
    }
  } catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
  }
});

process.stdin.once('end', () => {
  process.exit(0);
});

await fs.mkdir(bridgeDirectory(), {recursive: true, mode: 0o700});
try {
  const stats = await fs.lstat(socketPath);
  if (!stats.isSocket()) {
    throw new Error(`Refusing to replace non-socket bridge path: ${socketPath}`);
  }
  await fs.unlink(socketPath);
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const server = net.createServer({allowHalfOpen: true}, socket => {
  socket.setEncoding('utf8');
  let requestText = '';
  let rejected = false;

  socket.on('data', chunk => {
    if (rejected) {
      return;
    }
    requestText += chunk;
    if (requestText.length > 1024 * 1024) {
      rejected = true;
      reply(socket, {error: {code: 'REQUEST_TOO_LARGE', message: 'Bridge request is too large'}});
    }
  });

  socket.once('end', () => {
    if (rejected) {
      return;
    }
    let request;
    try {
      request = JSON.parse(requestText.trim());
    } catch {
      reply(socket, {error: {code: 'INVALID_REQUEST', message: 'Bridge request must be valid JSON'}});
      return;
    }

    if (typeof request.id !== 'string' || typeof request.method !== 'string') {
      reply(socket, {
        id: request.id,
        error: {code: 'INVALID_REQUEST', message: 'Bridge request requires string id and method'},
      });
      return;
    }

    if (!extensionReady) {
      reply(socket, {
        id: request.id,
        error: {code: 'EXTENSION_NOT_READY', message: 'Chrome extension bridge is not ready'},
      });
      return;
    }

    const timeout = setTimeout(() => {
      pending.delete(request.id);
      reply(socket, {
        id: request.id,
        error: {code: 'EXTENSION_TIMEOUT', message: 'Chrome extension did not respond'},
      });
    }, 5000);
    pending.set(request.id, {socket, timeout});
    writeNative(request);
  });
});

server.listen(socketPath, async () => {
  await fs.chmod(socketPath, 0o600);
});

function cleanup() {
  server.close();
  try {
    fsSync.unlinkSync(socketPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      process.stderr.write(`Failed to remove bridge socket: ${error.message}\n`);
    }
  }
}

process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});
process.once('exit', cleanup);
