import {requestBridge} from './bridge/client.js';

const action = JSON.parse(process.argv[2] ?? '{}');
if (typeof action.method !== 'string') {
  throw new TypeError('A Tab Group action is required');
}

await requestBridge(action.method, action.params ?? {});
