import net from 'node:net';
import {randomUUID} from 'node:crypto';

import {BRIDGE_TIMEOUT_MS} from './constants.js';
import {bridgeSocketPath} from './paths.js';

export function requestBridge(method, params = {}, {
  socketPath = bridgeSocketPath(),
  timeoutMs = BRIDGE_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const id = randomUUID();
    let response = '';
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Chrome bridge request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const finish = callback => value => {
      clearTimeout(timeout);
      callback(value);
    };

    socket.setEncoding('utf8');
    socket.once('connect', () => {
      socket.end(`${JSON.stringify({id, method, params})}\n`);
    });
    socket.on('data', chunk => {
      response += chunk;
    });
    socket.once('end', finish(() => {
      try {
        const message = JSON.parse(response);
        if (message.error) {
          const error = new Error(message.error.message);
          error.code = message.error.code;
          reject(error);
          return;
        }

        resolve(message.result);
      } catch (error) {
        reject(new Error('Chrome bridge returned an invalid response', {cause: error}));
      }
    }));
    socket.once('error', finish(error => {
      if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
        reject(new Error(
          'Chrome Tabs bridge is unavailable. Load the extension and run npm run bridge:install.',
          {cause: error},
        ));
        return;
      }

      reject(error);
    }));
  });
}
