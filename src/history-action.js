import {requestBridge} from './bridge/client.js';

const action = JSON.parse(process.argv[2] ?? '{}');
if (action.method !== 'openHistoryItem') {
  throw new TypeError('A Chrome History result is required');
}

await requestBridge(action.method, action.params ?? {});
